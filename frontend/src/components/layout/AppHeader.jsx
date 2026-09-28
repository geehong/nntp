import React from 'react';
import {
  AppShell,
  Group,
  Burger,
  Title,
  Badge,
  ActionIcon,
  Tooltip,
  Button,
} from '@mantine/core';
import { Pin, PinOff, Sun, Moon } from 'lucide-react';

export default function AppHeader({
  opened,
  toggle,
  fixedHeader,
  setFixedHeader,
  computedColorScheme,
  toggleColorScheme,
  servers = [],
  setSelectedServerId,
  activeTab,
  setActiveTab
}) {
  const isReaderActive = activeTab === 'reader' || activeTab === 'newsgroups';
  const isDashboardActive = activeTab === 'farm';
  const isRecsActive = activeTab === 'recommendations';
  const isSettingsActive = activeTab === 'servers' || activeTab === 'ui-settings' || activeTab === 'etc';

  return (
    <AppShell.Header style={{ position: fixedHeader ? 'sticky' : 'static' }}>
      <Group h="100%" px="md" justify="space-between">
        <Group gap="md">
          <Burger opened={opened} onClick={toggle} size="sm" />
          <Title order={4} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
            <a 
              href="https://nntp.firemarkets.net/" 
              onClick={(e) => {
                if (window.location.pathname === '/') {
                  e.preventDefault();
                  setActiveTab('reader');
                }
              }}
              style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              🌐 NNTP
            </a>
          </Title>

          {/* Top Direct Menu Buttons (No Dropdowns) */}
          <Group gap="xs">
            <Button
              variant={isReaderActive ? 'filled' : 'subtle'}
              color="blue"
              size="xs"
              onClick={() => setActiveTab('reader')}
            >
              Newsgroup Reader
            </Button>

            <Button
              variant={isDashboardActive ? 'filled' : 'subtle'}
              color="blue"
              size="xs"
              onClick={() => {
                const primaryServer = (Array.isArray(servers) ? servers : []).find(s => s.isPrimary) || servers[0];
                if (primaryServer) {
                  setSelectedServerId(primaryServer.id);
                }
                setActiveTab('farm');
              }}
            >
              Dashboard
            </Button>

            <Button
              variant={isRecsActive ? 'filled' : 'subtle'}
              color="blue"
              size="xs"
              onClick={() => setActiveTab('recommendations')}
            >
              Recommendations
            </Button>

            <Button
              variant={isSettingsActive ? 'filled' : 'subtle'}
              color="blue"
              size="xs"
              onClick={() => setActiveTab('servers')}
            >
              Settings
            </Button>
          </Group>
        </Group>

        <Group gap="xs">
          <Tooltip label={fixedHeader ? 'Unfix Header' : 'Fix Header to Top'}>
            <ActionIcon
              variant="default"
              onClick={() => setFixedHeader(!fixedHeader)}
              size="lg"
            >
              {fixedHeader ? <Pin size={18} color="#0284c7" /> : <PinOff size={18} />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label={`Switch to ${computedColorScheme === 'dark' ? 'Light' : 'Dark'} Mode`}>
            <ActionIcon variant="default" onClick={toggleColorScheme} size="lg">
              {computedColorScheme === 'dark' ? <Sun size={18} color="#f59e0b" /> : <Moon size={18} color="#6366f1" />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </AppShell.Header>
  );
}
