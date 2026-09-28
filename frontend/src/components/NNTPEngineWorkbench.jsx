import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, RefreshCw, Layers, ShieldCheck, Box } from 'lucide-react';

export default function NNTPEngineWorkbench() {
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runEngineTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/nntp-engine/test');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setTestData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runEngineTest();
  }, []);

  return (
    <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Cpu size={18} color="#0284c7" />
            NNTP Engine Class Architecture Status (`backend/nntp`)
          </h3>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', margin: 0 }}>
            NNTPBaseClient, NNTPClient, yencDecoder, nzbParser 모듈 결과 모니터링
          </p>
        </div>
        <button
          onClick={runEngineTest}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.78rem',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>{loading ? 'Testing...' : 'Test Modules'}</span>
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '10px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>
          ❌ Engine Module Test Error: {error}
        </div>
      )}

      {testData && testData.modules && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
          {testData.modules.map((mod, idx) => (
            <div key={idx} style={{ background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem', color: '#0369a1', marginBottom: '8px' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>{mod.className}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {Object.entries(mod).map(([k, v]) => {
                  if (k === 'className') return null;
                  return (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e2e8f0', paddingBottom: '2px' }}>
                      <span style={{ fontWeight: 500, color: '#64748b' }}>{k}:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(v)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
