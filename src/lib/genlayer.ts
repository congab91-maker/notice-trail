import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import {
  ExecutionResult,
  TransactionResult,
  TransactionStatus,
  type TransactionHash,
} from 'genlayer-js/types';
import { AssessmentSnapshot, RecordData, TxStatus } from '../types';
import {
  validateIdentityKey,
  validateRegistrationParams,
  RegisterRecordInputParams,
  UTAH_SOURCE_HOST,
} from './validation';
import {
  assertWalletConnectionCurrent,
  clearRememberedWallet,
  connectWalletCandidate,
  getActiveWalletConnection,
  selectWalletProvider,
  type BrowserEthereumProvider,
  type WalletConnection,
  type WalletNetworkConfig,
} from './walletProviders';

export type { BrowserEthereumProvider, WalletConnection } from './walletProviders';

export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS || '').trim();
export const IS_CONFIGURED = Boolean(
  CONTRACT_ADDRESS &&
    /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS) &&
    !/^0x0{40}$/i.test(CONTRACT_ADDRESS)
);

export const STUDIONET_RPC_URL = import.meta.env.VITE_RPC_URL || 'https://studio.genlayer.com/api';
export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_HEX_CHAIN_ID = '0xf22f';
export const STUDIONET_EXPLORER_URL = 'https://explorer-studio.genlayer.com';
export const POLICY_VERSION = 'NOTICE_TRAIL_V1';

const STUDIONET_WALLET_CONFIG: WalletNetworkConfig = {
  chainId: STUDIONET_CHAIN_ID,
  chainIdHex: STUDIONET_HEX_CHAIN_ID,
  chainName: 'GenLayer Studionet',
  rpcUrl: STUDIONET_RPC_URL,
  explorerUrl: STUDIONET_EXPLORER_URL,
};

const TRANSACTION_RESULT_BY_NUMBER: Record<string, string> = {
  '0': 'IDLE',
  '1': 'AGREE',
  '2': 'DISAGREE',
  '3': 'TIMEOUT',
  '4': 'DETERMINISTIC_VIOLATION',
  '5': 'NO_MAJORITY',
  '6': 'MAJORITY_AGREE',
  '7': 'MAJORITY_DISAGREE',
};

const EXECUTION_RESULT_BY_NUMBER: Record<string, string> = {
  '0': 'NOT_VOTED',
  '1': 'FINISHED_WITH_RETURN',
  '2': 'FINISHED_WITH_ERROR',
};

type FinalizedReceiptClassification = {
  kind: 'SUCCESS' | 'CONSENSUS_REJECTED' | 'EXECUTION_ERROR' | 'UNKNOWN';
  resultName: string;
  executionName: string;
};

function normalizeReceiptValue(value: unknown, numberMap: Record<string, string>): string {
  if (typeof value === 'number' || typeof value === 'bigint') {
    return numberMap[String(value)] || String(value);
  }
  if (typeof value !== 'string') return '';
  return numberMap[value] || value.toUpperCase();
}

export function classifyFinalizedReceipt(receipt: unknown): FinalizedReceiptClassification {
  const value = (receipt || {}) as {
    result?: unknown;
    resultName?: unknown;
    txExecutionResult?: unknown;
    txExecutionResultName?: unknown;
  };
  const resultName = normalizeReceiptValue(value.resultName ?? value.result, TRANSACTION_RESULT_BY_NUMBER);
  const executionName = normalizeReceiptValue(
    value.txExecutionResultName ?? value.txExecutionResult,
    EXECUTION_RESULT_BY_NUMBER
  );

  if (resultName === 'NO_MAJORITY' || resultName === 'MAJORITY_DISAGREE') {
    return { kind: 'CONSENSUS_REJECTED', resultName, executionName };
  }
  if (resultName === 'FAILURE' || executionName === ExecutionResult.FINISHED_WITH_ERROR) {
    return { kind: 'EXECUTION_ERROR', resultName, executionName };
  }
  if (
    (resultName === TransactionResult.SUCCESS || resultName === 'MAJORITY_AGREE') &&
    (!executionName || executionName === ExecutionResult.FINISHED_WITH_RETURN)
  ) {
    return { kind: 'SUCCESS', resultName, executionName };
  }
  return { kind: 'UNKNOWN', resultName, executionName };
}

