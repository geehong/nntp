import React, { useState, useMemo, useEffect } from 'react';
import { useNNTPStore } from '../../store/useNNTPStore';
import {
  Download,
  FileText,
  Eye,
  Filter,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Star,
  Calculator,
  Settings,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

const IMAGE_EXT_PATTERN = /\.(jpe?g|png|gif|webp|bmp)(\s|\d|$)/i;
const looksLikeImageArticle = (subject, bodyPreview) =>
  IMAGE_EXT_PATTERN.test(subject || '') || (bodyPreview || '').includes('=ybegin');

// Helper function to detect random hash/encrypted subjects (e.g. ZbH4JQXTjwS6)
const isRandomHashSubject = (subject) => {
  if (!subject) return false;
  const trimmed = subject.trim();
  // Match pure alphanumeric random strings of length 8-40 without spaces
  const isPureHash = /^[a-zA-Z0-9]{8,40}$/.test(trimmed);
  // Check if it has common extensions or part indicators
  const hasExtensionOrPart = /\.(mp4|mkv|avi|wmv|rar|zip|7z|par2|jpg|png|gif|nfo|txt)\b/i.test(trimmed) || /\d+[\/\s]\d+/.test(trimmed);
  return isPureHash && !hasExtensionOrPart;
};

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Most posters embed a "[N/Total]" or "(N/Total)" part counter in the
// subject — pull it out so we can tell a truly complete multi-part set
// apart from one where we're only seeing some of its parts.
const PART_COUNTER_PATTERN = /[[(](\d+)\/(\d+)[\])]/;
const extractPartInfo = (subject) => {
  if (!subject) return null;
  let match = subject.match(PART_COUNTER_PATTERN);
  if (!match) {
    // Fallback for bare " 1/40 " at the end of the string
    match = subject.match(/\b(\d+)\/(\d+)\b(?=\s*$)/);
  }
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  if (!total || num > total) return null;
  return { num, total };
};

const RE_PART_COUNTER_1 = /\[\d+\/\d+\]/gi;
const RE_PART_COUNTER_2 = /\(\d+\/\d+\)/gi;
const RE_PART_COUNTER_3 = /\b\d+\/\d+\b/gi;
const RE_YENC_1 = /yenc\s*\(\d+\/\d+\)/gi;
const RE_YENC_2 = /yenc/gi;
const RE_PAR2 = /\.vol\d+(\+\d+)?\.par2/gi;
const RE_RAR = /\.rar\b/gi;
const RE_R_EXT = /\.r\d{2,3}\b/gi;
const RE_PARTS = /\(\d+ parts?\)/gi;
const RE_QUOTES = /"/g;
const RE_DASH_END = /[-\s]+$/;
const RE_SPACES = /\s+/g;
const RE_GROUP_HEURISTIC = /[[(]\d+\/\d+[\])]/;

const getBaseTitle = (subj) => {
  if (!subj) return 'Unknown';
  let base = subj;

  const partMatch = base.match(RE_GROUP_HEURISTIC);
  if (partMatch) {
     const prefix = base.substring(0, partMatch.index).trim();
     if (prefix.length > 5) {
         base = prefix;
     }
  }

  // Remove individual file sequence numbers inside quotes or before extensions (e.g. "Angelica-20090625_123.jpg" -> "Angelica-20090625")
  base = base
    .replace(RE_PART_COUNTER_1, '')
    .replace(RE_PART_COUNTER_2, '')
    .replace(RE_PART_COUNTER_3, '')
    .replace(RE_YENC_1, '')
    .replace(RE_YENC_2, '')
    .replace(RE_PAR2, '')
    .replace(RE_RAR, '')
    .replace(RE_R_EXT, '')
    .replace(RE_PARTS, '')
    .replace(/["']/g, '') // remove quotes
    .replace(/[-_\s]*\d{2,4}\.(jpe?g|png|gif|webp|bmp|mp4|mkv|avi|rar|zip|7z)\b/gi, '') // strip file-specific counter like _123.jpg or _001.jpg
    .replace(/\.(jpe?g|png|gif|webp|bmp|mp4|mkv|avi|rar|zip|7z)\b/gi, '') // strip extension
    .replace(RE_DASH_END, '')
    .replace(RE_SPACES, ' ')
    .trim();

  return base || subj;
};

export default function ArticleTable() {
  const {
    selectedGroup,
    setSelectedGroup,
    selectedServerId,
    articles = [],
    newsgroups = [],
    favorites = [],
    toggleStar,
    addFavoritesBatch,
    removeFavoritesBatch,
    updateSelectedGroupCounts,
    lastUpdated,
    downloadServerNewsgroups,
    isDownloadingGroups,
    downloadProgressCount = 0,
    articleSearchQuery,
    refreshCurrentGroup,
    loading,
    groupStats,
    pageSize,
    setPage,
    setPageSize,
    loadMoreRaw,
    rawExhausted,
    isFetchingPage,
    pageFetchSeq,
    rawChunkSize,
    setRecentArticleCount,
    xoverProgress,
    rangeStart,
    rangeEnd,
    setRetrievalRange,
    clearRetrievalRange,
    articleBodies = {},
    loadingBodyId,
    fetchArticleBody,

    // Server-side Pagination Store Actions & State
    serverPage,
    serverPageSize,
    serverSearch,
    serverSort,
    serverOrder,
    serverTotalCount,
    serverTotalGroupsCount,
    serverTotalPages,
    isFetchingServerPage,
    fetchServerNewsgroupsPage,
    serverFavoriteOnly,
    setServerFavoriteOnly,
    downloadSelectedArticles,
    downloads,
  } = useNNTPStore();

  const isServerMode = selectedGroup === '__SERVER__';

  // Common Search & Selection States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCheckboxes, setSelectedCheckboxes] = useState({});
  const [tablePage, setTablePage] = useState(1);
  const [serverTablePageSize, setServerTablePageSize] = useState(25);
  const [showColumnConfig, setShowColumnConfig] = useState(false);

  // Article mode uses the store's pageSize (it drives real NNTP fetch size);
  // server mode (newsgroup manager) has its own independent page size.
  const tablePageSize = isServerMode ? serverTablePageSize : pageSize;

  // Article count control: a single "look at the most recent N articles"
  // input, plus a gear icon that opens a modal for precise Start/End article
  // number selection (xnews' "Set number of headers to retrieve" dialog).
  const [articleCountInput, setArticleCountInput] = useState(String(rawChunkSize));
  const [useStandardTable, setUseStandardTable] = useState(false); // Default: Compact table (useStandardTable = false)
  const [hideRandomHashSubjects, setHideRandomHashSubjects] = useState(true); // Default: Filter random hash subjects
  const isCompactTable = !useStandardTable;
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [modalStartInput, setModalStartInput] = useState('');
  const [modalEndInput, setModalEndInput] = useState('');

  const [selectedArticleId, setSelectedArticleId] = useState(null);
  // Track which image articles are still loading the <img> itself
  const [imgLoadingIds, setImgLoadingIds] = useState({});
  const [expandedImages, setExpandedImages] = useState({});

  // Sorting State
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Dynamic Column Definitions
  const columnDefs = useMemo(() => {
    if (isServerMode) {
      return [
        { key: 'checkbox', label: 'Check', width: '4%', align: 'center', sortable: false },
        { key: 'id', label: 'ID', width: '6%', align: 'center', sortable: true },
        { key: 'name', label: 'Newsgroup Name', align: 'left', sortable: true },
        { key: 'high', label: 'High', width: '12%', align: 'left', sortable: true },
        { key: 'low', label: 'Low', width: '12%', align: 'left', sortable: true },
        { key: 'count', label: 'Count', width: '12%', align: 'left', sortable: true },
        { key: 'article_count', label: 'Article Count', width: '15%', align: 'left', sortable: true },
        { key: 'status', label: 'Status', width: '6%', align: 'center', sortable: true },
        { key: 'action', label: 'Actions', width: '10%', align: 'right', sortable: false },
      ];
    } else {
      return [
        { key: 'checkbox', label: 'Check', width: '4%', align: 'center', sortable: false },
        { key: 'id', label: 'ID / Article #', width: '10%', align: 'left', sortable: true },
        { key: 'subject', label: 'Subject / Title', width: '42%', align: 'left', sortable: true },
        { key: 'poster', label: 'Poster / Author', width: '22%', align: 'left', sortable: true },
        { key: 'date', label: 'Date', width: '14%', align: 'left', sortable: true },
        { key: 'bytes', label: 'Size', width: '8%', align: 'left', sortable: true },
        { key: 'action', label: 'Actions', width: '12%', align: 'right', sortable: false },
      ];
    }
  }, [isServerMode]);

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState(() => {
    return {
      checkbox: true,
      id: true,
      name: true,
      high: true,
      low: true,
      count: true,
      article_count: true,
      status: false,
      subject: true,
      poster: true,
      date: true,
      bytes: true,
      action: true,
    };
  });

  const safeFavorites = Array.isArray(favorites) ? favorites : [];

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Trigger Server-side Pagination Fetch when in Server Mode
  useEffect(() => {
    if (isServerMode && fetchServerNewsgroupsPage) {
      fetchServerNewsgroupsPage({
        page: tablePage,
        pageSize: tablePageSize,
        search: debouncedSearchQuery,
        sort: sortColumn,
        order: sortDirection,
        favoriteOnly: serverFavoriteOnly,
      });
    }
  }, [isServerMode, tablePage, tablePageSize, debouncedSearchQuery, sortColumn, sortDirection, serverFavoriteOnly]);

  // Server-side vs Client-side Filtered & Sorted Items
  const displayItems = useMemo(() => {
    if (isServerMode) {
      // In server mode, newsgroups array contains ONLY current page items returned by backend!
      return newsgroups;
    } else {
      // In article mode, filter and sort locally per current page
      const q = (searchQuery || articleSearchQuery || '').toLowerCase();
      let filtered = articles.filter((item) => {
        if (!item || !item.subject) return true;
        if (hideRandomHashSubjects && isRandomHashSubject(item.subject)) {
          return false;
        }
        return item.subject.toLowerCase().includes(q);
      });

      if (sortColumn) {
        filtered = [...filtered].sort((a, b) => {
          let valA = a[sortColumn];
          let valB = b[sortColumn];
          if (sortColumn === 'id') {
            valA = a.id;
            valB = b.id;
          } else if (sortColumn === 'poster') {
            valA = a.poster || a.from || '';
            valB = b.poster || b.from || '';
          } else if (sortColumn === 'date') {
            valA = a.date ? new Date(a.date).getTime() || a.date : '';
            valB = b.date ? new Date(b.date).getTime() || b.date : '';
          }
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
      }
      return filtered;
    }
  }, [isServerMode, newsgroups, articles, searchQuery, articleSearchQuery, sortColumn, sortDirection, hideRandomHashSubjects]);

  // NZB Filter Mode: 'grouped' (모아서 1개) | 'all' (모두 펼치기) | 'clean' (숨기기)
  const [nzbFilterMode, setNzbFilterMode] = useState('grouped');
  const [expandedNzbPackages, setExpandedNzbPackages] = useState({});

  const toggleExpandPackage = (pkgKey) => {
    setExpandedNzbPackages((prev) => ({
      ...prev,
      [pkgKey]: !prev[pkgKey],
    }));
  };

  // NZB Grouping Logic
  const processedArticles = useMemo(() => {
    if (isServerMode || nzbFilterMode === 'all') {
      return displayItems;
    }

    // getBaseTitle is now hoisted to module scope

    const groupMap = new Map();
    // Per base-title: the declared total part count (from "[N/Total]" in the
    // subject, when posters include one) and the set of distinct part numbers
    // we've actually seen, so we can tell a complete set apart from a "gappy" one.
    const groupMeta = new Map();

    displayItems.forEach((item) => {
      const baseKey = getBaseTitle(item.subject);
      if (!groupMap.has(baseKey)) {
        groupMap.set(baseKey, []);
        groupMeta.set(baseKey, { declaredTotal: null, seenNums: new Set() });
      }
      groupMap.get(baseKey).push(item);

      const info = extractPartInfo(item.subject);
      if (info) {
        const meta = groupMeta.get(baseKey);
        meta.seenNums.add(info.num);
        if (meta.declaredTotal == null || info.total > meta.declaredTotal) {
          meta.declaredTotal = info.total;
        }
      }
    });

    const completenessFor = (baseKey, seenCount) => {
      const meta = groupMeta.get(baseKey);
      const declaredTotal = meta && meta.declaredTotal;
      if (!declaredTotal) return { declaredTotal: null, isComplete: null };
      const confirmedCount = Math.max(meta.seenNums.size, seenCount);
      return { declaredTotal, isComplete: confirmedCount >= declaredTotal };
    };

    let result = [];
    if (nzbFilterMode === 'clean') {
      result = Array.from(groupMap.entries()).map(([baseKey, items]) => {
        if (items.length === 1) return items[0];
        const first = items[0];
        const totalBytes = items.reduce((sum, it) => sum + (it.bytes || 0), 0);
        const { declaredTotal, isComplete } = completenessFor(baseKey, items.length);
        return {
          ...first,
          bytes: totalBytes,
          size: formatBytes(totalBytes),
          partCount: items.length,
          declaredTotal,
          isComplete,
        };
      });
    } else {
      // 'grouped' mode: create package row item
      groupMap.forEach((items, baseKey) => {
        if (items.length === 1) {
          result.push(items[0]);
        } else {
          const first = items[0];
          const totalBytes = items.reduce((sum, it) => sum + (it.bytes || 0), 0);
          const { declaredTotal, isComplete } = completenessFor(baseKey, items.length);
          result.push({
            isNzbPackage: true,
            packageKey: baseKey,
            id: first.id,
            subject: baseKey,
            poster: first.poster,
            date: first.date,
            bytes: totalBytes,
            size: formatBytes(totalBytes),
            partCount: items.length,
            declaredTotal,
            isComplete,
            items: items,
          });
        }
      });
    }

    // Re-apply sorting on grouped result so clicking column headers (like Date) sorts packages correctly
    if (sortColumn) {
      result.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        if (sortColumn === 'id') {
          valA = a.id;
          valB = b.id;
        } else if (sortColumn === 'poster') {
          valA = a.poster || a.from || '';
          valB = b.poster || b.from || '';
        } else if (sortColumn === 'date') {
          valA = a.date ? new Date(a.date).getTime() || a.date : '';
          valB = b.date ? new Date(b.date).getTime() || b.date : '';
        }
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [isServerMode, displayItems, nzbFilterMode, sortColumn, sortDirection]);

  const fileNameWithExtension = (title) => {
    const safe = (title || 'usenet_download')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim();
    return safe.endsWith('.nzb') ? safe : `${safe}.nzb`;
  };

  const handleDownloadNZB = (item, groupName) => {
    const fileName = fileNameWithExtension(item.subject);
    const itemsToExport = item.isNzbPackage ? item.items : [item];

    // A fabricated message-id (e.g. "<articleNumber>@usenet.farm") doesn't
    // exist on the real news server, so any downloader (SABnzbd/NZBGet/etc.)
    // fed one just gets an empty/failed fetch — that's what produced the
    // random-named, wrong-sized files in the browser's download history.
    // Only export segments whose real Message-ID we actually captured from XOVER.
    const validItems = itemsToExport.filter((it) => it.msgId);
    const skipped = itemsToExport.length - validItems.length;
    if (validItems.length === 0) {
      alert('이 항목엔 실제 Message-ID 정보가 없어 NZB를 만들 수 없습니다. 그룹을 새로고침(Refresh Group)한 뒤 다시 시도해주세요.');
      return;
    }

    const unixTime = Math.floor(Date.now() / 1000);

    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xmlContent += `<!DOCTYPE nzb PUBLIC "-//newzBin//DTD NZB 1.1//EN" "http://www.newzbin.com/DTD/nzb/nzb-1.1.dtd">\n`;
    xmlContent += `<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">\n`;

    validItems.forEach((it) => {
      const poster = (it.poster || 'Anonymous').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const subj = (it.subject || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const msgId = it.msgId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      xmlContent += `  <file poster="${poster}" date="${unixTime}" subject="${subj}">\n`;
      xmlContent += `    <groups>\n`;
      xmlContent += `      <group>${groupName}</group>\n`;
      xmlContent += `    </groups>\n`;
      xmlContent += `    <segments>\n`;
      xmlContent += `      <segment bytes="${it.bytes || 100000}" number="1">${msgId}</segment>\n`;
      xmlContent += `    </segments>\n`;
      xmlContent += `  </file>\n`;
    });

    xmlContent += `</nzb>`;

    const blob = new Blob([xmlContent], { type: 'application/x-nzb;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    if (skipped > 0) {
      alert(`${skipped}개 파트는 Message-ID가 없어 NZB에서 제외되었습니다 (${validItems.length}개 파트만 포함됨).`);
    }
  };

  const handleDirectDownload = async (item, groupName) => {
    alert('파일 직접 다운로드를 백엔드에 요청했습니다. (진행 상태바가 표시됩니다)');
    const rawTitle = (item.subject || 'download').replace(/[\\/:*?"<>|]/g, '_').trim();
    let safeFilename = rawTitle;
    if (safeFilename.toLowerCase().endsWith('.nzb')) {
      safeFilename = safeFilename.substring(0, safeFilename.length - 4);
    }
    
    if (item.isNzbPackage) {
      const ids = item.items.map(it => it.id).join(',');
      await downloadSelectedArticles('file', groupName, safeFilename, ids, null);
    } else {
      await downloadSelectedArticles('file', groupName, safeFilename, item.id, null);
    }
  };

  const isGrouping = !isServerMode && nzbFilterMode !== 'all';

  // Reset to page 1 & clear search filter whenever group changes
  useEffect(() => {
    setTablePage(1);
    setSearchQuery('');
  }, [selectedGroup, isGrouping, pageSize, rawChunkSize]);

  // Grouped/Clean mode pagination is entirely local once data is fetched:
  // all raw articles scanned so far live in `articles`, get grouped into
  // `processedArticles`, and each page is just a slice of that — Prev/Next
  // never need a network round-trip unless the requested page needs MORE
  // grouped rows than we've scanned yet, in which case this effect keeps
  // pulling more raw chunks (of `rawChunkSize` parts each) until either the
  // target is met or there's nothing left to fetch.
  useEffect(() => {
    if (!isGrouping || loading || isFetchingPage || rawExhausted) return;
    const target = tablePage * pageSize;
    const SAFETY_CAP = Math.max(rawChunkSize * 5, target * 20);
    if (processedArticles.length < target && articles.length < SAFETY_CAP) {
      loadMoreRaw(rawChunkSize);
    }
  }, [isGrouping, loading, isFetchingPage, rawExhausted, processedArticles.length, articles.length, tablePage, pageSize, rawChunkSize, pageFetchSeq]);

  // The slice of processedArticles actually rendered for the current page.
  const pagedArticles = isGrouping
    ? processedArticles.slice((tablePage - 1) * pageSize, tablePage * pageSize)
    : processedArticles.slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize);

  // Pagination Totals
  const rawGroupCount = groupStats && groupStats.count ? parseInt(groupStats.count, 10) : 0;
  const totalItemCount = isServerMode ? serverTotalCount : (rawGroupCount || articles.length);
  // Total pages can only be computed exactly when each raw part maps 1:1 to a
  // displayed row ('all' mode). Once grouping is active, one logical page can
  // consume a variable number of raw chunks, so the total is unknowable up front.
  const computedTotalPages = isServerMode
    ? serverTotalPages
    : (isGrouping ? null : (Math.ceil(totalItemCount / tablePageSize) || 1));

  const handlePageChange = (newPage) => {
    setTablePage(newPage);
    if (!isServerMode && setPage) {
      setPage(newPage);
    }
  };

  const handleNextPage = () => {
    if (!isGrouping) {
      handlePageChange(tablePage + 1);
      return;
    }
    // All previously-scanned pages stay in `articles`, so paging forward is
    // just a local slice — the effect above fetches more if this page isn't
    // fully populated yet.
    setTablePage((p) => p + 1);
  };

  const handlePrevPage = () => {
    if (!isGrouping) {
      handlePageChange(tablePage - 1);
      return;
    }
    // No refetch needed — everything scanned so far is already client-side.
    setTablePage((p) => Math.max(1, p - 1));
  };

  const hasMoreGroupedForNextPage = processedArticles.length > tablePage * pageSize;

  const isNextDisabled = isServerMode
    ? tablePage >= computedTotalPages || isFetchingServerPage
    : isGrouping
      ? !hasMoreGroupedForNextPage && rawExhausted
      : tablePage >= computedTotalPages;

  const isPrevDisabled = isServerMode
    ? tablePage <= 1 || isFetchingServerPage
    : tablePage <= 1;

  // Sorting Handler
  const handleSort = (key) => {
    if (!key) return;
    if (sortColumn === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
    setTablePage(1);
  };

  // Selection Checkbox Handlers
  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      const newSelected = {};
      const targetItems = isServerMode ? displayItems : pagedArticles;
      targetItems.forEach((g) => {
        const itemKey = isServerMode ? g.name : (g.isNzbPackage ? g.packageKey : g.id);
        if (itemKey) newSelected[itemKey] = true;
      });
      setSelectedCheckboxes(newSelected);
    } else {
      setSelectedCheckboxes({});
    }
  };

  const toggleCheckItem = (itemKey) => {
    setSelectedCheckboxes((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

  const selectedCount = Object.keys(selectedCheckboxes).filter(
    (k) => selectedCheckboxes[k]
  ).length;

  const handleBatchFavorite = () => {
    const selectedNames = Object.keys(selectedCheckboxes).filter((k) => selectedCheckboxes[k]);
    if (selectedNames.length === 0) {
      alert('Please select at least one newsgroup using the checkboxes.');
      return;
    }
    if (serverFavoriteOnly) {
      if (removeFavoritesBatch) {
        removeFavoritesBatch(selectedNames);
      } else {
        selectedNames.forEach((name) => toggleStar(name));
      }
      alert(`Successfully removed ${selectedNames.length} selected newsgroups from Favorites!`);
    } else {
      if (addFavoritesBatch) {
        addFavoritesBatch(selectedNames);
      } else {
        selectedNames.forEach((name) => {
          if (!safeFavorites.includes(name)) toggleStar(name);
        });
      }
      alert(`Successfully saved ${selectedNames.length} selected newsgroups to Favorites!`);
    }
    setSelectedCheckboxes({});
  };

  const handleUpdateArticleCount = async () => {
    const selectedNames = Object.keys(selectedCheckboxes).filter((k) => selectedCheckboxes[k]);
    if (selectedNames.length === 0) {
      alert('Please select at least one newsgroup using the checkboxes to calculate article_count.');
      return;
    }
    if (updateSelectedGroupCounts) {
      await updateSelectedGroupCounts(selectedNames);
      setSelectedCheckboxes({});
      alert(`Successfully calculated & saved Article Count for ${selectedNames.length} newsgroups into SQLite DB!`);
    }
  };

  const handleBatchDownload = async () => {
    const selectedKeys = Object.keys(selectedCheckboxes).filter((k) => selectedCheckboxes[k]);
    if (selectedKeys.length === 0) {
      return alert('다운로드할 항목을 선택해주세요.');
    }
    
    // Find selected items
    const selectedItems = pagedArticles.filter((item) => {
      const key = isServerMode ? item.name : (item.isNzbPackage ? item.packageKey : item.id);
      return selectedKeys.includes(key);
    });

    if (isServerMode) {
      return alert('서버 목록에서는 지원되지 않습니다.');
    }

    alert('다운로드를 요청했습니다. 파일이 많은 경우 백엔드(서버)에서 시간이 걸릴 수 있습니다.');

    for (const item of selectedItems) {
      const rawTitle = (item.subject || 'download').replace(/[\\/:*?"<>|]/g, '_').trim();
      let safeFilename = rawTitle;
      // Remove trailing .nzb if it exists, to save as original file
      if (safeFilename.toLowerCase().endsWith('.nzb')) {
        safeFilename = safeFilename.substring(0, safeFilename.length - 4);
      }

      if (item.isNzbPackage) {
        const ids = item.items.map(it => it.id).join(',');
        await downloadSelectedArticles('file', selectedGroup, safeFilename, ids, null);
      } else {
        await downloadSelectedArticles('file', selectedGroup, safeFilename, item.id, null);
      }
    }
    
    alert('모든 일괄 다운로드 처리가 완료되었습니다. (백엔드 지정 폴더 확인)');
    setSelectedCheckboxes({});
  };

  const generateNzbData = (item, groupName) => {
    const itemsToExport = item.isNzbPackage ? item.items : [item];
    const validItems = itemsToExport.filter((it) => it.msgId);
    const unixTime = Math.floor(Date.now() / 1000);
    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE nzb PUBLIC "-//newzBin//DTD NZB 1.1//EN" "http://www.newzbin.com/DTD/nzb/nzb-1.1.dtd">\n<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">\n`;
    validItems.forEach((it) => {
      const poster = (it.poster || 'Anonymous').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const subj = (it.subject || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const msgId = it.msgId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      xmlContent += `  <file poster="${poster}" date="${unixTime}" subject="${subj}">\n    <groups>\n      <group>${groupName}</group>\n    </groups>\n    <segments>\n      <segment bytes="${it.bytes || 100000}" number="1">${msgId}</segment>\n    </segments>\n  </file>\n`;
    });
    xmlContent += `</nzb>`;
    return xmlContent;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yy}/${mm}/${dd}(${hh}:${min})`;
  };

  // Badge for multi-part items: shows whether all declared parts ("[N/Total]"
  // in the subject) have actually been scanned, or if some are still missing
  // from the currently-fetched raw window (could be truly gone from the
  // server, or just not scanned back far enough yet).
  const renderCompletenessBadge = (item) => {
    if (item.declaredTotal == null) return null;
    if (item.isComplete) {
      return (
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0, color: '#16a34a', fontWeight: 700, fontSize: '0.72rem' }}
          title={`전체 ${item.declaredTotal}개 파트가 모두 확인됨`}
        >
          <CheckCircle2 size={12} />
        </span>
      );
    }
    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0, color: '#dc2626', fontWeight: 700, fontSize: '0.72rem' }}
        title={`${item.declaredTotal}개 중 ${item.partCount}개 파트만 확인됨 — 서버에 없거나 아직 스캔하지 않은 구간일 수 있음`}
      >
        <AlertTriangle size={12} /> {item.partCount}/{item.declaredTotal}
      </span>
    );
  };

  const handleToggleArticle = (artId, subject) => {
    if (selectedArticleId === artId) {
      setSelectedArticleId(null);
    } else {
      setSelectedArticleId(artId);
      if (looksLikeImageArticle(subject, undefined)) {
        // Image articles: rendered via /api/article-image directly — no WS body fetch needed
        setImgLoadingIds((prev) => ({ ...prev, [artId]: true }));
      } else {
        fetchArticleBody(artId);
      }
    }
  };

  const groupHigh = parseInt(groupStats.high, 10);
  const groupLow = parseInt(groupStats.low, 10);

  // Simple path: user types a count directly ("최근 N개 아티클").
  const handleApplyArticleCount = () => {
    const n = parseInt(articleCountInput, 10);
    if (!n || n <= 0) {
      alert('숫자를 입력해주세요.');
      setArticleCountInput(String(rawChunkSize));
      return;
    }
    setArticleCountInput(String(n));
    setRecentArticleCount(n);
  };

  // Advanced path: user picks exact Start/End article numbers in the modal.
  const handleApplyModalRange = () => {
    const start = modalStartInput.trim() ? parseInt(modalStartInput.trim(), 10) : null;
    const end = modalEndInput.trim() ? parseInt(modalEndInput.trim(), 10) : null;
    if (start != null && isNaN(start)) { alert('시작 아티클 번호가 올바르지 않습니다.'); return; }
    if (end != null && isNaN(end)) { alert('끝 아티클 번호가 올바르지 않습니다.'); return; }
    if (start != null && end != null && start < end) {
      alert('시작 번호는 끝 번호보다 크거나 같아야 합니다 (최신 → 과거 순으로 스캔합니다).');
      return;
    }
    setRetrievalRange({ start, end });

    const effectiveStart = start != null ? start : groupHigh;
    const effectiveEnd = end != null ? end : groupLow;
    if (!isNaN(effectiveStart) && !isNaN(effectiveEnd)) {
      setArticleCountInput(String(Math.max(1, effectiveStart - effectiveEnd + 1)));
    }
    setShowRangeModal(false);
  };

  const handleResetRange = () => {
    setModalStartInput('');
    setModalEndInput('');
    setArticleCountInput(String(rawChunkSize));
    clearRetrievalRange();
    setShowRangeModal(false);
  };

  return (
    <div style={{ padding: '20px', background: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
      {/* 1. Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isServerMode ? (
              <>🌐 Usenet Server Newsgroup Manager ({(serverTotalGroupsCount || totalItemCount).toLocaleString()} Total Groups)</>
            ) : (
              <>📌 Group: <span style={{ color: '#0284c7' }}>{selectedGroup}</span></>
            )}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
            {isServerMode ? (
              <>Server-Side Paginated API: <code>src/data/newsgroups.json</code> {lastUpdated && ` | Last Updated: ${new Date(lastUpdated).toLocaleString()}`}</>
            ) : (
              <>
                Showing Page {tablePage}{computedTotalPages != null ? ` of ${computedTotalPages}` : ''} (Total NNTP Articles: {(groupStats.count || 0).toLocaleString()})
                {(rangeStart != null || rangeEnd != null) && (
                  <span style={{ marginLeft: '8px', color: '#0284c7', fontWeight: 600 }}>
                    · 조회 범위: #{rangeStart != null ? rangeStart : groupStats.high} ~ #{rangeEnd != null ? rangeEnd : groupStats.low}
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowColumnConfig(!showColumnConfig)}
            className="nav-tab"
            style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Settings size={14} />
            <span>Column Settings</span>
          </button>

          {isServerMode ? (
            <button
              onClick={() => downloadServerNewsgroups(selectedServerId)}
              disabled={isDownloadingGroups}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: serverTotalGroupsCount > 0 ? '#f1f5f9' : '#0284c7',
                color: serverTotalGroupsCount > 0 ? '#334155' : '#ffffff',
                fontWeight: 700,
                fontSize: '0.825rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isDownloadingGroups ? (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>Downloading... {downloadProgressCount > 0 ? `(${downloadProgressCount.toLocaleString()})` : ''}</span>
                </>
              ) : (
                <>
                  {serverTotalGroupsCount > 0 ? <RefreshCw size={14} color="#0284c7" /> : <Download size={14} color="#ffffff" />}
                  <span>{serverTotalGroupsCount > 0 ? 'Update Newsgroups List' : 'Download Newsgroups List'}</span>
                </>
              )}
            </button>
          ) : (
            <>
              {selectedCount > 0 && (
                <button
                  onClick={handleBatchDownload}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', background: '#0284c7', color: '#fff',
                    border: 'none', fontWeight: 700, fontSize: '0.825rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Download size={14} /> Download Selected ({selectedCount})
                </button>
              )}
              <button
                className="nav-tab"
                onClick={() => refreshCurrentGroup()}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
              >
                {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                <span>Refresh Group</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Column Settings Panel */}
      {showColumnConfig && (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '8px' }}>
            ⚙️ Select Columns to Display ({isServerMode ? 'Newsgroup Manager' : 'Article List'}):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.8rem' }}>
            {columnDefs.map((col) => (
              <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 500, color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={visibleColumns[col.key] !== false}
                  onChange={(e) =>
                    setVisibleColumns((prev) => ({
                      ...prev,
                      [col.key]: e.target.checked,
                    }))
                  }
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
              <input
                type="checkbox"
                checked={hideRandomHashSubjects}
                onChange={(e) => setHideRandomHashSubjects(e.target.checked)}
              />
              <span>🔒 난수/암호화 제목 숨기기 (Hide Random Subjects)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
              <input
                type="checkbox"
                checked={useStandardTable}
                onChange={(e) => setUseStandardTable(e.target.checked)}
              />
              <span>📐 기본 테이블 사용 (Standard Table Layout)</span>
            </label>
          </div>
        </div>
      )}

      {/* 3. Search & Action Toolbar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder={isServerMode ? "Search newsgroups by name (press enter or type)..." : "Search articles by subject..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setTablePage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              fontSize: '0.85rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              outline: 'none',
            }}
          />
        </div>

        {isServerMode && (
          <>
            <button
              onClick={() => {
                const nextVal = !serverFavoriteOnly;
                setTablePage(1);
                setServerFavoriteOnly(nextVal);
              }}
              style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: serverFavoriteOnly ? '#fef3c7' : '#ffffff',
                color: serverFavoriteOnly ? '#b45309' : '#334155',
                border: serverFavoriteOnly ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                transition: 'all 0.15s ease',
              }}
              title="Toggle to view only favorite newsgroups for this server"
            >
              <Star size={14} color="#f59e0b" fill={serverFavoriteOnly ? "#f59e0b" : "none"} />
              <span>{serverFavoriteOnly ? 'Show Favorites Only (On)' : 'Show Favorites Only'}</span>
            </button>

            <button
              onClick={handleUpdateArticleCount}
              className="nav-tab"
              style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}
              title="Calculate real article count and save to json"
            >
              <Calculator size={14} color="#0284c7" />
              <span>Update Selected Count ({selectedCount})</span>
            </button>

            <button
              onClick={() => {
                const selectedNames = Object.keys(selectedCheckboxes).filter((k) => selectedCheckboxes[k]);
                if (selectedNames.length === 0) {
                  alert('Please select at least one newsgroup using the checkboxes.');
                  return;
                }
                if (addFavoritesBatch) {
                  addFavoritesBatch(selectedNames);
                } else {
                  selectedNames.forEach((name) => {
                    if (!safeFavorites.includes(name)) toggleStar(name);
                  });
                }
                alert(`Successfully added ${selectedNames.length} selected newsgroups to Favorites!`);
                setSelectedCheckboxes({});
              }}
              className="nav-tab"
              style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Add selected newsgroups to Favorites"
            >
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <span>Add Selected ({selectedCount})</span>
            </button>

            <button
              onClick={() => {
                const selectedNames = Object.keys(selectedCheckboxes).filter((k) => selectedCheckboxes[k]);
                if (selectedNames.length === 0) {
                  alert('Please select at least one newsgroup using the checkboxes to remove.');
                  return;
                }
                if (removeFavoritesBatch) {
                  removeFavoritesBatch(selectedNames);
                } else {
                  selectedNames.forEach((name) => toggleStar(name));
                }
                alert(`Successfully removed ${selectedNames.length} selected newsgroups from Favorites!`);
                setSelectedCheckboxes({});
              }}
              className="nav-tab"
              style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
              }}
              title="Remove selected newsgroups from Favorites"
            >
              <Star size={14} color="#dc2626" fill="none" />
              <span>Remove Selected ({selectedCount})</span>
            </button>
          </>
        )}
        {!isServerMode && (
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', border: '1px solid #cbd5e1' }}>
            <button
              onClick={() => setNzbFilterMode('grouped')}
              style={{
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: nzbFilterMode === 'grouped' ? '#ffffff' : 'transparent',
                color: nzbFilterMode === 'grouped' ? '#0284c7' : '#64748b',
                boxShadow: nzbFilterMode === 'grouped' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
              title="Group split NZB parts into 1 single package"
            >
              📦 Group NZB Parts
            </button>
            <button
              onClick={() => setNzbFilterMode('all')}
              style={{
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: nzbFilterMode === 'all' ? '#ffffff' : 'transparent',
                color: nzbFilterMode === 'all' ? '#0284c7' : '#64748b',
                boxShadow: nzbFilterMode === 'all' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
              title="Show all split part items"
            >
              📂 Show All Parts
            </button>
            <button
              onClick={() => setNzbFilterMode('clean')}
              style={{
                padding: '5px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: nzbFilterMode === 'clean' ? '#ffffff' : 'transparent',
                color: nzbFilterMode === 'clean' ? '#0284c7' : '#64748b',
                boxShadow: nzbFilterMode === 'clean' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
              title="Hide duplicate split parts"
            >
              🙈 Hide Split Parts
            </button>
          </div>
        )}
        {isGrouping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
              아티클 선택:
            </label>
            <input
              type="number"
              value={articleCountInput}
              onChange={(e) => setArticleCountInput(e.target.value)}
              onBlur={handleApplyArticleCount}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyArticleCount()}
              title="최근 몇 개의 아티클을 스캔할지 입력"
              style={{
                width: '90px',
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 600,
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
              (최근 {(parseInt(articleCountInput, 10) || 0).toLocaleString()}개 아티클)
            </span>
            <button
              onClick={() => {
                setModalStartInput(rangeStart != null ? String(rangeStart) : '');
                setModalEndInput(rangeEnd != null ? String(rangeEnd) : '');
                setShowRangeModal(true);
              }}
              title="시작/끝 아티클 번호를 직접 지정 (xnews의 Set number of headers to retrieve와 동일한 개념)"
              style={{
                padding: '5px 7px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: (rangeStart != null || rangeEnd != null) ? '#e0f2fe' : '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Settings size={14} color={(rangeStart != null || rangeEnd != null) ? '#0369a1' : '#64748b'} />
            </button>
          </div>
        )}
      </div>

      {/* 4. Unified Dynamic Table Container */}
      <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
        <table className={`article-table ${isCompactTable ? 'table-sm' : ''}`} style={{ width: '100%' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc' }}>
            <tr>
              {columnDefs.map(
                (col) =>
                  visibleColumns[col.key] !== false && (
                    <th
                      key={col.key}
                      style={{
                        width: col.width || 'auto',
                        textAlign: col.align || 'left',
                        cursor: col.sortable ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                      onClick={() => col.sortable && handleSort(col.key)}
                      title={col.sortable ? `Click to sort by ${col.label}` : ''}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start', gap: '4px' }}>
                        {col.key === 'checkbox' ? (
                          <input type="checkbox" onChange={toggleSelectAll} title="Select All Visible On Page" />
                        ) : (
                          <span>{col.label}</span>
                        )}
                        {col.sortable && (
                          <span style={{ fontSize: '0.75rem', color: sortColumn === col.key ? '#0284c7' : '#94a3b8' }}>
                            {sortColumn === col.key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        )}
                      </div>
                    </th>
                  )
              )}
            </tr>
          </thead>
          <tbody>
            {(loading || isFetchingServerPage) && pagedArticles.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '35px', color: '#64748b' }}>
                  {xoverProgress ? (
                    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                      <div style={{ fontSize: '0.9rem', marginBottom: '8px', fontWeight: 500, color: '#334155' }}>
                        Downloading Article List... ({xoverProgress.current.toLocaleString()} / {xoverProgress.total.toLocaleString()})
                      </div>
                      <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(100, Math.round((xoverProgress.current / Math.max(1, xoverProgress.total)) * 100))}%`, 
                          backgroundColor: '#0284c7', 
                          height: '100%', 
                          transition: 'width 0.2s ease-out' 
                        }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      Fetching current page data ({tablePageSize} items) from server...
                    </>
                  )}
                </td>
              </tr>
            ) : pagedArticles.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  {isServerMode
                    ? serverTotalGroupsCount > 0
                      ? `No newsgroups matching "${searchQuery}".`
                      : 'No newsgroups cached yet. Click [Download Newsgroups List] above.'
                    : `No articles found on page ${tablePage}.`}
                </td>
              </tr>
            ) : (
              pagedArticles.map((item, idx) => {
                const globalIdx = (tablePage - 1) * tablePageSize + idx + 1;
                
                if (isServerMode) {
                  // --- NEWSGROUP MANAGER ROW ---
                  const itemKey = item.name;
                  const isChecked = !!selectedCheckboxes[itemKey];
                  const isStarred = item.is_favorite === 1 || safeFavorites.includes(item.name);

                  return (
                    <tr
                      key={item.name}
                      style={{ background: isChecked ? '#f0f9ff' : 'transparent' }}
                      onClick={() => toggleCheckItem(item.name)}
                    >
                      {visibleColumns.checkbox !== false && (
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheckItem(item.name)}
                          />
                        </td>
                      )}
                      {visibleColumns.id !== false && (
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '0.78rem' }}>
                          {globalIdx}
                        </td>
                      )}
                      {visibleColumns.name !== false && (
                        <td style={{ fontWeight: 600, color: '#0284c7' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStar(item.name);
                              }}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                              title={isStarred ? "Remove from Favorites" : "Add to Favorites"}
                            >
                              <Star
                                size={15}
                                color={isStarred ? "#f59e0b" : "#cbd5e1"}
                                fill={isStarred ? "#f59e0b" : "none"}
                              />
                            </button>
                            <span title={item.name}>{item.name}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.high !== false && (
                        <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.high || 'N/A'}</td>
                      )}
                      {visibleColumns.low !== false && (
                        <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.low || 'N/A'}</td>
                      )}
                      {visibleColumns.count !== false && (
                        <td style={{ color: '#475569', fontSize: '0.825rem', fontWeight: 500 }}>
                          {item.count || '0'}
                        </td>
                      )}
                      {visibleColumns.article_count !== false && (
                        <td style={{ color: '#0369a1', fontSize: '0.825rem', fontWeight: 700 }}>
                          {item.article_count !== undefined ? `${item.article_count} articles` : 'Not calculated'}
                        </td>
                      )}
                      {visibleColumns.status !== false && (
                        <td style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 600 }}>
                          <span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                            {item.status || 'y'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.action !== false && (
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="nav-tab"
                            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600 }}
                            onClick={() => setSelectedGroup(item.name)}
                          >
                            Open Group
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                } else if (item.isNzbPackage) {
                  // --- NZB GROUPED PACKAGE ROW ---
                  const isPkgExpanded = !!expandedNzbPackages[item.packageKey];
                  const isChecked = !!selectedCheckboxes[item.packageKey];
                  return (
                    <React.Fragment key={`pkg-${item.packageKey}`}>
                      <tr onClick={() => toggleExpandPackage(item.packageKey)} style={{ cursor: 'pointer', background: isChecked ? '#f0f9ff' : 'transparent' }}>
                        {visibleColumns.checkbox !== false && (
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCheckItem(item.packageKey)}
                            />
                          </td>
                        )}
                        {visibleColumns.id !== false && (
                          <td style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.78rem' }}>📦 #{item.id}</td>
                        )}
                        {visibleColumns.subject !== false && (
                          <td style={{ fontWeight: 700, color: '#0369a1' }}>
                            <div className="truncate-container" title={item.subject} style={{ display: 'flex', alignItems: 'center' }}>
                              <span style={{ flexShrink: 0, marginRight: '4px' }}>{isPkgExpanded ? '▼' : '▶'}</span>
                              <span className="truncate-text">{item.subject}</span>
                              <span style={{ flexShrink: 0, fontWeight: 500, color: '#64748b', fontSize: '0.75rem', marginLeft: '4px' }}>
                                ({item.partCount} parts)
                              </span>
                              {renderCompletenessBadge(item)}
                              
                              {/* Progress Bar Rendering */}
                              {(() => {
                                if (!item.items || item.items.length === 0) return null;
                                const dlState = downloads[item.items[0].id];
                                if (!dlState) return null;
                                
                                if (dlState.status === 'downloading') {
                                  const pct = dlState.total > 0 ? Math.round((dlState.current / dlState.total) * 100) : 0;
                                  return (
                                    <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
                                      <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: '#0ea5e9', transition: 'width 0.2s' }} />
                                      </div>
                                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0ea5e9', whiteSpace: 'nowrap' }}>
                                        {pct}% ({dlState.current}/{dlState.total})
                                      </span>
                                    </div>
                                  );
                                } else if (dlState.status === 'complete') {
                                  return <span style={{ marginLeft: '12px', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>✅ Complete</span>;
                                } else if (dlState.status === 'error') {
                                  return <span style={{ marginLeft: '12px', fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>❌ Error</span>;
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                        )}
                        {visibleColumns.poster !== false && (
                          <td style={{ color: '#64748b', fontSize: '0.825rem' }}>
                            <div className="truncate-container" title={item.poster}>
                              <span className="truncate-text">{item.poster}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.date !== false && (
                          <td style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {formatDate(item.date)}
                          </td>
                        )}
                        {visibleColumns.bytes !== false && (
                          <td style={{ color: '#0369a1', fontSize: '0.8rem', fontWeight: 700 }}>{item.size || '-'}</td>
                        )}
                        {visibleColumns.action !== false && (
                          <td style={{ textAlign: 'right', display: 'flex', gap: '4px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                            {looksLikeImageArticle(item.subject, undefined) && (
                              <button
                                style={{
                                  padding: '3px 8px', fontSize: '0.75rem', fontWeight: 700,
                                  background: '#ffffff', color: '#0284c7', border: '1px solid #cbd5e1',
                                  borderRadius: '4px', cursor: 'pointer', display: 'inline-flex',
                                  alignItems: 'center', gap: '4px',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedImages(prev => ({
                                    ...prev,
                                    [item.id]: !prev[item.id]
                                  }));
                                }}
                                title={expandedImages[item.id] ? `Hide Image` : `View Assembled Image Inline`}
                              >
                                <Eye size={13} /> View Image
                              </button>
                            )}
                            <button
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: '#10b981', // Green for direct download
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginRight: '6px',
                              }}
                              onClick={() => handleDirectDownload(item, selectedGroup)}
                              title={`직접 다운로드 후 합치기`}
                            >
                              <Download size={13} /> File
                            </button>
                            <button
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              onClick={() => handleDownloadNZB(item, selectedGroup)}
                              title={`Download ${fileNameWithExtension(item.subject)} (.nzb format for SABnzbd / Newsbin)`}
                            >
                              <Download size={13} /> NZB ({item.partCount})
                            </button>
                          </td>
                        )}
                      </tr>
                      {isPkgExpanded && item.items.map((child, cIdx) => (
                        <tr key={`child-${child.id}-${cIdx}`} style={{ background: '#f8fafc', borderBottom: '1px dashed #cbd5e1' }}>
                          {visibleColumns.id !== false && <td style={{ paddingLeft: '24px', fontSize: '0.75rem', color: '#94a3b8' }}>└ #{child.id}</td>}
                          {visibleColumns.subject !== false && <td style={{ fontSize: '0.825rem', paddingLeft: '16px' }}><FileText size={13} /> {child.subject}</td>}
                          {visibleColumns.poster !== false && <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{child.poster}</td>}
                          {visibleColumns.date !== false && <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{formatDate(child.date)}</td>}
                          {visibleColumns.bytes !== false && <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{child.size}</td>}
                          {visibleColumns.action !== false && (
                            <td style={{ textAlign: 'right' }}>
                              <button
                                style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '4px' }}
                                onClick={() => handleDirectDownload(child, selectedGroup)}
                              >
                                ⬇️ File
                              </button>
                              <button
                                style={{ padding: '2px 6px', fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                                onClick={() => handleDownloadNZB(child, selectedGroup)}
                              >
                                ⬇️ NZB
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {expandedImages[item.id] && (
                        <tr key={`img-${item.id}`}>
                          <td colSpan={10} style={{ padding: 0 }}>
                            <div style={{ background: '#f8fafc', padding: '16px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'center' }}>
                              <img
                                src={`/api/article-image?group=${encodeURIComponent(selectedGroup)}&ids=${item.items.map(i=>i.id).join(',')}${selectedServerId ? `&serverId=${encodeURIComponent(selectedServerId)}` : ''}`}
                                alt="Article preview"
                                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                                loading="lazy"
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                } else {
                  // --- ARTICLE READER ROW ---
                  const isExpanded = selectedArticleId === item.id;
                  const isChecked = !!selectedCheckboxes[item.id];
                  const bodyContent = articleBodies[item.id];
                  const isLoadingBody = loadingBodyId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr onClick={() => handleToggleArticle(item.id, item.subject)} style={{ cursor: 'pointer', background: isChecked ? '#f0f9ff' : 'transparent' }}>
                        {visibleColumns.checkbox !== false && (
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCheckItem(item.id)}
                            />
                          </td>
                        )}
                        {visibleColumns.id !== false && (
                          <td style={{ fontWeight: 600, color: '#64748b', fontSize: '0.78rem' }}>#{item.id}</td>
                        )}
                        {visibleColumns.subject !== false && (
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>
                            <div className="truncate-container" title={item.subject}>
                              <FileText size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                              <span className="truncate-text">{item.subject}</span>
                              {item.partCount > 1 && (
                                <span style={{ flexShrink: 0, fontWeight: 500, color: '#64748b', fontSize: '0.75rem' }}>
                                  ({item.partCount} parts)
                                </span>
                              )}
                              {renderCompletenessBadge(item)}
                            </div>
                          </td>
                        )}
                        {visibleColumns.poster !== false && (
                          <td style={{ color: '#64748b', fontSize: '0.825rem' }}>
                            <div className="truncate-container" title={item.poster}>
                              <span className="truncate-text">{item.poster}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.date !== false && (
                          <td style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {formatDate(item.date)}
                          </td>
                        )}
                        {visibleColumns.bytes !== false && (
                          <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.size || '-'}</td>
                        )}
                        {visibleColumns.action !== false && (
                          <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <button className="action-btn icon-only" onClick={() => handleToggleArticle(item.id, item.subject)} title="View Article Content">
                              <Eye size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} style={{ padding: 0, background: '#0f172a', color: '#f8fafc' }}>
                            <div style={{ padding: '16px 20px', maxHeight: '400px', overflowY: 'auto' }}>
                              {looksLikeImageArticle(item.subject, undefined) ? (
                                // Image article: load directly via /api/article-image REST endpoint
                                <>
                                  {imgLoadingIds[item.id] && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                      <Loader2 size={18} className="spin" /> 이미지 로딩 중...
                                    </div>
                                  )}
                                  <img
                                    src={`/api/article-image?group=${encodeURIComponent(selectedGroup)}&id=${encodeURIComponent(item.id)}${selectedServerId ? `&serverId=${encodeURIComponent(selectedServerId)}` : ''}`}
                                    alt={item.subject}
                                    style={{ maxWidth: '100%', maxHeight: '360px', display: imgLoadingIds[item.id] ? 'none' : 'block', borderRadius: '6px' }}
                                    onLoad={() => setImgLoadingIds((prev) => { const n = { ...prev }; delete n[item.id]; return n; })}
                                    onError={(e) => {
                                      setImgLoadingIds((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.nextElementSibling;
                                      if (fallback) fallback.style.display = 'block';
                                    }}
                                  />
                                  <pre style={{ display: 'none', fontSize: '0.825rem', whiteSpace: 'pre-wrap', marginTop: '10px' }}>
                                    이미지를 디코딩하지 못했습니다. (그룹: {selectedGroup} / ID: {item.id})
                                  </pre>
                                </>
                              ) : isLoadingBody ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Loader2 size={18} className="spin" /> Loading...</div>
                              ) : (
                                <pre style={{ fontSize: '0.825rem', whiteSpace: 'pre-wrap' }}>{bodyContent || 'No content'}</pre>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Pagination & Page Size Control Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          fontSize: '0.825rem',
          color: '#475569',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>
            {isGrouping ? (
              <>
                Showing <strong>{pagedArticles.length.toLocaleString()}</strong> grouped item(s)
                {' '}(총 {processedArticles.length.toLocaleString()}개 그룹 확보 / {articles.length.toLocaleString()}개 raw 파트 스캔
                {rawExhausted ? (rangeStart != null || rangeEnd != null ? ', 지정한 조회 범위 끝에 도달' : ', 그룹 끝에 도달') : ''})
                {(loading || isFetchingPage) && ' — 더 불러오는 중...'}
              </>
            ) : (
              <>
                Showing {totalItemCount === 0 ? 0 : (tablePage - 1) * tablePageSize + 1} to{' '}
                {Math.min(tablePage * tablePageSize, totalItemCount)} of{' '}
                <strong>{totalItemCount.toLocaleString()}</strong> items
                {isServerMode && searchQuery && ` (filtered from ${(serverTotalGroupsCount || 0).toLocaleString()} total)`}
              </>
            )}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 600 }}>
              Page Size {isGrouping ? '(groups / page)' : ''}:
            </label>
            <select
              value={tablePageSize}
              onChange={(e) => {
                const size = Number(e.target.value);
                if (isServerMode) {
                  setServerTablePageSize(size);
                } else if (setPageSize) {
                  setPageSize(size);
                }
                setTablePage(1);
                setRawPageStartHistory([]);
              }}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              {[5, 10, 25, 50, 100, 250, 500].map((sz) => (
                <option key={sz} value={sz}>
                  {sz} items / page
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            className="nav-tab"
            disabled={isPrevDisabled}
            onClick={handlePrevPage}
            style={{ opacity: isPrevDisabled ? 0.5 : 1, padding: '4px 10px' }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontWeight: 700, padding: '0 6px' }}>
            Page {tablePage}{computedTotalPages != null ? ` of ${computedTotalPages}` : ''}
          </span>
          <button
            className="nav-tab"
            disabled={isNextDisabled}
            onClick={handleNextPage}
            style={{ opacity: isNextDisabled ? 0.5 : 1, padding: '4px 10px' }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Retrieval Range Modal (xnews-style Start/End article # picker) */}
      {showRangeModal && !isServerMode && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowRangeModal(false)}
        >
          <div
            style={{ background: '#ffffff', borderRadius: '10px', padding: '20px 24px', width: '420px', maxWidth: '90vw', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: '#0f172a' }}>
              🎯 조회 범위 직접 지정
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '16px', lineHeight: 1.6 }}>
              전체 아티클 수: <strong>{(groupStats.count || 0).toLocaleString()}</strong>개<br />
              번호 범위: #{isNaN(groupLow) ? '?' : groupLow.toLocaleString()} ~ #{isNaN(groupHigh) ? '?' : groupHigh.toLocaleString()}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                시작 아티클 # (최신 쪽, 비우면 최신부터)
                <input
                  type="number"
                  value={modalStartInput}
                  onChange={(e) => setModalStartInput(e.target.value)}
                  placeholder={isNaN(groupHigh) ? '' : String(groupHigh)}
                  style={{ width: '100%', marginTop: '4px', padding: '7px 9px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </label>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                끝 아티클 # (과거 쪽, 비우면 처음까지)
                <input
                  type="number"
                  value={modalEndInput}
                  onChange={(e) => setModalEndInput(e.target.value)}
                  placeholder={isNaN(groupLow) ? '' : String(groupLow)}
                  style={{ width: '100%', marginTop: '4px', padding: '7px 9px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={handleResetRange}
                style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                전체 범위로 초기화
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowRangeModal(false)}
                  style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  onClick={handleApplyModalRange}
                  style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
