import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/genlayer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/genlayer')>();
  return {
    ...mod,
    IS_CONFIGURED: true,
  };
});

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../App';
import { ConfigMissingBanner } from '../components/ConfigMissingBanner';
import { DisclaimerBanner } from '../components/DisclaimerBanner';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { TransactionStatusPanel } from '../components/TransactionStatusPanel';
import { RegisterRecordForm } from '../components/RegisterRecordForm';
import { REASON_CODES_MAP } from '../constants/reasonCodes';
import { AssessmentSnapshot } from '../types';
import { STUDIONET_EXPLORER_URL } from '../lib/genlayer';
import { Header } from '../components/Header';
import {
  WALLET_CONNECTED_EVENT,
  type BrowserEthereumProvider,
} from '../lib/walletProviders';

describe('NoticeTrail Frontend Component & Accessibility Suite', () => {
  it('invalidates the signed session when the provider account changes', async () => {
    let accountsChanged: ((...args: unknown[]) => void) | undefined;
    const provider: BrowserEthereumProvider = {
      request: vi.fn(),
      on: vi.fn((event, listener) => {
        if (event === 'accountsChanged') accountsChanged = listener;
      }),
      removeListener: vi.fn(),
    };

    render(<Header currentTab="overview" onNavigate={vi.fn()} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent(WALLET_CONNECTED_EVENT, {
        detail: {
          account: '0x2222222222222222222222222222222222222222',
          provider,
          wallet: { uuid: 'okx', name: 'OKX Wallet', icon: '', rdns: 'com.okex.wallet' },
        },
      }));
    });

    expect(screen.getByRole('button', { name: /OKX Wallet 0x2222\.\.\.2222/i })).toBeInTheDocument();
    await act(async () => {
      accountsChanged?.(['0x3333333333333333333333333333333333333333']);
    });
    expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/connect and sign again/i);
  });

  it('shows Disconnect after clicking a connected wallet and returns to Connect Wallet', async () => {
    const provider: BrowserEthereumProvider = { request: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    render(<Header currentTab="overview" onNavigate={vi.fn()} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent(WALLET_CONNECTED_EVENT, {
        detail: {
          account: '0x2222222222222222222222222222222222222222',
          provider,
          wallet: { uuid: 'okx', name: 'OKX Wallet', icon: '', rdns: 'com.okex.wallet' },
        },
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: /OKX Wallet 0x2222\.\.\.2222/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Disconnect$/i }));
    expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument();
  });

  it('renders DisclaimerBanner with neutral non-legal disclaimer', () => {
    render(<DisclaimerBanner />);
    expect(screen.getByText(/Public-Record Comparison Attestation — Non-Legal Disclaimer/i)).toBeInTheDocument();
  });

  it('renders ConfigMissingBanner without fake address placeholder', () => {
    render(<ConfigMissingBanner />);
    expect(screen.getByText(/Deployment Not Configured/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_CONTRACT_ADDRESS/i)).toBeInTheDocument();
    expect(screen.queryByText(/0xYourDeployedStudionetAddress/i)).not.toBeInTheDocument();
  });

  it('renders TransactionStatusPanel with exact Explorer href', () => {
    const knownHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    render(
      <TransactionStatusPanel
        status={{
          stage: 'CONSENSUS',
          txHash: knownHash,
          message: 'Awaiting validator consensus...',
        }}
      />
    );
    expect(screen.getByText(/Transaction Stage: CONSENSUS/i)).toBeInTheDocument();
    expect(document.querySelector('.transaction-spinner')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /View Tx on Explorer/i });
    expect(link).toHaveAttribute('href', `${STUDIONET_EXPLORER_URL}/tx/${knownHash}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('binds accessible labels to form controls in RegisterRecordForm', () => {
    render(<RegisterRecordForm onSuccess={vi.fn()} onTxStatusChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: /Jurisdiction Key/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Meeting Key/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Item Key/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Source Host/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Agenda URL/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Outcome URL/i })).toBeInTheDocument();
  });

  it('renders HistoryTimeline in correct chronological order', () => {
    const history: AssessmentSnapshot[] = [
      {
        assessed_at: '2026-08-01T12:00:00Z',
        decision: 'MATERIAL_CHANGE',
        meeting_match: 'EXACT',
        item_match: 'EXACT',
        outcome_match: 'MATERIAL_CHANGE',
        agenda_record_type: 'AGENDA',
        outcome_record_type: 'MINUTES',
        reason_codes: ['ACTION_CHANGED'],
        normalized_item_label: 'Item 1',
        normalized_action_label: 'Budget Reduced',
        source_locators: ['Page 1'],
        agenda_fingerprint: '0xagenda1',
        outcome_fingerprint: '0xoutcome1',
        evidence_fingerprint: '0xabc123',
      },
      {
        assessed_at: '2026-08-01T12:05:00Z',
        decision: 'MATCHES_NOTICE',
        meeting_match: 'EXACT',
        item_match: 'EXACT',
        outcome_match: 'MATCHING',
        agenda_record_type: 'AGENDA',
        outcome_record_type: 'MINUTES',
        reason_codes: ['ACTION_MATCH'],
        normalized_item_label: 'Item 1',
        normalized_action_label: 'Budget Confirmed',
        source_locators: ['Page 1'],
        agenda_fingerprint: '0xagenda2',
        outcome_fingerprint: '0xoutcome2',
        evidence_fingerprint: '0xdef456',
      },
    ];

    render(<HistoryTimeline history={history} />);
    expect(screen.getByText(/Assessment History Timeline \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/#1/i)).toBeInTheDocument();
    expect(screen.getByText(/#2/i)).toBeInTheDocument();
  });

  it('maps reason codes to human explanations accurately', () => {
    expect(REASON_CODES_MAP['ACTION_MATCH'].label).toBe('Action Consistent');
    expect(REASON_CODES_MAP['ACTION_CHANGED'].label).toBe('Action Modified');
    expect(REASON_CODES_MAP['PROMPT_INJECTION_IGNORED'].label).toBe('Injection Attack Neutralized');
    expect(REASON_CODES_MAP['OVERSIZED_EVIDENCE'].label).toBe('Evidence Exceeds Bounds');
  });

  it('renders App shell without trust/verified badges and navigates tabs without act warnings', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getAllByText(/NoticeTrail/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Public-Record Comparison Ledger/i)[0]).toBeInTheDocument();
    expect(screen.queryByText(/Trust-First/i)).not.toBeInTheDocument();

    const registerNavBtn = screen.getAllByRole('button', { name: /\+ Register Record/i })[0];
    await act(async () => {
      fireEvent.click(registerNavBtn);
    });

    expect(screen.getByText(/Register Meeting Item Comparison Claim/i)).toBeInTheDocument();
  });
});