export const ALLOWED_DECISIONS = new Set([
  'MATCHES_NOTICE',
  'MATERIAL_CHANGE',
  'NO_FINAL_ACTION',
  'SOURCES_NOT_COMPARABLE',
  'UNRESOLVED',
]);

export const ALLOWED_MEETING_MATCH = new Set(['EXACT', 'MISMATCH', 'UNCLEAR']);
export const ALLOWED_ITEM_MATCH = new Set(['EXACT', 'PARTIAL', 'MISSING', 'UNCLEAR']);
export const ALLOWED_OUTCOME_MATCH = new Set(['MATCHING', 'MATERIAL_CHANGE', 'NO_ACTION', 'UNCLEAR']);
export const ALLOWED_AGENDA_RECORD_TYPE = new Set(['NOTICE', 'AGENDA', 'UNKNOWN']);
export const ALLOWED_OUTCOME_RECORD_TYPE = new Set(['MINUTES', 'RESOLUTION', 'DECISION_LOG', 'UNKNOWN']);

export const ALLOWLIST_REASON_CODES = new Set([
  'MEETING_ID_MATCH',
  'MEETING_ID_MISMATCH',
  'ITEM_MATCH',
  'ITEM_PARTIAL_MATCH',
  'ITEM_NOT_FOUND',
  'ACTION_MATCH',
  'ACTION_CHANGED',
  'NO_ACTION_RECORDED',
  'OUTCOME_SOURCE_MISSING',
  'SOURCE_UNAVAILABLE',
  'SOURCE_MALFORMED',
  'SOURCE_HOST_MISMATCH',
  'SOURCE_TYPE_MISMATCH',
  'SOURCE_CONFLICT',
  'AMBIGUOUS_WORDING',
  'OVERSIZED_EVIDENCE',
  'PROMPT_INJECTION_IGNORED',
  'UNRESOLVED_EVIDENCE',
]);

const DECISION_ALLOWED_REASON_CODES: Record<string, Set<string>> = {
  MATCHES_NOTICE: new Set(['MEETING_ID_MATCH', 'ITEM_MATCH', 'ACTION_MATCH', 'PROMPT_INJECTION_IGNORED']),
  MATERIAL_CHANGE: new Set([
    'MEETING_ID_MATCH',
    'ITEM_MATCH',
    'ITEM_PARTIAL_MATCH',
    'ACTION_CHANGED',
    'PROMPT_INJECTION_IGNORED',
  ]),
  NO_FINAL_ACTION: new Set(['MEETING_ID_MATCH', 'ITEM_MATCH', 'NO_ACTION_RECORDED', 'PROMPT_INJECTION_IGNORED']),
  SOURCES_NOT_COMPARABLE: new Set([
    'MEETING_ID_MISMATCH',
    'ITEM_NOT_FOUND',
    'SOURCE_TYPE_MISMATCH',
    'SOURCE_CONFLICT',
    'PROMPT_INJECTION_IGNORED',
  ]),
  UNRESOLVED: new Set([
    'OUTCOME_SOURCE_MISSING',
    'SOURCE_UNAVAILABLE',
    'SOURCE_MALFORMED',
    'SOURCE_CONFLICT',
    'AMBIGUOUS_WORDING',
    'OVERSIZED_EVIDENCE',
    'UNRESOLVED_EVIDENCE',
    'PROMPT_INJECTION_IGNORED',
  ]),
};

export function buildCanonicalKey(params: {
  jurisdictionKey: string;
  meetingKey: string;
  itemKey: string;
  agendaUrl: string;
  outcomeUrl: string;
}): string {
  const cJur = validateIdentityKey(params.jurisdictionKey, 'jurisdiction_key');
  const cMeet = validateIdentityKey(params.meetingKey, 'meeting_key');
  const cItem = validateIdentityKey(params.itemKey, 'item_key');
  const cAgenda = params.agendaUrl.trim().toLowerCase();
  const cOutcome = params.outcomeUrl.trim().toLowerCase();
  return `${POLICY_VERSION}:${cJur}:${cMeet}:${cItem}:${cAgenda}:${cOutcome}`;
}

