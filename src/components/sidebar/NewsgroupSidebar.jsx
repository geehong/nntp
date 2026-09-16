import React, { useState } from 'react';
import { useNNTPStore } from '../../store/useNNTPStore';
import { Star, Server, RefreshCw, Loader2, Menu, ChevronLeft, ChevronRight, Settings } from 'lucide-react';

export default function NewsgroupSidebar() {
  const {
    selectedGroup,
    setSelectedGroup,
    newsgroups = [],
    favorites = [],
    favoriteObjects = [],
    downloadServerNewsgroups,
    isDownloadingGroups,
    toggleStar,
    openEditServerModal,
    servers = [],
  } = useNNTPStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [serverExpanded, setServerExpanded] = useState(true);
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);

  const safeGroups = Array.isArray(newsgroups) ? newsgroups : [];
  const safeFavorites = Array.isArray(favorites) ? favorites : [];
  const safeFavoriteObjects = Array.isArray(favoriteObjects) ? favoriteObjects : [];

  // Build complete favorites list
  const favoriteMap = new Map();
  safeFavoriteObjects.forEach((obj) => {
    if (obj && obj.name) favoriteMap.set(obj.name, obj);
  });
  safeGroups.forEach((g) => {
    if (g && g.is_favorite) favoriteMap.set(g.name, g);
  });
  safeFavorites.forEach((name) => {
    if (!favoriteMap.has(name)) {
      favoriteMap.set(name, { name, count: '0' });
    }
  });

  const favoriteGroups = Array.from(favoriteMap.values());

  return (
    <aside
      className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        width: isCollapsed ? '60px' : '260px',
        transition: 'width 0.2s ease-in-out',
        background: '#ffffff',
        borderRight: '1px solid #cbd5e1',
        padding: isCollapsed ? '12px 6px' : '12px 14px',
        userSelect: 'none',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Top Controls Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          marginBottom: '14px',
          paddingBottom: '8px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        {!isCollapsed && (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
            MENU NAVIGATION
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            width: '26px',
            height: '26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#334155',
            padding: 0,
          }}
          title={isCollapsed ? "Expand Sidebar (>)" : "Collapse Sidebar (<)"}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Render All Configured NNTP Servers */}
      {servers.map((srv) => (
        <div key={srv.id} style={{ marginBottom: '14px' }}>
          <div
            onClick={() => setSelectedGroup('__SERVER__')}
            className={`group-item ${selectedGroup === '__SERVER__' ? 'active' : ''}`}
            style={{
              fontWeight: 700,
              fontSize: '0.85rem',
              padding: isCollapsed ? '8px 0' : '8px 10px',
              borderRadius: '6px',
              background: selectedGroup === '__SERVER__' ? '#e0f2fe' : '#f8fafc',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
            }}
            title={`${srv.name} (${srv.host}:${srv.port})`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!isCollapsed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setServerExpanded(!serverExpanded);
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '3px',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: srv.isPrimary ? '#0284c7' : '#059669',
                  }}
                  title={serverExpanded ? "Collapse Server Tree (-)" : "Expand Server Tree (+)"}
                >
                  {serverExpanded ? '-' : '+'}
                </button>
              )}
              <Server size={18} color={srv.isPrimary ? '#0284c7' : '#059669'} />
              {!isCollapsed && (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                  {srv.name}
                </span>
              )}
            </div>

            {!isCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadServerNewsgroups();
                  }}
                  disabled={isDownloadingGroups}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.68rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0284c7',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Sync Newsgroups List from Server"
                >
                  {isDownloadingGroups ? <Loader2 size={10} className="spin" /> : <RefreshCw size={10} />}
                  <span>Sync</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditServerModal(srv);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3px 5px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                  title="Configure NNTP Server"
                >
                  <Settings size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Tree Children under Server (Favorites List) */}
          {serverExpanded && (
            <div style={{ paddingLeft: isCollapsed ? 0 : '12px', marginTop: '6px', borderLeft: isCollapsed ? 'none' : '2px dashed #cbd5e1', marginLeft: isCollapsed ? 0 : '12px' }}>
              <div style={{ marginBottom: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    padding: '6px 4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                  onClick={() => setFavoritesExpanded(!favoritesExpanded)}
                  title={`Favorite Groups (${favoriteGroups.length})`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!isCollapsed && (
                      <button
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '3px',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          lineHeight: 1,
                          padding: 0,
                          color: '#475569',
                        }}
                      >
                        {favoritesExpanded ? '-' : '+'}
                      </button>
                    )}
                    <Star size={16} color="#f59e0b" fill="#f59e0b" />
                    {!isCollapsed && <span>Favorite Groups ({favoriteGroups.length})</span>}
                  </div>
                </div>

                {favoritesExpanded && (
                  <div style={{ paddingLeft: isCollapsed ? 0 : '10px', marginTop: '4px' }}>
                    {favoriteGroups.length === 0 ? (
                      !isCollapsed && (
                        <div style={{ fontSize: '0.725rem', color: '#94a3b8', padding: '6px 8px' }}>
                          No favorite groups. Add groups from Group Management.
                        </div>
                      )
                    ) : (
                      favoriteGroups.map((g) => (
                        <div
                          key={g.name}
                          className={`group-item ${selectedGroup === g.name ? 'active' : ''}`}
                          onClick={() => setSelectedGroup(g.name)}
                          style={{
                            padding: isCollapsed ? '6px 0' : '5px 8px',
                            fontSize: '0.8rem',
                            justifyContent: isCollapsed ? 'center' : 'space-between',
                          }}
                          title={g.name}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStar(g.name);
                              }}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            >
                              <Star size={14} color="#f59e0b" fill="#f59e0b" />
                            </button>
                            {!isCollapsed && <span className="truncate" title={g.name}>{g.name}</span>}
                          </div>
                          {!isCollapsed && <span className="group-badge">{g.count}</span>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
