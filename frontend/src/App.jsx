import React, { useState, useMemo, useEffect } from 'react';
import {
  AppShell,
  useMantineColorScheme,
  useComputedColorScheme
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { filterArticles, computeArticleStats } from './utils/articleFilter';
import { useNNTPStore } from './store/useNNTPStore';

import AppHeader from './components/layout/AppHeader';
import AppMain from './components/layout/AppMain';
import AppSidebar from './components/layout/AppSidebar';

export default function App() {
  const [opened, { toggle }] = useDisclosure(true);
  const [fixedHeader, setFixedHeader] = useState(true);
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');

  const {
    selectedGroup,
    setSelectedGroup,
    articles = [],
    newsgroups = [],
    favorites = [],
    groupStats = { high: 0, low: 0, count: 0 },
    loading,
    rawExhausted,
    isFetchingPage,
    fetchChunk,
    rawCursorEnd,
    rawChunkSize,
    connectBridge,
    fetchFavorites,
    fetchServerNewsgroupsPage,
    fetchArticles,
    refreshCurrentGroup,
    selectedServerId,
    setSelectedServerId,
    servers,
    isDownloadingGroups,
    downloadProgressCount,
    downloadServerNewsgroups,
    serverPage,
    serverTotalPages,
    serverTotalGroupsCount,
    serverPageSize,
    serverSearch,
    serverFavoriteOnly,
    toggleStar
  } = useNNTPStore();

  useEffect(() => {
    connectBridge();
    fetchFavorites();
    fetchServerNewsgroupsPage({ page: 1 });
  }, []);

  const [showFilterConfig, setShowFilterConfig] = useState(false);
  const [showTableConfig, setShowTableConfig] = useState(false);
  const [activeTab, setActiveTab] = useState('reader');

  const [selectedArticleIds, setSelectedArticleIds] = useState([]);
  const [selectedGroupNames, setSelectedGroupNames] = useState([]);

  // Pagination State
  const [articlePage, setArticlePage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter States
  const [filterOptions, setFilterOptions] = useState({
    searchQuery: '',
    mediaType: 'all',
    age: 'all',
    minSizeMB: '',
    maxSizeMB: '',
    readStatus: 'all',
    hideRandomHash: true,
    expandSplitParts: false,
  });

  // Table Columns Visibility State
  const [visibleColumns, setVisibleColumns] = useState({
    id: false,
    subject: true,
    poster: true,
    date: true,
    bytes: true,
  });

  const realArticleCount = useMemo(() => {
    const h = Number(groupStats?.high || 0);
    const l = Number(groupStats?.low || 0);
    if (h >= l && l > 0) return h - l + 1;
    return groupStats?.count || 0;
  }, [groupStats]);

  // Sorting State for ArticleTable
  const [articleSortStatus, setArticleSortStatus] = useState({ column: null, direction: 'asc' });

  const handleArticleSortChange = (col) => {
    setArticleSortStatus((prev) => {
      if (prev.column === col) {
        return { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column: col, direction: 'asc' };
    });
  };

  const filteredArticles = useMemo(() => {
    const list = filterArticles(articles, filterOptions);
    if (!articleSortStatus.column) return list;

    const col = articleSortStatus.column;
    const isAsc = articleSortStatus.direction === 'asc';

    return [...list].sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      if (col === 'id' || col === 'bytes') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (col === 'date') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return isAsc ? -1 : 1;
      if (valA > valB) return isAsc ? 1 : -1;
      return 0;
    });
  }, [articles, filterOptions, articleSortStatus]);

  const articleStats = useMemo(() => {
    return computeArticleStats(filteredArticles);
  }, [filteredArticles]);

  // Paginated articles slice for current page
  const currentPaginatedArticles = useMemo(() => {
    console.log(`[DEBUG] articles.length=${articles?.length}, filteredArticles.length=${filteredArticles?.length}`);
    const start = (articlePage - 1) * pageSize;
    return filteredArticles.slice(start, start + pageSize);
  }, [filteredArticles, articlePage, pageSize]);

  const totalArticlePages = useMemo(() => {
    const pages = Math.ceil(filteredArticles.length / pageSize) || 1;
    return rawExhausted ? pages : pages + 1;
  }, [filteredArticles, pageSize, rawExhausted]);

  useEffect(() => {
    const pages = Math.ceil(filteredArticles.length / pageSize) || 1;
    if (articlePage > pages && !rawExhausted && !isFetchingPage) {
      fetchChunk({ end: rawCursorEnd, limit: rawChunkSize, append: true });
    }
  }, [articlePage, filteredArticles.length, pageSize, rawExhausted, isFetchingPage, fetchChunk, rawCursorEnd, rawChunkSize]);

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  const handleSelectArticle = (id, checked) => {
    setSelectedArticleIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleSelectAllArticles = (checked) => {
    setSelectedArticleIds(checked ? currentPaginatedArticles.map((a) => a.id) : []);
  };

  const handleSelectGroup = (name, checked) => {
    setSelectedGroupNames((prev) =>
      checked ? [...prev, name] : prev.filter((item) => item !== name)
    );
  };

  const handleSelectAllGroups = (checked) => {
    setSelectedGroupNames(checked ? newsgroups.map((g) => g.name) : []);
  };

  const showSidebar = activeTab !== 'recommendations';

  return (
    <AppShell
      header={{ height: 60, collapsed: false, offset: fixedHeader }}
      navbar={{
        width: showSidebar ? (opened ? 260 : 60) : 0,
        breakpoint: 'sm',
        collapsed: { mobile: !showSidebar, desktop: !showSidebar },
      }}
      padding="xs"
    >
      <AppHeader
        opened={opened}
        toggle={toggle}
        fixedHeader={fixedHeader}
        setFixedHeader={setFixedHeader}
        computedColorScheme={computedColorScheme}
        toggleColorScheme={toggleColorScheme}
        servers={servers}
        setSelectedServerId={setSelectedServerId}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      {showSidebar && (
        <AppSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          opened={opened}
        />
      )}
      <AppMain
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        realArticleCount={realArticleCount}
        groupStats={groupStats}
        showFilterConfig={showFilterConfig}
        setShowFilterConfig={setShowFilterConfig}
        showTableConfig={showTableConfig}
        setShowTableConfig={setShowTableConfig}
        filterOptions={filterOptions}
        setFilterOptions={setFilterOptions}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        articlePage={articlePage}
        setArticlePage={setArticlePage}
        currentPaginatedArticles={currentPaginatedArticles}
        selectedArticleIds={selectedArticleIds}
        handleSelectArticle={handleSelectArticle}
        handleSelectAllArticles={handleSelectAllArticles}
        totalArticlePages={totalArticlePages}
        pageSize={pageSize}
        setPageSize={setPageSize}
        filteredArticlesLength={filteredArticles.length}
        articleStats={articleStats}
        newsgroups={newsgroups}
        selectedGroupNames={selectedGroupNames}
        favorites={favorites}
        handleSelectGroup={handleSelectGroup}
        handleSelectAllGroups={handleSelectAllGroups}
        toggleStar={toggleStar}
        refreshCurrentGroup={refreshCurrentGroup}
        serverPage={serverPage}
        serverTotalPages={serverTotalPages}
        serverTotalGroupsCount={serverTotalGroupsCount}
        serverPageSize={serverPageSize}
        fetchServerNewsgroupsPage={fetchServerNewsgroupsPage}
        serverSearch={serverSearch}
        serverFavoriteOnly={serverFavoriteOnly}
        isDownloadingGroups={isDownloadingGroups}
        downloadProgressCount={downloadProgressCount}
        downloadServerNewsgroups={downloadServerNewsgroups}
        articleSortStatus={articleSortStatus}
        onArticleSortChange={handleArticleSortChange}
      />
    </AppShell>
  );
}
