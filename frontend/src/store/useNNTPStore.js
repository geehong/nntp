import { create } from 'zustand';
import initialFavorites from '../data/favorites.json';

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Parses one tab-separated XOVER line: 0:Number 1:Subject 2:From 3:Date
// 4:MsgId 5:Refs 6:Bytes 7:Lines
const parseOverviewLine = (line) => {
  if (!line || !line.includes('\t')) return null;
  const parts = line.split('\t');
  const articleId = parts[0];
  if (!articleId) return null;

  const msgId = (parts[4] || '').trim().replace(/^</, '').replace(/>$/, '');

  let rawBytes = 0;
  for (let i = 5; i < parts.length; i++) {
    const val = (parts[i] || '').trim();
    if (/^\d+$/.test(val)) {
      rawBytes = parseInt(val, 10);
      break;
    }
  }

  return {
    id: articleId,
    subject: parts[1] || 'No Subject',
    poster: parts[2] || 'Anonymous',
    date: parts[3] || new Date().toISOString(),
    msgId,
    size: formatBytes(rawBytes),
    bytes: rawBytes,
  };
};

export const useNNTPStore = create((set, get) => ({
  globalSettings: { rawTemp: '', rawResult: '' },
  downloads: {}, // { [downloadId]: { current, total, status, error } }
  xoverProgress: null,
  nntpLogs: [],
  clearNNTPLogs: () => set({ nntpLogs: [] }),

  fetchGlobalSettings: async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        set({ globalSettings: data });
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    }
  },

  saveGlobalSettings: async (settings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        set({ globalSettings: settings });
        return true;
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
    return false;
  },

  downloadSelectedArticles: async (type, group, filename, ids, nzbData) => {
    try {
      const { selectedServerId } = get();
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, group, filename, ids, serverId: selectedServerId, nzbData
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.success;
      }
    } catch (e) {
      console.error('Failed to download articles:', e);
    }
    return false;
  },

  activeTab: 'reader',
  setActiveTab: (tab) => set({ activeTab: tab }),

  disconnectedByUser: false,
  setDisconnectedByUser: (val) => set({ disconnectedByUser: val }),

  selectedServerId: 'server-easynews',
  setSelectedServerId: (serverId) => {
    const srv = get().servers.find(s => s.id === serverId);
    const newChunkSize = srv?.default_article_count || 30000;
    set({ selectedServerId: serverId, selectedGroup: '__SERVER__', articles: [], loading: false, articleSearchQuery: '', rawChunkSize: newChunkSize });
    get().fetchServerNewsgroupsPage({ page: 1, serverId });
    get().fetchFavorites(serverId);
  },

  selectedGroup: '__SERVER__',
  setSelectedGroup: (group) => {
    if (group === '__SERVER__') {
      set({ selectedGroup: '__SERVER__', articles: [], loading: false, articleSearchQuery: '' });
      return;
    }
    // Article numbers are per-group, so a manual Start/End range from the
    // previous group would be meaningless (or wrong) here.
    set({ selectedGroup: group, articles: [], currentPage: 1, loading: true, articleSearchQuery: '', rangeStart: null, rangeEnd: null });
    get().fetchArticles(group, 1);
  },

  groupSearchQuery: '',
  setGroupSearchQuery: (query) => set({ groupSearchQuery: query }),

  articleSearchQuery: '',
  setArticleSearchQuery: (query) => set({ articleSearchQuery: query }),

  newsgroups: [],
  lastUpdated: null,
  favorites: Array.isArray(initialFavorites) ? initialFavorites : [],
  favoriteObjects: [],
  isDownloadingGroups: false,
  downloadProgressCount: 0,

  serverPage: 1,
  serverPageSize: 25,
  serverSearch: '',
  serverSort: null,
  serverOrder: 'asc',
  serverTotalCount: 0,
  serverTotalGroupsCount: 0,
  serverTotalPages: 1,
  isFetchingServerPage: false,

  serverFavoriteOnly: false,

  setServerFavoriteOnly: (favOnly) => {
    set({ serverFavoriteOnly: favOnly, serverPage: 1 });
    get().fetchServerNewsgroupsPage({ page: 1, favoriteOnly: favOnly });
  },

  serverFavoritesMap: {},

  fetchServerNewsgroupsPage: async (params = {}) => {
    const { serverPage, serverPageSize, serverSearch, serverSort, serverOrder, selectedServerId, serverFavoriteOnly } = get();
    const p = params.page !== undefined ? params.page : serverPage;
    const ps = params.pageSize !== undefined ? params.pageSize : serverPageSize;
    const s = params.search !== undefined ? params.search : serverSearch;
    const st = params.sort !== undefined ? params.sort : serverSort;
    const o = params.order !== undefined ? params.order : serverOrder;
    const srvId = params.serverId !== undefined ? params.serverId : selectedServerId;
    const favOnly = params.favoriteOnly !== undefined ? params.favoriteOnly : serverFavoriteOnly;

    set({ isFetchingServerPage: true, serverFavoriteOnly: favOnly });

    try {
      const q = new URLSearchParams({
        page: p,
        pageSize: ps,
        search: s,
        serverId: srvId,
        ...(st ? { sort: st, order: o } : {}),
        ...(favOnly ? { favoriteOnly: 'true' } : {}),
      });

      const res = await fetch(`/api/newsgroups?${q.toString()}`);
      const data = await res.json();

      if (data.hasCache) {
        set({
          newsgroups: data.groups || [],
          serverTotalCount: data.totalCount || 0,
          serverTotalGroupsCount: data.totalGroupsCount || 0,
          serverTotalPages: data.totalPages || 1,
          serverPage: data.page || 1,
          serverPageSize: data.pageSize || 25,
          serverSearch: s,
          serverSort: st,
          serverOrder: o,
          lastUpdated: data.lastUpdated || get().lastUpdated,
        });
      } else {
        set({
          newsgroups: [],
          serverTotalCount: 0,
          serverTotalGroupsCount: 0,
          serverTotalPages: 1,
        });
      }
    } catch (err) {
      console.error('Failed to fetch server newsgroups page:', err);
    } finally {
      set({ isFetchingServerPage: false });
    }
  },

  fetchFavorites: async (targetServerId) => {
    const srvId = targetServerId || get().selectedServerId;
    try {
      const res = await fetch(`/api/favorites?serverId=${srvId}`);
      const data = await res.json();
      if (Array.isArray(data.favorites)) {
        set((state) => ({
          favorites: srvId === state.selectedServerId ? data.favorites : state.favorites,
          favoriteObjects: srvId === state.selectedServerId ? (data.favoriteObjects || []) : state.favoriteObjects,
          serverFavoritesMap: {
            ...state.serverFavoritesMap,
            [srvId]: {
              favorites: data.favorites,
              favoriteObjects: data.favoriteObjects || [],
            },
          },
        }));
      }
    } catch (e) {
      console.error('Failed to fetch favorites:', e);
    }
  },

  toggleStar: async (groupName, targetServerId) => {
    const srvId = targetServerId || get().selectedServerId;
    try {
      const res = await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, serverId: srvId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.favorites)) {
        await get().fetchFavorites(srvId);
        if (srvId === get().selectedServerId) {
          get().fetchServerNewsgroupsPage();
        }
      }
    } catch (e) {
      console.error('Failed to toggle star in SQLite:', e);
    }
  },

  addFavoritesBatch: async (groupNames, targetServerId, action = 'add') => {
    const srvId = targetServerId || get().selectedServerId;
    try {
      const res = await fetch('/api/favorites/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: groupNames, serverId: srvId, action }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.favorites)) {
        await get().fetchFavorites(srvId);
        if (srvId === get().selectedServerId) {
          get().fetchServerNewsgroupsPage();
        }
      }
    } catch (e) {
      console.error('Failed to batch update favorites in SQLite:', e);
    }
  },

  removeFavoritesBatch: async (groupNames, targetServerId) => {
    return get().addFavoritesBatch(groupNames, targetServerId, 'remove');
  },

  updateSelectedGroupCounts: async (groupNames) => {
    try {
      const res = await fetch('/api/newsgroups/update-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: groupNames }),
      });
      const data = await res.json();
      if (data.success) {
        get().fetchServerNewsgroupsPage();
      }
    } catch (e) {
      console.error('Failed to update group counts in SQLite:', e);
    }
  },

  connected: false,
  nntpUser: '',
  ws: null,
  loading: false,

  currentPage: 1,
  pageSize: 25,
  groupStats: { count: 0, low: 0, high: 0 },

  // Raw XOVER fetch cursor (used to fetch additional raw chunks on demand,
  // e.g. to fill a page with enough NZB-grouped packages)
  rawCursorEnd: null,
  rawExhausted: false,
  isFetchingPage: false,
  pageFetchSeq: 0,
  fetchRequestSeq: 0,
  lastFetchLimit: 25,

  // Test knob: how many raw articles to request per XOVER batch when
  // auto-continuing to fill a grouped/clean-mode page (independent of
  // `pageSize`, which controls how many rows/groups are shown per page).
  rawChunkSize: 30000,

  // Maximum number of consecutive empty chunk auto-retries (default: 3)
  maxEmptyRetries: 3,
  emptyRetryCount: 0,
  setMaxEmptyRetries: (count) => set({ maxEmptyRetries: count }),

  // Optional manual retrieval range (xnews-style "Start"/"End" article
  // numbers). null means "use the group's actual high/low bound".
  rangeStart: null,
  rangeEnd: null,

  articles: [],
  articleBodies: {},
  loadingBodyId: null,

  fetchArticleBody: (articleId) => {
    const { ws, articleBodies, selectedGroup, selectedServerId } = get();
    if (articleBodies[articleId]) return; // cached
    set({ loadingBodyId: articleId });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'FETCH_ARTICLE_BODY', serverId: selectedServerId, group: selectedGroup, articleId }));
      // Safety timeout: if server never responds, clear loading state after 15s
      setTimeout(() => {
        const { loadingBodyId } = get();
        if (loadingBodyId === articleId) {
          set({
            loadingBodyId: null,
            articleBodies: {
              ...get().articleBodies,
              [articleId]: '(No response from server — article may be binary-only or unavailable)',
            },
          });
        }
      }, 15000);
    }
  },

  setPage: (page) => {
    const { groupStats, pageSize, rangeStart, rangeEnd } = get();
    const groupLow = parseInt(groupStats.low, 10);
    const low = rangeEnd != null && !isNaN(rangeEnd) ? Math.max(groupLow, rangeEnd) : groupLow;
    const topRef = rangeStart != null && !isNaN(rangeStart) ? rangeStart : parseInt(groupStats.high, 10);
    const end = Math.max(low, topRef - (page - 1) * pageSize);
    set({ currentPage: page });
    get().fetchChunk({ end, append: false });
  },

  setPageSize: (size) => {
    set({ pageSize: size, currentPage: 1 });
    get()._refetchFromTop({ limit: size });
  },

  setRawChunkSize: (size) => {
    set({ rawChunkSize: size, currentPage: 1 });
  },

  // Simple combined control: "look at the most recent N articles". Sets both
  // the per-batch fetch size and the scan depth (rangeEnd) from one number,
  // so the UI only needs a single input for the common case.
  setRecentArticleCount: (n) => {
    const { groupStats } = get();
    const groupLow = parseInt(groupStats.low, 10);
    const groupHigh = parseInt(groupStats.high, 10);
    const end = !isNaN(groupLow) && !isNaN(groupHigh) ? Math.max(groupLow, groupHigh - n + 1) : null;
    set({ rawChunkSize: n, rangeStart: null, rangeEnd: end, currentPage: 1 });
    get()._refetchFromTop({ limit: n });
  },

  // xnews-style manual "Start"/"End" article number override. Pass null for
  // either to fall back to the group's real high/low bound. Immediately
  // refetches page 1 from the new start.
  setRetrievalRange: ({ start = null, end = null } = {}) => {
    set({ rangeStart: start, rangeEnd: end, currentPage: 1, emptyRetryCount: 0 });
    get()._refetchFromTop({});
  },

  clearRetrievalRange: () => {
    set({ rangeStart: null, rangeEnd: null, currentPage: 1, emptyRetryCount: 0 });
    get()._refetchFromTop({});
  },

  _refetchFromTop: ({ limit } = {}) => {
    const { selectedGroup, groupStats, rangeStart, rawChunkSize } = get();
    if (!selectedGroup || selectedGroup === '__SERVER__' || !groupStats || !groupStats.high) return;
    const end = rangeStart != null && !isNaN(rangeStart) ? rangeStart : parseInt(groupStats.high, 10);
    get().fetchChunk({ end, limit: limit !== undefined ? limit : rawChunkSize, append: false });
  },

  // Fetches one raw XOVER chunk of `limit` articles ending at `end` (defaults
  // to `pageSize` when no limit is given — used by the plain, non-grouped
  // page navigation). append:true keeps previously-fetched articles (used to
  // grow a page with more raw parts until enough NZB-grouped packages have
  // been assembled).
  fetchChunk: ({ end, limit, append = false } = {}) => {
    const { ws, selectedGroup, groupStats, pageSize, rangeEnd } = get();
    const effectiveLimit = limit !== undefined ? limit : pageSize;
    const groupLow = parseInt(groupStats.low, 10);
    const low = rangeEnd != null && !isNaN(rangeEnd) ? Math.max(groupLow, rangeEnd) : groupLow;
    const targetEnd = end !== undefined ? end : get().rawCursorEnd;

    if (targetEnd == null || isNaN(targetEnd) || targetEnd < low) {
      set({ isFetchingPage: false, loading: false, rawExhausted: true });
      return;
    }

    const requestId = get().fetchRequestSeq + 1;
    set((state) => ({
      loading: true,
      isFetchingPage: true,
      rawCursorEnd: targetEnd,
      rawExhausted: false,
      fetchRequestSeq: requestId,
      lastFetchLimit: effectiveLimit,
      articles: append ? state.articles : [],
      emptyRetryCount: append ? state.emptyRetryCount : 0,
    }));

    if (ws && ws.readyState === WebSocket.OPEN) {
      const { rangeStart } = get();
      ws.send(
        JSON.stringify({
          type: 'FETCH_PAGE',
          serverId: get().selectedServerId,
          group: selectedGroup,
          low,
          high: targetEnd,
          start: rangeStart || undefined,
          page: 1,
          limit: effectiveLimit,
        })
      );
    }
  },

  _completeChunk: ({ empty, receivedCount = 0, addedCount = 0 } = {}) => {
    const state = get();
    const groupLow = parseInt(state.groupStats.low, 10);
    const low = state.rangeEnd != null && !isNaN(state.rangeEnd) ? Math.max(groupLow, state.rangeEnd) : groupLow;
    const nextEnd = (state.rawCursorEnd != null ? state.rawCursorEnd : low) - state.lastFetchLimit;
    
    let currentRetryCount = state.emptyRetryCount;
    if (empty || receivedCount === 0) {
      currentRetryCount += 1;
    } else {
      currentRetryCount = 0;
    }

    const maxRetries = state.maxEmptyRetries !== undefined ? state.maxEmptyRetries : 3;
    const shouldStopRetry = (empty || receivedCount === 0) && currentRetryCount >= maxRetries;

    set({
      isFetchingPage: false,
      loading: false,
      rawExhausted: nextEnd < low || shouldStopRetry,
      pageFetchSeq: state.pageFetchSeq + 1,
      rawCursorEnd: nextEnd,
      emptyRetryCount: currentRetryCount,
    });
    
    if ((empty || receivedCount === 0) && !shouldStopRetry && nextEnd >= low) {
      console.log(`[NNTP] Empty chunk encountered (${currentRetryCount}/${maxRetries}), retrying next range...`);
      setTimeout(() => get().loadMoreRaw(), 50);
    } else if (shouldStopRetry) {
      console.warn(`[NNTP] Stopped auto-retry after ${maxRetries} consecutive empty chunks.`);
    }
  },

  loadMoreRaw: (limit) => {
    const { rawCursorEnd, rawExhausted, isFetchingPage, rawChunkSize } = get();
    if (rawExhausted || isFetchingPage || rawCursorEnd == null) return;
    get().fetchChunk({ end: rawCursorEnd, limit: limit !== undefined ? limit : rawChunkSize, append: true });
  },

  downloadServerNewsgroups: (targetServerId) => {
    const { ws, selectedServerId } = get();
    const srvId = targetServerId || selectedServerId;
    set({ isDownloadingGroups: true });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'FETCH_SERVER_NEWSGROUPS', serverId: srvId }));
    }
  },

  connectBridge: () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to NNTP Bridge Server');
      set({ connected: true });
      get().fetchServers();
      get().fetchFavorites();
      get().fetchServerNewsgroupsPage({ page: 1 });
      if (get().selectedGroup && get().selectedGroup !== '__SERVER__') {
        get().fetchArticles(get().selectedGroup, 1);
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'STATUS') {
        set({ connected: true });
      } else if (data.type === 'AUTH_SUCCESS') {
        set({ connected: true, nntpUser: data.user });
        get().fetchServers();
        get().fetchFavorites();
        get().fetchServerNewsgroupsPage({ page: 1 });
        if (get().selectedGroup && get().selectedGroup !== '__SERVER__') {
          get().fetchArticles(get().selectedGroup, 1);
        }
      } else if (data.type === 'FETCH_GROUPS_PROGRESS') {
        set({ downloadProgressCount: data.count || 0 });
      } else if (data.type === 'FETCH_GROUPS_SUCCESS') {
        set({ isDownloadingGroups: false, downloadProgressCount: 0, lastUpdated: data.lastUpdated });
        get().fetchServerNewsgroupsPage({ page: 1 });
        get().fetchFavorites();
        alert(`Successfully fetched & saved ${(data.count || 0).toLocaleString()} newsgroups into SQLite DB!`);
      } else if (data.type === 'FETCH_GROUPS_ERROR') {
        set({ isDownloadingGroups: false, downloadProgressCount: 0 });
        alert(`Failed to save newsgroups: ${data.message}`);
      } else if (data.type === 'DOWNLOAD_PROGRESS') {
        set((state) => ({
          downloads: {
            ...state.downloads,
            [data.downloadId]: { current: data.current, total: data.total, status: 'downloading' }
          }
        }));
      } else if (data.type === 'DOWNLOAD_COMPLETE') {
        set((state) => ({
          downloads: {
            ...state.downloads,
            [data.downloadId]: { status: data.success ? 'complete' : 'error', error: data.error }
          }
        }));
        if (!data.success) {
          alert(`Download failed: ${data.error}`);
        }
      } else if (data.type === 'GROUP_SUCCESS') {
        set({
          groupStats: { count: data.count, low: data.low, high: data.high },
          currentPage: 1,
        });
        get()._refetchFromTop({});
      } else if (data.type === 'PAGE_FETCH_PROGRESS') {
        set({ xoverProgress: { current: data.current, total: data.total } });
      } else if (data.type === 'PAGE_FETCH_COMPLETE') {
        if (data.group && data.group !== get().selectedGroup) {
          console.warn(`[!] Ignored PAGE_FETCH_COMPLETE for ${data.group} (current group is ${get().selectedGroup})`);
          return;
        }
        set({ xoverProgress: null });
        // Parse the whole batch in one pass (O(n) dedup via a Set, one array
        // copy) and commit with a single set() call — doing this per-line
        // was O(n^2) and the actual cause of multi-second/minute stalls on
        // large batches.
        const lines = Array.isArray(data.lines) ? data.lines : [];
        let addedCount = 0;
        if (lines.length > 0) {
          set((state) => {
            const existingIds = new Set(state.articles.map((a) => a.id));
            const newItems = [];
            for (const line of lines) {
              const item = parseOverviewLine(line);
              if (item && !existingIds.has(item.id)) {
                existingIds.add(item.id);
                newItems.push(item);
              }
            }
            addedCount = newItems.length;
            return newItems.length ? { articles: [...state.articles, ...newItems] } : state;
          });
        }
        const isEmpty = !!data.empty || lines.length === 0;
        get()._completeChunk({ empty: isEmpty, receivedCount: lines.length, addedCount });
      } else if (data.type === 'ARTICLE_BODY_SUCCESS') {
        set((state) => ({
          loadingBodyId: null,
          articleBodies: {
            ...state.articleBodies,
            [data.articleId]: data.body || '(Empty article body)',
          },
        }));
      } else if (data.type === 'ARTICLE_BODY_ERROR') {
        set((state) => ({
          loadingBodyId: null,
          articleBodies: {
            ...state.articleBodies,
            [data.articleId]: `[Error] ${data.message}`,
          },
        }));
      } else if (data.type === 'GROUP_ERROR') {
        set({ loading: false, isFetchingPage: false, articles: [] });
      } else if (data.type === 'NNTP_LOG') {
        const { level, category, message, details, timestamp } = data;
        set((state) => ({
          nntpLogs: [
            ...(state.nntpLogs || []).slice(-199),
            {
              id: Date.now() + Math.random(),
              timestamp: timestamp || new Date().toISOString(),
              time: new Date().toLocaleTimeString(),
              level,
              category,
              message,
              details,
            }
          ]
        }));

        // 백엔드 NNTP 클래스 로그를 브라우저 DevTools 콘솔에도 출력
        const tag = `%c[NNTP:${category}]%c`;
        const style = level === 'error'
          ? 'color:#ef4444;font-weight:bold'
          : level === 'warn'
            ? 'color:#f59e0b;font-weight:bold'
            : 'color:#3b82f6;font-weight:bold';
        const detailStr = details ? ` ${typeof details === 'object' ? JSON.stringify(details) : details}` : '';
        const fullMsg = `${message}${detailStr}`;
        if (level === 'error') {
          console.error(tag, style, '', fullMsg);
        } else if (level === 'warn') {
          console.warn(tag, style, '', fullMsg);
        } else {
          console.log(tag, style, '', fullMsg);
        }
      }
    };

    set({ ws });
  },

  fetchArticles: (group, page = 1) => {
    const { ws, selectedServerId } = get();
    set({ loading: true, articles: [] });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SELECT_GROUP', serverId: selectedServerId, group: group || get().selectedGroup }));
    }
  },

  refreshCurrentGroup: () => {
    const { ws, selectedGroup, selectedServerId } = get();
    set({ loading: true, articles: [] });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'REFRESH', serverId: selectedServerId, group: selectedGroup }));
    }
  },

  credentials: {
    host: 'news.usenet.farm',
    port: 563,
    useSSL: true,
    username: 'ufadh3njs4xtxy0e',
    password: '••••••••••••',
    maxConnections: 10,
  },

  servers: [
    {
      id: 'server-farm',
      name: 'Usenet.Farm Server',
      host: 'news.usenet.farm',
      port: 563,
      useSSL: true,
      username: 'ufadh3njs4xtxy0e',
      password: 'c35y18s53qglwx5e',
      maxConnections: 10,
      status: 'Connected',
      retention: '3000+ Days',
      syncedGroups: 1289531,
      isPrimary: true,
    },
  ],
  isServerModalOpen: false,
  editingServer: null,

  fetchServers: async () => {
    try {
      const res = await fetch('/api/servers');
      const data = await res.json();
      if (data.success && Array.isArray(data.servers) && data.servers.length > 0) {
        const { selectedServerId } = get();
        const primaryServer = data.servers.find(s => s.isPrimary) || data.servers[0];
        const activeServerId = (selectedServerId && data.servers.some(s => s.id === selectedServerId))
          ? selectedServerId
          : primaryServer.id;
        const currentServer = data.servers.find(s => s.id === activeServerId);
        const newChunkSize = currentServer?.default_article_count || 300;
        set({ servers: data.servers, selectedServerId: activeServerId, rawChunkSize: newChunkSize });
      }
    } catch (e) {
      console.error('Failed to fetch servers from API:', e);
    }
  },

  openAddServerModal: () => {
    set({ isServerModalOpen: true, editingServer: null });
  },

  openEditServerModal: (server) => {
    const target = server || get().servers[0];
    set({ isServerModalOpen: true, editingServer: target });
  },

  closeServerModal: () => {
    set({ isServerModalOpen: false, editingServer: null });
  },

  saveServer: async (serverData) => {
    try {
      const res = await fetch('/api/servers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.servers)) {
        const { selectedServerId } = get();
        const currentServer = data.servers.find(s => s.id === selectedServerId);
        const newChunkSize = currentServer?.default_article_count || 300;
        set({ servers: data.servers, isServerModalOpen: false, editingServer: null, rawChunkSize: newChunkSize });
        return;
      }
    } catch (e) {
      console.error('Failed to save server to API:', e);
    }

    // Fallback to local state if backend API request fails
    const { servers } = get();
    if (serverData.id) {
      const updated = servers.map((s) => (s.id === serverData.id ? { ...s, ...serverData } : s));
      set({ servers: updated, isServerModalOpen: false, editingServer: null });
    } else {
      const newServer = {
        id: `server-${Date.now()}`,
        status: 'Connected',
        retention: '3000+ Days',
        syncedGroups: 0,
        isPrimary: servers.length === 0,
        ...serverData,
      };
      set({ servers: [...servers, newServer], isServerModalOpen: false, editingServer: null });
    }
  },

  batchSaveServers: async (serversList) => {
    try {
      const res = await fetch('/api/servers/batch-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servers: serversList }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.servers)) {
        const { selectedServerId } = get();
        const currentServer = data.servers.find(s => s.id === selectedServerId);
        const newChunkSize = currentServer?.default_article_count || 300;
        set({ servers: data.servers, rawChunkSize: newChunkSize });
        return true;
      }
    } catch (e) {
      console.error('Failed to batch save servers:', e);
    }
    return false;
  },

  deleteServer: async (serverId) => {
    const { servers } = get();
    if (servers.length <= 1) {
      alert('최소 1개의 서버는 등록되어 있어야 합니다.');
      return;
    }

    try {
      const res = await fetch(`/api/servers/${serverId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.servers)) {
        set({ servers: data.servers });
        return;
      } else if (data.error) {
        alert(data.error);
        return;
      }
    } catch (e) {
      console.error('Failed to delete server via API:', e);
    }

    set({ servers: servers.filter((s) => s.id !== serverId) });
  },
}));
