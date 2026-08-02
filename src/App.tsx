import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { ConfigMissingBanner } from './components/ConfigMissingBanner';
import { RegisterRecordForm } from './components/RegisterRecordForm';
import { RecordDetail } from './components/RecordDetail';
import { TransactionStatusPanel } from './components/TransactionStatusPanel';
import {
  IS_CONFIGURED,
  readContractRecord,
  readRecordCount,
  executeEvaluateRecord,
} from './lib/genlayer';
import { RecordData, TxStatus } from './types';
import { Search, RefreshCw, Layers, ArrowRight } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'overview' | 'ledger' | 'register'>('overview');
  const [records, setRecords] = useState<RecordData[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<RecordData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);

  const loadRecords = useCallback(async () => {
    if (!IS_CONFIGURED) return;
    setLoading(true);
    try {
      const count = await readRecordCount();
      const loaded: RecordData[] = [];
      for (let i = 1; i <= count; i++) {
        const rec = await readContractRecord(i);
        if (rec) loaded.push(rec);
      }
      setRecords(loaded);
      if (loaded.length > 0 && !selectedRecord) {
        setSelectedRecord(loaded[0]);
      }
    } catch (err) {
      console.error('Failed to load ledger records:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedRecord]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleEvaluate = async (recordId: number, isReassess: boolean) => {
    const updated = await executeEvaluateRecord(recordId, isReassess, (status) => setTxStatus(status));
    if (updated) {
      setSelectedRecord(updated);
      await loadRecords();
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      r.jurisdiction_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.meeting_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.item_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.current_decision.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header currentTab={currentTab} onNavigate={(tab) => setCurrentTab(tab)} />

      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">
          <DisclaimerBanner />

          {!IS_CONFIGURED && <ConfigMissingBanner />}

          {txStatus && <TransactionStatusPanel status={txStatus} />}

          {currentTab === 'overview' && (
            <div>
              <div
                className="card"
                style={{
                  padding: '2.5rem',
                  marginBottom: '2rem',
                  background: 'linear-gradient(180deg, #171f2b 0%, #121824 100%)',
                }}
              >
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
                  NoticeTrail: Public-Record Comparison Ledger
                </h2>
                <p style={{ fontSize: '1rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                  NoticeTrail is an independent public-record comparison attestation. It grounds public meeting item comparisons in two role-bound public documents, evaluating exact meeting identity, item alignment, and described action outcomes through validator consensus.
                </p>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => setCurrentTab('register')}>
                    + Register Record <ArrowRight size={16} />
                  </button>
                  <button className="btn btn-secondary" onClick={() => setCurrentTab('ledger')}>
                    <Layers size={16} /> View Public Ledger ({records.length})
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.5rem' }}>
                    1. Claim Registration
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Register a claim for one meeting item by linking two role-bound HTTPS documents: pre-meeting AGENDA notice and post-meeting OUTCOME minutes.
                  </p>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.5rem' }}>
                    2. Validator Consensus
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    GenLayer validators independently fetch public source documents, compare meeting identity, item alignment, and action outcomes, enforcing stable decision fields.
                  </p>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.5rem' }}>
                    3. Five Evaluated Verdicts
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    Outcomes are classified into 5 neutral verdicts: MATCHES_NOTICE, MATERIAL_CHANGE, NO_FINAL_ACTION, SOURCES_NOT_COMPARABLE, or UNRESOLVED.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'register' && (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <RegisterRecordForm
                onSuccess={(newRecord) => {
                  setSelectedRecord(newRecord);
                  loadRecords();
                  setCurrentTab('ledger');
                }}
                onTxStatusChange={(status) => setTxStatus(status)}
              />
            </div>
          )}

          {currentTab === 'ledger' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem' }}>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Ledger Records ({filteredRecords.length})</h3>
                  <button
                    className="btn btn-secondary"
                    onClick={loadRecords}
                    disabled={loading}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    title="Refresh Ledger"
                  >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                  </button>
                </div>

                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                  <Search
                    size={16}
                    style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
                  />
                  <input
                    type="text"
                    className="input-field"
                    aria-label="Filter ledger records"
                    placeholder="Filter records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '2.25rem', fontSize: '0.8125rem' }}
                  />
                </div>

                {filteredRecords.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                    {loading ? 'Loading ledger records...' : 'No public records found.'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '600px', overflowY: 'auto' }}>
                    {filteredRecords.map((rec) => (
                      <div
                        key={rec.record_id}
                        onClick={() => setSelectedRecord(rec)}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          border: `1px solid ${selectedRecord?.record_id === rec.record_id ? '#3b82f6' : 'var(--border-color)'}`,
                          background: selectedRecord?.record_id === rec.record_id ? 'rgba(59, 130, 246, 0.1)' : '#0f172a',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            #{rec.record_id} • {rec.jurisdiction_key}
                          </span>
                          <span className={`badge badge-${rec.current_decision.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                            {rec.current_decision.replace('_', ' ')}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>
                          {rec.meeting_key} / {rec.item_key}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                          Source: {rec.source_host}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                {selectedRecord ? (
                  <RecordDetail
                    record={selectedRecord}
                    onEvaluate={(id) => handleEvaluate(id, false)}
                    onReassess={(id) => handleEvaluate(id, true)}
                    isEvaluating={txStatus?.stage === 'SUBMITTING' || txStatus?.stage === 'CONSENSUS'}
                  />
                ) : (
                  <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Select a record from the ledger list to view comparison attestation details.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem 0', background: '#0b0f17', textAlign: 'center' }}>
        <div className="container" style={{ fontSize: '0.8125rem', color: '#64748b' }}>
          NoticeTrail Policy V1 • GenLayer Studionet Public-Record Comparison Ledger
        </div>
      </footer>
    </div>
  );
};
