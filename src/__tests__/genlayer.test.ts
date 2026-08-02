import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { RecordData, DecisionVerdict } from '../types';

const sdkMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  writeContract: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('genlayer-js', () => ({
  createClient: sdkMocks.createClient,
}));

vi.mock('genlayer-js/chains', () => ({
  studionet: { id: 61999, name: 'GenLayer Studionet' },
}));

vi.mock('genlayer-js/types', () => ({
  ExecutionResult: {
    NOT_VOTED: 'NOT_VOTED',
    FINISHED_WITH_RETURN: 'FINISHED_WITH_RETURN',
    FINISHED_WITH_ERROR: 'FINISHED_WITH_ERROR',
  },
  TransactionResult: {
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
    IDLE: 'IDLE',
    NO_MAJORITY: 'NO_MAJORITY',
  },
  TransactionStatus: {
    FINALIZED: 'FINALIZED',
  },
}));

const CONTRACT_ADDRESS = '0x1111111111111111111111111111111111111111';
const TX_HASH = `0x${'a'.repeat(64)}`;
const ACCOUNT = '0x2222222222222222222222222222222222222222';
const VALID_HEX32 = `0x${'1'.repeat(64)}`;
const WALLET_SIGNATURE = `0x${'2'.repeat(130)}`;

function installProvider(
  handler: (args: { method: string; params?: unknown[] }) => Promise<unknown> = async ({ method }) => {
    if (method === 'eth_chainId') return '0xf22f'; // 61999
    if (method === 'eth_requestAccounts') return [ACCOUNT];
    if (method === 'eth_accounts') return [ACCOUNT];
    if (method === 'personal_sign') return WALLET_SIGNATURE;
    return [];
  }
) {
  const provider = { request: vi.fn(handler) };
  Object.defineProperty(window, 'ethereum', {
    configurable: true,
    value: provider,
  });
  return provider;
}

async function loadApi() {
  vi.stubEnv('VITE_CONTRACT_ADDRESS', CONTRACT_ADDRESS);
  vi.stubEnv('VITE_RPC_URL', 'https://studio.genlayer.com/api');
  return import('../lib/genlayer');
}

function buildCleanRegistrationInput() {
  return {
    jurisdictionKey: 'city-sf',
    meetingKey: '2026-08-01',
    itemKey: 'item-1',
    agendaUrl: 'https://www.utah.gov/pmn/sitemap/notice/1001.html',
    outcomeUrl: 'https://www.utah.gov/pmn/sitemap/notice/1002.html',
    sourceHost: 'www.utah.gov',
  };
}

function buildValidRegistrationRecord(api: any, input = buildCleanRegistrationInput()): RecordData {
  return {
    record_id: 1,
    canonical_key: api.buildCanonicalKey(input),
    jurisdiction_key: input.jurisdictionKey,
    meeting_key: input.meetingKey,
    item_key: input.itemKey,
    agenda_url: input.agendaUrl,
    outcome_url: input.outcomeUrl,
    source_host: input.sourceHost,
    policy_version: 'NOTICE_TRAIL_V1',
    submitter: ACCOUNT,
    created_at: '2026-08-01T12:00:00Z',
    assessed_at: '',
    current_decision: 'REGISTERED',
    meeting_match: 'UNCLEAR',
    item_match: 'UNCLEAR',
    outcome_match: 'UNCLEAR',
    agenda_record_type: 'UNKNOWN',
    outcome_record_type: 'UNKNOWN',
    reason_codes: [],
    normalized_item_label: 'Claim Registered',
    normalized_action_label: 'Pending Assessment',
    source_locators: [],
    agenda_fingerprint: '',
    outcome_fingerprint: '',
    evidence_fingerprint: '',
    assessment_count: 0,
    retry_count: 0,
    history: [],
  };
}

function buildValidPostRecord(preRecord: RecordData, decision: DecisionVerdict = 'MATCHES_NOTICE'): RecordData {
  const reason_codes =
    decision === 'MATCHES_NOTICE'
      ? ['ACTION_MATCH', 'ITEM_MATCH', 'MEETING_ID_MATCH']
      : decision === 'MATERIAL_CHANGE'
      ? ['ACTION_CHANGED', 'ITEM_MATCH', 'MEETING_ID_MATCH']
      : decision === 'NO_FINAL_ACTION'
      ? ['NO_ACTION_RECORDED', 'ITEM_MATCH', 'MEETING_ID_MATCH']
      : decision === 'SOURCES_NOT_COMPARABLE'
      ? ['MEETING_ID_MISMATCH']
      : ['UNRESOLVED_EVIDENCE'];

  const meeting_match = decision === 'SOURCES_NOT_COMPARABLE' ? 'MISMATCH' : 'EXACT';
  const item_match = 'EXACT';
  const outcome_match =
    decision === 'MATCHES_NOTICE'
      ? 'MATCHING'
      : decision === 'MATERIAL_CHANGE'
      ? 'MATERIAL_CHANGE'
      : decision === 'NO_FINAL_ACTION'
      ? 'NO_ACTION'
      : 'UNCLEAR';

  return {
    ...preRecord,
    assessment_count: preRecord.assessment_count + 1,
    retry_count: preRecord.retry_count + 1,
    assessed_at: '2026-08-02T12:00:00Z',
    current_decision: decision,
    meeting_match,
    item_match,
    outcome_match,
    agenda_record_type: 'AGENDA',
    outcome_record_type: 'MINUTES',
    reason_codes,
    normalized_item_label: 'Item 1 Label',
    normalized_action_label: 'Action 1 Label',
    source_locators: ['Loc 1'],
    agenda_fingerprint: VALID_HEX32,
    outcome_fingerprint: VALID_HEX32,
    evidence_fingerprint: VALID_HEX32,
  };
}

