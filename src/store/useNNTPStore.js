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
  activeTab: 'reader',
  setActiveTab: (tab) => set({ activeTab: tab }),

  selectedGroup: 'alt.binaries.teal',
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

  fetchServerNewsgroupsPage: async (params = {}) => {
    const { serverPage, serverPageSize, serverSearch, serverSort, serverOrder } = get();
    const p = params.page !== undefined ? params.page : serverPage;
    const ps = params.pageSize !== undefined ? params.pageSize : serverPageSize;
    const s = params.search !== undefined ? params.search : serverSearch;
    const st = params.sort !== undefined ? params.sort : serverSort;
    const o = params.order !== undefined ? params.order : serverOrder;

    set({ isFetchingServerPage: true });

    try {
      const q = new URLSearchParams({
        page: p,
        pageSize: ps,
        search: s,
        ...(st ? { sort: st, order: o } : {}),
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
      }
    } catch (err) {
      console.error('Failed to fetch server newsgroups page:', err);
    } finally {
      set({ isFetchingServerPage: false });
    }
  },

  fetchFavorites: async () => {
    try {
      const res = await fetch('/api/favorites');
      const data = await res.json();
      if (Array.isArray(data.favorites)) {
        set({ favorites: data.favorites, favoriteObjects: data.favoriteObjects || [] });
      }
    } catch (e) {
      console.error('Failed to fetch favorites:', e);
    }
  },

  toggleStar: async (groupName) => {
    try {
      const res = await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.favorites)) {
        set({ favorites: data.favorites });
        get().fetchServerNewsgroupsPage();
      }
    } catch (e) {
      console.error('Failed to toggle star in SQLite:', e);
    }
  },

  addFavoritesBatch: async (groupNames) => {
    try {
      const res = await fetch('/api/favorites/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: groupNames }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.favorites)) {
        set({ favorites: data.favorites });
        get().fetchServerNewsgroupsPage();
      }
    } catch (e) {
      console.error('Failed to batch save favorites in SQLite:', e);
    }
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
  rawChunkSize: 300,

  // Optional manual retrieval range (xnews-style "Start"/"End" article
  // numbers). null means "use the group's actual high/low bound".
  rangeStart: null,
  rangeEnd: null,

  articles: [],
  articleBodies: {},
  loadingBodyId: null,

  fetchArticleBody: (articleId) => {
    const { ws, articleBodies, selectedGroup } = get();
    if (articleBodies[articleId]) return; // cached
    set({ loadingBodyId: articleId });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'FETCH_ARTICLE_BODY', group: selectedGroup, articleId }));
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
    get()._refetchFromTop({ limit: size });
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
    set({ rangeStart: start, rangeEnd: end, currentPage: 1 });
    get()._refetchFromTop({});
  },

  clearRetrievalRange: () => {
    set({ rangeStart: null, rangeEnd: null, currentPage: 1 });
    get()._refetchFromTop({});
  },

  // (Re)starts retrieval at the top of the current effective range (custom
  // `rangeStart`, or the group's real high watermark). Defaults the batch
  // size to `rawChunkSize` since this mostly serves the grouped-view flows.
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
    }));

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'FETCH_PAGE',
          group: selectedGroup,
          low,
          high: targetEnd,
          page: 1,
          limit: effectiveLimit,
        })
      );
    }

    // Safety net in case PAGE_FETCH_COMPLETE never arrives (e.g. the bridge
    // server process hasn't been restarted since it gained support for that
    // message) — don't let the UI hang forever waiting for it. Large test
    // batches (thousands of parts) take longer, so scale the wait a bit.
    const timeoutMs = Math.min(20000, Math.max(6000, effectiveLimit * 4));
    setTimeout(() => {
      if (get().fetchRequestSeq === requestId && get().isFetchingPage) {
        get()._completeChunk({ empty: false });
      }
    }, timeoutMs);
  },

  _completeChunk: ({ empty }) => {
    set((state) => {
      const groupLow = parseInt(state.groupStats.low, 10);
      const low = state.rangeEnd != null && !isNaN(state.rangeEnd) ? Math.max(groupLow, state.rangeEnd) : groupLow;
      const nextEnd = (state.rawCursorEnd != null ? state.rawCursorEnd : low) - state.lastFetchLimit;
      return {
        isFetchingPage: false,
        loading: false,
        rawExhausted: !!empty || nextEnd < low,
        pageFetchSeq: state.pageFetchSeq + 1,
        rawCursorEnd: nextEnd,
      };
    });
  },

  loadMoreRaw: (limit) => {
    const { rawCursorEnd, rawExhausted, isFetchingPage, rawChunkSize } = get();
    if (rawExhausted || isFetchingPage || rawCursorEnd == null) return;
    get().fetchChunk({ end: rawCursorEnd, limit: limit !== undefined ? limit : rawChunkSize, append: true });
  },

  downloadServerNewsgroups: () => {
    const { ws } = get();
    set({ isDownloadingGroups: true });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'FETCH_SERVER_NEWSGROUPS' }));
    }
  },

  connectBridge: () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to NNTP Bridge Server');
      get().fetchServers();
      get().fetchFavorites();
      get().fetchServerNewsgroupsPage({ page: 1 });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'AUTH_SUCCESS') {
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
      } else if (data.type === 'GROUP_SUCCESS') {
        set({
          groupStats: { count: data.count, low: data.low, high: data.high },
          currentPage: 1,
        });
        get()._refetchFromTop({});
      } else if (data.type === 'PAGE_FETCH_COMPLETE') {
        // Parse the whole batch in one pass (O(n) dedup via a Set, one array
        // copy) and commit with a single set() call — doing this per-line
        // was O(n^2) and the actual cause of multi-second/minute stalls on
        // large batches.
        const lines = Array.isArray(data.lines) ? data.lines : [];
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
            return newItems.length ? { articles: [...state.articles, ...newItems] } : state;
          });
        }
        get()._completeChunk({ empty: !!data.empty });
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
      }
    };

    set({ ws });
  },

  fetchArticles: (group, page = 1) => {
    const { ws } = get();
    set({ loading: true, articles: [] });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SELECT_GROUP', group: group || get().selectedGroup }));
    }
  },

  refreshCurrentGroup: () => {
    const { ws, selectedGroup } = get();
    set({ loading: true, articles: [] });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'REFRESH', group: selectedGroup }));
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
        set({ servers: data.servers });
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
        set({ servers: data.servers, isServerModalOpen: false, editingServer: null });
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
