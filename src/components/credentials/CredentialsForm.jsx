import React from 'react';
import { useNNTPStore } from '../../store/useNNTPStore';
import { Server, ShieldCheck, Plus, Settings, RefreshCw, Trash2, CheckCircle2, Activity, Database, Lock } from 'lucide-react';

export default function CredentialsForm() {
  const {
    servers = [],
    openAddServerModal,
    openEditServerModal,
    deleteServer,
    downloadServerNewsgroups,
    isDownloadingGroups,
    connected,
  } = useNNTPStore();

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server color="#0284c7" size={24} />
            NNTP Server Status & Connections
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
            Manage active Usenet news servers, connection parameters, and newsgroup synchronization.
          </p>
        </div>

        <button
          onClick={openAddServerModal}
          style={{
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
          }}
        >
          <Plus size={18} /> Add Server
        </button>
      </div>

      {/* Servers Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {servers.map((srv) => (
          <div
            key={srv.id}
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Card Top Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Server size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                      {srv.name}
                    </h3>
                    {srv.isPrimary && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: '#0284c7',
                          color: '#ffffff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.825rem', color: '#64748b' }}>
                    {srv.host}:{srv.port}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: connected ? '#f0fdf4' : '#fef2f2',
                  color: connected ? '#166534' : '#991b1b',
                  border: `1px solid ${connected ? '#bbf7d0' : '#fecaca'}`,
                }}
              >
                <CheckCircle2 size={14} color={connected ? '#16a34a' : '#dc2626'} />
                <span>{connected ? 'Active (Connected SSL)' : 'Idle / Offline'}</span>
              </div>
            </div>

            {/* Server Details Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '12px',
                background: '#f8fafc',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid #f1f5f9',
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>ACCOUNT USER</span>
                <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>{srv.username}</span>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SECURITY</span>
                <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={13} color="#16a34a" /> {srv.useSSL ? 'SSL / TLS (563)' : 'Plain (119)'}
                </span>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>MAX CONNECTIONS</span>
                <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={13} color="#0284c7" /> {srv.maxConnections} Threads
                </span>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SYNCED GROUPS</span>
                <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Database size={13} color="#8b5cf6" /> {(srv.syncedGroups || 1289531).toLocaleString()} Groups
                </span>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => downloadServerNewsgroups()}
                disabled={isDownloadingGroups}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0284c7',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={14} className={isDownloadingGroups ? 'spin' : ''} />
                Sync Groups
              </button>

              <button
                onClick={() => openEditServerModal(srv)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Settings size={14} /> Edit Config
              </button>

              {!srv.isPrimary && (
                <button
                  onClick={() => deleteServer(srv.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