beforeEach(() => {
  vi.resetModules();
  sdkMocks.createClient.mockReset();
  sdkMocks.readContract.mockReset();
  sdkMocks.waitForTransactionReceipt.mockReset();
  sdkMocks.writeContract.mockReset().mockResolvedValue(TX_HASH);
  sdkMocks.connect.mockReset().mockResolvedValue(undefined);
  sdkMocks.createClient.mockImplementation((config: { provider?: unknown }) =>
    config.provider
      ? { writeContract: sdkMocks.writeContract, connect: sdkMocks.connect }
      : {
          readContract: sdkMocks.readContract,
          waitForTransactionReceipt: sdkMocks.waitForTransactionReceipt,
        }
  );
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(window, 'ethereum');
});

describe('NoticeTrail Core SDK Client & Verification Suite', () => {
  it('creates a write client with the explicitly selected provider without invoking SDK Snap connect', async () => {
    const api = await loadApi();
    const provider = installProvider();

    const client = await api.getGenLayerWriteClient(ACCOUNT, provider);

    expect(sdkMocks.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        account: ACCOUNT,
        provider,
        endpoint: 'https://studio.genlayer.com/api',
      })
    );
    expect(sdkMocks.connect).not.toHaveBeenCalled();
    expect(client).toEqual(
      expect.objectContaining({ writeContract: sdkMocks.writeContract })
    );
  });

  it('does not depend on SDK connect or wallet_getSnaps', async () => {
    const api = await loadApi();
    const provider = installProvider();
    sdkMocks.connect.mockRejectedValue(new Error('Connection Failed'));

    await expect(api.getGenLayerWriteClient(ACCOUNT, provider)).resolves.toEqual(
      expect.objectContaining({ writeContract: sdkMocks.writeContract })
    );
    expect(sdkMocks.connect).not.toHaveBeenCalled();
    expect(sdkMocks.writeContract).not.toHaveBeenCalled();
  });
});

describe('Registration Readback Verification Suite (verifyRegistrationReadback)', () => {
  it('passes exact valid initial registration state', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const record = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback(record, input)).toBe(true);
  });

  it('rejects wrong record ID (negative, zero, NaN, non-integer)', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);

    expect(api.verifyRegistrationReadback({ ...base, record_id: 0 }, input)).toBe(false);
    expect(api.verifyRegistrationReadback({ ...base, record_id: -1 }, input)).toBe(false);
    expect(api.verifyRegistrationReadback({ ...base, record_id: NaN }, input)).toBe(false);
    expect(api.verifyRegistrationReadback({ ...base, record_id: 1.5 }, input)).toBe(false);
  });

  it('rejects wrong or mismatched canonical key', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, canonical_key: 'WRONG_KEY' }, input)).toBe(false);
  });

  it('rejects canonical / frozen identity mismatch', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, jurisdiction_key: 'other-city' }, input)).toBe(false);
  });

  it('rejects wrong key casing', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, jurisdiction_key: 'CITY-SF' }, input)).toBe(false);
  });

  it('rejects wrong agenda URL', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, agenda_url: 'https://www.utah.gov/pmn/sitemap/notice/9999.html' }, input)).toBe(false);
  });

  it('rejects wrong outcome URL', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, outcome_url: 'https://www.utah.gov/pmn/sitemap/notice/9999.html' }, input)).toBe(false);
  });

  it('rejects wrong source host', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, source_host: 'records.example.gov' }, input)).toBe(false);
  });

  it('rejects wrong policy version', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, policy_version: 'V2' }, input)).toBe(false);
  });

  it('rejects non-REGISTERED initial decision', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, current_decision: 'MATCHES_NOTICE' }, input)).toBe(false);
  });

  it('rejects nonzero initial assessment count', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, assessment_count: 1 }, input)).toBe(false);
  });

  it('rejects nonzero initial retry count', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, retry_count: 1 }, input)).toBe(false);
  });

  it('rejects nonempty initial assessed_at', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, assessed_at: '2026-08-01' }, input)).toBe(false);
  });

  it('rejects nonempty initial fingerprints', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, agenda_fingerprint: VALID_HEX32 }, input)).toBe(false);
    expect(api.verifyRegistrationReadback({ ...base, outcome_fingerprint: VALID_HEX32 }, input)).toBe(false);
    expect(api.verifyRegistrationReadback({ ...base, evidence_fingerprint: VALID_HEX32 }, input)).toBe(false);
  });

  it('rejects nonempty initial reason codes', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, reason_codes: ['ACTION_MATCH'] }, input)).toBe(false);
  });

  it('rejects nonempty initial source locators', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, source_locators: ['Loc 1'] }, input)).toBe(false);
  });

  it('rejects nonempty initial history', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, history: [{ decision: 'REGISTERED' }] as any }, input)).toBe(false);
  });

  it('rejects missing submitter or created_at', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, submitter: '' }, input)).toBe(false);
    expect(api.verifyRegistrationReadback({ ...base, created_at: '' }, input)).toBe(false);
  });

  it('rejects missing initial labels', async () => {
    const api = await loadApi();
    const input = buildCleanRegistrationInput();
    const base = buildValidRegistrationRecord(api, input);
    expect(api.verifyRegistrationReadback({ ...base, normalized_item_label: '' }, input)).toBe(false);
    expect(api.verifyRegistrationReadback({ ...base, normalized_action_label: '' }, input)).toBe(false);
  });
});