export function isValidHex32(val: unknown): boolean {
  return typeof val === 'string' && /^0x[a-fA-F0-9]{64}$/.test(val);
}

export function isPositiveSafeInteger(val: unknown): boolean {
  return typeof val === 'number' && Number.isFinite(val) && Number.isSafeInteger(val) && val > 0;
}

export function isNonNegativeSafeInteger(val: unknown): boolean {
  return typeof val === 'number' && Number.isFinite(val) && Number.isSafeInteger(val) && val >= 0;
}

function equalStringArrays(left: unknown, right: unknown): boolean {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => typeof value === 'string' && value === right[index])
  );
}

function snapshotsEqual(left: AssessmentSnapshot, right: AssessmentSnapshot): boolean {
  return (
    left?.decision === right?.decision &&
    left?.meeting_match === right?.meeting_match &&
    left?.item_match === right?.item_match &&
    left?.outcome_match === right?.outcome_match &&
    left?.agenda_record_type === right?.agenda_record_type &&
    left?.outcome_record_type === right?.outcome_record_type &&
    equalStringArrays(left?.reason_codes, right?.reason_codes) &&
    left?.normalized_item_label === right?.normalized_item_label &&
    left?.normalized_action_label === right?.normalized_action_label &&
    equalStringArrays(left?.source_locators, right?.source_locators) &&
    left?.agenda_fingerprint === right?.agenda_fingerprint &&
    left?.outcome_fingerprint === right?.outcome_fingerprint &&
    left?.evidence_fingerprint === right?.evidence_fingerprint &&
    left?.assessed_at === right?.assessed_at
  );
}

function snapshotMatchesRecord(snapshot: AssessmentSnapshot, record: RecordData): boolean {
  return snapshotsEqual(snapshot, {
    decision: record.current_decision,
    meeting_match: record.meeting_match,
    item_match: record.item_match,
    outcome_match: record.outcome_match,
    agenda_record_type: record.agenda_record_type,
    outcome_record_type: record.outcome_record_type,
    reason_codes: record.reason_codes,
    normalized_item_label: record.normalized_item_label,
    normalized_action_label: record.normalized_action_label,
    source_locators: record.source_locators,
    agenda_fingerprint: record.agenda_fingerprint,
    outcome_fingerprint: record.outcome_fingerprint,
    evidence_fingerprint: record.evidence_fingerprint,
    assessed_at: record.assessed_at,
  });
}

export function getGenLayerReadClient() {
  return createClient({
    chain: studionet,
    endpoint: STUDIONET_RPC_URL,
  });
}

export async function getGenLayerWriteClient(accountAddress: string, provider: BrowserEthereumProvider) {
  return createClient({
    chain: studionet,
    endpoint: STUDIONET_RPC_URL,
    account: accountAddress as `0x${string}`,
    provider: provider as never,
  });
}

export async function verifyAndConnectWallet(
  forceSelection = false,
  previousAccount?: string
): Promise<WalletConnection> {
  const activeConnection = getActiveWalletConnection();
  if (!forceSelection && activeConnection) {
    try {
      await assertWalletConnectionCurrent(activeConnection, STUDIONET_WALLET_CONFIG);
      return activeConnection;
    } catch {
      clearRememberedWallet();
    }
  }
  const candidate = await selectWalletProvider(forceSelection);
  return connectWalletCandidate(candidate, STUDIONET_WALLET_CONFIG, {
    forceAccountSelection: forceSelection,
    previousAccount,
  });
}

export async function readContractRecord(recordId: number): Promise<RecordData | null> {
  if (!IS_CONFIGURED) return null;
  const client = getGenLayerReadClient();
  try {
    const data = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'get_record',
      args: [BigInt(recordId)],
    });
    return data as unknown as RecordData;
  } catch (error) {
    console.error('Error reading record:', error);
    return null;
  }
}

export async function readContractRecordByKey(canonicalKey: string): Promise<RecordData | null> {
  if (!IS_CONFIGURED) return null;
  const client = getGenLayerReadClient();
  try {
    const data = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'get_record_by_key',
      args: [canonicalKey],
    });
    return data as unknown as RecordData;
  } catch (error) {
    console.error('Error reading record by key:', error);
    return null;
  }
}

