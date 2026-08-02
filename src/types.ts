export type DecisionVerdict =
  | 'REGISTERED'
  | 'MATCHES_NOTICE'
  | 'MATERIAL_CHANGE'
  | 'NO_FINAL_ACTION'
  | 'SOURCES_NOT_COMPARABLE'
  | 'UNRESOLVED';

export type MeetingMatch = 'EXACT' | 'MISMATCH' | 'UNCLEAR';
export type ItemMatch = 'EXACT' | 'PARTIAL' | 'MISSING' | 'UNCLEAR';
export type OutcomeMatch = 'MATCHING' | 'MATERIAL_CHANGE' | 'NO_ACTION' | 'UNCLEAR';
export type AgendaRecordType = 'NOTICE' | 'AGENDA' | 'UNKNOWN';
export type OutcomeRecordType = 'MINUTES' | 'RESOLUTION' | 'DECISION_LOG' | 'UNKNOWN';

export interface AssessmentSnapshot {
  assessed_at: string;
  decision: DecisionVerdict;
  meeting_match: MeetingMatch;
  item_match: ItemMatch;
  outcome_match: OutcomeMatch;
  agenda_record_type: AgendaRecordType;
  outcome_record_type: OutcomeRecordType;
  reason_codes: string[];
  normalized_item_label: string;
  normalized_action_label: string;
  source_locators: string[];
  agenda_fingerprint: string;
  outcome_fingerprint: string;
  evidence_fingerprint: string;
}

export interface RecordData {
  record_id: number;
  canonical_key: string;
  jurisdiction_key: string;
  meeting_key: string;
  item_key: string;
  agenda_url: string;
  outcome_url: string;
  source_host: string;
  policy_version: string;
  submitter: string;
  created_at: string;
  current_decision: DecisionVerdict;
  meeting_match: MeetingMatch;
  item_match: ItemMatch;
  outcome_match: OutcomeMatch;
  agenda_record_type: AgendaRecordType;
  outcome_record_type: OutcomeRecordType;
  reason_codes: string[];
  normalized_item_label: string;
  normalized_action_label: string;
  source_locators: string[];
  agenda_fingerprint: string;
  outcome_fingerprint: string;
  evidence_fingerprint: string;
  assessed_at: string;
  assessment_count: number;
  retry_count: number;
  history: AssessmentSnapshot[];
}

export type TxStage =
  | 'IDLE'
  | 'CONNECTING'
  | 'SUBMITTING'
  | 'PENDING'
  | 'CONSENSUS'
  | 'FINALIZING'
  | 'READBACK'
  | 'SUCCESS'
  | 'ERROR'
  | 'UNDETERMINED';

export interface TxStatus {
  stage: TxStage;
  txHash?: string;
  message?: string;
  error?: string;
}
