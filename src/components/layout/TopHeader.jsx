import React from 'react';
import { useNNTPStore } from '../../store/useNNTPStore';
import { Newspaper, Gauge, Key, Search, DownloadCloud, Wifi, WifiOff, Settings, Sparkles } from 'lucide-react';

export default function TopHeader() {
  const { activeTab, setActiveTab, articleSearchQuery, setArticleSearchQuery, connected, nntpUser } = useNNTPStore();

  return (
    <header className="top-header">
      <div className="header-brand">
        <div className="brand-logo">
          <DownloadCloud size={24} color="#0284c7" />
          <span>Easynews NNTP</span>
        </div>

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
          <span>{connected ? `Usenet.Farm SSL (${nntpUser})` : 'Connecting...'}</span>
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
          <span>Usenet.Farm Dashboard</span>
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