export async function readRecordCount(): Promise<number> {
  if (!IS_CONFIGURED) return 0;
  const client = getGenLayerReadClient();
  try {
    const data = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'get_record_count',
      args: [],
    });
    return Number(data);
  } catch (error) {
    console.error('Error reading record count:', error);
    return 0;
  }
}

export function verifyRegistrationReadback(
  record: RecordData | null,
  cleanParams: {
    jurisdictionKey: string;
    meetingKey: string;
    itemKey: string;
    agendaUrl: string;
    outcomeUrl: string;
  }
): boolean {
  if (!record) return false;
  if (!isPositiveSafeInteger(record.record_id)) return false;

  const expectedCanonicalKey = buildCanonicalKey(cleanParams);
  if (record.canonical_key !== expectedCanonicalKey) return false;

  if (record.jurisdiction_key !== cleanParams.jurisdictionKey) return false;
  if (record.meeting_key !== cleanParams.meetingKey) return false;
  if (record.item_key !== cleanParams.itemKey) return false;
  if (record.agenda_url !== cleanParams.agendaUrl) return false;
  if (record.outcome_url !== cleanParams.outcomeUrl) return false;

  if (record.source_host !== UTAH_SOURCE_HOST) return false;
  if (record.policy_version !== POLICY_VERSION) return false;
  if (record.current_decision !== 'REGISTERED') return false;
  if (record.meeting_match !== 'UNCLEAR') return false;
  if (record.item_match !== 'UNCLEAR') return false;
  if (record.outcome_match !== 'UNCLEAR') return false;
  if (record.agenda_record_type !== 'UNKNOWN') return false;
  if (record.outcome_record_type !== 'UNKNOWN') return false;

  if (record.assessment_count !== 0 || record.retry_count !== 0) return false;
  if (record.assessed_at !== '') return false;
  if (record.agenda_fingerprint !== '' || record.outcome_fingerprint !== '' || record.evidence_fingerprint !== '') {
    return false;
  }

  if (!Array.isArray(record.reason_codes) || record.reason_codes.length !== 0) return false;
  if (!Array.isArray(record.source_locators) || record.source_locators.length !== 0) return false;
  if (!Array.isArray(record.history) || record.history.length !== 0) return false;

  if (typeof record.submitter !== 'string' || !record.submitter) return false;
  if (typeof record.created_at !== 'string' || !record.created_at) return false;
  if (typeof record.normalized_item_label !== 'string' || !record.normalized_item_label) return false;
  if (typeof record.normalized_action_label !== 'string' || !record.normalized_action_label) return false;

  return true;
}

export function verifyFrozenRecordIdentity(record: RecordData | null, requestedRecordId: number): boolean {
  if (!record || !isPositiveSafeInteger(requestedRecordId)) return false;
  if (!isPositiveSafeInteger(record.record_id) || record.record_id !== requestedRecordId) return false;

  try {
    const cleanParams = validateRegistrationParams({
      jurisdictionKey: record.jurisdiction_key,
      meetingKey: record.meeting_key,
      itemKey: record.item_key,
      agendaUrl: record.agenda_url,
      outcomeUrl: record.outcome_url,
      sourceHost: record.source_host,
    });
    const expectedCanonicalKey = buildCanonicalKey(cleanParams);

    return (
      record.jurisdiction_key === cleanParams.jurisdictionKey &&
      record.meeting_key === cleanParams.meetingKey &&
      record.item_key === cleanParams.itemKey &&
      record.agenda_url === cleanParams.agendaUrl &&
      record.outcome_url === cleanParams.outcomeUrl &&
      record.source_host === UTAH_SOURCE_HOST &&
      record.policy_version === POLICY_VERSION &&
      record.canonical_key === expectedCanonicalKey
    );
  } catch {
    return false;
  }
}

