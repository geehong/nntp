import React from 'react';
import { BaseTable } from './BaseTable';
import { Badge, ActionIcon, Tooltip, Group, Text } from '@mantine/core';
import { Star, RefreshCw } from 'lucide-react';

export function NewsgroupTable({
  newsgroups = [],
  selectedGroupNames = [],
  favoriteGroupNames = [],
  onSelectGroup,
  onSelectAllGroups,
  onGroupClick,
  onToggleFavorite,
  onRefreshGroup,
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
  const columns = [
    {
      accessor: 'is_favorite',
      title: 'Fav',
      width: 50,
      align: 'center',
      render: (val, row) => {
        const isFav = favoriteGroupNames.includes(row.name) || val === 1;
        return (
          <ActionIcon
            size="sm"
            variant="subtle"
            color={isFav ? 'yellow' : 'gray'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite && onToggleFavorite(row.name);
            }}
          >
            <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
          </ActionIcon>
        );
      },
    },
    {
      accessor: 'name',
      title: 'Newsgroup Name',
      sortable: true,
      onSort: onSortChange,
      render: (val) => (
        <Text size="xs" fw={700} c="blue">
          {val}
        </Text>
      ),
    },
    {
      accessor: 'count',
      title: 'Articles Count',
      width: 150,
      align: 'right',
      sortable: true,
      onSort: onSortChange,
      render: (val, row) => {
        const h = Number(row.high || 0);
        const l = Number(row.low || 0);
        const count = h >= l && l > 0 ? h - l + 1 : Number(row.count || 0);
        return (
          <Text size="xs" fw={600}>
            {count ? count.toLocaleString() : (val || '-')}
          </Text>
        );
      },
    },
    {
      accessor: 'high',
      title: 'High #',
      width: 120,
      align: 'right',
      sortable: true,
      onSort: onSortChange,
      render: (val) => (
        <Text size="xs" c="dimmed">
          {val ? Number(val).toLocaleString() : '-'}
        </Text>
      ),
    },
    {
      accessor: 'low',
      title: 'Low #',
      width: 120,
      align: 'right',
      sortable: true,
      onSort: onSortChange,
      render: (val) => (
        <Text size="xs" c="dimmed">
          {val ? Number(val).toLocaleString() : '-'}
        </Text>
      ),
    },
    {
      accessor: 'status',
      title: 'Status',
      width: 80,
      align: 'center',
      render: (val) => (
        <Badge size="xs" color={val === 'y' ? 'green' : 'gray'} variant="light">
          {val || 'y'}
        </Badge>
      ),
    },
  ];

  const renderRowActions = (row) => (
    <Group gap={4} justify="center">
      {onRefreshGroup && (
        <Tooltip label="Refresh Group Articles">
          <ActionIcon size="sm" variant="subtle" color="blue" onClick={() => onRefreshGroup(row)}>
            <RefreshCw size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );

  return (
    <BaseTable
      columns={columns}
      data={newsgroups}
      rowKey="name"
      selectable={true}
      selectedRows={selectedGroupNames}
      onSelectRow={onSelectGroup}
      onSelectAll={onSelectAllGroups}
      onRowClick={onGroupClick}
      maxHeight={maxHeight}
      emptyMessage="No newsgroups cached or available."
      renderRowActions={renderRowActions}
      page={page}
      total={total}
      onPageChange={onPageChange}
      totalItemsCount={totalItemsCount || newsgroups.length}
      pageSize={pageSize}
      onPageSizeChange={onPageSizeChange}
      sortStatus={sortStatus}
    />
  );
}

export default NewsgroupTable;
