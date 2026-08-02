import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const ConfigMissingBanner: React.FC = () => {
  return (
    <div
      style={{
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        padding: '1.25rem',
        margin: '2rem 0',
        color: '#f8fafc',
      }}
      role="alert"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
        <AlertTriangle size={24} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.375rem' }}>
            Deployment Not Configured
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '0.5rem' }}>
            NoticeTrail requires a valid GenLayer contract address configured on Studionet before processing public record attestations.
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#94a3b8', fontFamily: 'monospace' }}>
            Set <strong>VITE_CONTRACT_ADDRESS</strong> in your environment or <code>.env</code> file with your deployed Studionet contract address.
          </p>
        </div>
      </div>
    </div>
  );
};