export function verifyPostStateInvariants(
  preRecord: RecordData,
  postRecord: RecordData | null,
  requestedRecordId: number
): boolean {
  try {
    if (!postRecord) return false;

    // A. Record Identity & Canonical Key Recomputation
    if (!verifyFrozenRecordIdentity(preRecord, requestedRecordId)) return false;
    if (!verifyFrozenRecordIdentity(postRecord, requestedRecordId)) return false;

    if (postRecord.jurisdiction_key !== preRecord.jurisdiction_key) return false;
    if (postRecord.meeting_key !== preRecord.meeting_key) return false;
    if (postRecord.item_key !== preRecord.item_key) return false;
    if (postRecord.agenda_url !== preRecord.agenda_url) return false;
    if (postRecord.outcome_url !== preRecord.outcome_url) return false;
    if (postRecord.source_host !== UTAH_SOURCE_HOST || preRecord.source_host !== UTAH_SOURCE_HOST) return false;
    if (postRecord.policy_version !== POLICY_VERSION || preRecord.policy_version !== POLICY_VERSION) return false;

    // B. Counters
    if (!isNonNegativeSafeInteger(preRecord.assessment_count) || !isNonNegativeSafeInteger(preRecord.retry_count)) {
      return false;
    }
    if (!isNonNegativeSafeInteger(postRecord.assessment_count) || !isNonNegativeSafeInteger(postRecord.retry_count)) {
      return false;
    }
    if (postRecord.assessment_count !== preRecord.assessment_count + 1) return false;
    if (postRecord.retry_count !== preRecord.retry_count + 1) return false;

    // C. Timestamp
    if (typeof preRecord.assessed_at !== 'string' || typeof postRecord.assessed_at !== 'string') return false;
    if (!postRecord.assessed_at || postRecord.assessed_at === preRecord.assessed_at) return false;

    // D. Decisions & Matches Allowlist and Semantic Consistency
    if (!ALLOWED_DECISIONS.has(postRecord.current_decision)) return false;
    if (!ALLOWED_MEETING_MATCH.has(postRecord.meeting_match)) return false;
    if (!ALLOWED_ITEM_MATCH.has(postRecord.item_match)) return false;
    if (!ALLOWED_OUTCOME_MATCH.has(postRecord.outcome_match)) return false;
    if (!ALLOWED_AGENDA_RECORD_TYPE.has(postRecord.agenda_record_type)) return false;
    if (!ALLOWED_OUTCOME_RECORD_TYPE.has(postRecord.outcome_record_type)) return false;

    const agendaRoleValid = postRecord.agenda_record_type === 'NOTICE' || postRecord.agenda_record_type === 'AGENDA';
    const outcomeRoleValid =
      postRecord.outcome_record_type === 'MINUTES' ||
      postRecord.outcome_record_type === 'RESOLUTION' ||
      postRecord.outcome_record_type === 'DECISION_LOG';

    // E. Reason Codes
    if (!Array.isArray(postRecord.reason_codes) || postRecord.reason_codes.length < 1 || postRecord.reason_codes.length > 8) {
      return false;
    }
    if (postRecord.reason_codes.some((code) => typeof code !== 'string' || !ALLOWLIST_REASON_CODES.has(code))) {
      return false;
    }
    if (new Set(postRecord.reason_codes).size !== postRecord.reason_codes.length) return false;

    const reasonSet = new Set(postRecord.reason_codes);
    const allowedReasons = DECISION_ALLOWED_REASON_CODES[postRecord.current_decision];
    if (!allowedReasons || [...reasonSet].some((reason) => !allowedReasons.has(reason))) return false;

    if (postRecord.current_decision === 'MATCHES_NOTICE') {
      if (
        postRecord.meeting_match !== 'EXACT' ||
        postRecord.item_match !== 'EXACT' ||
        postRecord.outcome_match !== 'MATCHING' ||
        !reasonSet.has('MEETING_ID_MATCH') ||
        !reasonSet.has('ITEM_MATCH') ||
        !reasonSet.has('ACTION_MATCH')
      ) {
        return false;
      }
    } else if (postRecord.current_decision === 'MATERIAL_CHANGE') {
      const itemReasonConsistent =
        (postRecord.item_match === 'EXACT' && reasonSet.has('ITEM_MATCH') && !reasonSet.has('ITEM_PARTIAL_MATCH')) ||
        (postRecord.item_match === 'PARTIAL' && reasonSet.has('ITEM_PARTIAL_MATCH') && !reasonSet.has('ITEM_MATCH'));
      if (
        postRecord.meeting_match !== 'EXACT' ||
        (postRecord.item_match !== 'EXACT' && postRecord.item_match !== 'PARTIAL') ||
        postRecord.outcome_match !== 'MATERIAL_CHANGE' ||
        !reasonSet.has('MEETING_ID_MATCH') ||
        !reasonSet.has('ACTION_CHANGED') ||
        !itemReasonConsistent
      ) {
        return false;
      }
    } else if (postRecord.current_decision === 'NO_FINAL_ACTION') {
      if (
        postRecord.meeting_match !== 'EXACT' ||
        postRecord.item_match !== 'EXACT' ||
        postRecord.outcome_match !== 'NO_ACTION' ||
        !reasonSet.has('MEETING_ID_MATCH') ||
        !reasonSet.has('ITEM_MATCH') ||
        !reasonSet.has('NO_ACTION_RECORDED')
      ) {
        return false;
      }
    } else if (postRecord.current_decision === 'SOURCES_NOT_COMPARABLE') {
      const meetingMismatch = postRecord.meeting_match === 'MISMATCH';
      const itemMissing = postRecord.item_match === 'MISSING';
      const typeMismatch = !agendaRoleValid || !outcomeRoleValid;
      const sourceConflict =
        postRecord.meeting_match === 'EXACT' &&
        postRecord.item_match === 'EXACT' &&
        postRecord.outcome_match === 'UNCLEAR' &&
        agendaRoleValid &&
        outcomeRoleValid;
      const supported =
        !reasonSet.has('SOURCE_HOST_MISMATCH') &&
        reasonSet.has('MEETING_ID_MISMATCH') === meetingMismatch &&
        reasonSet.has('ITEM_NOT_FOUND') === itemMissing &&
        reasonSet.has('SOURCE_TYPE_MISMATCH') === typeMismatch &&
        reasonSet.has('SOURCE_CONFLICT') === sourceConflict &&
        (meetingMismatch || itemMissing || typeMismatch || sourceConflict);
      if (!supported) return false;
    } else if (postRecord.current_decision === 'UNRESOLVED') {
      const hasUnresolvedReason =
        reasonSet.has('OUTCOME_SOURCE_MISSING') ||
        reasonSet.has('SOURCE_UNAVAILABLE') ||
        reasonSet.has('SOURCE_MALFORMED') ||
        reasonSet.has('SOURCE_CONFLICT') ||
        reasonSet.has('AMBIGUOUS_WORDING') ||
        reasonSet.has('OVERSIZED_EVIDENCE') ||
        reasonSet.has('UNRESOLVED_EVIDENCE');
      if (!hasUnresolvedReason) return false;
    }

    // F. Fingerprints
    if (!isValidHex32(postRecord.agenda_fingerprint)) return false;
    if (!isValidHex32(postRecord.outcome_fingerprint)) return false;
    if (!isValidHex32(postRecord.evidence_fingerprint)) return false;

    // G. Labels, Locators, History
    if (typeof postRecord.normalized_item_label !== 'string' || !postRecord.normalized_item_label || postRecord.normalized_item_label.length > 100) {
      return false;
    }
    if (typeof postRecord.normalized_action_label !== 'string' || !postRecord.normalized_action_label || postRecord.normalized_action_label.length > 100) {
      return false;
    }
    if (!Array.isArray(postRecord.source_locators) || postRecord.source_locators.length > 5) return false;
    if (postRecord.source_locators.some((loc) => typeof loc !== 'string' || loc.length > 100)) return false;
    if (new Set(postRecord.source_locators).size !== postRecord.source_locators.length) return false;

    if (!Array.isArray(preRecord.history) || !Array.isArray(postRecord.history)) return false;
    if (preRecord.history.length > 49 || postRecord.history.length > 49) return false;
    const unchangedHistoryPrefix = preRecord.history.every((snapshot, index) =>
      snapshotsEqual(snapshot, postRecord.history[index])
    );
    if (!unchangedHistoryPrefix) return false;

    if (preRecord.current_decision === 'REGISTERED') {
      if (postRecord.history.length !== preRecord.history.length) return false;
    } else {
      if (!ALLOWED_DECISIONS.has(preRecord.current_decision)) return false;
      if (postRecord.history.length !== preRecord.history.length + 1) return false;
      if (!snapshotMatchesRecord(postRecord.history[postRecord.history.length - 1], preRecord)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function executeRegisterRecord(
  params: RegisterRecordInputParams,
  onStatusUpdate: (status: TxStatus) => void,
  walletConnection?: WalletConnection
): Promise<RecordData | null> {
  if (!IS_CONFIGURED) {
    onStatusUpdate({
      stage: 'ERROR',
      error: 'Deployment not configured. VITE_CONTRACT_ADDRESS is missing.',
    });
    return null;
  }

  let cleanParams;
  try {
    cleanParams = validateRegistrationParams(params);
  } catch (validationErr: any) {
    onStatusUpdate({
      stage: 'ERROR',
      error: validationErr?.message || 'Invalid registration parameters.',
    });
    return null;
  }

  try {
    onStatusUpdate({ stage: 'CONNECTING', message: 'Connecting wallet & verifying Studionet network...' });
    const connection = walletConnection || await verifyAndConnectWallet();
    const { account, provider } = connection;

    const writeClient = await getGenLayerWriteClient(account, provider);
    const readClient = getGenLayerReadClient();

    onStatusUpdate({ stage: 'SUBMITTING', message: 'Submitting record registration transaction...' });
    await assertWalletConnectionCurrent(connection, STUDIONET_WALLET_CONFIG);

    const txHash = await writeClient.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'register_record',
      args: [
        cleanParams.jurisdictionKey,
        cleanParams.meetingKey,
        cleanParams.itemKey,
        cleanParams.agendaUrl,
        cleanParams.outcomeUrl,
        cleanParams.sourceHost,
      ],
      value: 0n,
    });

    onStatusUpdate({ stage: 'PENDING', txHash, message: 'Transaction submitted. Awaiting validator proposal & consensus...' });
    onStatusUpdate({ stage: 'CONSENSUS', txHash, message: 'Awaiting GenLayer validator consensus...' });

    const receipt = await readClient.waitForTransactionReceipt({
      hash: txHash as TransactionHash,
      status: TransactionStatus.FINALIZED,
      interval: 3_000,
      retries: 50,
    });

    const receiptClassification = classifyFinalizedReceipt(receipt);
    if (receiptClassification.kind === 'CONSENSUS_REJECTED') {
      onStatusUpdate({
        stage: 'UNDETERMINED',
        txHash,
        error: `Transaction finalized with ${receiptClassification.resultName}; validators did not accept a registration state update.`,
      });
      return null;
    }
    if (receiptClassification.kind !== 'SUCCESS') {
      onStatusUpdate({
        stage: 'ERROR',
        txHash,
        error: `Transaction finalized without a successful execution (${receiptClassification.executionName || receiptClassification.resultName || 'UNKNOWN_RESULT'}).`,
      });
      return null;
    }

    onStatusUpdate({ stage: 'READBACK', txHash, message: 'Transaction finalized & execution verified. Reading back record by canonical key...' });

    const canonicalKey = buildCanonicalKey(cleanParams);
    const record = await readContractRecordByKey(canonicalKey);

    if (verifyRegistrationReadback(record, cleanParams)) {
      onStatusUpdate({ stage: 'SUCCESS', txHash, message: 'Record registered successfully on Studionet!' });
      return record;
    }

    onStatusUpdate({ stage: 'UNDETERMINED', txHash, error: 'Registration succeeded on chain, but exact readback identity verification failed.' });
    return null;

  } catch (err: any) {
    console.error('Error registering record:', err);
    onStatusUpdate({
      stage: 'ERROR',
      error: err?.message || 'Transaction failed or was rejected.',
    });
    return null;
  }
}

export async function executeEvaluateRecord(
  recordId: number,
  isReassess: boolean,
  onStatusUpdate: (status: TxStatus) => void,
  walletConnection?: WalletConnection
): Promise<RecordData | null> {
  if (!IS_CONFIGURED) {
    onStatusUpdate({
      stage: 'ERROR',
      error: 'Deployment not configured. VITE_CONTRACT_ADDRESS is missing.',
    });
    return null;
  }

  const functionName = isReassess ? 'reassess_record' : 'evaluate_record';
  const label = isReassess ? 'reassessment' : 'evaluation';

  onStatusUpdate({ stage: 'CONNECTING', message: `Fetching pre-state for record #${recordId}...` });
  const preRecord = await readContractRecord(recordId);

  if (!preRecord || preRecord.record_id !== recordId) {
    onStatusUpdate({
      stage: 'UNDETERMINED',
      error: `Pre-state readback failed. Record #${recordId} could not be retrieved from contract.`,
    });
    return null;
  }

  if (!verifyFrozenRecordIdentity(preRecord, recordId)) {
    onStatusUpdate({
      stage: 'UNDETERMINED',
      error: `Pre-state identity verification failed for record #${recordId}; no write was submitted.`,
    });
    return null;
  }

  try {
    onStatusUpdate({ stage: 'CONNECTING', message: 'Connecting wallet & verifying Studionet network...' });
    const connection = walletConnection || await verifyAndConnectWallet();
    const { account, provider } = connection;

    const writeClient = await getGenLayerWriteClient(account, provider);
    const readClient = getGenLayerReadClient();

    onStatusUpdate({ stage: 'SUBMITTING', message: `Triggering permissionless record ${label}...` });
    await assertWalletConnectionCurrent(connection, STUDIONET_WALLET_CONFIG);

    const txHash = await writeClient.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName,
      args: [BigInt(recordId)],
      value: 0n,
    });

    onStatusUpdate({ stage: 'PENDING', txHash, message: 'Transaction submitted to Studionet...' });
    onStatusUpdate({ stage: 'CONSENSUS', txHash, message: 'Validators independently fetching & comparing public sources...' });

    const receipt = await readClient.waitForTransactionReceipt({
      hash: txHash as TransactionHash,
      status: TransactionStatus.FINALIZED,
      interval: 3_000,
      retries: 50,
    });

    const receiptClassification = classifyFinalizedReceipt(receipt);
    if (receiptClassification.kind === 'CONSENSUS_REJECTED') {
      const unchangedRecord = await readContractRecord(recordId);
      const stateUnchanged = Boolean(
        unchangedRecord &&
        unchangedRecord.assessment_count === preRecord.assessment_count &&
        unchangedRecord.retry_count === preRecord.retry_count &&
        unchangedRecord.current_decision === preRecord.current_decision &&
        unchangedRecord.evidence_fingerprint === preRecord.evidence_fingerprint
      );
      onStatusUpdate({
        stage: 'UNDETERMINED',
        txHash,
        error: `Transaction finalized with ${receiptClassification.resultName}; validators did not accept the proposed ${label}${stateUnchanged ? ' and authoritative readback confirms state is unchanged' : ''}.`,
      });
      return null;
    }
    if (receiptClassification.kind !== 'SUCCESS') {
      onStatusUpdate({
        stage: 'ERROR',
        txHash,
        error: `Transaction finalized without a successful ${label} execution (${receiptClassification.executionName || receiptClassification.resultName || 'UNKNOWN_RESULT'}).`,
      });
      return null;
    }

    onStatusUpdate({ stage: 'READBACK', txHash, message: 'Consensus achieved. Performing authoritative post-state readback & verification...' });

    const postRecord = await readContractRecord(recordId);

    if (verifyPostStateInvariants(preRecord, postRecord, recordId)) {
      onStatusUpdate({ stage: 'SUCCESS', txHash, message: `Record ${label} complete with state advancement!` });
      return postRecord;
    }

    onStatusUpdate({
      stage: 'UNDETERMINED',
      txHash,
      error: `Transaction finalized, but contract storage remained unchanged or post-state invariants failed.`,
    });
    return null;

  } catch (err: any) {
    console.error(`Error in ${label}:`, err);
    onStatusUpdate({
      stage: 'ERROR',
      error: err?.message || `${label} transaction failed or was rejected.`,
    });
    return null;
  }
}
