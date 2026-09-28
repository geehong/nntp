import React, { useState } from 'react';
import { BaseTable } from './BaseTable';
import { Badge, ActionIcon, Tooltip, Group, Text, Paper, Code, Loader, Box, Button } from '@mantine/core';
import { Download, Eye, FileText, Image as ImageIcon, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Puzzle, Unlink, Film, Music, Archive, FileDown } from 'lucide-react';
import { useNNTPStore } from '../../store/useNNTPStore';

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const IMAGE_EXT_PATTERN = /\.(jpe?g|png|gif|webp|bmp)(\s|\d|$|")/i;
const VIDEO_EXT_PATTERN = /\.(mp4|mkv|avi|mov|wmv|flv|webm)(\s|\d|$|")/i;
const AUDIO_EXT_PATTERN = /\.(mp3|wav|flac|aac|ogg|m4a)(\s|\d|$|")/i;
const ARCHIVE_EXT_PATTERN = /\.(zip|rar|7z|tar|gz|iso)(\s|\d|$|")/i;

const getMediaType = (subject, bodyPreview) => {
  const sub = subject || '';
  if (IMAGE_EXT_PATTERN.test(sub) || (bodyPreview || '').includes('=ybegin')) return 'image';
  if (VIDEO_EXT_PATTERN.test(sub)) return 'video';
  if (AUDIO_EXT_PATTERN.test(sub)) return 'audio';
  if (ARCHIVE_EXT_PATTERN.test(sub)) return 'archive';
  return 'file';
};

export function ArticleTable({
  articles = [],
  selectedArticleIds = [],
  onSelectArticle,
  onSelectAllArticles,
  onDownloadArticle,
  onDownloadNZB,
  selectedGroup = '__SERVER__',
  serverId = null,
  visibleColumns = { id: true, subject: true, poster: true, date: true, bytes: true },
  maxHeight = 600,
  page = 1,
  total = 1,
  onPageChange = null,
  totalItemsCount = 0,
  pageSize = 25,
  onPageSizeChange = null,
  sortStatus = null,
  onSortChange = null,
}) {
  const [expandedBodyId, setExpandedBodyId] = useState(null);
  const [articleBodies, setArticleBodies] = useState({});
  const [loadingBodyId, setLoadingBodyId] = useState(null);

  const [expandedImageId, setExpandedImageId] = useState(null);
  const [imgLoadingIds, setImgLoadingIds] = useState({});
  const [imgErrors, setImgErrors] = useState({});
  const [expandedPackages, setExpandedPackages] = useState({});

  const handleToggleBody = async (row) => {
    const artId = row.id;
    if (expandedBodyId === artId) {
      setExpandedBodyId(null);
      return;
    }

    setExpandedBodyId(artId);
    setExpandedImageId(null);

    if (!articleBodies[artId]) {
      setLoadingBodyId(artId);
      try {
        const query = new URLSearchParams({
          group: selectedGroup,
          id: String(artId),
        });
        if (serverId) query.append('serverId', serverId);

        const res = await fetch(`/api/article-body?${query.toString()}`);
        const data = await res.json();
        if (data.success) {
          setArticleBodies((prev) => ({ ...prev, [artId]: data.body }));
        } else {
          setArticleBodies((prev) => ({ ...prev, [artId]: `[Error] ${data.error}` }));
        }
      } catch (err) {
        setArticleBodies((prev) => ({ ...prev, [artId]: `[Error] Failed to fetch article body: ${err.message}` }));
      } finally {
        setLoadingBodyId(null);
      }
    }
  };

  const handleToggleImage = (row) => {
    const artId = row.id;
    if (expandedImageId === artId) {
      setExpandedImageId(null);
      return;
    }

    setExpandedImageId(artId);
    setExpandedBodyId(null);
    setImgLoadingIds((prev) => ({ ...prev, [artId]: true }));
    setImgErrors((prev) => ({ ...prev, [artId]: null }));
  };

  const handleImageError = async (artId) => {
    setImgLoadingIds((prev) => ({ ...prev, [artId]: false }));
    const imgUrl = `/api/article-image?group=${encodeURIComponent(selectedGroup)}&id=${artId}${serverId ? `&serverId=${encodeURIComponent(serverId)}` : ''}`;
    try {
      const res = await fetch(imgUrl);
      const contentType = res.headers.get('content-type') || '';
      let errReason = '';
      if (res.ok && contentType.startsWith('image/')) {
        errReason = `Decoded binary payload is not a valid displayable image format (corrupt header or unsupported image encoding).`;
      } else {
        const text = await res.text();
        // Sanitize non-printable binary characters to prevent binary character output in console
        const cleanText = text.replace(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g, '').trim();
        errReason = cleanText || `HTTP ${res.status}: Failed to decode image`;
      }
      console.error(`[NNTP:IMAGE_DECODE_ERROR] Article #${artId} (Group: ${selectedGroup}): ${errReason}`);
      setImgErrors((prev) => ({ ...prev, [artId]: errReason }));
    } catch (e) {
      const errReason = `Network/Fetch error: ${e.message}`;
      console.error(`[NNTP:IMAGE_DECODE_ERROR] Article #${artId}: ${errReason}`);
      setImgErrors((prev) => ({ ...prev, [artId]: errReason }));
    }
  };

  const toggleExpandPackage = (pkgKey) => {
    setExpandedPackages((prev) => ({ ...prev, [pkgKey]: !prev[pkgKey] }));
  };

  const handleToggleArticle = (row) => {
    const isImage = getMediaType(row.subject) === 'image';
    if (isImage) {
      handleToggleImage(row);
    } else {
      handleToggleBody(row);
    }
  };

  const renderExpandedRow = (row) => {
    const artId = row.id;

    if (expandedBodyId === artId) {
      return (
        <Paper p="md" bg="dark.8">
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="blue.3">
              📄 Article Body (ID: #{artId})
            </Text>
            <Button size="xs" variant="subtle" color="gray" onClick={() => setExpandedBodyId(null)}>
              Close Body
            </Button>
          </Group>

          {loadingBodyId === artId ? (
            <Group gap="xs" p="sm">
              <Loader size="sm" color="blue" />
              <Text size="xs" c="dimmed">Loading article body content from NNTP server...</Text>
            </Group>
          ) : (
            <Code block style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', maxHeight: '350px', overflowY: 'auto' }}>
              {articleBodies[artId] || 'No body content available.'}
            </Code>
          )}
        </Paper>
      );
    }

    if (expandedImageId === artId) {
      return (
        <Paper p="md" bg="dark.9" style={{ textAlign: 'center' }}>
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="cyan.3">
              🖼️ Multi-part / yEnc Assembled Image Preview (Article #{artId})
            </Text>
            <Button size="xs" variant="subtle" color="gray" onClick={() => setExpandedImageId(null)}>
              Close Image
            </Button>
          </Group>

          {imgLoadingIds[artId] && (
            <Group justify="center" gap="xs" p="md">
              <Loader size="sm" color="cyan" />
              <Text size="xs" c="dimmed">Decoding yEnc image parts from NNTP server...</Text>
            </Group>
          )}

          {imgErrors[artId] && (
            <Paper p="sm" bg="red.9" my="xs" style={{ textAlign: 'left' }}>
              <Text size="xs" fw={700} c="white">
                ❌ Image Decoding Failed for Article #{artId}
              </Text>
              <Code color="red" block mt="xs" style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                {imgErrors[artId]}
              </Code>
            </Paper>
          )}

          <Box style={{ display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
            <img
              src={`/api/article-image?group=${encodeURIComponent(selectedGroup)}&id=${artId}${serverId ? `&serverId=${encodeURIComponent(serverId)}` : ''}`}
              alt={`Article #${artId}`}
              style={{
                maxWidth: '100%',
                maxHeight: '500px',
                objectFit: 'contain',
                borderRadius: '6px',
                display: (imgLoadingIds[artId] || imgErrors[artId]) ? 'none' : 'block'
              }}
              onLoad={() => setImgLoadingIds((prev) => ({ ...prev, [artId]: false }))}
              onError={() => handleImageError(artId)}
            />
          </Box>
        </Paper>
      );
    }

    return null;
  };

  const handleSort = (column) => {
    if (onSortChange) {
      onSortChange(column);
    }
  };

  const columns = [
    visibleColumns.id && {
      accessor: 'id',
      title: 'Article ID',
      width: 130,
      sortable: true,
      onSort: handleSort,
      render: (val, row) => (
        <Group gap={4} wrap="nowrap">
          {row.isNzbPackage ? (
            <Text size="xs" fw={700} c="blue">
              📦 #{val}
            </Text>
          ) : (
            <Text size="xs" fw={600} c="dimmed">
              #{val}
            </Text>
          )}
        </Group>
      ),
    },
    visibleColumns.subject && {
      accessor: 'subject',
      title: 'Subject / Title',
      sortable: true,
      onSort: handleSort,
      render: (val, row) => {
        const isPkg = row.isNzbPackage;
        const isPkgExpanded = !!expandedPackages[row.packageKey];
        const mediaType = getMediaType(val, row.bodyPreview);

        let typeEmoji = '📄';
        if (mediaType === 'image') typeEmoji = '🖼️';
        else if (mediaType === 'video') typeEmoji = '🎬';
        else if (mediaType === 'audio') typeEmoji = '🎵';
        else if (mediaType === 'archive') typeEmoji = '📦';

        return (
          <Box
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (isPkg) {
                toggleExpandPackage(row.packageKey);
              } else {
                handleToggleArticle(row);
              }
            }}
          >
            <Group gap={6} wrap="nowrap" align="center">
              {isPkg && (
                <ActionIcon size="xs" variant="subtle" color="gray">
                  {isPkgExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </ActionIcon>
              )}
              <Text span style={{ fontSize: '14px', lineHeight: 1 }}>
                {typeEmoji}
              </Text>
              <Tooltip
                label={val}
                multiline
                w={550}
                withArrow
                bg="rgba(15, 23, 42, 0.92)"
                c="white"
                style={{ fontSize: '0.75rem', borderRadius: '6px', backdropFilter: 'blur(4px)' }}
              >
                <Text size="xs" fw={600} c={isPkg ? "blue.7" : "blue.6"} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '520px', textDecoration: 'underline' }}>
                  {val}
                </Text>
              </Tooltip>
              {row.partCount && (
                <Badge size="xs" color="gray" variant="light">
                  {row.partCount} parts
                </Badge>
              )}
              {row.declaredTotal && (
                row.isComplete ? (
                  <Badge size="xs" color="green" variant="light" leftSection={<CheckCircle2 size={10} />}>
                    Complete ({row.partCount}/{row.declaredTotal})
                  </Badge>
                ) : (
                  <Badge size="xs" color="red" variant="light" leftSection={<AlertTriangle size={10} />}>
                    Incomplete ({row.partCount}/{row.declaredTotal})
                  </Badge>
                )
              )}
            </Group>
          </Box>
        );
      },
    },
    visibleColumns.poster && {
      accessor: 'poster',
      title: 'Poster / Author',
      width: 200,
      sortable: true,
      onSort: handleSort,
      render: (val) => (
        <Text size="xs" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {val}
        </Text>
      ),
    },
    visibleColumns.date && {
      accessor: 'date',
      title: 'Date',
      width: 120,
      sortable: true,
      onSort: handleSort,
      render: (val) => (
        <Text size="xs" c="dimmed">
          {val ? new Date(val).toLocaleDateString() : '-'}
        </Text>
      ),
    },
    visibleColumns.bytes && {
      accessor: 'bytes',
      title: 'Size',
      width: 100,
      align: 'right',
      sortable: true,
      onSort: handleSort,
      render: (val, row) => (
        <Text size="xs" fw={600} c={row.isNzbPackage ? "blue" : "dimmed"}>
          {formatBytes(val || row.size)}
        </Text>
      ),
    },
  ].filter(Boolean);

  const renderRowActions = (row) => {
    const isImage = getMediaType(row.subject) === 'image';

    return (
      <Group gap={4} justify="center" wrap="nowrap">
        {/* Article Body Toggle Button */}
        {!row.isNzbPackage && (
          <Tooltip label="Toggle Article Body Preview">
            <ActionIcon
              size="sm"
              variant={expandedBodyId === row.id ? "filled" : "subtle"}
              color="blue"
              onClick={() => handleToggleBody(row)}
            >
              <Text span style={{ fontSize: '13px', lineHeight: 1 }}>📄</Text>
            </ActionIcon>
          </Tooltip>
        )}

        {/* Multi-part / yEnc Assembled Image Button */}
        {isImage && (
          <Tooltip label="View Multi-part / yEnc Image">
            <ActionIcon
              size="sm"
              variant={expandedImageId === row.id ? "filled" : "subtle"}
              color="cyan"
              onClick={() => handleToggleImage(row)}
            >
              <Text span style={{ fontSize: '13px', lineHeight: 1 }}>🖼️</Text>
            </ActionIcon>
          </Tooltip>
        )}

        {/* NZB Export Button */}
        {onDownloadNZB && (
          <Tooltip label="Export NZB File">
            <ActionIcon size="sm" variant="subtle" color={row.isComplete ? "teal" : "red"} onClick={() => onDownloadNZB(row)}>
              {row.isComplete ? <Puzzle size={14} /> : <Unlink size={14} />}
            </ActionIcon>
          </Tooltip>
        )}

        {/* Direct File Download Button */}
        {onDownloadArticle && (
          <Tooltip label="Download Raw Article File">
            <ActionIcon size="sm" variant="subtle" color="green" onClick={() => onDownloadArticle(row)}>
              <FileDown size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    );
  };

  const { loading, xoverProgress } = useNNTPStore();

  return (
    <BaseTable
      columns={columns}
      data={articles}
      rowKey="id"
      selectable={true}
      selectedRows={selectedArticleIds}
      onSelectRow={onSelectArticle}
      onSelectAll={onSelectAllArticles}
      maxHeight={maxHeight}
      loading={loading}
      progress={xoverProgress}
      emptyMessage="No articles found matching criteria."
      renderRowActions={renderRowActions}
      renderExpandedRow={renderExpandedRow}
      page={page}
      total={total}
      onPageChange={onPageChange}
      totalItemsCount={totalItemsCount || articles.length}
      pageSize={pageSize}
      onPageSizeChange={onPageSizeChange}
      sortStatus={sortStatus}
    />
  );
}

export default ArticleTable;

