import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecordData } from '../types';

let RecordDetail: typeof import('../components/RecordDetail').RecordDetail;
let RegisterRecordForm: typeof import('../components/RegisterRecordForm').RegisterRecordForm;
let App: typeof import('../App').App;

const sdkMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('genlayer-js', () => ({
  createClient: sdkMocks.createClient,
}));

const registeredRecord: RecordData = {
  record_id: 1,
  canonical_key: 'NOTICE_TRAIL_V1:c:m:i:https://www.utah.gov/pmn/sitemap/notice/1.html:https://www.utah.gov/pmn/sitemap/notice/2.html',
  jurisdiction_key: 'c',
  meeting_key: 'm',
  item_key: 'i',
  agenda_url: 'https://www.utah.gov/pmn/sitemap/notice/1.html',
  outcome_url: 'https://www.utah.gov/pmn/sitemap/notice/2.html',
  source_host: 'www.utah.gov',
  policy_version: 'NOTICE_TRAIL_V1',
  submitter: '0x123',
  created_at: '2026-08-01',
  assessed_at: '',
  current_decision: 'REGISTERED',
  meeting_match: 'UNCLEAR',
  item_match: 'UNCLEAR',
  outcome_match: 'UNCLEAR',
  agenda_record_type: 'UNKNOWN',
  outcome_record_type: 'UNKNOWN',
  reason_codes: [],
  normalized_item_label: 'Item 1',
  normalized_action_label: 'Pending',
  source_locators: [],
  agenda_fingerprint: '',
  outcome_fingerprint: '',
  evidence_fingerprint: '',
  assessment_count: 0,
  retry_count: 0,
  history: [],
};

const assessedRecord: RecordData = {
  ...registeredRecord,
  record_id: 2,
  current_decision: 'MATCHES_NOTICE',
  meeting_match: 'EXACT',
  item_match: 'EXACT',
  outcome_match: 'MATCHING',
  agenda_record_type: 'AGENDA',
  outcome_record_type: 'MINUTES',
  reason_codes: ['ACTION_MATCH'],
  assessment_count: 1,
  retry_count: 1,
  assessed_at: '2026-08-01T12:00:00Z',
  agenda_fingerprint: '0x' + '1'.repeat(64),
  outcome_fingerprint: '0x' + '2'.repeat(64),
  evidence_fingerprint: '0x' + '3'.repeat(64),
};

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('VITE_CONTRACT_ADDRESS', '');
  sdkMocks.createClient.mockReset();
  ({ RecordDetail } = await import('../components/RecordDetail'));
  ({ RegisterRecordForm } = await import('../components/RegisterRecordForm'));
  ({ App } = await import('../App'));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(window, 'ethereum');
});

describe('NoticeTrail Genuine Unconfigured Mode Suite (IS_CONFIGURED === false)', () => {
  it('treats the zero address as unconfigured', async () => {
    vi.stubEnv('VITE_CONTRACT_ADDRESS', '0x0000000000000000000000000000000000000000');
    vi.resetModules();
    const api = await import('../lib/genlayer');
    expect(api.IS_CONFIGURED).toBe(false);
  });

  it('disables Submit Record button in RegisterRecordForm when unconfigured', async () => {
    render(<RegisterRecordForm onSuccess={vi.fn()} onTxStatusChange={vi.fn()} />);
    const submitBtn = screen.getByRole('button', { name: /Register Comparison Claim/i });
    expect(submitBtn).toBeDisabled();
  });

  it('disables Evaluate button in RecordDetail when record is REGISTERED and unconfigured', () => {
    render(<RecordDetail record={registeredRecord} />);
    const evalBtn = screen.getByRole('button', { name: /Evaluate Record/i });
    expect(evalBtn).toBeDisabled();
  });

  it('disables Reassess button in RecordDetail when record is assessed and unconfigured', () => {
    render(<RecordDetail record={assessedRecord} />);
    const reassessBtn = screen.getByRole('button', { name: /Reassess Record/i });
    expect(reassessBtn).toBeDisabled();
  });

  it('halts executeRegisterRecord before createClient, wallet, readContract, or writeContract when unconfigured', async () => {
    const api = await import('../lib/genlayer');
    expect(api.IS_CONFIGURED).toBe(false);

    const windowEthSpy = vi.fn();
    Object.defineProperty(window, 'ethereum', { configurable: true, value: { request: windowEthSpy } });

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeRegisterRecord(
      {
        jurisdictionKey: 'city-sf',
        meetingKey: '2026-08-01',
        itemKey: 'item-1',
        agendaUrl: 'https://www.utah.gov/pmn/sitemap/notice/1001.html',
        outcomeUrl: 'https://www.utah.gov/pmn/sitemap/notice/1002.html',
        sourceHost: 'www.utah.gov',
      },
      (s) => statuses.push(s)
    );

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('ERROR');
    expect(sdkMocks.createClient).not.toHaveBeenCalled();
    expect(windowEthSpy).not.toHaveBeenCalled();
  });

  it('halts executeEvaluateRecord before createClient, wallet, readContract, or writeContract when unconfigured', async () => {
    const api = await import('../lib/genlayer');
    expect(api.IS_CONFIGURED).toBe(false);

    const windowEthSpy = vi.fn();
    Object.defineProperty(window, 'ethereum', { configurable: true, value: { request: windowEthSpy } });

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeEvaluateRecord(1, false, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('ERROR');
    expect(sdkMocks.createClient).not.toHaveBeenCalled();
    expect(windowEthSpy).not.toHaveBeenCalled();
  });

  it('renders overview banner and non-legal disclaimer without placeholder address', () => {
    render(<App />);

    expect(screen.getByText(/Deployment Not Configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Public-Record Comparison Attestation — Non-Legal Disclaimer/i)).toBeInTheDocument();
    expect(screen.queryByText(/0xYourDeployedStudionetAddress/i)).not.toBeInTheDocument();
  });
});
