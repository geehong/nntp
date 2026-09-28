import React from 'react';
import { Table, Paper, Checkbox, Text, Group, Pagination, Select, RingProgress, Center } from '@mantine/core';

/**
 * BaseTable Component
 * Generic reusable table component built on Mantine UI v7 Table.
 * Fixed sticky header overlay issue and integrated Mantine Pagination control.
 */
export function BaseTable({
  columns = [],
  data = [],
  rowKey = 'id',
  selectable = false,
  selectedRows = [],
  onSelectRow,
  onSelectAll,
  onRowClick,
  stickyHeader = true,
  stickyHeaderOffset = 0,
  maxHeight = 600,
  minWidth = 800,
  striped = true,
  highlightOnHover = true,
  withTableBorder = true,
  withColumnBorders = false,
  emptyMessage = 'No data available',
  caption = null,
  renderRowActions = null,
  renderExpandedRow = null,
  loading = false,
  progress = null, // { current, total }

  // Pagination Props
  page = 1,
  total = 1,
  onPageChange = null,
  totalItemsCount = 0,
  pageSize = 25,
  onPageSizeChange = null,
  pageSizeOptions = ['25', '50', '100', '250', '500', '1000'],
  sortStatus = null,
  ...tableProps
}) {
  const allSelected = data.length > 0 && selectedRows.length === data.length;
  const someSelected = selectedRows.length > 0 && selectedRows.length < data.length;
  const colSpanCount = columns.length + (selectable ? 1 : 0) + (renderRowActions ? 1 : 0);

  const percent = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  return (
    <Paper radius="md" withBorder style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Table.ScrollContainer
        minWidth={minWidth}
        style={{
          resize: 'vertical',
          overflow: 'auto',
          minHeight: '350px',
          height: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight || '650px',
          maxHeight: '90vh',
          position: 'relative',
        }}
        type="native"
      >
        <Table
          stickyHeader={stickyHeader}
          stickyHeaderOffset={stickyHeaderOffset}
          striped={striped}
          highlightOnHover={highlightOnHover}
          withTableBorder={withTableBorder}
          withColumnBorders={withColumnBorders}
          tabularNums
          {...tableProps}
        >
          {caption && <Table.Caption>{caption}</Table.Caption>}
          
          <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--mantine-color-body)', zIndex: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <Table.Tr>
              {selectable && (
                <Table.Th style={{ width: 40, textAlign: 'center', backgroundColor: 'var(--mantine-color-body)', position: 'sticky', top: 0, zIndex: 11 }}>
                  <Checkbox
                    aria-label="Select all rows"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={(e) => onSelectAll && onSelectAll(e.currentTarget.checked)}
                  />
                </Table.Th>
              )}
              {columns.map((col) => {
                const isSorted = sortStatus && sortStatus.column === col.accessor;
                const sortIcon = isSorted ? (sortStatus.direction === 'desc' ? ' ↓' : ' ↑') : (col.sortable ? ' ↕' : '');
                return (
                  <Table.Th
                    key={col.key || col.accessor}
                    style={{
                      width: col.width,
                      textAlign: col.align || 'left',
                      cursor: col.sortable ? 'pointer' : 'default',
                      whiteSpace: 'nowrap',
                      backgroundColor: 'var(--mantine-color-body)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 11,
                    }}
                    onClick={() => col.sortable && col.onSort && col.onSort(col.accessor)}
                  >
                    <Text fw={700} size="xs" c="dimmed">
                      {col.title}{sortIcon}
                    </Text>
                  </Table.Th>
                );
              })}
              {renderRowActions && (
                <Table.Th style={{ width: 100, textAlign: 'center', backgroundColor: 'var(--mantine-color-body)', position: 'sticky', top: 0, zIndex: 11 }}>
                  <Text fw={700} size="xs" c="dimmed">
                    Actions
                  </Text>
                </Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {(loading || progress) ? (
              <Table.Tr>
                <Table.Td
                  colSpan={colSpanCount}
                  style={{ textAlign: 'center', padding: '48px 16px', background: '#fafafa' }}
                >
                  <Paper p="xl" radius="md" withBorder style={{ maxWidth: 420, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                    <Center>
                      <RingProgress
                        size={120}
                        thickness={12}
                        roundCaps
                        sections={[{ value: progress ? percent : 100, color: 'blue' }]}
                        label={
                          <Text fw={700} ta="center" size="lg" c="blue">
                            {progress ? `${percent}%` : '...'}
                          </Text>
                        }
                      />
                    </Center>
                    <Text fw={700} size="sm" mt="md" c="dark.7">
                      Fetching Article Headers from Usenet Server...
                    </Text>
                    {progress ? (
                      <Group justify="center" gap={4} mt="xs">
                        <Text size="sm" fw={700} c="blue">
                          {progress.current.toLocaleString()}
                        </Text>
                        <Text size="sm" c="dimmed">
                          / {progress.total.toLocaleString()} items
                        </Text>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed" mt={4}>
                        Connecting to NNTP Server...
                      </Text>
                    )}
                  </Paper>
                </Table.Td>
              </Table.Tr>
            ) : data.length === 0 ? (
              <Table.Tr>
                <Table.Td
                  colSpan={colSpanCount}
                  style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}
                >
                  {emptyMessage}
                </Table.Td>
              </Table.Tr>
            ) : (
              data.map((row, index) => {
                const keyValue = typeof rowKey === 'function' ? rowKey(row) : row[rowKey] || index;
                const isSelected = selectedRows.includes(keyValue);
                const expandedContent = renderExpandedRow ? renderExpandedRow(row, index) : null;
                const colSpanCount = columns.length + (selectable ? 1 : 0) + (renderRowActions ? 1 : 0);

                return (
                  <React.Fragment key={keyValue}>
                    <Table.Tr
                      bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
                      style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                      onClick={() => onRowClick && onRowClick(row)}
                    >
                      {selectable && (
                        <Table.Td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label="Select row"
                            checked={isSelected}
                            onChange={(e) => onSelectRow && onSelectRow(keyValue, e.currentTarget.checked)}
                          />
                        </Table.Td>
                      )}
                      {columns.map((col) => {
                        const cellValue = col.render ? col.render(row[col.accessor], row, index) : row[col.accessor];
                        return (
                          <Table.Td key={col.key || col.accessor} style={{ textAlign: col.align || 'left' }}>
                            {cellValue}
                          </Table.Td>
                        );
                      })}
                      {renderRowActions && (
                        <Table.Td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {renderRowActions(row, index)}
                        </Table.Td>
                      )}
                    </Table.Tr>
                    {expandedContent && (
                      <Table.Tr bg="var(--mantine-color-body)">
                        <Table.Td colSpan={colSpanCount} style={{ padding: 0 }}>
                          {expandedContent}
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {/* Mantine Pagination Controls Footer */}
      {onPageChange && (
        <Group justify="space-between" align="center" p="sm" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Group gap="sm">
            <Text size="xs" c="dimmed">
              Showing <Text span fw={600}>{(page - 1) * pageSize + 1}</Text> - <Text span fw={600}>{Math.min(page * pageSize, totalItemsCount || data.length)}</Text> of <Text span fw={600}>{(totalItemsCount || data.length).toLocaleString()}</Text> items
            </Text>
            {onPageSizeChange && (
              <Select
                size="xs"
                w={80}
                data={pageSizeOptions}
                value={String(pageSize)}
                onChange={(val) => onPageSizeChange(Number(val))}
              />
            )}
          </Group>

          <Pagination
            value={page}
            onChange={onPageChange}
            total={total}
            siblings={1}
            boundaries={1}
            size="sm"
            withEdges
          />
        </Group>
      )}
    </Paper>
  );
}

export default BaseTable;