describe('Post-State Invariants Verification Suite (verifyPostStateInvariants)', () => {
  it('passes valid MATCHES_NOTICE, MATERIAL_CHANGE, NO_FINAL_ACTION, SOURCES_NOT_COMPARABLE, and UNRESOLVED post states', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);

    expect(api.verifyPostStateInvariants(pre, buildValidPostRecord(pre, 'MATCHES_NOTICE'), 1)).toBe(true);
    expect(api.verifyPostStateInvariants(pre, buildValidPostRecord(pre, 'MATERIAL_CHANGE'), 1)).toBe(true);
    expect(api.verifyPostStateInvariants(pre, buildValidPostRecord(pre, 'NO_FINAL_ACTION'), 1)).toBe(true);
    expect(api.verifyPostStateInvariants(pre, buildValidPostRecord(pre, 'SOURCES_NOT_COMPARABLE'), 1)).toBe(true);
    expect(api.verifyPostStateInvariants(pre, buildValidPostRecord(pre, 'UNRESOLVED'), 1)).toBe(true);
  });

  it('recomputes exact canonical key from preRecord frozen fields and rejects mismatch', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const post = buildValidPostRecord(pre);

    // Bad pre canonical key
    expect(api.verifyPostStateInvariants({ ...pre, canonical_key: 'WRONG' }, post, 1)).toBe(false);

    // Bad post canonical key
    expect(api.verifyPostStateInvariants(pre, { ...post, canonical_key: 'WRONG' }, 1)).toBe(false);

    // Pre canonical key using wrong jurisdiction
    const badPreJur = { ...pre, jurisdiction_key: 'wrong-jur' };
    expect(api.verifyPostStateInvariants(badPreJur, post, 1)).toBe(false);

    // Pre canonical key using wrong meeting
    const badPreMeet = { ...pre, meeting_key: 'wrong-meet' };
    expect(api.verifyPostStateInvariants(badPreMeet, post, 1)).toBe(false);

    // Pre canonical key using wrong item
    const badPreItem = { ...pre, item_key: 'wrong-item' };
    expect(api.verifyPostStateInvariants(badPreItem, post, 1)).toBe(false);

    // Pre canonical key using wrong agenda URL
    const badPreAgenda = { ...pre, agenda_url: 'https://www.utah.gov/pmn/sitemap/notice/999.html' };
    expect(api.verifyPostStateInvariants(badPreAgenda, post, 1)).toBe(false);

    // Pre canonical key using wrong outcome URL
    const badPreOutcome = { ...pre, outcome_url: 'https://www.utah.gov/pmn/sitemap/notice/999.html' };
    expect(api.verifyPostStateInvariants(badPreOutcome, post, 1)).toBe(false);
  });

  it('rejects PROMPT_INJECTION_IGNORED alone for UNRESOLVED but accepts when combined with UNRESOLVED_EVIDENCE', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const postInjOnly = buildValidPostRecord(pre, 'UNRESOLVED');
    postInjOnly.reason_codes = ['PROMPT_INJECTION_IGNORED'];

    expect(api.verifyPostStateInvariants(pre, postInjOnly, 1)).toBe(false);

    const postInjCombined = buildValidPostRecord(pre, 'UNRESOLVED');
    postInjCombined.reason_codes = ['PROMPT_INJECTION_IGNORED', 'UNRESOLVED_EVIDENCE'];
    expect(api.verifyPostStateInvariants(pre, postInjCombined, 1)).toBe(true);
  });

  it('rejects mismatched pre or post record IDs or invalid requested ID', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const post = buildValidPostRecord(pre);

    expect(api.verifyPostStateInvariants(pre, post, 99)).toBe(false);
    expect(api.verifyPostStateInvariants({ ...pre, record_id: 99 }, post, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, record_id: 99 }, 1)).toBe(false);
  });

  it('rejects NaN, Infinity, negative, fractional, or unchanged counters', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const post = buildValidPostRecord(pre);

    expect(api.verifyPostStateInvariants(pre, { ...post, assessment_count: NaN }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, retry_count: NaN }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants({ ...pre, assessment_count: Infinity }, post, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, retry_count: Infinity }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, assessment_count: -1 }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, retry_count: -1 }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, assessment_count: 1.5 }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, retry_count: 1.5 }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, assessment_count: 0 }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, retry_count: 0 }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, assessment_count: 2 }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, retry_count: 3 }, 1)).toBe(false);
  });

  it('requires exact history correspondence for first evaluation and reassessment', async () => {
    const api = await loadApi();
    const registered = buildValidRegistrationRecord(api);
    const firstPost = buildValidPostRecord(registered);

    expect(api.verifyPostStateInvariants(registered, { ...firstPost, history: [{} as any] }, 1)).toBe(false);

    const assessedPre = buildValidPostRecord(registered);
    const expectedSnapshot = {
      decision: assessedPre.current_decision,
      meeting_match: assessedPre.meeting_match,
      item_match: assessedPre.item_match,
      outcome_match: assessedPre.outcome_match,
      agenda_record_type: assessedPre.agenda_record_type,
      outcome_record_type: assessedPre.outcome_record_type,
      reason_codes: [...assessedPre.reason_codes],
      normalized_item_label: assessedPre.normalized_item_label,
      normalized_action_label: assessedPre.normalized_action_label,
      source_locators: [...assessedPre.source_locators],
      agenda_fingerprint: assessedPre.agenda_fingerprint,
      outcome_fingerprint: assessedPre.outcome_fingerprint,
      evidence_fingerprint: assessedPre.evidence_fingerprint,
      assessed_at: assessedPre.assessed_at,
    };
    const reassessedPost = {
      ...buildValidPostRecord(assessedPre, 'MATERIAL_CHANGE'),
      assessed_at: '2026-08-03T12:00:00Z',
      history: [expectedSnapshot],
    };

    expect(api.verifyPostStateInvariants(assessedPre, reassessedPost, 1)).toBe(true);
    expect(api.verifyPostStateInvariants(assessedPre, { ...reassessedPost, history: [] }, 1)).toBe(false);
    expect(
      api.verifyPostStateInvariants(
        assessedPre,
        { ...reassessedPost, history: [expectedSnapshot, expectedSnapshot] },
        1
      )
    ).toBe(false);
    expect(
      api.verifyPostStateInvariants(
        assessedPre,
        { ...reassessedPost, history: [{ ...expectedSnapshot, decision: 'NO_FINAL_ACTION' }] },
        1
      )
    ).toBe(false);
  });

  it('rejects unchanged assessed_at timestamp', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const post = buildValidPostRecord(pre);

    expect(api.verifyPostStateInvariants(pre, { ...post, assessed_at: '' }, 1)).toBe(false);
  });

  it('rejects arbitrary decisions or semantically inconsistent reason codes', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const post = buildValidPostRecord(pre);

    expect(api.verifyPostStateInvariants(pre, { ...post, current_decision: 'LEGAL_VERDICT' as DecisionVerdict }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, reason_codes: ['MEETING_ID_MATCH'] }, 1)).toBe(false);
  });

  it('rejects every contradictory extra reason code for each decision matrix', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const allCodes = [...api.ALLOWLIST_REASON_CODES];
    const cases: Array<{
      post: RecordData;
      allowed: string[];
    }> = [
      {
        post: buildValidPostRecord(pre),
        allowed: ['MEETING_ID_MATCH', 'ITEM_MATCH', 'ACTION_MATCH', 'PROMPT_INJECTION_IGNORED'],
      },
      {
        post: {
          ...buildValidPostRecord(pre),
          current_decision: 'MATERIAL_CHANGE',
          outcome_match: 'MATERIAL_CHANGE',
          reason_codes: ['MEETING_ID_MATCH', 'ITEM_MATCH', 'ACTION_CHANGED'],
        },
        allowed: ['MEETING_ID_MATCH', 'ITEM_MATCH', 'ITEM_PARTIAL_MATCH', 'ACTION_CHANGED', 'PROMPT_INJECTION_IGNORED'],
      },
      {
        post: {
          ...buildValidPostRecord(pre),
          current_decision: 'NO_FINAL_ACTION',
          outcome_match: 'NO_ACTION',
          reason_codes: ['MEETING_ID_MATCH', 'ITEM_MATCH', 'NO_ACTION_RECORDED'],
        },
        allowed: ['MEETING_ID_MATCH', 'ITEM_MATCH', 'NO_ACTION_RECORDED', 'PROMPT_INJECTION_IGNORED'],
      },
      {
        post: {
          ...buildValidPostRecord(pre),
          current_decision: 'SOURCES_NOT_COMPARABLE',
          meeting_match: 'MISMATCH',
          item_match: 'MISSING',
          outcome_match: 'UNCLEAR',
          reason_codes: ['MEETING_ID_MISMATCH', 'ITEM_NOT_FOUND'],
        },
        allowed: [
          'MEETING_ID_MISMATCH',
          'ITEM_NOT_FOUND',
          'SOURCE_TYPE_MISMATCH',
          'SOURCE_CONFLICT',
          'PROMPT_INJECTION_IGNORED',
        ],
      },
      {
        post: {
          ...buildValidPostRecord(pre),
          current_decision: 'UNRESOLVED',
          meeting_match: 'UNCLEAR',
          item_match: 'UNCLEAR',
          outcome_match: 'UNCLEAR',
          reason_codes: ['UNRESOLVED_EVIDENCE'],
        },
        allowed: [
          'OUTCOME_SOURCE_MISSING',
          'SOURCE_UNAVAILABLE',
          'SOURCE_MALFORMED',
          'SOURCE_CONFLICT',
          'AMBIGUOUS_WORDING',
          'OVERSIZED_EVIDENCE',
          'UNRESOLVED_EVIDENCE',
          'PROMPT_INJECTION_IGNORED',
        ],
      },
    ];

    for (const matrixCase of cases) {
      for (const contradiction of allCodes.filter((code) => !matrixCase.allowed.includes(code))) {
        expect(
          api.verifyPostStateInvariants(
            pre,
            { ...matrixCase.post, reason_codes: [...matrixCase.post.reason_codes, contradiction] },
            1
          ),
          `${matrixCase.post.current_decision} accepted contradictory ${contradiction}`
        ).toBe(false);
      }
    }
  });

  it('binds each SOURCES_NOT_COMPARABLE reason to its exact supporting fields', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const base = {
      ...buildValidPostRecord(pre),
      current_decision: 'SOURCES_NOT_COMPARABLE' as const,
      meeting_match: 'EXACT' as const,
      item_match: 'EXACT' as const,
      outcome_match: 'UNCLEAR' as const,
      agenda_record_type: 'AGENDA' as const,
      outcome_record_type: 'MINUTES' as const,
    };
    const invalid = (reasonCode: string, overrides: Partial<RecordData> = {}) => ({
      post: { ...base, ...overrides, reason_codes: [reasonCode] } as RecordData,
      valid: false,
    });
    const cases: Array<{ post: RecordData; valid: boolean }> = [
      invalid('SOURCE_HOST_MISMATCH'),
      ...(['EXACT', 'UNCLEAR'] as const).map((meeting_match) => invalid('MEETING_ID_MISMATCH', { meeting_match })),
      ...(['EXACT', 'PARTIAL', 'UNCLEAR'] as const).map((item_match) => invalid('ITEM_NOT_FOUND', { item_match })),
      ...(['NOTICE', 'AGENDA'] as const).flatMap((agenda_record_type) =>
        (['MINUTES', 'RESOLUTION', 'DECISION_LOG'] as const).map((outcome_record_type) =>
          invalid('SOURCE_TYPE_MISMATCH', { agenda_record_type, outcome_record_type })
        )
      ),
      ...(['MISMATCH', 'UNCLEAR'] as const).map((meeting_match) => invalid('SOURCE_CONFLICT', { meeting_match })),
      ...(['PARTIAL', 'MISSING', 'UNCLEAR'] as const).map((item_match) => invalid('SOURCE_CONFLICT', { item_match })),
      ...(['MATCHING', 'MATERIAL_CHANGE', 'NO_ACTION'] as const).map((outcome_match) => invalid('SOURCE_CONFLICT', { outcome_match })),
      invalid('SOURCE_CONFLICT', { agenda_record_type: 'UNKNOWN' }),
      invalid('SOURCE_CONFLICT', { outcome_record_type: 'UNKNOWN' }),
      invalid('PROMPT_INJECTION_IGNORED', { meeting_match: 'MISMATCH' }),
      invalid('PROMPT_INJECTION_IGNORED', { item_match: 'MISSING' }),
      invalid('PROMPT_INJECTION_IGNORED', { agenda_record_type: 'UNKNOWN' }),
      invalid('PROMPT_INJECTION_IGNORED'),
      { post: { ...base, meeting_match: 'MISMATCH', reason_codes: ['MEETING_ID_MISMATCH'] }, valid: true },
      { post: { ...base, item_match: 'MISSING', reason_codes: ['ITEM_NOT_FOUND'] }, valid: true },
      { post: { ...base, agenda_record_type: 'UNKNOWN', reason_codes: ['SOURCE_TYPE_MISMATCH'] }, valid: true },
      { post: { ...base, reason_codes: ['SOURCE_CONFLICT'] }, valid: true },
    ];

    for (const matrixCase of cases) {
      expect(api.verifyPostStateInvariants(pre, matrixCase.post, 1)).toBe(matrixCase.valid);
    }
  });

  it('rejects empty, unknown, duplicate, or too many reason codes (> 8)', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const post = buildValidPostRecord(pre);

    expect(api.verifyPostStateInvariants(pre, { ...post, reason_codes: [] }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, reason_codes: ['UNKNOWN_CODE'] }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, reason_codes: ['ACTION_MATCH', 'ACTION_MATCH'] }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, reason_codes: Array(9).fill('ACTION_MATCH') }, 1)).toBe(false);
  });

  it('rejects malformed fingerprints', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const post = buildValidPostRecord(pre);

    expect(api.verifyPostStateInvariants(pre, { ...post, agenda_fingerprint: 'invalid_hex' }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, outcome_fingerprint: '0x123' }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, evidence_fingerprint: '' }, 1)).toBe(false);
  });

  it('rejects empty/overlong labels, duplicate/overlong locators (>5), and history > 49', async () => {
    const api = await loadApi();
    const pre = buildValidRegistrationRecord(api);
    const post = buildValidPostRecord(pre);

    expect(api.verifyPostStateInvariants(pre, { ...post, normalized_item_label: '' }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, normalized_item_label: 'X'.repeat(101) }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, source_locators: ['L1', 'L1'] }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, source_locators: ['L'.repeat(101)] }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, source_locators: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] }, 1)).toBe(false);
    expect(api.verifyPostStateInvariants(pre, { ...post, history: Array(50).fill({}) as any }, 1)).toBe(false);
  });
});

