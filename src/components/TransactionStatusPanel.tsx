import React from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { TxStatus } from '../types';
import { STUDIONET_EXPLORER_URL } from '../lib/genlayer';

interface TransactionStatusPanelProps {
  status: TxStatus;
}

export const TransactionStatusPanel: React.FC<TransactionStatusPanelProps> = ({ status }) => {
  const getIcon = () => {
    switch (status.stage) {
      case 'SUCCESS':
        return <CheckCircle2 size={20} color="#10b981" />;
      case 'ERROR':
        return <XCircle size={20} color="#ef4444" />;
      case 'UNDETERMINED':
        return <AlertTriangle size={20} color="#f59e0b" />;
      default:
        return (
          <Loader2
            size={20}
            color="#60a5fa"
            className="transaction-spinner"
            aria-hidden="true"
          />
        );
    }
  };

  const getStageColor = () => {
    switch (status.stage) {
      case 'SUCCESS':
        return '#10b981';
      case 'ERROR':
        return '#ef4444';
      case 'UNDETERMINED':
        return '#f59e0b';
      default:
        return '#60a5fa';
    }
  };

  const explorerLink = status.txHash ? `${STUDIONET_EXPLORER_URL}/tx/${status.txHash}` : null;

  return (
    <div
      style={{
        background: '#171f2b',
        border: `1px solid ${getStageColor()}`,
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {getIcon()}
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getStageColor() }}>
              Transaction Stage: {status.stage}
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#cbd5e1', marginTop: '0.125rem' }}>
              {status.message || status.error}
            </div>
          </div>
        </div>

        {explorerLink && (
          <a
            href={explorerLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.75rem',
              color: '#60a5fa',
              textDecoration: 'none',
              background: '#0f172a',
              padding: '0.375rem 0.625rem',
              borderRadius: '4px',
              border: '1px solid #1e293b',
            }}
          >
            <span>View Tx on Explorer</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {status.txHash && (
        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8', marginTop: '0.5rem', wordBreak: 'break-all' }}>
          Tx Hash: {status.txHash}
        </div>
      )}
    </div>
  );
};
