export interface BrowserEthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
  isPhantom?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: BrowserEthereumProvider[];
}

export interface WalletProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface WalletProviderCandidate {
  info: WalletProviderInfo;
  provider: BrowserEthereumProvider;
  source: 'eip6963' | 'legacy';
}

export interface WalletConnection {
  account: string;
  provider: BrowserEthereumProvider;
  wallet: WalletProviderInfo;
}

export interface WalletNetworkConfig {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
}

export interface ConnectWalletOptions {
  forceAccountSelection?: boolean;
  previousAccount?: string;
  requestTimeoutMs?: number;
}

interface Eip6963Announcement {
  info: WalletProviderInfo;
  provider: BrowserEthereumProvider;
}

const SESSION_WALLET_KEY = 'notice-trail:selected-wallet-rdns';
export const WALLET_CONNECTED_EVENT = 'notice-trail:wallet-connected';
export const WALLET_DISCONNECTED_EVENT = 'notice-trail:wallet-disconnected';
let activeWalletConnection: WalletConnection | null = null;

function normalizeRdns(value: string): string {
  return value.trim().toLowerCase();
}

function inferLegacyInfo(provider: BrowserEthereumProvider, index: number): WalletProviderInfo {
  if (provider.isPhantom) {
    return { uuid: `legacy-phantom-${index}`, name: 'Phantom', icon: '', rdns: 'app.phantom' };
  }
  if (provider.isRabby) {
    return { uuid: `legacy-rabby-${index}`, name: 'Rabby', icon: '', rdns: 'io.rabby' };
  }
  if (provider.isCoinbaseWallet) {
    return { uuid: `legacy-coinbase-${index}`, name: 'Coinbase Wallet', icon: '', rdns: 'com.coinbase.wallet' };
  }
  if (provider.isBraveWallet) {
    return { uuid: `legacy-brave-${index}`, name: 'Brave Wallet', icon: '', rdns: 'com.brave.wallet' };
  }
  if (provider.isMetaMask) {
    return { uuid: `legacy-metamask-${index}`, name: 'MetaMask', icon: '', rdns: 'io.metamask' };
  }
  return {
    uuid: `legacy-evm-${index}`,
    name: `EVM Wallet ${index + 1}`,
    icon: '',
    rdns: `unknown.evm-wallet-${index + 1}`,
  };
}

function providerErrorCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as { code?: unknown; data?: { originalError?: { code?: unknown } } };
  if (typeof candidate.code === 'number') return candidate.code;
  const nestedCode = candidate.data?.originalError?.code;
  return typeof nestedCode === 'number' ? nestedCode : undefined;
}

function walletError(prefix: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown wallet error');
  return new Error(`${prefix}: ${message}`);
}

