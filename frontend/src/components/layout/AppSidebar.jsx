import React, { useEffect, useRef } from 'react';
import { AppShell, NavLink, ScrollArea, Text, Tooltip, Box } from '@mantine/core';
import { Server, Star, Sliders, Monitor, MoreHorizontal, Settings } from 'lucide-react';
import { useNNTPStore } from '../../store/useNNTPStore';

function shortenNewsgroup(name) {
  if (!name || typeof name !== 'string') return '';
  const parts = name.split('.');
  if (parts.length <= 1) return name;
  const lastPart = parts.pop();
  const shortenedPrefix = parts.map(p => p ? p.charAt(0) : '').join('.');
  return `${shortenedPrefix}.${lastPart}`;
}

export default function AppSidebar({ activeTab, setActiveTab, opened = true }) {
  const {
    servers = [],
    selectedServerId,
    setSelectedServerId,
    serverFavoritesMap = {},
    fetchFavorites,
    selectedGroup,
    setSelectedGroup
  } = useNNTPStore();

  const fetchedRef = useRef(new Set());

  useEffect(() => {
    if (Array.isArray(servers) && fetchFavorites) {
      servers.forEach((srv) => {
        if (srv && srv.id && !fetchedRef.current.has(srv.id)) {
          fetchedRef.current.add(srv.id);
          fetchFavorites(srv.id);
        }
      });
    }
  }, [servers, fetchFavorites]);

  const visibleServers = (Array.isArray(servers) ? servers : [])
    .filter((s) => s.showInSidebar !== false && s.showInSidebar !== 0)
    .sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)));

  const isSettingsTab = activeTab === 'servers' || activeTab === 'ui-settings' || activeTab === 'etc';
  const isDashboardTab = activeTab === 'farm';

  // 1. Settings Sidebar View
  if (isSettingsTab) {
    const settingsItems = [
      { id: 'servers', label: 'Server Settings', icon: Server, color: '#0284c7' },
      { id: 'ui-settings', label: 'UI Settings', icon: Monitor, color: '#8b5cf6' },
      { id: 'etc', label: 'Etc Settings', icon: MoreHorizontal, color: '#64748b' },
    ];

    return (
      <AppShell.Navbar p={opened ? 'sm' : 'xs'}>
        <AppShell.Section grow component={ScrollArea}>
          {opened && (
            <Text size="xs" fw={700} c="dimmed" mb="sm" px="xs">
              SYSTEM SETTINGS
            </Text>
          )}
          {settingsItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            if (!opened) {
              return (
                <Box key={item.id} mb="sm" style={{ display: 'flex', justifyContent: 'center' }}>
                  <Tooltip label={item.label} position="right" withArrow bg="rgba(15, 23, 42, 0.92)">
                    <Box
                      onClick={() => setActiveTab(item.id)}
                      style={{
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '8px',
                        backgroundColor: isActive ? '#e0f2fe' : '#f1f5f9',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '36px',
                        height: '36px',
                      }}
                    >
                      <Icon size={18} color={item.color} />
                    </Box>
                  </Tooltip>
                </Box>
              );
            }

            return (
              <NavLink
                key={item.id}
                label={item.label}
                leftSection={<Icon size={16} color={item.color} />}
                active={isActive}
                onClick={() => setActiveTab(item.id)}
                variant="light"
                mb={4}
              />
            );
          })}
        </AppShell.Section>
      </AppShell.Navbar>
    );
  }

  // 2. Dashboard / Reader Sidebar View
  return (
    <AppShell.Navbar p={opened ? 'sm' : 'xs'}>
      <AppShell.Section grow component={ScrollArea}>
        {opened && (
          <Text size="xs" fw={700} c="dimmed" mb="sm" px="xs">
            {isDashboardTab ? 'CONFIGURED SERVERS' : 'SERVERS & FAVORITES'}
          </Text>
        )}
        
        {visibleServers.map(server => {
          const isServerActive = selectedServerId === server.id;
          const srvFavData = serverFavoritesMap[server.id] || {};
          const favorites = srvFavData.favorites || [];

          if (!opened) {
            // Mini icon mode (collapsed width 60px)
            return (
              <Box key={server.id} mb="md" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Tooltip label={`Server: ${server.name || server.host}`} position="right" withArrow bg="rgba(15, 23, 42, 0.92)">
                  <Box
                    onClick={() => {
                      setSelectedServerId(server.id);
                    }}
                    style={{
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '8px',
                      backgroundColor: isServerActive ? '#e0f2fe' : '#f1f5f9',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      width: '36px',
                      height: '36px',
                    }}
                  >
                    <Server size={18} color={server.isPrimary ? '#0284c7' : '#059669'} />
                  </Box>
                </Tooltip>

                {!isDashboardTab && favorites.map(groupName => {
                  const isFavActive = selectedGroup === groupName && activeTab === 'reader';

                  return (
                    <Tooltip key={groupName} label={groupName} position="right" withArrow bg="rgba(15, 23, 42, 0.92)">
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedServerId !== server.id) {
                            setSelectedServerId(server.id);
                          }
                          setSelectedGroup(groupName);
                          setActiveTab('reader');
                        }}
                        style={{
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '6px',
                          backgroundColor: isFavActive ? '#fef3c7' : 'transparent',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          width: '32px',
                          height: '32px',
                        }}
                      >
                        <Star size={15} color="#f59e0b" fill={isFavActive ? '#f59e0b' : 'none'} />
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            );
          }
          
          return (
            <NavLink
              key={server.id}
              label={server.name || server.host}
              leftSection={<Server size={16} color={server.isPrimary ? '#0284c7' : '#059669'} />}
              childrenOffset={28}
              defaultOpened
              active={isServerActive}
              onClick={() => {
                setSelectedServerId(server.id);
              }}
              variant="light"
            >
              {!isDashboardTab && favorites.map(groupName => {
                const displayGroup = shortenNewsgroup(groupName);

                return (
                  <Tooltip
                    key={groupName}
                    label={groupName}
                    withArrow
                    position="right"
                    bg="rgba(15, 23, 42, 0.92)"
                    openDelay={200}
                  >
                    <NavLink
                      label={
                        <Text
                          component="span"
                          size="sm"
                          style={{
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {displayGroup}
                        </Text>
                      }
                      leftSection={<Star size={14} color="#f59e0b" fill="#f59e0b" />}
                      active={selectedGroup === groupName && activeTab === 'reader'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedServerId !== server.id) {
                          setSelectedServerId(server.id);
                        }
                        setSelectedGroup(groupName);
                        setActiveTab('reader');
                      }}
                      variant="filled"
                    />
                  </Tooltip>
                );
              })}
            </NavLink>
          );
        })}
      </AppShell.Section>
    </AppShell.Navbar>
  );
}
