import React, { useState } from 'react';
import { FilePlus, AlertCircle, Info } from 'lucide-react';
import { RecordData, TxStatus } from '../types';
import { executeRegisterRecord, IS_CONFIGURED } from '../lib/genlayer';
import { UTAH_SOURCE_HOST } from '../lib/validation';

interface RegisterRecordFormProps {
  onSuccess: (record: RecordData) => void;
  onTxStatusChange: (status: TxStatus | null) => void;
}

export const RegisterRecordForm: React.FC<RegisterRecordFormProps> = ({
  onSuccess,
  onTxStatusChange,
}) => {
  const [jurisdictionKey, setJurisdictionKey] = useState('');
  const [meetingKey, setMeetingKey] = useState('');
  const [itemKey, setItemKey] = useState('');
  const [agendaUrl, setAgendaUrl] = useState('');
  const [outcomeUrl, setOutcomeUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!IS_CONFIGURED) {
      setErrorMessage('Deployment not configured. VITE_CONTRACT_ADDRESS is missing.');
      return;
    }

    setIsSubmitting(true);
    onTxStatusChange({ stage: 'CONNECTING', message: 'Initializing transaction...' });

    try {
      const record = await executeRegisterRecord(
        {
          jurisdictionKey,
          meetingKey,
          itemKey,
          agendaUrl,
          outcomeUrl,
          sourceHost: UTAH_SOURCE_HOST,
        },
        (status) => {
          onTxStatusChange(status);
          if (status.error) {
            setErrorMessage(status.error);
          }
        }
      );

      if (record) {
        onSuccess(record);
        setJurisdictionKey('');
        setMeetingKey('');
        setItemKey('');
        setAgendaUrl('');
        setOutcomeUrl('');
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred';
      setErrorMessage(msg);
      onTxStatusChange({ stage: 'ERROR', error: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '1rem',
        }}
      >
        <FilePlus size={22} color="#60a5fa" />
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'rgb(248, 250, 252)' }}>
            Register Meeting Item Comparison Claim
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            NoticeTrail V1 supports exact Utah Public Notice (PMN) direct notice HTML pages.
          </p>
        </div>
      </div>

      <div
        style={{
          background: 'rgb(15, 23, 42)',
          border: '1px solid rgb(30, 41, 59)',
          borderRadius: '6px',
          padding: '0.875rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.8125rem',
          color: 'rgb(203, 213, 225)',
          lineHeight: '1.5',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: '600',
            color: 'rgb(96, 165, 250)',
            marginBottom: '0.25rem',
          }}
        >
          <Info size={16} /> Utah PMN Notice Grammar Rules:
        </div>
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          <li>
            Source host is fixed to <code>www.utah.gov</code>
          </li>
          <li>
            URLs must match <code>https://www.utah.gov/pmn/sitemap/notice/&lt;NOTICE_ID&gt;.html</code>
          </li>
          <li>
            Notice ID must be ASCII decimal digits only (e.g. <code>1048291</code>)
          </li>
        </ul>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--accent-red)',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#fca5a5',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <label htmlFor="register-jurisdiction-key" className="input-label">
              Jurisdiction Key *
            </label>
            <input
              id="register-jurisdiction-key"
              type="text"
              className="input-field"
              value={jurisdictionKey}
              onChange={(e) => setJurisdictionKey(e.target.value)}
              placeholder="e.g. utah-state-board"
              required
              disabled={!IS_CONFIGURED || isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="register-meeting-key" className="input-label">
              Meeting Key *
            </label>
            <input
              id="register-meeting-key"
              type="text"
              className="input-field"
              value={meetingKey}
              onChange={(e) => setMeetingKey(e.target.value)}
              placeholder="e.g. 2026-08-01-regular"
              required
              disabled={!IS_CONFIGURED || isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="register-item-key" className="input-label">
              Item Key *
            </label>
            <input
              id="register-item-key"
              type="text"
              className="input-field"
              value={itemKey}
              onChange={(e) => setItemKey(e.target.value)}
              placeholder="e.g. item-5-budget"
              required
              disabled={!IS_CONFIGURED || isSubmitting}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="register-source-host" className="input-label">
            Source Host (Fixed Production V1 Adapter)
          </label>
          <input
            id="register-source-host"
            type="text"
            className="input-field"
            value={UTAH_SOURCE_HOST}
            readOnly
            disabled
            style={{ background: 'rgb(15, 23, 42)', color: 'rgb(148, 163, 184)', cursor: 'not-allowed' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="register-agenda-url" className="input-label">
            Agenda URL (Pre-Meeting Notice HTML) *
          </label>
          <input
            id="register-agenda-url"
            type="url"
            className="input-field"
            value={agendaUrl}
            onChange={(e) => setAgendaUrl(e.target.value)}
            placeholder="https://www.utah.gov/pmn/sitemap/notice/1001.html"
            required
            disabled={!IS_CONFIGURED || isSubmitting}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="register-outcome-url" className="input-label">
            Outcome URL (Post-Meeting Minutes HTML) *
          </label>
          <input
            id="register-outcome-url"
            type="url"
            className="input-field"
            value={outcomeUrl}
            onChange={(e) => setOutcomeUrl(e.target.value)}
            placeholder="https://www.utah.gov/pmn/sitemap/notice/1002.html"
            required
            disabled={!IS_CONFIGURED || isSubmitting}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!IS_CONFIGURED || isSubmitting}
          style={{ width: '100%', padding: '0.75rem', justifyContent: 'center' }}
        >
          {isSubmitting ? 'Registering Claim...' : 'Register Comparison Claim'}
        </button>
      </form>
    </div>
  );
};
