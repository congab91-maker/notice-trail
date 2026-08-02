import React from 'react';
import { History, Clock, Hash } from 'lucide-react';
import { AssessmentSnapshot } from '../types';
import { REASON_CODES_MAP } from '../constants/reasonCodes';

interface HistoryTimelineProps {
  history: AssessmentSnapshot[];
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic', padding: '1rem 0' }}>
        No prior evaluation history recorded. Current state is the initial assessment.
      </div>
    );
  }

  const getDecisionBadgeClass = (decision: string) => {
    switch (decision) {
      case 'MATCHES_NOTICE': return 'badge-matches';
      case 'MATERIAL_CHANGE': return 'badge-material-change';
      case 'NO_FINAL_ACTION': return 'badge-no-action';
      case 'SOURCES_NOT_COMPARABLE': return 'badge-not-comparable';
      case 'UNRESOLVED': return 'badge-unresolved';
      default: return 'badge-registered';
    }
  };

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <History size={18} color="#94a3b8" />
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Assessment History Timeline ({history.length})
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {history.map((snap, idx) => (
          <div
            key={idx}
            style={{
              background: '#121824',
              border: '1px solid #2a3649',
              borderRadius: '6px',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  #{idx + 1}
                </span>
                <span className={`badge ${getDecisionBadgeClass(snap.decision)}`}>
                  {snap.decision.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={12} /> {snap.assessed_at || 'Recorded Snapshot'}
              </div>
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              <strong>Action Label:</strong> {snap.normalized_action_label || 'Unspecified'}
            </div>

            {snap.reason_codes && snap.reason_codes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
                {snap.reason_codes.map((code) => {
                  const meta = REASON_CODES_MAP[code];
                  return (
                    <span
                      key={code}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        padding: '0.15rem 0.4rem',
                        fontSize: '0.75rem',
                        color: '#cbd5e1',
                      }}
                      title={meta?.description || code}
                    >
                      {meta?.label || code}
                    </span>
                  );
                })}
              </div>
            )}

            {snap.evidence_fingerprint && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Hash size={12} /> Digest: {snap.evidence_fingerprint}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
