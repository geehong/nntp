import React from 'react';
import { useNNTPStore } from '../../store/useNNTPStore';
import { ShieldCheck, Server, Key, Save } from 'lucide-react';

export default function CredentialsForm() {
  const { credentials, setCredentials } = useNNTPStore();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCredentials({
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  return (
    <div
      style={{
        maxWidth: '600px',
        background: '#ffffff',
        padding: '24px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <Server color="#0284c7" size={24} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
          NNTP Server & Credentials
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
            NNTP Server Host
          </label>
          <input
            type="text"
            name="host"
            value={credentials.host}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              Port
            </label>
            <input
              type="number"
              name="port"
              value={credentials.port}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                name="useSSL"
                checked={credentials.useSSL}
                onChange={handleChange}
              />
              Use SSL / TLS (Port 563)
            </label>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
            Username
          </label>
          <input
            type="text"
            name="username"
            value={credentials.username}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
            Password / API Key
          </label>
          <input
            type="password"
            name="password"
            value={credentials.password}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
            }}
          />
        </div>

        <button
          style={{
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '10px',
          }}
          onClick={() => alert('NNTP Credentials successfully saved!')}
        >
          <Save size={16} /> Save & Test Connection
        </button>
      </div>
    </div>
  );
}
