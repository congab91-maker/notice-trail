import React, { useState } from 'react';
import {
  FileText,
  ExternalLink,
  RefreshCw,
  Play,
  Hash,
  Clock,
  User,
  Tag,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { RecordData, TxStatus } from '../types';
import { REASON_CODES_MAP } from '../constants/reasonCodes';
import { HistoryTimeline } from './HistoryTimeline';
import { executeEvaluateRecord, IS_CONFIGURED } from '../lib/genlayer';

interface RecordDetailProps {
  record: RecordData;
  onEvaluate?: (recordId: number) => void;
  onReassess?: (recordId: number) => void;
  onRecordUpdated?: (updated: RecordData) => void;
  onTxStatusChange?: (status: TxStatus) => void;
  isEvaluating?: boolean;
}

export const RecordDetail: React.FC<RecordDetailProps> = ({
  record,
  onEvaluate,
  onReassess,
  onRecordUpdated,
  onTxStatusChange,
  isEvaluating = false,
}) => {
  const [evaluating, setEvaluating] = useState(false);

  const handleEvaluateAction = async (isReassess: boolean) => {
    if (isReassess && onReassess) {
      onReassess(record.record_id);
      return;
    }
    if (!isReassess && onEvaluate) {
      onEvaluate(record.record_id);
      return;
    }
    setEvaluating(true);
    const updated = await executeEvaluateRecord(record.record_id, isReassess, (status) => {
      if (onTxStatusChange) onTxStatusChange(status);
    });
    if (updated && onRecordUpdated) {
      onRecordUpdated(updated);
    }
    setEvaluating(false);
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'MATCHES_NOTICE':
        return (
          <span className="badge badge-matches">
            <CheckCircle2 size={14} /> MATCHES NOTICE
          </span>
        );
      case 'MATERIAL_CHANGE':
        return (
          <span className="badge badge-material-change">
            <AlertTriangle size={14} /> MATERIAL CHANGE
          </span>
        );
      case 'NO_FINAL_ACTION':
        return (
          <span className="badge badge-no-action">
            <Clock size={14} /> NO FINAL ACTION
          </span>
        );
      case 'SOURCES_NOT_COMPARABLE':
        return (
          <span className="badge badge-not-comparable">
            <FileCode size={14} /> SOURCES NOT COMPARABLE
          </span>
        );
      case 'UNRESOLVED':
        return (
          <span className="badge badge-unresolved">
            <AlertTriangle size={14} /> UNRESOLVED
          </span>
        );
      default:
        return (
          <span className="badge badge-registered">
            <ShieldCheck size={14} /> REGISTERED
          </span>
        );
    }
  };

  const handleTriggerEvaluation = async (isReassess: boolean) => {
    if (!IS_CONFIGURED) return;
    if (isReassess && onReassess) {
      onReassess(record.record_id);
      return;
    }
    if (!isReassess && onEvaluate) {
      onEvaluate(record.record_id);
      return;
    }
    setEvaluating(true);
    const updated = await executeEvaluateRecord(record.record_id, isReassess, (status) => {
      if (onTxStatusChange) onTxStatusChange(status);
    });
    setEvaluating(false);
    if (updated && onRecordUpdated) {
      onRecordUpdated(updated);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Record #{record.record_id}
            </span>
            {getDecisionBadge(record.current_decision)}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
            {record.normalized_item_label || `${record.jurisdiction_key} — Item ${record.item_key}`}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Action: {record.normalized_action_label || 'Pending Assessment'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {record.current_decision === 'REGISTERED' ? (
            <button
              onClick={() => handleTriggerEvaluation(false)}
              className="btn btn-primary"
              disabled={isEvaluating || !IS_CONFIGURED}
            >
              <Play size={16} /> Evaluate Record
            </button>
          ) : (
            <button
              onClick={() => handleTriggerEvaluation(true)}
              className="btn btn-secondary"
              disabled={isEvaluating || !IS_CONFIGURED}
            >
              <RefreshCw size={16} /> Reassess Record ({record.assessment_count})
            </button>
          )}
        </div>
      </div>

      {/* Frozen Identity & Roles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#121824', padding: '0.875rem', borderRadius: '6px', border: '1px solid #2a3649' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Jurisdiction Key
          </div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#e2e8f0', marginTop: '0.25rem' }}>
            {record.jurisdiction_key}
          </div>
        </div>

        <div style={{ background: '#121824', padding: '0.875rem', borderRadius: '6px', border: '1px solid #2a3649' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Meeting Key / Date
          </div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#e2e8f0', marginTop: '0.25rem' }}>
            {record.meeting_key}
          </div>
        </div>

        <div style={{ background: '#121824', padding: '0.875rem', borderRadius: '6px', border: '1px solid #2a3649' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Item Key / Number
          </div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#e2e8f0', marginTop: '0.25rem' }}>
            {record.item_key}
          </div>
        </div>

        <div style={{ background: '#121824', padding: '0.875rem', borderRadius: '6px', border: '1px solid #2a3649' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Bound Source Host
          </div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#60a5fa', marginTop: '0.25rem' }}>
            {record.source_host}
          </div>
        </div>
      </div>

      {/* Role-Bound Sources */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <FileText size={16} /> Role-Bound Public Sources
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ background: '#121824', border: '1px solid #2a3649', borderRadius: '6px', padding: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span className="badge" style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)', fontSize: '0.7rem' }}>
                Role: AGENDA (Pre-Meeting Notice)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {record.agenda_fingerprint}
              </span>
            </div>
            <a href={record.agenda_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.875rem', wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              {record.agenda_url} <ExternalLink size={14} />
            </a>
          </div>

          <div style={{ background: '#121824', border: '1px solid #2a3649', borderRadius: '6px', padding: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.7rem' }}>
                Role: OUTCOME (Minutes / Resolution)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {record.outcome_fingerprint}
              </span>
            </div>
            <a href={record.outcome_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.875rem', wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              {record.outcome_url} <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* Structured Consensus Findings */}
      <div style={{ marginBottom: '1.5rem', background: '#141d2b', border: '1px solid #243247', borderRadius: '6px', padding: '1rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Tag size={16} color="#38bdf8" /> Finite Reason Codes & Findings
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Meeting Match:</span>{' '}
            <strong style={{ color: record.meeting_match === 'EXACT' ? '#34d399' : '#fbbf24' }}>{record.meeting_match}</strong>
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Item Match:</span>{' '}
            <strong style={{ color: record.item_match === 'EXACT' ? '#34d399' : '#fbbf24' }}>{record.item_match}</strong>
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Outcome Match:</span>{' '}
            <strong style={{ color: record.outcome_match === 'MATCHING' ? '#34d399' : '#fbbf24' }}>{record.outcome_match}</strong>
          </div>
        </div>

        {record.reason_codes && record.reason_codes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {record.reason_codes.map((code) => {
              const meta = REASON_CODES_MAP[code];
              return (
                <div
                  key={code}
                  style={{
                    background: '#1a2436',
                    border: '1px solid #2b3952',
                    borderRadius: '4px',
                    padding: '0.625rem 0.875rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f1f5f9' }}>
                      {meta?.label || code}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#94a3b8', background: '#0f172a', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                      {code}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>
                    {meta?.description || 'No detailed description.'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No reason codes recorded. Record is pending initial evaluation.
          </p>
        )}

        {record.source_locators && record.source_locators.length > 0 && (
          <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid #243247' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <MapPin size={12} /> Source Locators:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {record.source_locators.map((loc, i) => (
                <span key={i} style={{ background: '#1e293b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#93c5fd' }}>
                  {loc}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metadata & Digests */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <div><User size={12} style={{ display: 'inline', marginRight: '4px' }} /> Submitter: {record.submitter}</div>
        <div><Clock size={12} style={{ display: 'inline', marginRight: '4px' }} /> Assessed At: {record.assessed_at || 'Not Assessed'}</div>
        <div style={{ gridColumn: '1 / -1', wordBreak: 'break-all' }}>
          <Hash size={12} style={{ display: 'inline', marginRight: '4px' }} /> Canonical Key: {record.canonical_key}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Hash size={12} style={{ display: 'inline', marginRight: '4px' }} /> Evidence Fingerprint Digest: {record.evidence_fingerprint}
        </div>
      </div>

      {/* Append-only history timeline */}
      <HistoryTimeline history={record.history} />
    </div>
  );
};