async function requestWithTimeout(
  provider: BrowserEthereumProvider,
  args: { method: string; params?: unknown[] },
  timeoutMs: number
): Promise<unknown> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      provider.request(args),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(
          `WALLET_REQUEST_TIMEOUT: ${args.method} did not respond within ${Math.ceil(timeoutMs / 1000)} seconds. ` +
          'Open the wallet extension, cancel any pending request, and try again.'
        )), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export async function discoverWalletProviders(discoveryWindowMs = 150): Promise<WalletProviderCandidate[]> {
  if (typeof window === 'undefined') return [];

  const announced: WalletProviderCandidate[] = [];
  const onAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Announcement>).detail;
    if (!detail?.provider || typeof detail.provider.request !== 'function' || !detail.info) return;
    announced.push({
      provider: detail.provider,
      source: 'eip6963',
      info: {
        uuid: String(detail.info.uuid || ''),
        name: String(detail.info.name || 'EVM Wallet'),
        icon: String(detail.info.icon || ''),
        rdns: normalizeRdns(String(detail.info.rdns || 'unknown.evm-wallet')),
      },
    });
  };

  window.addEventListener('eip6963:announceProvider', onAnnouncement as EventListener);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  await new Promise((resolve) => window.setTimeout(resolve, discoveryWindowMs));
  window.removeEventListener('eip6963:announceProvider', onAnnouncement as EventListener);

  const globalProvider = (window as Window & { ethereum?: BrowserEthereumProvider }).ethereum;
  const legacyProviders = globalProvider?.providers?.length
    ? globalProvider.providers
    : globalProvider
      ? [globalProvider]
      : [];

  const allCandidates: WalletProviderCandidate[] = [
    ...announced,
    ...legacyProviders
      .filter((provider) => provider && typeof provider.request === 'function')
      .map((provider, index) => ({
        provider,
        source: 'legacy' as const,
        info: inferLegacyInfo(provider, index),
      })),
  ];

  const deduped = new Map<string, WalletProviderCandidate>();
  for (const candidate of allCandidates) {
    const key = normalizeRdns(candidate.info.rdns);
    const existing = deduped.get(key);
    if (!existing || (existing.source === 'legacy' && candidate.source === 'eip6963')) {
      deduped.set(key, candidate);
    }
  }
  return [...deduped.values()].sort((left, right) => left.info.name.localeCompare(right.info.name));
}

export async function filterCompatibleWalletProviders(
  candidates: WalletProviderCandidate[]
): Promise<WalletProviderCandidate[]> {
  const probed = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const chainId = await candidate.provider.request({ method: 'eth_chainId' });
        return typeof chainId === 'string' && /^0x[0-9a-f]+$/i.test(chainId) ? candidate : null;
      } catch {
        return null;
      }
    })
  );
  return probed.filter((candidate): candidate is WalletProviderCandidate => candidate !== null);
}

function loadRememberedWalletRdns(): string {
  try {
    return normalizeRdns(window.sessionStorage.getItem(SESSION_WALLET_KEY) || '');
  } catch {
    return '';
  }
}

function rememberWallet(candidate: WalletProviderCandidate): void {
  try {
    window.sessionStorage.setItem(SESSION_WALLET_KEY, normalizeRdns(candidate.info.rdns));
  } catch {
    // Session persistence is optional; provider selection still works.
  }
}

