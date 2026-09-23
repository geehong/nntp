import React from 'react';
import { useNNTPStore } from '../../store/useNNTPStore';
import { Newspaper, Gauge, Key, Search, DownloadCloud, Wifi, WifiOff, Settings, Sparkles } from 'lucide-react';

export default function TopHeader() {
  const { activeTab, setActiveTab, articleSearchQuery, setArticleSearchQuery, connected, selectedServerId, servers, disconnectedByUser, setDisconnectedByUser, connectBridge } = useNNTPStore();
  const currentServer = (servers || []).find((s) => s.id === selectedServerId) || (servers || []).find((s) => s.isPrimary) || (servers || [])[0];
  const serverDisplayName = currentServer ? currentServer.name : 'BlockNews Server (Asia)';

  return (
    <header className="top-header">
      <div className="header-brand">
        <a
          href="https://nntp.firemarkets.net"
          className="brand-logo"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('reader');
            if (window.location.pathname !== '/') {
              window.location.href = 'https://nntp.firemarkets.net';
            }
          }}
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          title="firemarkets usenet Home"
        >
          <DownloadCloud size={24} color="#0284c7" />
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>firemarkets usenet</span>
        </a>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: connected ? '#dcfce7' : '#fee2e2',
            color: connected ? '#15803d' : '#b91c1c',
            padding: '4px 10px',
            borderRadius: '12px',
            marginLeft: '12px',
          }}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{connected ? `${serverDisplayName} SSL` : disconnectedByUser ? 'Disconnected (로그아웃됨)' : 'Connecting...'}</span>
          {connected ? (
            <button
              onClick={async () => {
                if (window.confirm('웹 앱의 모든 연결(다운로드 포함)을 강제 종료하시겠습니까? (이 버튼을 누르고 잠시 후 Newsbin에서 다시 연결을 시도하세요)')) {
                  try {
                    await fetch('/api/disconnect', { method: 'POST' });
                    useNNTPStore.getState().ws?.close();
                    useNNTPStore.setState({ connected: false, disconnectedByUser: true });
                  } catch (e) {
                    alert('연결 해제 중 오류가 발생했습니다.');
                  }
                }
              }}
              style={{
                marginLeft: '8px',
                padding: '2px 6px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Force disconnect all NNTP sockets"
            >
              Disconnect
            </button>
          ) : disconnectedByUser ? (
            <button
              onClick={() => {
                setDisconnectedByUser(false);
                connectBridge();
              }}
              style={{
                marginLeft: '8px',
                padding: '2px 6px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              Reconnect
            </button>
          ) : null}
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'reader' ? 'active' : ''}`}
          onClick={() => setActiveTab('reader')}
        >
          <Newspaper size={16} />
          <span>Newsgroup Reader</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'farm' ? 'active' : ''}`}
          onClick={() => setActiveTab('farm')}
        >
          <Gauge size={16} />
          <span>Status Dashboard</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'recommended' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommended')}
        >
          <Sparkles size={16} />
          <span>Recommended Usenet</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'credentials' ? 'active' : ''}`}
          onClick={() => setActiveTab('credentials')}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </nav>

      <div className="header-search">
        <Search className="search-icon" size={16} />
        <input
          type="text"
          placeholder="Search article subjects in current group..."
          value={articleSearchQuery}
          onChange={(e) => setArticleSearchQuery(e.target.value)}
        />
      </div>
    </header>
  );
}
