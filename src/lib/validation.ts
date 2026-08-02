export const UTAH_SOURCE_HOST = 'www.utah.gov';
export const UTAH_NOTICE_URL_PREFIX = 'https://www.utah.gov/pmn/sitemap/notice/';
export const UTAH_NOTICE_URL_SUFFIX = '.html';

export const MAX_FIELD_LENGTH = 256;
export const MAX_IDENTITY_KEY_LENGTH = 80;
export const MAX_URL_LENGTH = 1024;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function isAsciiDigits(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

export function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function validateNonEmptyString(val: unknown, fieldName: string, maxLen = MAX_FIELD_LENGTH): string {
  if (typeof val !== 'string') {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Must be string`);
  }

  // Check for control characters BEFORE trimming
  if (hasControlChars(val)) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Contains control characters`);
  }

  const trimmed = val.trim();
  if (!trimmed) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Empty value`);
  }

  if (trimmed.length > maxLen) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Exceeds maximum length ${maxLen}`);
  }

  return trimmed;
}

export function validateIdentityKey(val: unknown, fieldName: string): string {
  if (typeof val === 'string' && val !== val.trim()) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Leading or trailing whitespace is forbidden`);
  }
  const clean = validateNonEmptyString(val, fieldName, MAX_IDENTITY_KEY_LENGTH);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) {
    throw new ValidationError(
      `ERR_INVALID_${fieldName.toUpperCase()}: Must match lowercase ASCII slug grammar [a-z0-9]+(-[a-z0-9]+)*`
    );
  }
  return clean;
}

export function validateSourceHost(val: unknown): string {
  if (val === undefined) {
    return UTAH_SOURCE_HOST;
  }
  if (typeof val !== 'string') {
    throw new ValidationError('ERR_INVALID_SOURCE_HOST: Must be string');
  }

  if (hasControlChars(val)) {
    throw new ValidationError('ERR_INVALID_SOURCE_HOST: Contains control characters');
  }

  const trimmed = val.trim().toLowerCase();
  if (!trimmed) {
    throw new ValidationError('ERR_INVALID_SOURCE_HOST: Empty or whitespace host is forbidden');
  }

  if (trimmed !== UTAH_SOURCE_HOST) {
    throw new ValidationError('ERR_INVALID_SOURCE_HOST: Production V1 host must be www.utah.gov');
  }

  return trimmed;
}

export function validateUtahNoticeUrl(url: unknown, expectedHost: string, fieldName: string): string {
  if (typeof url !== 'string') {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Must be string`);
  }

  if (hasControlChars(url)) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Contains control characters`);
  }

  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Invalid URL length`);
  }

  // Forbidden characters: %, \, ?, #, @, ..
  if (trimmed.includes('%')) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Percent encoding (%) is forbidden`);
  }
  if (
    trimmed.includes('\\') ||
    trimmed.includes('?') ||
    trimmed.includes('#') ||
    trimmed.includes('@') ||
    trimmed.includes('..')
  ) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Forbidden URL character or structure`);
  }
  if (trimmed.slice(8).includes(':')) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Ports in URL are forbidden`);
  }

  if (!trimmed.startsWith(UTAH_NOTICE_URL_PREFIX) || !trimmed.endsWith(UTAH_NOTICE_URL_SUFFIX)) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Must match exact Utah PMN notice URL grammar`);
  }

  const noticeId = trimmed.slice(UTAH_NOTICE_URL_PREFIX.length, -UTAH_NOTICE_URL_SUFFIX.length);
  if (!isAsciiDigits(noticeId)) {
    throw new ValidationError(`ERR_INVALID_${fieldName.toUpperCase()}: Notice ID must be non-empty ASCII decimal digits`);
  }

  if (expectedHost !== UTAH_SOURCE_HOST) {
    throw new ValidationError(`ERR_${fieldName.toUpperCase()}_HOST_MISMATCH: URL host does not match source host 'www.utah.gov'`);
  }

  return trimmed;
}

export interface RegisterRecordInputParams {
  jurisdictionKey: string;
  meetingKey: string;
  itemKey: string;
  agendaUrl: string;
  outcomeUrl: string;
  sourceHost?: string;
}

export interface ValidatedRegisterRecordParams {
  jurisdictionKey: string;
  meetingKey: string;
  itemKey: string;
  agendaUrl: string;
  outcomeUrl: string;
  sourceHost: string;
}

export function validateRegistrationParams(input: RegisterRecordInputParams): ValidatedRegisterRecordParams {
  const cleanJur = validateIdentityKey(input.jurisdictionKey, 'jurisdiction_key');
  const cleanMeet = validateIdentityKey(input.meetingKey, 'meeting_key');
  const cleanItem = validateIdentityKey(input.itemKey, 'item_key');
  const cleanHost = validateSourceHost(input.sourceHost);

  const cleanAgenda = validateUtahNoticeUrl(input.agendaUrl, cleanHost, 'agenda_url');
  const cleanOutcome = validateUtahNoticeUrl(input.outcomeUrl, cleanHost, 'outcome_url');

  if (cleanAgenda === cleanOutcome) {
    throw new ValidationError('ERR_DUPLICATE_URLS: Agenda and Outcome URLs cannot be identical');
  }

  return {
    jurisdictionKey: cleanJur,
    meetingKey: cleanMeet,
    itemKey: cleanItem,
    agendaUrl: cleanAgenda,
    outcomeUrl: cleanOutcome,
    sourceHost: cleanHost,
  };
}