export function clearRememberedWallet(): void {
  activeWalletConnection = null;
  try {
    window.sessionStorage.removeItem(SESSION_WALLET_KEY);
  } catch {
    // Nothing else to clear.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WALLET_DISCONNECTED_EVENT));
}

export function getActiveWalletConnection(): WalletConnection | null {
  return activeWalletConnection;
}

function connectionChallenge(account: string): string {
  const nonce = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return [
    'NoticeTrail wallet connection',
    `Origin: ${window.location.origin}`,
    `Account: ${account}`,
    `Nonce: ${nonce}`,
    'This signature authenticates this browser session and does not submit a transaction.',
  ].join('\n');
}

function utf8ToHex(value: string): string {
  return `0x${Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function showWalletChooser(candidates: WalletProviderCandidate[]): Promise<WalletProviderCandidate> {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'presentation');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '10000', background: 'rgba(2, 6, 23, 0.78)',
      display: 'grid', placeItems: 'center', padding: '1rem',
    });

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'notice-trail-wallet-title');
    Object.assign(dialog.style, {
      width: 'min(440px, 100%)', maxHeight: '80vh', overflowY: 'auto', background: '#121824',
      color: '#f8fafc', border: '1px solid #334155', borderRadius: '10px', padding: '1.25rem',
      boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
    });

    const title = document.createElement('h2');
    title.id = 'notice-trail-wallet-title';
    title.textContent = 'Choose an EVM wallet';
    Object.assign(title.style, { margin: '0 0 0.4rem', fontSize: '1.1rem' });

    const description = document.createElement('p');
    description.textContent = 'Select the wallet that will receive all account, network, and signing requests.';
    Object.assign(description.style, { margin: '0 0 1rem', color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.45' });

    const list = document.createElement('div');
    Object.assign(list.style, { display: 'grid', gap: '0.65rem' });

    const cleanup = () => overlay.remove();
    for (const candidate of candidates) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Connect ${candidate.info.name}`);
      Object.assign(button.style, {
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left',
        padding: '0.8rem', color: '#f8fafc', background: '#171f2b', border: '1px solid #334155',
        borderRadius: '7px', cursor: 'pointer',
      });
      if (candidate.info.icon) {
        const icon = document.createElement('img');
        icon.src = candidate.info.icon;
        icon.alt = '';
        icon.width = 30;
        icon.height = 30;
        icon.style.borderRadius = '7px';
        button.appendChild(icon);
      }
      const label = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = candidate.info.name;
      const rdns = document.createElement('small');
      rdns.textContent = candidate.info.rdns;
      Object.assign(rdns.style, { display: 'block', marginTop: '0.15rem', color: '#94a3b8' });
      label.append(name, rdns);
      button.appendChild(label);
      button.addEventListener('click', () => {
        rememberWallet(candidate);
        cleanup();
        resolve(candidate);
      });
      list.appendChild(button);
    }

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    Object.assign(cancel.style, {
      marginTop: '1rem', width: '100%', padding: '0.65rem', color: '#cbd5e1', background: 'transparent',
      border: '1px solid #334155', borderRadius: '7px', cursor: 'pointer',
    });
    cancel.addEventListener('click', () => {
      cleanup();
      reject(new Error('WALLET_SELECTION_CANCELLED: Wallet selection was cancelled.'));
    });

    dialog.append(title, description, list, cancel);
    overlay.appendChild(dialog);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cancel.click();
    });
    document.body.appendChild(overlay);
    candidates.length > 0 && (list.firstElementChild as HTMLButtonElement | null)?.focus();
  });
}

export async function selectWalletProvider(forceSelection = false): Promise<WalletProviderCandidate> {
  const discovered = await discoverWalletProviders();
  if (discovered.length === 0) {
    throw new Error('NO_EVM_WALLET: No browser wallet provider was detected.');
  }
  const compatible = await filterCompatibleWalletProviders(discovered);
  if (compatible.length === 0) {
    throw new Error('UNSUPPORTED_WALLET: Installed wallet providers do not expose a compatible EVM interface.');
  }

  const remembered = forceSelection ? '' : loadRememberedWalletRdns();
  const rememberedCandidate = compatible.find((candidate) => normalizeRdns(candidate.info.rdns) === remembered);
  if (rememberedCandidate) return rememberedCandidate;
  if (compatible.length === 1) {
    rememberWallet(compatible[0]);
    return compatible[0];
  }
  return showWalletChooser(compatible);
}

function isTargetChain(chainId: unknown, config: WalletNetworkConfig): boolean {
  return (
    typeof chainId === 'string' &&
    (chainId.toLowerCase() === config.chainIdHex.toLowerCase() || Number.parseInt(chainId, 16) === config.chainId)
  );
}

