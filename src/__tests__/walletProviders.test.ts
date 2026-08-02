import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertWalletConnectionCurrent,
  connectWalletCandidate,
  discoverWalletProviders,
  filterCompatibleWalletProviders,
  selectWalletProvider,
  type BrowserEthereumProvider,
  type WalletNetworkConfig,
  type WalletProviderCandidate,
} from '../lib/walletProviders';

const ACCOUNT = '0x2222222222222222222222222222222222222222';
const OTHER_ACCOUNT = '0x3333333333333333333333333333333333333333';
const SIGNATURE = `0x${'11'.repeat(65)}`;
const STUDIONET: WalletNetworkConfig = {
  chainId: 61999,
  chainIdHex: '0xf22f',
  chainName: 'GenLayer Studionet',
  rpcUrl: 'https://studio.genlayer.com/api',
  explorerUrl: 'https://explorer-studio.genlayer.com',
};

function providerWith(
  handler: (args: { method: string; params?: unknown[] }) => Promise<unknown>
): BrowserEthereumProvider {
  return { request: vi.fn(handler) };
}

function candidate(
  name: string,
  rdns: string,
  provider: BrowserEthereumProvider,
  source: 'eip6963' | 'legacy' = 'eip6963'
): WalletProviderCandidate {
  return {
    provider,
    source,
    info: { uuid: `${rdns}-uuid`, name, rdns, icon: '' },
  };
}

function announceOnRequest(announcements: WalletProviderCandidate[]): () => void {
  const listener = () => {
    for (const item of announcements) {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: { info: item.info, provider: item.provider },
      }));
    }
  };
  window.addEventListener('eip6963:requestProvider', listener);
  return () => window.removeEventListener('eip6963:requestProvider', listener);
}

beforeEach(() => {
  window.sessionStorage.clear();
  Reflect.deleteProperty(window, 'ethereum');
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, 'ethereum');
});

