export interface ReasonCodeMeta {
  code: string;
  label: string;
  description: string;
  category: 'IDENTITY' | 'ACTION' | 'SOURCE' | 'SECURITY';
}

export const REASON_CODES_MAP: Record<string, ReasonCodeMeta> = {
  MEETING_ID_MATCH: {
    code: 'MEETING_ID_MATCH',
    label: 'Meeting Identity Match',
    description: 'Both notice and outcome sources refer to the exact same meeting identity.',
    category: 'IDENTITY',
  },
  MEETING_ID_MISMATCH: {
    code: 'MEETING_ID_MISMATCH',
    label: 'Meeting Mismatch',
    description: 'The outcome source refers to a different meeting date or docket identity.',
    category: 'IDENTITY',
  },
  ITEM_MATCH: {
    code: 'ITEM_MATCH',
    label: 'Item Matched',
    description: 'The target item number or canonical description matches between both records.',
    category: 'IDENTITY',
  },
  ITEM_PARTIAL_MATCH: {
    code: 'ITEM_PARTIAL_MATCH',
    label: 'Partial Item Match',
    description: 'The item label or scope matches partially but contains minor alignment variance.',
    category: 'IDENTITY',
  },
  ITEM_NOT_FOUND: {
    code: 'ITEM_NOT_FOUND',
    label: 'Item Not Found',
    description: 'The target meeting item was not identified in the outcome source.',
    category: 'IDENTITY',
  },
  ACTION_MATCH: {
    code: 'ACTION_MATCH',
    label: 'Action Consistent',
    description: 'The recorded outcome action materially matches the pre-meeting notice.',
    category: 'ACTION',
  },
  ACTION_CHANGED: {
    code: 'ACTION_CHANGED',
    label: 'Action Modified',
    description: 'The outcome record describes a material change in vote, scope, amount, or conditions.',
    category: 'ACTION',
  },
  NO_ACTION_RECORDED: {
    code: 'NO_ACTION_RECORDED',
    label: 'No Final Action',
    description: 'The outcome record explicitly documents deferral, tabling, withdrawal, or no vote taken.',
    category: 'ACTION',
  },
  OUTCOME_SOURCE_MISSING: {
    code: 'OUTCOME_SOURCE_MISSING',
    label: 'Outcome Missing',
    description: 'The outcome minutes or resolution URL could not be fetched or read.',
    category: 'SOURCE',
  },
  SOURCE_UNAVAILABLE: {
    code: 'SOURCE_UNAVAILABLE',
    label: 'Source Unavailable',
    description: 'One or both specified public source URLs returned a fetch or render error.',
    category: 'SOURCE',
  },
  SOURCE_MALFORMED: {
    code: 'SOURCE_MALFORMED',
    label: 'Source Malformed',
    description: 'The retrieved document text was empty, unreadable, or corrupted.',
    category: 'SOURCE',
  },
  SOURCE_HOST_MISMATCH: {
    code: 'SOURCE_HOST_MISMATCH',
    label: 'Host Mismatch',
    description: 'Source URL host does not match the bound source host.',
    category: 'SOURCE',
  },
  SOURCE_TYPE_MISMATCH: {
    code: 'SOURCE_TYPE_MISMATCH',
    label: 'Source Type Mismatch',
    description: 'Source document types are incompatible for agenda-to-outcome comparison.',
    category: 'SOURCE',
  },
  SOURCE_CONFLICT: {
    code: 'SOURCE_CONFLICT',
    label: 'Source Conflict',
    description: 'Internal contradictions were found between the provided record documents.',
    category: 'SOURCE',
  },
  AMBIGUOUS_WORDING: {
    code: 'AMBIGUOUS_WORDING',
    label: 'Ambiguous Record',
    description: 'The document text contains ambiguous wording preventing conclusive alignment.',
    category: 'SOURCE',
  },
  OVERSIZED_EVIDENCE: {
    code: 'OVERSIZED_EVIDENCE',
    label: 'Evidence Exceeds Bounds',
    description: 'The retrieved record document exceeded maximum evaluation byte bounds.',
    category: 'SOURCE',
  },
  PROMPT_INJECTION_IGNORED: {
    code: 'PROMPT_INJECTION_IGNORED',
    label: 'Injection Attack Neutralized',
    description: 'Embedded text instructions in source document were detected and ignored by consensus.',
    category: 'SECURITY',
  },
  UNRESOLVED_EVIDENCE: {
    code: 'UNRESOLVED_EVIDENCE',
    label: 'Evidence Unresolved',
    description: 'The available public evidence was insufficient for a conclusive decision.',
    category: 'SOURCE',
  },
};