export async function connectWalletCandidate(
  candidate: WalletProviderCandidate,
  config: WalletNetworkConfig,
  options: ConnectWalletOptions = {}
): Promise<WalletConnection> {
  const { provider } = candidate;
  const requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
  const normalizedRdns = normalizeRdns(candidate.info.rdns);
  const isOkxWallet = normalizedRdns.includes('okx') || normalizedRdns.includes('okex');
  if (options.forceAccountSelection && !isOkxWallet) {
    try {
      await requestWithTimeout(provider, {
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      }, requestTimeoutMs);
    } catch (error) {
      const code = providerErrorCode(error);
      if (code === 4001) {
        throw new Error('WALLET_ACCOUNT_SELECTION_REJECTED: Account selection was rejected.');
      }
      // EIP-2255 is the standard account re-selection path, but some otherwise
      // compatible EIP-1193 wallets do not implement it. Continue to
      // eth_requestAccounts so a manually selected active account still works.
      if (code !== -32601 && code !== 4200) {
        throw walletError('WALLET_ACCOUNT_SELECTION_FAILED', error);
      }
    }
  }

  let accounts: unknown;
  try {
    // OKX documents that eth_requestAccounts performs the eth_accounts
    // permission request internally, so issuing both calls can leave two
    // overlapping extension approvals and an indefinitely busy UI.
    accounts = await requestWithTimeout(
      provider,
      { method: 'eth_requestAccounts' },
      requestTimeoutMs
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('WALLET_REQUEST_TIMEOUT:')) throw error;
    if (providerErrorCode(error) === 4001) throw new Error('WALLET_ACCESS_REJECTED: Account access was rejected.');
    throw walletError('UNSUPPORTED_WALLET', error);
  }
  if (!Array.isArray(accounts) || typeof accounts[0] !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(accounts[0])) {
    throw new Error('UNSUPPORTED_WALLET: The selected wallet did not provide a valid EVM account.');
  }

  const account = accounts[0];
  let currentChainId = await provider.request({ method: 'eth_chainId' });
  if (!isTargetChain(currentChainId, config)) {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainIdHex }],
      });
    } catch (error) {
      if (providerErrorCode(error) === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: config.chainIdHex,
            chainName: config.chainName,
            rpcUrls: [config.rpcUrl],
            nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
            blockExplorerUrls: [config.explorerUrl],
          }],
        });
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: config.chainIdHex }],
        });
      } else if (providerErrorCode(error) === 4001) {
        throw new Error('NETWORK_SWITCH_REJECTED: Studionet network switching was rejected.');
      } else {
        throw walletError('UNSUPPORTED_WALLET: The selected wallet cannot switch to Studionet', error);
      }
    }
    currentChainId = await provider.request({ method: 'eth_chainId' });
  }
  if (!isTargetChain(currentChainId, config)) {
    throw new Error(`WRONG_NETWORK: Wallet remained on chain ${String(currentChainId)} after switching.`);
  }

  let signature: unknown;
  try {
    signature = await requestWithTimeout(provider, {
      method: 'personal_sign',
      params: [utf8ToHex(connectionChallenge(account)), account],
    }, requestTimeoutMs);
  } catch (error) {
    if (providerErrorCode(error) === 4001) {
      throw new Error('WALLET_SIGNATURE_REJECTED: Wallet connection signature was rejected.');
    }
    if (error instanceof Error && error.message.startsWith('WALLET_REQUEST_TIMEOUT:')) throw error;
    throw walletError('WALLET_SIGNATURE_FAILED', error);
  }
  if (typeof signature !== 'string' || !/^0x[0-9a-f]+$/i.test(signature)) {
    throw new Error('WALLET_SIGNATURE_FAILED: The wallet did not return a valid connection signature.');
  }

  const connection = { account, provider, wallet: candidate.info };
  activeWalletConnection = connection;
  window.dispatchEvent(new CustomEvent(WALLET_CONNECTED_EVENT, {
    detail: connection,
  }));
  return connection;
}

export async function assertWalletConnectionCurrent(
  connection: WalletConnection,
  config: WalletNetworkConfig
): Promise<void> {
  const accounts = await connection.provider.request({ method: 'eth_accounts' });
  if (
    !Array.isArray(accounts) ||
    typeof accounts[0] !== 'string' ||
    accounts[0].toLowerCase() !== connection.account.toLowerCase()
  ) {
    throw new Error('WALLET_ACCOUNT_CHANGED: The selected wallet account changed. Reconnect before submitting.');
  }
  const chainId = await connection.provider.request({ method: 'eth_chainId' });
  if (!isTargetChain(chainId, config)) {
    throw new Error('WRONG_NETWORK: The selected wallet left GenLayer Studionet. Reconnect before submitting.');
  }
}
