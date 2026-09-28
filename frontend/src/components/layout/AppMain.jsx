import React from 'react';
import {
  AppShell,
  Group,
  Title,
  Text,
  TextInput,
  Button,
  Paper,
  Box,
  Breadcrumbs,
  Anchor,
  NumberInput,
  Tooltip,
} from '@mantine/core';
import { Filter, RefreshCw, Settings, Search, Star, ChevronRight } from 'lucide-react';
import { useNNTPStore } from '../../store/useNNTPStore';
import NNTPEngineWorkbench from '../NNTPEngineWorkbench';
import StatusDashboard from '../StatusDashboard';
import FilterSettingsDropdown from '../FilterSettingsDropdown';
import { ArticleTable, NewsgroupTable } from '../table';
import ServerSettings from '../ServerSettings';
import RecommendedUsenet from '../recommendations/RecommendedUsenet';
import ServerModal from '../ServerModal';
import FolderPickerModal from '../FolderPickerModal';

export default function AppMain({
  activeTab,
  setActiveTab,
  selectedGroup,
  setSelectedGroup,
  realArticleCount,
  groupStats,
  showFilterConfig,
  setShowFilterConfig,
  showTableConfig,
  setShowTableConfig,
  filterOptions,
  setFilterOptions,
  visibleColumns,
  setVisibleColumns,
  articlePage,
  setArticlePage,
  currentPaginatedArticles,
  selectedArticleIds,
  handleSelectArticle,
  handleSelectAllArticles,
  totalArticlePages,
  pageSize,
  setPageSize,
  filteredArticlesLength,
  articleStats,
  newsgroups,
  selectedGroupNames,
  favorites,
  handleSelectGroup,
  handleSelectAllGroups,
  toggleStar,
  refreshCurrentGroup,
  serverPage,
  serverTotalPages,
  serverTotalGroupsCount,
  serverPageSize,
  fetchServerNewsgroupsPage,
  serverSearch,
  serverFavoriteOnly,
  isDownloadingGroups,
  downloadProgressCount,
  downloadServerNewsgroups,
  articleSortStatus,
  onArticleSortChange,
}) {
  const { servers, selectedServerId, rawChunkSize, rangeStart, rangeEnd, maxEmptyRetries, setMaxEmptyRetries } = useNNTPStore();
  const [tempChunkSize, setTempChunkSize] = React.useState(rawChunkSize || 30000);
  const [tempStart, setTempStart] = React.useState(rangeStart || '');
  const [tempEnd, setTempEnd] = React.useState(rangeEnd || '');
  const [clearOnFetch, setClearOnFetch] = React.useState(true);

  React.useEffect(() => {
    if (rawChunkSize) {
      setTempChunkSize(rawChunkSize);
    }
  }, [rawChunkSize]);
  const currentServer = servers?.find(s => s.id === selectedServerId);
  const isCurrentGroupFavorite = Array.isArray(favorites) && favorites.includes(selectedGroup);

  const breadcrumbItems = [
    { title: 'Home', href: '#' },
    ...(currentServer ? [{ title: currentServer.name || currentServer.host, href: '#' }] : []),
    ...(activeTab === 'reader' && selectedGroup ? [{ title: selectedGroup, href: '#' }] : []),
    ...(activeTab === 'newsgroups' ? [{ title: 'Directory', href: '#' }] : []),
    ...(activeTab === 'farm' ? [{ title: 'Dashboard', href: '#' }] : []),
    ...(activeTab === 'recommendations' ? [{ title: 'Recommendations', href: '#' }] : []),
    ...(activeTab === 'servers' ? [{ title: 'Server Settings', href: '#' }] : []),
    ...(activeTab === 'test' ? [{ title: 'Test Modules', href: '#' }] : [])
  ].map((item, index) => (
    <Anchor href={item.href} key={index} size="sm">
      {item.title}
    </Anchor>
  ));

  return (
    <AppShell.Main>
      <Box mb="xs">
        <Breadcrumbs separator={<ChevronRight size={14} />} mt={2} px="xs">
          {breadcrumbItems}
        </Breadcrumbs>
      </Box>
      <Box style={{ width: '100%', maxWidth: '100%', margin: 0 }}>
        {activeTab === 'farm' && <StatusDashboard />}
        {activeTab === 'test' && <NNTPEngineWorkbench />}
        {activeTab === 'servers' && <ServerSettings />}
        {activeTab === 'recommendations' && <RecommendedUsenet />}

        {activeTab === 'reader' && selectedGroup === '__SERVER__' && (
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={5} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📂 Newsgroup Directory: <Text span c="indigo" fw={700}>{currentServer?.name || currentServer?.host}</Text>
                </Title>
                <Text size="xs" c="dimmed" mt={4}>
                  Server: <Text span fw={600} c="indigo">{currentServer?.host}:{currentServer?.port}</Text> |
                  Synced Groups: <Text span fw={600} c="blue">{(serverTotalGroupsCount || 0).toLocaleString()}</Text>
                </Text>
              </div>
              <Button
                size="xs"
                leftSection={<RefreshCw size={14} />}
                loading={isDownloadingGroups}
                onClick={() => downloadServerNewsgroups()}
              >
                {isDownloadingGroups
                  ? `Downloading... (${downloadProgressCount.toLocaleString()})`
                  : 'Fetch All Groups from Server'}
              </Button>
            </Group>

            <Group mb="md" align="center">
              <TextInput
                placeholder="Search newsgroups by name..."
                leftSection={<Search size={16} />}
                value={serverSearch || ''}
                onChange={(e) => fetchServerNewsgroupsPage({ search: e.target.value, page: 1, pageSize: serverPageSize })}
                style={{ flex: 1 }}
              />
              <Button
                variant={serverFavoriteOnly ? "filled" : "default"}
                color={serverFavoriteOnly ? "yellow" : "gray"}
                leftSection={<Star size={16} fill={serverFavoriteOnly ? "currentColor" : "none"} />}
                onClick={() => fetchServerNewsgroupsPage({ favoriteOnly: !serverFavoriteOnly, page: 1, pageSize: serverPageSize })}
              >
                Favorites
              </Button>
              <Button
                variant="light"
                color="blue"
                leftSection={<RefreshCw size={14} />}
                onClick={() => {
                  if (selectedGroupNames.length === 0) return alert('No groups selected.');
                  useNNTPStore.getState().updateSelectedGroupCounts(selectedGroupNames);
                }}
              >
                Re Count ({selectedGroupNames.length})
              </Button>
              <Button
                variant="light"
                color="yellow"
                leftSection={<Star size={14} fill="currentColor" />}
                onClick={() => {
                  if (selectedGroupNames.length === 0) return alert('No groups selected.');
                  useNNTPStore.getState().addFavoritesBatch(selectedGroupNames);
                }}
              >
                Add ({selectedGroupNames.length})
              </Button>
              <Button
                variant="light"
                color="red"
                leftSection={<Star size={14} />}
                onClick={() => {
                  if (selectedGroupNames.length === 0) return alert('No groups selected.');
                  useNNTPStore.getState().removeFavoritesBatch(selectedGroupNames);
                }}
              >
                Remove ({selectedGroupNames.length})
              </Button>
            </Group>

            <NewsgroupTable
              newsgroups={newsgroups}
              selectedGroupNames={selectedGroupNames}
              favoriteGroupNames={favorites}
              onSelectGroup={handleSelectGroup}
              onSelectAllGroups={handleSelectAllGroups}
              onGroupClick={(group) => {
                setSelectedGroup(group.name);
                setActiveTab('reader');
              }}
              onToggleFavorite={(name) => toggleStar(name)}
              onRefreshGroup={(group) => {
                setSelectedGroup(group.name);
                refreshCurrentGroup();
                setActiveTab('reader');
              }}
              page={serverPage || 1}
              total={serverTotalPages || 1}
              onPageChange={(p) => fetchServerNewsgroupsPage({ page: p, pageSize: serverPageSize })}
              totalItemsCount={serverTotalGroupsCount || 0}
              pageSize={serverPageSize}
              onPageSizeChange={(newSize) => {
                fetchServerNewsgroupsPage({ page: 1, pageSize: newSize });
              }}
              sortStatus={{ column: useNNTPStore.getState().serverSort, direction: useNNTPStore.getState().serverOrder?.toLowerCase() }}
              onSortChange={(col) => {
                const currentSort = useNNTPStore.getState().serverSort;
                const currentOrder = useNNTPStore.getState().serverOrder;
                const newOrder = (currentSort === col && currentOrder === 'ASC') ? 'DESC' : 'ASC';
                fetchServerNewsgroupsPage({ sort: col, order: newOrder, page: 1, pageSize: serverPageSize });
              }}
            />
          </Paper>
        )}

        {activeTab === 'reader' && selectedGroup !== '__SERVER__' && (
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" mb="md" pb="xs" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <Title order={5} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📌 Server: <Text span c="indigo" fw={700}>{currentServer?.name || currentServer?.host}</Text> |
                  Group: <Text span c="blue" fw={700}>{selectedGroup}</Text>
                </Title>
                <Text size="xs" c="dimmed" mt={4}>
                  Articles: <Text span fw={600} c="blue">{(filteredArticlesLength || 0).toLocaleString()}</Text> (Total Range: #{groupStats?.high?.toLocaleString() || 0} ~ #{groupStats?.low?.toLocaleString() || 0})
                  {articleStats && (
                    <>
                      <Text span mx="xs" c="dimmed">|</Text>
                      <Text span fw={600} c="dark.3">
                        Parts[Complite:<Text span c="green.7" fw={700}>{articleStats.completeParts.toLocaleString()}</Text> UnComplite:<Text span c="red.7" fw={700}>{articleStats.incompleteParts.toLocaleString()}</Text>], NoParts[Pic:<Text span c="blue.7" fw={700}>{articleStats.picNoParts.toLocaleString()}</Text> Text:<Text span c="cyan.7" fw={700}>{articleStats.textNoParts.toLocaleString()}</Text> Etc:<Text span c="gray.6" fw={700}>{articleStats.etcNoParts.toLocaleString()}</Text>]
                      </Text>
                    </>
                  )}
                </Text>
              </div>

              <Group gap="xs">
                <Button
                  variant={showFilterConfig ? 'filled' : 'outline'}
                  size="xs"
                  leftSection={<Filter size={14} />}
                  onClick={() => setShowFilterConfig(!showFilterConfig)}
                >
                  Filter Settings
                </Button>

                <Button
                  variant={showTableConfig ? 'filled' : 'outline'}
                  size="xs"
                  leftSection={<Settings size={14} />}
                  onClick={() => setShowTableConfig(!showTableConfig)}
                >
                  Setting
                </Button>

                <Button
                  variant="default"
                  size="xs"
                  leftSection={<RefreshCw size={14} />}
                  onClick={() => useNNTPStore.getState().refreshCurrentGroup()}
                >
                  Refresh Article
                </Button>

                <Button
                  variant={isCurrentGroupFavorite ? 'filled' : 'default'}
                  color={isCurrentGroupFavorite ? 'yellow' : 'gray'}
                  size="xs"
                  leftSection={<Star size={14} fill={isCurrentGroupFavorite ? 'currentColor' : 'none'} />}
                  onClick={async () => {
                    await useNNTPStore.getState().toggleFavorite(selectedGroup, selectedServerId);
                  }}
                >
                  {isCurrentGroupFavorite ? 'Favorite' : 'Add Favorite'}
                </Button>
              </Group>
            </Group>

            {showFilterConfig && (
              <FilterSettingsDropdown
                filterOptions={filterOptions}
                setFilterOptions={setFilterOptions}
                onReset={() => {
                  setFilterOptions({ searchQuery: '', mediaType: 'all', age: 'all', minSizeMB: '', maxSizeMB: '', readStatus: 'all', hideRandomHash: true, hideSplitParts: false });
                  setArticlePage(1);
                }}
              />
            )}

            {showTableConfig && (
              <Paper p="sm" mb="md" withBorder style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}>
                <Group justify="space-between" align="center" wrap="wrap" gap="lg">
                  {/* 1. Visible Columns Section */}
                  <Box>
                    <Text size="xs" fw={700} c="dark.7" mb={4}>⚙️ Visible Columns:</Text>
                    <Group gap="sm">
                      {Object.keys(visibleColumns).map((colKey) => (
                        <label key={colKey} style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#334155', fontWeight: 500 }}>
                          <input
                            type="checkbox"
                            checked={visibleColumns[colKey]}
                            onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [colKey]: e.target.checked }))}
                          />
                          <span style={{ textTransform: 'capitalize' }}>{colKey}</span>
                        </label>
                      ))}
                    </Group>
                  </Box>

                  {/* 2. Header Retrieval Controls (XNews Style: Get / Start / End) */}
                  <Box style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '16px' }}>
                    <Text size="xs" fw={700} c="dark.7" mb={4}>
                      ⚙️ Header Retrieval (XNews Style):
                    </Text>
                    <Group gap="xs" align="center" wrap="wrap">
                      <Tooltip label="가져올 아티클 헤더 개수를 지정합니다 (기본 300)" withArrow bg="rgba(15, 23, 42, 0.92)">
                        <Group gap={4} align="center">
                          <Text size="xs" fw={600} c="dimmed">Get:</Text>
                          <NumberInput
                            size="xs"
                            w={90}
                            min={100}
                            max={500000}
                            step={300}
                            value={tempChunkSize}
                            onChange={(val) => setTempChunkSize(Number(val) || 300)}
                          />
                        </Group>
                      </Tooltip>

                      <Tooltip label="조회할 시작 아티클 번호를 직접 지정합니다" withArrow bg="rgba(15, 23, 42, 0.92)">
                        <Group gap={4} align="center">
                          <Text size="xs" fw={600} c="dimmed" ml="xs">Start:</Text>
                          <NumberInput
                            size="xs"
                            w={110}
                            placeholder={groupStats?.low ? String(groupStats.low) : "Low"}
                            value={tempStart}
                            onChange={(val) => setTempStart(val)}
                          />
                        </Group>
                      </Tooltip>

                      <Tooltip label="조회할 종료 아티클 번호를 직접 지정합니다" withArrow bg="rgba(15, 23, 42, 0.92)">
                        <Group gap={4} align="center">
                          <Text size="xs" fw={600} c="dimmed">End:</Text>
                          <NumberInput
                            size="xs"
                            w={110}
                            placeholder={groupStats?.high ? String(groupStats.high) : "High"}
                            value={tempEnd}
                            onChange={(val) => setTempEnd(val)}
                          />
                        </Group>
                      </Tooltip>

                      <Tooltip label="지정한 범위 또는 개수 기준으로 아티클 목록을 서버에서 가져옵니다" withArrow bg="rgba(15, 23, 42, 0.92)">
                        <Button
                          size="xs"
                          variant="filled"
                          color="blue"
                          onClick={() => {
                            if (tempChunkSize) {
                              useNNTPStore.getState().setRawChunkSize(tempChunkSize);
                            }
                            useNNTPStore.getState().setRetrievalRange({
                              start: tempStart ? Number(tempStart) : null,
                              end: tempEnd ? Number(tempEnd) : null,
                            });
                          }}
                        >
                          Fetch Range
                        </Button>
                      </Tooltip>

                      {(tempStart || tempEnd) && (
                        <Tooltip label="지정 범위를 초기화하고 기본 최신 순으로 복구합니다" withArrow bg="rgba(15, 23, 42, 0.92)">
                          <Button
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => {
                              setTempStart('');
                              setTempEnd('');
                              useNNTPStore.getState().clearRetrievalRange();
                            }}
                          >
                            Reset Range
                          </Button>
                        </Tooltip>
                      )}
                    </Group>
                  </Box>

                  {/* 3. Action Checkboxes (XNews Style) */}
                  <Box style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '16px' }}>
                    <Text size="xs" fw={700} c="dark.7" mb={4}>⚙️ Actions:</Text>
                    <Group gap="sm" align="center">
                      <Tooltip label="새로 목록을 불러올 때 기존 조회 데이터를 비우고 새로고침합니다" withArrow bg="rgba(15, 23, 42, 0.92)">
                        <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#334155' }}>
                          <input
                            type="checkbox"
                            checked={clearOnFetch}
                            onChange={(e) => setClearOnFetch(e.target.checked)}
                          />
                          Clear & Retrieve
                        </label>
                      </Tooltip>

                      <Tooltip label="이미 읽거나 확인한 아티클 목록을 표에서 숨깁니다" withArrow bg="rgba(15, 23, 42, 0.92)">
                        <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#334155' }}>
                          <input
                            type="checkbox"
                            checked={filterOptions.readStatus === 'unread'}
                            onChange={(e) => setFilterOptions((prev) => ({ ...prev, readStatus: e.target.checked ? 'unread' : 'all' }))}
                          />
                          Exclude Read
                        </label>
                      </Tooltip>

                      <Tooltip label="빈 아티클 구간(Gap) 만났을 때 다음 구간으로 자동 재시도하는 최대 횟수 (기본 3회, 0은 미사용)" withArrow bg="rgba(15, 23, 42, 0.92)">
                        <Group gap={4} align="center" style={{ marginLeft: '6px' }}>
                          <Text size="xs" fw={600} c="dimmed">Empty Retries:</Text>
                          <NumberInput
                            size="xs"
                            w={65}
                            min={0}
                            max={20}
                            value={maxEmptyRetries !== undefined ? maxEmptyRetries : 3}
                            onChange={(val) => setMaxEmptyRetries(Number(val) || 0)}
                          />
                        </Group>
                      </Tooltip>
                    </Group>
                  </Box>
                </Group>
              </Paper>
            )}

            <TextInput
              placeholder="Search article subjects..."
              leftSection={<Search size={16} />}
              value={filterOptions.searchQuery}
              onChange={(e) => {
                setFilterOptions((prev) => ({ ...prev, searchQuery: e.target.value }));
                setArticlePage(1);
              }}
              mb="md"
            />

            {/* Extended ArticleTable with Mantine Pagination */}
            <ArticleTable
              articles={currentPaginatedArticles}
              selectedArticleIds={selectedArticleIds}
              onSelectArticle={handleSelectArticle}
              onSelectAllArticles={handleSelectAllArticles}
              visibleColumns={visibleColumns}
              selectedGroup={selectedGroup}
              serverId={selectedServerId}
              onDownloadArticle={(art) => alert(`Direct Download requested for: ${art.subject}`)}
              onDownloadNZB={(art) => alert(`NZB File export generated for: ${art.subject}`)}
              page={articlePage}
              total={totalArticlePages}
              onPageChange={(p) => setArticlePage(p)}
              totalItemsCount={filteredArticlesLength}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              sortStatus={articleSortStatus}
              onSortChange={onArticleSortChange}
            />
          </Paper>
        )}

        {activeTab === 'newsgroups' && (
          <Paper p="md" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={5}>
                  📂 Newsgroups Directory & Favorites
                </Title>
                {currentServer && (
                  <Text size="xs" c="dimmed" mt={4}>
                    Server: <Text span fw={600} c="indigo">{currentServer.host}:{currentServer.port}</Text> |
                    Connection: <Text span fw={600} c="green">Available</Text>
                  </Text>
                )}
              </div>
              <Button
                size="xs"
                leftSection={<RefreshCw size={14} />}
                loading={isDownloadingGroups}
                onClick={() => downloadServerNewsgroups()}
              >
                {isDownloadingGroups
                  ? `Downloading... (${downloadProgressCount.toLocaleString()})`
                  : 'Fetch All Groups from Server'}
              </Button>
            </Group>

            <Group mb="md" align="center">
              <TextInput
                placeholder="Search newsgroups by name..."
                leftSection={<Search size={16} />}
                value={serverSearch || ''}
                onChange={(e) => fetchServerNewsgroupsPage({ search: e.target.value, page: 1, pageSize: serverPageSize })}
                style={{ flex: 1 }}
              />
              <Button
                variant={serverFavoriteOnly ? "filled" : "default"}
                color={serverFavoriteOnly ? "yellow" : "gray"}
                leftSection={<Star size={16} fill={serverFavoriteOnly ? "currentColor" : "none"} />}
                onClick={() => fetchServerNewsgroupsPage({ favoriteOnly: !serverFavoriteOnly, page: 1, pageSize: serverPageSize })}
              >
                Favorites
              </Button>
              <Button
                variant="light"
                color="blue"
                leftSection={<RefreshCw size={14} />}
                onClick={() => {
                  if (selectedGroupNames.length === 0) return alert('No groups selected.');
                  useNNTPStore.getState().updateSelectedGroupCounts(selectedGroupNames);
                }}
              >
                Re Count ({selectedGroupNames.length})
              </Button>
              <Button
                variant="light"
                color="yellow"
                leftSection={<Star size={14} fill="currentColor" />}
                onClick={() => {
                  if (selectedGroupNames.length === 0) return alert('No groups selected.');
                  useNNTPStore.getState().addFavoritesBatch(selectedGroupNames);
                }}
              >
                Add ({selectedGroupNames.length})
              </Button>
              <Button
                variant="light"
                color="red"
                leftSection={<Star size={14} />}
                onClick={() => {
                  if (selectedGroupNames.length === 0) return alert('No groups selected.');
                  useNNTPStore.getState().removeFavoritesBatch(selectedGroupNames);
                }}
              >
                Remove ({selectedGroupNames.length})
              </Button>
            </Group>

            {/* Extended NewsgroupTable with Mantine Pagination */}
            <NewsgroupTable
              newsgroups={newsgroups}
              selectedGroupNames={selectedGroupNames}
              favoriteGroupNames={favorites}
              onSelectGroup={handleSelectGroup}
              onSelectAllGroups={handleSelectAllGroups}
              onGroupClick={(group) => {
                setSelectedGroup(group.name);
                setActiveTab('reader');
              }}
              onToggleFavorite={(name) => toggleStar(name)}
              onRefreshGroup={(group) => {
                setSelectedGroup(group.name);
                refreshCurrentGroup();
                setActiveTab('reader');
              }}
              page={serverPage || 1}
              total={serverTotalPages || 1}
              onPageChange={(p) => fetchServerNewsgroupsPage({ page: p, pageSize: serverPageSize })}
              totalItemsCount={serverTotalGroupsCount || 0}
              pageSize={serverPageSize}
              onPageSizeChange={(newSize) => {
                fetchServerNewsgroupsPage({ page: 1, pageSize: newSize });
              }}
              sortStatus={{ column: useNNTPStore.getState().serverSort, direction: useNNTPStore.getState().serverOrder?.toLowerCase() }}
              onSortChange={(col) => {
                const currentSort = useNNTPStore.getState().serverSort;
                const currentOrder = useNNTPStore.getState().serverOrder;
                const newOrder = (currentSort === col && currentOrder === 'ASC') ? 'DESC' : 'ASC';
                fetchServerNewsgroupsPage({ sort: col, order: newOrder, page: 1, pageSize: serverPageSize });
              }}
            />
          </Paper>
        )}
      </Box>

      {/* Modals from ServerSettings */}
      <ServerModal />
      <FolderPickerModal />
    </AppShell.Main>
  );
}