describe('multi-wallet EIP-1193 provider isolation', () => {
  it('discovers concurrent EIP-6963 wallets and prefers an announcement over the duplicate legacy provider', async () => {
    const metamask = providerWith(async () => '0xf22f');
    const phantom = providerWith(async () => '0xf22f');
    const eipMetaMask = candidate('MetaMask', 'io.metamask', metamask);
    const eipPhantom = candidate('Phantom', 'app.phantom', phantom);
    const removeAnnouncements = announceOnRequest([eipMetaMask, eipPhantom]);
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: { request: vi.fn(), providers: [{ request: vi.fn(), isMetaMask: true }, { request: vi.fn(), isPhantom: true }] },
    });

    const discovered = await discoverWalletProviders(0);
    removeAnnouncements();

    expect(discovered.map((item) => item.info.rdns)).toEqual(
      expect.arrayContaining(['app.phantom', 'io.metamask'])
    );
    expect(discovered.every((item) => item.source === 'eip6963')).toBe(true);
    expect(discovered.find((item) => item.info.rdns === 'io.metamask')?.provider).toBe(metamask);
  });

  it('filters out non-EVM or broken injected providers without disturbing compatible wallets', async () => {
    const compatible = candidate('Compatible', 'wallet.compatible', providerWith(async () => '0xf22f'));
    const nonEvm = candidate('Non EVM', 'wallet.nonevm', providerWith(async () => ({ chain: 'sui' })));
    const broken = candidate('Broken', 'wallet.broken', providerWith(async () => { throw new Error('unsupported'); }));

    await expect(filterCompatibleWalletProviders([compatible, nonEvm, broken])).resolves.toEqual([compatible]);
  });

  it('shows an explicit chooser when multiple compatible wallets are installed', async () => {
    const first = candidate('MetaMask', 'io.metamask', providerWith(async () => '0xf22f'));
    const second = candidate('Phantom', 'app.phantom', providerWith(async () => '0xf22f'));
    const removeAnnouncements = announceOnRequest([first, second]);

    const selection = selectWalletProvider(true);
    await new Promise((resolve) => window.setTimeout(resolve, 170));
    const phantomButton = document.querySelector<HTMLButtonElement>('[aria-label="Connect Phantom"]');
    expect(phantomButton).not.toBeNull();
    phantomButton?.click();

    await expect(selection).resolves.toEqual(expect.objectContaining({ provider: second.provider }));
    expect(window.sessionStorage.getItem('notice-trail:selected-wallet-rdns')).toBe('app.phantom');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    removeAnnouncements();
  });

  it('routes all account and network requests only to the explicitly selected wallet', async () => {
    const selected = providerWith(async ({ method }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [ACCOUNT];
      if (method === 'eth_chainId') return '0xf22f';
      if (method === 'personal_sign') return SIGNATURE;
      throw new Error(`Unexpected method: ${method}`);
    });
    const unrelated = providerWith(async () => { throw new Error('must never be called'); });

    const connection = await connectWalletCandidate(candidate('Selected', 'wallet.selected', selected), STUDIONET);
    await assertWalletConnectionCurrent(connection, STUDIONET);

    expect(connection.account).toBe(ACCOUNT);
    expect(selected.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    expect(selected.request).toHaveBeenCalledWith({ method: 'eth_accounts' });
    expect(unrelated.request).not.toHaveBeenCalled();
    expect(selected.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_getSnaps' }));
  });

  it('forces a wallet to reopen account permissions before reconnecting to a different account', async () => {
    let accountSelectionRequested = false;
    const selected = providerWith(async ({ method, params }) => {
      if (method === 'wallet_requestPermissions') {
        accountSelectionRequested = true;
        expect(params).toEqual([{ eth_accounts: {} }]);
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_requestAccounts') {
        return [accountSelectionRequested ? OTHER_ACCOUNT : ACCOUNT];
      }
      if (method === 'eth_chainId') return '0xf22f';
      if (method === 'personal_sign') return SIGNATURE;
      throw new Error(`Unexpected method: ${method}`);
    });

    const connection = await connectWalletCandidate(
      candidate('Generic Wallet', 'wallet.generic', selected),
      STUDIONET,
      { forceAccountSelection: true, previousAccount: ACCOUNT }
    );

    expect(connection.account).toBe(OTHER_ACCOUNT);
    expect(selected.request).toHaveBeenNthCalledWith(1, {
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
    expect(selected.request).toHaveBeenNthCalledWith(2, { method: 'eth_requestAccounts' });
  });

  it('uses only eth_requestAccounts for OKX because it performs the permission request internally', async () => {
    const selected = providerWith(async ({ method }) => {
      if (method === 'wallet_requestPermissions') throw new Error('must not be called for OKX');
      if (method === 'eth_requestAccounts') return [OTHER_ACCOUNT];
      if (method === 'eth_chainId') return '0xf22f';
      if (method === 'personal_sign') return SIGNATURE;
      throw new Error(`Unexpected method: ${method}`);
    });

    const connection = await connectWalletCandidate(
      candidate('OKX Wallet', 'com.okex.wallet', selected),
      STUDIONET,
      { forceAccountSelection: true, previousAccount: ACCOUNT }
    );

    expect(connection.account).toBe(OTHER_ACCOUNT);
    expect(selected.request).toHaveBeenNthCalledWith(1, { method: 'eth_requestAccounts' });
    expect(selected.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_requestPermissions' }));
  });

  it('times out an unresponsive wallet request instead of leaving the UI busy indefinitely', async () => {
    const selected = providerWith(() => new Promise(() => undefined));

    await expect(connectWalletCandidate(
      candidate('OKX Wallet', 'com.okex.wallet', selected),
      STUDIONET,
      { forceAccountSelection: true, previousAccount: ACCOUNT, requestTimeoutMs: 5 }
    )).rejects.toThrow('WALLET_REQUEST_TIMEOUT');
  });

  it('allows reconnecting the same account when the user signs a fresh session challenge', async () => {
    const selected = providerWith(async ({ method }) => {
      if (method === 'wallet_requestPermissions') return [];
      if (method === 'eth_requestAccounts') return [ACCOUNT];
      if (method === 'eth_chainId') return '0xf22f';
      if (method === 'personal_sign') return SIGNATURE;
      throw new Error(`Unexpected method: ${method}`);
    });

    await expect(connectWalletCandidate(
      candidate('OKX Wallet', 'com.okex.wallet', selected),
      STUDIONET,
      { forceAccountSelection: true, previousAccount: ACCOUNT }
    )).resolves.toEqual(expect.objectContaining({ account: ACCOUNT }));
    expect(selected.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'personal_sign' }));
  });

  it('requires a valid user signature before publishing a connected session', async () => {
    const selected = providerWith(async ({ method }) => {
      if (method === 'eth_requestAccounts') return [ACCOUNT];
      if (method === 'eth_chainId') return '0xf22f';
      if (method === 'personal_sign') {
        const error = new Error('User rejected') as Error & { code: number };
        error.code = 4001;
        throw error;
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    await expect(connectWalletCandidate(candidate('OKX Wallet', 'com.okex.wallet', selected), STUDIONET))
      .rejects.toThrow('WALLET_SIGNATURE_REJECTED');
  });

  it('adds Studionet after a 4902 response, switches, and verifies the resulting chain', async () => {
    let chainId = '0x1';
    const provider = providerWith(async ({ method }) => {
      if (method === 'eth_requestAccounts') return [ACCOUNT];
      if (method === 'eth_chainId') return chainId;
      if (method === 'wallet_addEthereumChain') return null;
      if (method === 'wallet_switchEthereumChain') {
        const switchCalls = (provider.request as ReturnType<typeof vi.fn>).mock.calls
          .filter(([args]) => args.method === 'wallet_switchEthereumChain').length;
        if (switchCalls === 1) {
          const error = new Error('unknown chain') as Error & { code: number };
          error.code = 4902;
          throw error;
        }
        chainId = '0xf22f';
        return null;
      }
      if (method === 'personal_sign') return SIGNATURE;
      return null;
    });

    await expect(connectWalletCandidate(candidate('Wallet', 'wallet.test', provider), STUDIONET))
      .resolves.toEqual(expect.objectContaining({ account: ACCOUNT, provider }));
    expect(provider.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_addEthereumChain' }));
    expect(provider.request).toHaveBeenCalledTimes(7);
  });

  it('fails closed if the wallet account changes before transaction submission', async () => {
    const provider = providerWith(async ({ method }) => {
      if (method === 'eth_accounts') return [OTHER_ACCOUNT];
      if (method === 'eth_chainId') return '0xf22f';
      return [ACCOUNT];
    });
    const connection = { account: ACCOUNT, provider, wallet: candidate('Wallet', 'wallet.test', provider).info };

    await expect(assertWalletConnectionCurrent(connection, STUDIONET)).rejects.toThrow('WALLET_ACCOUNT_CHANGED');
  });

  it('fails closed if the selected wallet leaves Studionet before transaction submission', async () => {
    const provider = providerWith(async ({ method }) => method === 'eth_accounts' ? [ACCOUNT] : '0x1');
    const connection = { account: ACCOUNT, provider, wallet: candidate('Wallet', 'wallet.test', provider).info };

    await expect(assertWalletConnectionCurrent(connection, STUDIONET)).rejects.toThrow('WRONG_NETWORK');
  });
});
