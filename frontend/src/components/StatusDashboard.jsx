import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Grid,
  Title,
  Text,
  Group,
  Badge,
  Button,
  Box,
  ScrollArea,
  TextInput,
  Select,
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Divider,
} from '@mantine/core';
import {
  Server,
  Database,
  Star,
  HardDrive,
  Clock,
  Terminal,
  RefreshCw,
  Trash2,
  Activity,
  CheckCircle2,
  Search,
  Lock,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { useNNTPStore } from '../store/useNNTPStore';
import NNTPEngineWorkbench from './NNTPEngineWorkbench';

const getDaysToExpiry = (expireDateStr) => {
  if (!expireDateStr) return null;
  const target = new Date(expireDateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  target.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export default function StatusDashboard() {
  const { nntpLogs = [], clearNNTPLogs, servers = [], selectedServerId, setSelectedServerId, downloadServerNewsgroups, isDownloadingGroups } = useNNTPStore();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [logFilterLevel, setLogFilterLevel] = useState('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const logViewportRef = useRef(null);

  const fetchDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (logViewportRef.current) {
      logViewportRef.current.scrollTo({ top: logViewportRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [nntpLogs]);

  const filteredLogs = (nntpLogs || []).filter((log) => {
    if (logFilterLevel !== 'all' && log.level !== logFilterLevel) return false;
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const msg = (log.message || '').toLowerCase();
      const cat = (log.category || '').toLowerCase();
      const det = (typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '')).toLowerCase();
      return msg.includes(q) || cat.includes(q) || det.includes(q);
    }
    return true;
  });

  const displayServers = stats?.servers || servers;
  const primaryServer = displayServers.find((s) => s.isPrimary) || displayServers[0];

  return (
    <Box style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header & Summary Row */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between" align="center" mb="xs">
          <div>
            <Title order={4} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
              <Activity color="#0284c7" size={24} />
              NNTP System & Server Status Dashboard
            </Title>
            <Text size="xs" c="dimmed" mt={2}>
              Real-time monitor for NNTP connections, newsgroup metadata sync, bandwidth usage, and class logging.
            </Text>
          </div>

          <Group gap="xs">
            <Button
              size="xs"
              variant="outline"
              leftSection={<RefreshCw size={14} className={loadingStats ? 'spin' : ''} />}
              onClick={fetchDashboardStats}
              loading={loadingStats}
            >
              Refresh Stats
            </Button>
          </Group>
        </Group>

        <Divider my="sm" />

        {/* Metric Cards Grid */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" fw={600}>PRIMARY SERVER</Text>
                  <Text size="md" fw={700} c="indigo.8" mt={2}>
                    {primaryServer?.name || 'BlockNews Server'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {displayServers.length} Servers Configured
                  </Text>
                </div>
                <Server size={28} color="#4f46e5" />
              </Group>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" fw={600}>TOTAL NEWSGROUPS</Text>
                  <Text size="md" fw={700} c="blue.8" mt={2}>
                    {(stats?.totalGroups || 1289531).toLocaleString()}
                  </Text>
                  <Text size="xs" c="teal.7" fw={600}>
                    ★ Favorites: {(stats?.favGroups || 0).toLocaleString()} Groups
                  </Text>
                </div>
                <Database size={28} color="#0284c7" />
              </Group>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" fw={600}>TOTAL BANDWIDTH USAGE</Text>
                  <Text size="md" fw={700} c="green.8" mt={2}>
                    {formatBytes(stats?.totalBytesAll || 0)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    30-Day Aggregated Download
                  </Text>
                </div>
                <HardDrive size={28} color="#059669" />
              </Group>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" fw={600}>LAST LIST SYNC TIME</Text>
                  <Text size="xs" fw={700} c="dark.7" mt={4}>
                    {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Recently Synced'}
                  </Text>
                  <Text size="xs" c="blue.6" style={{ cursor: 'pointer' }} onClick={() => downloadServerNewsgroups()}>
                    {isDownloadingGroups ? 'Syncing...' : '▶ Sync Now'}
                  </Text>
                </div>
                <Clock size={28} color="#d97706" />
              </Group>
            </Paper>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* 2. Per-Server Status Cards */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Title order={5} mb="md" c="dark.8" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={18} color="#0284c7" /> Configured Servers Status ({displayServers.length})
        </Title>

        <Grid>
          {displayServers.map((srv) => {
            const isSelected = selectedServerId === srv.id;
            const daysLeft = getDaysToExpiry(srv.expireDate);
            const isExpiring = daysLeft !== null && daysLeft <= 3;
            const isExpired = daysLeft !== null && daysLeft <= 0;

            return (
              <Grid.Col key={srv.id} span={{ base: 12, sm: 6, md: 4 }}>
                <Paper
                  p="sm"
                  radius="md"
                  withBorder
                  onClick={() => setSelectedServerId(srv.id)}
                  style={{
                    backgroundColor: isExpired ? '#fef2f2' : isExpiring ? '#fffbeb' : isSelected ? '#f0f9ff' : '#f8fafc',
                    borderColor: isExpired ? '#fca5a5' : isExpiring ? '#fcd34d' : isSelected ? '#0284c7' : srv.isPrimary ? '#93c5fd' : '#e2e8f0',
                    borderWidth: isSelected || isExpiring ? '2px' : '1px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 1px #0284c7' : 'none',
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Server size={18} color={isExpired ? '#dc2626' : isExpiring ? '#d97706' : isSelected ? '#0284c7' : srv.isPrimary ? '#0284c7' : '#059669'} />
                      <Text size="sm" fw={700} c={isSelected ? 'blue.9' : 'dark.8'}>{srv.name}</Text>
                    </Group>
                    <Group gap={4}>
                      {isExpired && <Badge color="red" size="xs" variant="filled">EXPIRED</Badge>}
                      {!isExpired && isExpiring && <Badge color="orange" size="xs" variant="filled">D-{daysLeft} EXPIRE</Badge>}
                      {isSelected && <Badge color="sky" size="xs" variant="filled">SELECTED</Badge>}
                      {srv.isPrimary && <Badge color="blue" size="xs">PRIMARY</Badge>}
                    </Group>
                  </Group>

                <Text size="xs" c="dimmed" mb="xs">{srv.host}:{srv.port}</Text>

                {isExpiring && (
                  <Paper p={6} mb="xs" radius="xs" style={{ background: isExpired ? '#fee2e2' : '#fef3c7', border: `1px solid ${isExpired ? '#f87171' : '#fbbf24'}` }}>
                    <Text size="xs" fw={700} c={isExpired ? 'red.9' : 'orange.9'} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={14} />
                      {isExpired
                        ? `구독 만료됨 (${srv.expireDate})`
                        : `구독 만료 ${daysLeft}일 전! (해지 권장)`}
                    </Text>
                  </Paper>
                )}

                <Divider my="xs" />

                <Grid gap="xs" style={{ fontSize: '0.78rem' }}>
                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed">Synced Groups:</Text>
                    <Text size="xs" fw={700} c="blue.7">{(srv.syncedGroups || 0).toLocaleString()} Groups</Text>
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed">Favorites:</Text>
                    <Text size="xs" fw={700} c="yellow.8">★ {(srv.favGroups || 0).toLocaleString()}</Text>
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed">Downloaded:</Text>
                    <Text size="xs" fw={700} c="green.7">{formatBytes(srv.bytesDownloaded || 0)}</Text>
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed">Connections:</Text>
                    <Text size="xs" fw={700} c="dark.7">{srv.maxConnections} Threads</Text>
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed">Security:</Text>
                    <Text size="xs" fw={600} c={srv.useSSL ? 'green.7' : 'dark.6'}>
                      {srv.useSSL ? 'SSL / TLS (563)' : 'Plain (119)'}
                    </Text>
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Text size="xs" c="dimmed">Expire Date:</Text>
                    <Text size="xs" fw={700} c={isExpiring ? 'orange.8' : 'dark.7'}>
                      {srv.expireDate || 'N/A'}
                    </Text>
                  </Grid.Col>
                </Grid>
              </Paper>
            </Grid.Col>
          );
        })}
        </Grid>
      </Paper>

      {/* 3. Engine Class Architecture Test Status (Moved from Settings) */}
      <NNTPEngineWorkbench />

      {/* 4. Real-Time NNTP Logging Console */}
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
        <Group justify="space-between" align="center" mb="sm">
          <Group gap="xs">
            <Terminal size={20} color="#38bdf8" />
            <Title order={5} style={{ color: '#f8fafc' }}>
              Real-Time NNTP Class Console Logs
            </Title>
            <Badge color="cyan" size="xs">
              {filteredLogs.length} / {nntpLogs.length} Events
            </Badge>
          </Group>

          <Group gap="xs">
            <TextInput
              placeholder="Search logs..."
              size="xs"
              w={180}
              leftSection={<Search size={12} color="#94a3b8" />}
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              styles={{ input: { backgroundColor: '#1e293b', color: '#f8fafc', borderColor: '#334155' } }}
            />

            <SegmentedControl
              size="xs"
              value={logFilterLevel}
              onChange={setLogFilterLevel}
              data={[
                { label: 'All', value: 'all' },
                { label: 'Info', value: 'info' },
                { label: 'Warn', value: 'warn' },
                { label: 'Error', value: 'error' },
              ]}
              styles={{ root: { backgroundColor: '#1e293b' } }}
            />

            <Tooltip label="Clear log console">
              <ActionIcon variant="subtle" color="red" size="sm" onClick={clearNNTPLogs}>
                <Trash2 size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Divider my="xs" color="#334155" />

        <ScrollArea h={320} viewportRef={logViewportRef} style={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.5' }}>
          {filteredLogs.length === 0 ? (
            <Text size="xs" c="dimmed" py="md" style={{ textAlign: 'center' }}>
              No NNTP log events captured yet. Commands (GROUP, XOVER, BODY, AUTH) will stream live here.
            </Text>
          ) : (
            filteredLogs.map((log) => {
              let color = '#38bdf8'; // blue for info
              if (log.level === 'warn') color = '#fbbf24'; // yellow
              if (log.level === 'error') color = '#f87171'; // red

              const detailText = log.details ? ` ${typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}` : '';

              return (
                <div key={log.id} style={{ marginBottom: '4px', borderBottom: '1px solid #1e293b', paddingBottom: '2px', wordBreak: 'break-all' }}>
                  <span style={{ color: '#64748b', marginRight: '8px' }}>[{log.time}]</span>
                  <span style={{ color: color, fontWeight: 'bold', marginRight: '8px' }}>[{log.category || 'NNTP'}]</span>
                  <span style={{ color: '#f1f5f9' }}>{log.message}</span>
                  {detailText && <span style={{ color: '#94a3b8', marginLeft: '6px' }}>{detailText}</span>}
                </div>
              );
            })
          )}
        </ScrollArea>
      </Paper>
    </Box>
  );
}