describe('Transaction-Level Actions Suite (executeRegisterRecord & executeEvaluateRecord)', () => {
  it('valid registration reaches SUCCESS only after finalized successful receipt and exact readback', async () => {
    const api = await loadApi();
    installProvider();
    const input = buildCleanRegistrationInput();

    sdkMocks.writeContract.mockResolvedValue(TX_HASH);
    sdkMocks.waitForTransactionReceipt.mockResolvedValue({
      status: 'FINALIZED',
      result: 'SUCCESS',
      resultName: 'SUCCESS',
      txExecutionResultName: 'FINISHED_WITH_RETURN',
    });

    const expectedRec = buildValidRegistrationRecord(api, input);
    sdkMocks.readContract.mockResolvedValue(expectedRec);

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeRegisterRecord(input, (s) => statuses.push(s));

    expect(result).toEqual(expectedRec);
    expect(statuses.at(-1)?.stage).toBe('SUCCESS');
    expect(sdkMocks.waitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ hash: TX_HASH, status: 'FINALIZED' })
    );
    expect(sdkMocks.waitForTransactionReceipt.mock.invocationCallOrder[0]).toBeLessThan(
      sdkMocks.readContract.mock.invocationCallOrder[0]
    );
    expect(statuses.filter((status) => status.stage === 'SUCCESS')).toHaveLength(1);
  });

  it('registration readback mismatch produces UNDETERMINED stage', async () => {
    const api = await loadApi();
    installProvider();
    const input = buildCleanRegistrationInput();

    sdkMocks.writeContract.mockResolvedValue(TX_HASH);
    sdkMocks.waitForTransactionReceipt.mockResolvedValue({
      status: 'FINALIZED',
      result: 'SUCCESS',
      resultName: 'SUCCESS',
      txExecutionResultName: 'FINISHED_WITH_RETURN',
    });

    // Mismatched readback
    sdkMocks.readContract.mockResolvedValue({ ...buildValidRegistrationRecord(api, input), current_decision: 'MATCHES_NOTICE' });

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeRegisterRecord(input, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('UNDETERMINED');
  });

  it('wrong network prevents write transaction execution', async () => {
    const api = await loadApi();
    const provider = installProvider(async ({ method }) => {
      if (method === 'eth_requestAccounts') return [ACCOUNT];
      if (method === 'eth_chainId') return '0x1';
      if (method === 'wallet_switchEthereumChain') return null;
      return null;
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const input = buildCleanRegistrationInput();

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeRegisterRecord(input, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('ERROR');
    expect((statuses.at(-1) as { error?: string })?.error).toContain('WRONG_NETWORK');
    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xf22f' }],
    });
    expect(sdkMocks.connect).not.toHaveBeenCalled();
    expect(sdkMocks.writeContract).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('validation failure prevents wallet request and write execution', async () => {
    const api = await loadApi();
    const windowEthSpy = vi.fn();
    Object.defineProperty(window, 'ethereum', { configurable: true, value: { request: windowEthSpy } });

    const invalidInput = { ...buildCleanRegistrationInput(), jurisdictionKey: '' };
    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeRegisterRecord(invalidInput, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('ERROR');
    expect(windowEthSpy).not.toHaveBeenCalled();
    expect(sdkMocks.writeContract).not.toHaveBeenCalled();
  });

  it('wallet account-access rejection prevents write transaction execution', async () => {
    const api = await loadApi();
    installProvider(async ({ method }) => {
      if (method === 'eth_chainId') return '0xf22f';
      if (method === 'eth_requestAccounts') {
        const error = new Error('User rejected wallet access') as Error & { code: number };
        error.code = 4001;
        throw error;
      }
      return [];
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const input = buildCleanRegistrationInput();
    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeRegisterRecord(input, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('ERROR');
    expect((statuses.at(-1) as { error?: string })?.error).toContain('WALLET_ACCESS_REJECTED');
    expect(sdkMocks.connect).not.toHaveBeenCalled();
    expect(sdkMocks.writeContract).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('pre-state read failure prevents wallet request and write execution during evaluation', async () => {
    const api = await loadApi();
    const provider = installProvider();
    sdkMocks.readContract.mockRejectedValue(new Error('Read failed'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeEvaluateRecord(1, false, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('UNDETERMINED');
    expect(provider.request).not.toHaveBeenCalled();
    expect(sdkMocks.connect).not.toHaveBeenCalled();
    expect(sdkMocks.writeContract).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each([
    ['canonical key', (record: RecordData) => ({ ...record, canonical_key: 'WRONG_KEY' })],
    ['source host', (record: RecordData) => ({ ...record, source_host: 'records.example.gov' })],
    ['policy version', (record: RecordData) => ({ ...record, policy_version: 'NOTICE_TRAIL_V2' })],
    ['agenda URL', (record: RecordData) => ({ ...record, agenda_url: 'https://www.utah.gov/other/1.html' })],
    ['record ID', (record: RecordData) => ({ ...record, record_id: 99 })],
  ])('malformed pre-state %s prevents wallet connection and write execution', async (_caseName, mutate) => {
    const api = await loadApi();
    const provider = installProvider();
    const malformedPre = mutate(buildValidRegistrationRecord(api));
    sdkMocks.readContract.mockResolvedValue(malformedPre);

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeEvaluateRecord(1, false, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('UNDETERMINED');
    expect(provider.request).not.toHaveBeenCalled();
    expect(sdkMocks.connect).not.toHaveBeenCalled();
    expect(sdkMocks.writeContract).not.toHaveBeenCalled();
    expect(sdkMocks.createClient.mock.calls.some(([config]) => Boolean(config?.provider))).toBe(false);
  });

  it('no-majority receipt produces UNDETERMINED without a successful post-readback', async () => {
    const api = await loadApi();
    installProvider();
    const input = buildCleanRegistrationInput();

    sdkMocks.writeContract.mockResolvedValue(TX_HASH);
    sdkMocks.waitForTransactionReceipt.mockResolvedValue({
      status: 'FINALIZED',
      result: 'NO_MAJORITY',
      resultName: 'NO_MAJORITY',
      txExecutionResultName: 'FINISHED_WITH_ERROR',
    });

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeRegisterRecord(input, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('UNDETERMINED');
    expect((statuses.at(-1) as { error?: string })?.error).toContain('NO_MAJORITY');
    expect(sdkMocks.readContract).not.toHaveBeenCalled();
    expect(statuses.some((status) => status.stage === 'SUCCESS')).toBe(false);
  });

  it('normalizes live numeric Studionet receipt results', async () => {
    const api = await loadApi();

    expect(api.classifyFinalizedReceipt({ status: 7, result: 6 })).toEqual({
      kind: 'SUCCESS',
      resultName: 'MAJORITY_AGREE',
      executionName: '',
    });
    expect(api.classifyFinalizedReceipt({ status: 7, result: 7 })).toEqual({
      kind: 'CONSENSUS_REJECTED',
      resultName: 'MAJORITY_DISAGREE',
      executionName: '',
    });
    expect(api.classifyFinalizedReceipt({ status: 7, result: 5 })).toEqual({
      kind: 'CONSENSUS_REJECTED',
      resultName: 'NO_MAJORITY',
      executionName: '',
    });
  });

  it('reports MAJORITY_DISAGREE as consensus rejection and verifies unchanged evaluation state', async () => {
    const api = await loadApi();
    installProvider();
    const preRecord = buildValidRegistrationRecord(api);
    sdkMocks.readContract
      .mockResolvedValueOnce(preRecord)
      .mockResolvedValueOnce(preRecord);
    sdkMocks.waitForTransactionReceipt.mockResolvedValue({ status: 7, result: 7 });

    const statuses: Array<{ stage: string; error?: string }> = [];
    const result = await api.executeEvaluateRecord(1, true, (status) => statuses.push(status));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('UNDETERMINED');
    expect(statuses.at(-1)?.error).toContain('MAJORITY_DISAGREE');
    expect(statuses.at(-1)?.error).toContain('readback confirms state is unchanged');
    expect(sdkMocks.readContract).toHaveBeenCalledTimes(2);
    expect(statuses.some((status) => status.stage === 'SUCCESS')).toBe(false);
  });

  it('unchanged post-state produces UNDETERMINED stage during evaluation', async () => {
    const api = await loadApi();
    installProvider();
    const pre = buildValidRegistrationRecord(api);
    sdkMocks.readContract.mockResolvedValue(pre); // Returns unchanged pre record both before and after

    sdkMocks.writeContract.mockResolvedValue(TX_HASH);
    sdkMocks.waitForTransactionReceipt.mockResolvedValue({
      status: 'FINALIZED',
      result: 'SUCCESS',
      resultName: 'SUCCESS',
      txExecutionResultName: 'FINISHED_WITH_RETURN',
    });

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeEvaluateRecord(1, false, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('UNDETERMINED');
  });

  it('valid semantic UNRESOLVED post-state reaches SUCCESS stage', async () => {
    const api = await loadApi();
    installProvider();
    const pre = buildValidRegistrationRecord(api);
    const postUnresolved = buildValidPostRecord(pre, 'UNRESOLVED');

    sdkMocks.readContract
      .mockResolvedValueOnce(pre)
      .mockResolvedValueOnce(postUnresolved);

    sdkMocks.writeContract.mockResolvedValue(TX_HASH);
    sdkMocks.waitForTransactionReceipt.mockResolvedValue({
      status: 'FINALIZED',
      result: 'SUCCESS',
      resultName: 'SUCCESS',
      txExecutionResultName: 'FINISHED_WITH_RETURN',
    });

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeEvaluateRecord(1, false, (s) => statuses.push(s));

    expect(result).toEqual(postUnresolved);
    expect(statuses.at(-1)?.stage).toBe('SUCCESS');
  });

  it.each([
    ['record ID', (record: RecordData) => ({ ...record, record_id: 99 })],
    ['canonical key', (record: RecordData) => ({ ...record, canonical_key: 'WRONG_KEY' })],
    ['jurisdiction key', (record: RecordData) => ({ ...record, jurisdiction_key: 'changed-city' })],
    ['meeting key', (record: RecordData) => ({ ...record, meeting_key: 'changed-meeting' })],
    ['item key', (record: RecordData) => ({ ...record, item_key: 'changed-item' })],
    ['agenda URL', (record: RecordData) => ({ ...record, agenda_url: 'https://www.utah.gov/pmn/sitemap/notice/9998.html' })],
    ['outcome URL', (record: RecordData) => ({ ...record, outcome_url: 'https://www.utah.gov/pmn/sitemap/notice/9999.html' })],
    ['source host', (record: RecordData) => ({ ...record, source_host: 'records.example.gov' })],
    ['policy version', (record: RecordData) => ({ ...record, policy_version: 'NOTICE_TRAIL_V2' })],
  ])('post-state with wrong %s produces UNDETERMINED without SUCCESS', async (_caseName, mutate) => {
    const api = await loadApi();
    installProvider();
    const pre = buildValidRegistrationRecord(api);
    const badPost = mutate(buildValidPostRecord(pre));

    sdkMocks.readContract
      .mockResolvedValueOnce(pre)
      .mockResolvedValueOnce(badPost);

    sdkMocks.writeContract.mockResolvedValue(TX_HASH);
    sdkMocks.waitForTransactionReceipt.mockResolvedValue({
      status: 'FINALIZED',
      result: 'SUCCESS',
      resultName: 'SUCCESS',
      txExecutionResultName: 'FINISHED_WITH_RETURN',
    });

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeEvaluateRecord(1, false, (s) => statuses.push(s));

    expect(result).toBeNull();
    expect(statuses.at(-1)?.stage).toBe('UNDETERMINED');
    expect(statuses.some((status) => status.stage === 'SUCCESS')).toBe(false);
  });

  it('valid reassessment state advancement reaches SUCCESS stage', async () => {
    const api = await loadApi();
    installProvider();
    const preAssessed = buildValidPostRecord(buildValidRegistrationRecord(api), 'MATCHES_NOTICE');
    const postReassessed = {
      ...preAssessed,
      assessment_count: preAssessed.assessment_count + 1,
      retry_count: preAssessed.retry_count + 1,
      assessed_at: '2026-08-03T12:00:00Z',
      history: [
        {
          decision: preAssessed.current_decision,
          meeting_match: preAssessed.meeting_match,
          item_match: preAssessed.item_match,
          outcome_match: preAssessed.outcome_match,
          agenda_record_type: preAssessed.agenda_record_type,
          outcome_record_type: preAssessed.outcome_record_type,
          reason_codes: [...preAssessed.reason_codes],
          normalized_item_label: preAssessed.normalized_item_label,
          normalized_action_label: preAssessed.normalized_action_label,
          source_locators: [...preAssessed.source_locators],
          agenda_fingerprint: preAssessed.agenda_fingerprint,
          outcome_fingerprint: preAssessed.outcome_fingerprint,
          evidence_fingerprint: preAssessed.evidence_fingerprint,
          assessed_at: preAssessed.assessed_at,
        },
      ],
    };

    sdkMocks.readContract
      .mockResolvedValueOnce(preAssessed)
      .mockResolvedValueOnce(postReassessed);

    sdkMocks.writeContract.mockResolvedValue(TX_HASH);
    sdkMocks.waitForTransactionReceipt.mockResolvedValue({
      status: 'FINALIZED',
      result: 'SUCCESS',
      resultName: 'SUCCESS',
      txExecutionResultName: 'FINISHED_WITH_RETURN',
    });

    const statuses: Array<{ stage: string }> = [];
    const result = await api.executeEvaluateRecord(1, true, (s) => statuses.push(s));

    expect(result).toEqual(postReassessed);
    expect(statuses.at(-1)?.stage).toBe('SUCCESS');
    expect(sdkMocks.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'reassess_record', args: [1n] })
    );
  });
});
