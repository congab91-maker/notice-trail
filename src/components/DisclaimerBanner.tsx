import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  return (
    <div
      style={{
        background: 'rgba(30, 41, 59, 0.6)',
        border: '1px solid #334155',
        borderRadius: '6px',
        padding: '0.875rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.875rem',
      }}
    >
      <AlertTriangle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: '1.45' }}>
        <strong style={{ color: '#f8fafc', display: 'block', marginBottom: '0.2rem' }}>
          Public-Record Comparison Attestation — Non-Legal Disclaimer
        </strong>
        NoticeTrail evaluates factual alignment between pre-meeting public notices and later minutes or resolution documents for a frozen meeting item.
        It <strong>does not determine legal validity, open-meeting compliance, political correctness, misconduct, intent, or vote merits</strong>.
        URL hosts represent claimed public record sources, not verified institutional authority.
      </div>
    </div>
  );
};
