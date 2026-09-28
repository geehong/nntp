import React, { useEffect, useState } from 'react';
import { useNNTPStore } from '../store/useNNTPStore';
import FolderPickerModal from './FolderPickerModal';
import { Server, ShieldCheck, Plus, Settings, RefreshCw, Trash2, CheckCircle2, Activity, Database, Lock, Loader2, AlertTriangle, Calendar } from 'lucide-react';

const getDaysToExpiry = (expireDateStr) => {
  if (!expireDateStr) return null;
  const target = new Date(expireDateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  // reset hours
  target.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diffDays;
};

function ServerControlBox({ srv, serverState, onUpdateState, otherOrders }) {
  const countVal = serverState.default_article_count;
  const showInSidebar = serverState.showInSidebar;
  const sortOrder = serverState.sortOrder;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={showInSidebar} 
          onChange={e => onUpdateState(srv.id, { showInSidebar: e.target.checked })} 
        />
        사이드메뉴 표시
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>순서:</span>
        <select
          value={sortOrder}
          onChange={e => onUpdateState(srv.id, { sortOrder: Number(e.target.value) })}
          title="사이드메뉴 표시 순서 (중복 불가)"
          style={{ padding: '2px 6px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
            const isTakenByOther = otherOrders.includes(num);
            return (
              <option key={num} value={num} disabled={isTakenByOther}>
                {num} {isTakenByOther ? '(사용 중)' : ''}
              </option>
            );
          })}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Default View Count:</span>
        <input 
          type="number" 
          value={countVal} 
          onChange={e => onUpdateState(srv.id, { default_article_count: Number(e.target.value) })}
          title="기본 아티클 표시 갯수"
          style={{ width: '70px', padding: '2px 6px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'right' }}
        />
      </div>
    </div>
  );
}

export default function ServerSettings() {
  const {
    servers = [],
    openAddServerModal,
    openEditServerModal,
    deleteServer,
    downloadServerNewsgroups,
    isDownloadingGroups,
    connected,
    globalSettings,
    fetchGlobalSettings,
    saveGlobalSettings,
    saveServer,
    batchSaveServers,
    fetchServers,
  } = useNNTPStore();

  const [localSettings, setLocalSettings] = useState({ rawTemp: '', rawResult: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [pickerOpenFor, setPickerOpenFor] = useState(null);

  // Local state for all server controls: { [serverId]: { showInSidebar, sortOrder, default_article_count } }
  const [serverStateMap, setServerStateMap] = useState({});

  useEffect(() => {
    fetchGlobalSettings();
  }, [fetchGlobalSettings]);

  useEffect(() => {
    if (globalSettings) {
      setLocalSettings(globalSettings);
    }
  }, [globalSettings]);

  useEffect(() => {
    if (Array.isArray(servers)) {
      const initialMap = {};
      servers.forEach((srv) => {
        initialMap[srv.id] = {
          showInSidebar: srv.showInSidebar !== undefined ? !!srv.showInSidebar : true,
          sortOrder: srv.sortOrder !== undefined ? Number(srv.sortOrder) : 0,
          default_article_count: srv.default_article_count !== undefined ? Number(srv.default_article_count) : 300,
        };
      });
      setServerStateMap(initialMap);
    }
  }, [servers]);

  const handleUpdateServerState = (serverId, partial) => {
    setServerStateMap((prev) => ({
      ...prev,
      [serverId]: {
        ...prev[serverId],
        ...partial,
      },
    }));
  };

  const handleSaveAllServers = async () => {
    // Collect updated servers list
    const updatedServersList = servers.map((srv) => {
      const controls = serverStateMap[srv.id] || {};
      return {
        ...srv,
        showInSidebar: controls.showInSidebar ? 1 : 0,
        sortOrder: Number(controls.sortOrder || 0),
        default_article_count: Number(controls.default_article_count || 300),
      };
    });

    setIsBatchSaving(true);
    const success = await batchSaveServers(updatedServersList);
    setIsBatchSaving(false);

    if (success) {
      alert('모든 서버 설정 및 순서가 저장되었습니다!');
      await fetchServers();
    } else {
      alert('서버 설정 저장에 실패했습니다.');
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    await saveGlobalSettings(localSettings);
    setIsSaving(false);
  };

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleSaveAllServers}
            disabled={isBatchSaving}
            style={{
              background: '#059669',
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
              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
            }}
          >
            {isBatchSaving ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
            {isBatchSaving ? '저장 중...' : '서버 설정 전체 저장'}
          </button>

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
      </div>

      {/* Servers Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {servers.map((srv) => {
          const serverState = serverStateMap[srv.id] || {
            showInSidebar: srv.showInSidebar !== undefined ? !!srv.showInSidebar : true,
            sortOrder: srv.sortOrder !== undefined ? Number(srv.sortOrder) : 0,
            default_article_count: srv.default_article_count !== undefined ? Number(srv.default_article_count) : 300,
          };

          // Find sortOrders taken by other servers
          const otherOrders = servers
            .filter((s) => s.id !== srv.id)
            .map((s) => (serverStateMap[s.id] ? Number(serverStateMap[s.id].sortOrder) : Number(s.sortOrder || 0)));

          return (
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

              {/* Server Display & Count Controls */}
              <ServerControlBox
                srv={srv}
                serverState={serverState}
                onUpdateState={handleUpdateServerState}
                otherOrders={otherOrders}
              />

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

            {/* Expiry Warning Banner if expiring within 3 days */}
            {(() => {
              const daysLeft = getDaysToExpiry(srv.expireDate);
              if (daysLeft !== null && daysLeft <= 3) {
                const isExpired = daysLeft <= 0;
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: isExpired ? '#fef2f2' : '#fffbebe6',
                      border: `1px solid ${isExpired ? '#fecaca' : '#fde68a'}`,
                      color: isExpired ? '#991b1b' : '#92400e',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    <AlertTriangle size={18} color={isExpired ? '#dc2626' : '#d97706'} />
                    <span>
                      {isExpired
                        ? `🚨 [경고] ${srv.name} 구독이 이미 만료되었습니다! (${srv.expireDate}) 서비스 갱신 또는 구독 해지를 진행해 주세요.`
                        : `⚠️ [구독 경고] ${srv.name} 구독 만료일(${srv.expireDate})이 ${daysLeft}일 남았습니다. 갱신을 원치 않으시면 2~3일 전에 구독 해지하시기 바랍니다.`}
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Server Details Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
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

              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>EXPIRE DATE</span>
                <span style={{ fontSize: '0.9rem', color: srv.expireDate ? '#0f172a' : '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={13} color="#d97706" /> {srv.expireDate || 'Not set'}
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
          );
        })}
        
        {/* Global Storage Settings Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f3e8ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Global Storage Settings</h3>
              <span style={{ fontSize: '0.825rem', color: '#64748b' }}>Configure paths for batch downloads and temp files</span>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Download Directory (rawResult)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={localSettings.rawResult || ''}
                  onChange={e => setLocalSettings({...localSettings, rawResult: e.target.value})}
                  placeholder="e.g. /app/downloads"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} 
                />
                <button
                  onClick={() => setPickerOpenFor('rawResult')}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  Browse...
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Temp Directory (rawTemp)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={localSettings.rawTemp || ''}
                  onChange={e => setLocalSettings({...localSettings, rawTemp: e.target.value})}
                  placeholder="e.g. /tmp"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} 
                />
                <button
                  onClick={() => setPickerOpenFor('rawTemp')}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  Browse...
                </button>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              style={{
                padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              {isSaving ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
              {isSaving ? 'Saving...' : 'Save Storage Settings'}
            </button>
          </div>
        </div>

        <FolderPickerModal
          isOpen={pickerOpenFor !== null}
          initialPath={pickerOpenFor === 'rawResult' ? localSettings.rawResult : (pickerOpenFor === 'rawTemp' ? localSettings.rawTemp : '/app')}
          onClose={() => setPickerOpenFor(null)}
          onSelect={(path) => {
            if (pickerOpenFor === 'rawResult') setLocalSettings({...localSettings, rawResult: path});
            if (pickerOpenFor === 'rawTemp') setLocalSettings({...localSettings, rawTemp: path});
          }}
        />

      </div>
    </div>
  );
}
