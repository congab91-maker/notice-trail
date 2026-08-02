import React, { useEffect, useState } from 'react';
import { FileSearch, Globe, Wallet as WalletIcon } from 'lucide-react';
import { CONTRACT_ADDRESS, IS_CONFIGURED, verifyAndConnectWallet } from '../lib/genlayer';
import {
  clearRememberedWallet,
  WALLET_CONNECTED_EVENT,
  WALLET_DISCONNECTED_EVENT,
  type WalletConnection,
} from '../lib/walletProviders';

interface HeaderProps {
  currentTab: 'overview' | 'ledger' | 'register';
  onNavigate: (tab: 'overview' | 'ledger' | 'register') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onNavigate }) => {
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  useEffect(() => {
    const connected = (event: Event) => {
      const detail = (event as CustomEvent<WalletConnection>).detail;
      if (detail?.account && detail.wallet && detail.provider) setWallet(detail);
      setWalletError('');
    };
    const disconnected = () => setWallet(null);
    window.addEventListener(WALLET_CONNECTED_EVENT, connected as EventListener);
    window.addEventListener(WALLET_DISCONNECTED_EVENT, disconnected);
    return () => {
      window.removeEventListener(WALLET_CONNECTED_EVENT, connected as EventListener);
      window.removeEventListener(WALLET_DISCONNECTED_EVENT, disconnected);
    };
  }, []);

  useEffect(() => {
    const provider = wallet?.provider;
    if (!provider?.on) return;

    const accountsChanged = (...args: unknown[]) => {
      const accounts = args[0];
      if (!Array.isArray(accounts) || accounts.length === 0) return clearRememberedWallet();
      const account = accounts[0];
      if (typeof account !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(account)) return;
      if (wallet && account.toLowerCase() !== wallet.account.toLowerCase()) {
        clearRememberedWallet();
        setWalletMenuOpen(false);
        setWalletError('Wallet account changed. Connect and sign again.');
      }
    };

    provider.on('accountsChanged', accountsChanged);
    return () => provider.removeListener?.('accountsChanged', accountsChanged);
  }, [wallet]);

  const handleWalletAction = async () => {
    setWalletBusy(true);
    setWalletError('');
    try {
      await verifyAndConnectWallet();
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : 'Wallet connection failed.');
    } finally {
      setWalletBusy(false);
    }
  };

  const handleDisconnect = () => {
    clearRememberedWallet();
    setWalletMenuOpen(false);
    setWalletError('');
  };

  return (
    <header className="notice-header">
      <div className="container notice-header__inner">
        <div className="notice-header__brand">
          <div className="notice-header__logo" aria-hidden="true">
            <FileSearch size={24} color="#60a5fa" />
          </div>
          <div className="notice-header__identity">
            <div className="notice-header__title-row">
              <h1>NoticeTrail</h1>
              <span className="badge badge-registered" style={{ fontSize: '0.7rem' }}>
                Policy V1
              </span>
            </div>
            <p>Public-Record Comparison Ledger</p>
          </div>
        </div>

        <nav className="notice-header__nav" aria-label="Primary navigation">
          <button
            className={`btn ${currentTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onNavigate('overview')}
            style={{ padding: '0.4rem 0.875rem', fontSize: '0.8125rem' }}
          >
            Overview & Rules
          </button>
          <button
            className={`btn ${currentTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onNavigate('ledger')}
            style={{ padding: '0.4rem 0.875rem', fontSize: '0.8125rem' }}
          >
            Public Ledger
          </button>
          <button
            className={`btn ${currentTab === 'register' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onNavigate('register')}
            style={{ padding: '0.4rem 0.875rem', fontSize: '0.8125rem' }}
          >
            + Register Record
          </button>
        </nav>

        <div className="notice-header__wallet-area">
          <div className="notice-header__network">
            <Globe size={14} color={IS_CONFIGURED ? '#10b981' : '#94a3b8'} />
            <span>Studionet</span>
          </div>
          {IS_CONFIGURED && (
            <span
              className="notice-header__contract"
              title={CONTRACT_ADDRESS}
            >
              {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}
            </span>
          )}
          <div className="notice-header__wallet-control">
            <button
              type="button"
              onClick={() => wallet ? setWalletMenuOpen((open) => !open) : handleWalletAction()}
              disabled={walletBusy}
              aria-expanded={wallet ? walletMenuOpen : undefined}
              title={walletError || (wallet
                ? `${wallet.wallet.name}: ${wallet.account}`
                : 'Connect and sign with an EVM wallet')}
              className="btn btn-secondary notice-header__wallet-button"
            >
              <WalletIcon size={14} />
              {walletBusy
                ? 'Connecting...'
                : wallet
                  ? `${wallet.wallet.name} ${wallet.account.slice(0, 6)}...${wallet.account.slice(-4)}`
                  : 'Connect Wallet'}
            </button>
            {wallet && walletMenuOpen && (
              <div className="notice-header__wallet-menu">
                <button type="button" onClick={handleDisconnect}>Disconnect</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {walletError && (
        <div role="alert" className="container notice-header__error">
          {walletError}
        </div>
      )}
    </header>
  );
};
