import * as RadixDialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { DialogTitle } from '~/components/ui/Dialog';
import { Switch } from '~/components/ui/Switch';
import type { TabType, TabVisibilityConfig } from '~/components/settings/settings.types';
import { TAB_LABELS } from '~/components/settings/settings.types';
import { DeveloperWindow } from '~/components/settings/developer/DeveloperWindow';
import { TabTile } from '~/components/settings/shared/TabTile';
import { tabConfigurationStore, updateTabConfiguration } from '~/lib/stores/settings';
import { useStore } from '@nanostores/react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ProfileTab from '~/components/settings/profile/ProfileTab';
import SettingsTab from '~/components/settings/settings/SettingsTab';
import NotificationsTab from '~/components/settings/notifications/NotificationsTab';
import FeaturesTab from '~/components/settings/features/FeaturesTab';
import DataTab from '~/components/settings/data/DataTab';
import { ProvidersTab } from '~/components/settings/providers/ProvidersTab';
import DebugTab from '~/components/settings/debug/DebugTab';
import { EventLogsTab } from '~/components/settings/event-logs/EventLogsTab';
import UpdateTab from '~/components/settings/update/UpdateTab';
import ConnectionsTab from '~/components/settings/connections/ConnectionsTab';
import { useUpdateCheck } from '~/lib/hooks/useUpdateCheck';
import { useFeatures } from '~/lib/hooks/useFeatures';
import { useNotifications } from '~/lib/hooks/useNotifications';
import { useConnectionStatus } from '~/lib/hooks/useConnectionStatus';
import { useDebugStatus } from '~/lib/hooks/useDebugStatus';

interface DraggableTabTileProps {
  tab: TabVisibilityConfig;
  index: number;
  moveTab: (dragIndex: number, hoverIndex: number) => void;
  onClick: () => void;
  isActive: boolean;
  hasUpdate: boolean;
  statusMessage: string;
  description: string;
  isLoading?: boolean;
}

const TAB_DESCRIPTIONS: Record<TabType, string> = {
  profile: 'Manage your profile and account settings',
  settings: 'Configure application preferences',
  notifications: 'View and manage your notifications',
  features: 'Explore new and upcoming features',
  data: 'Manage your data and storage',
  providers: 'Configure AI providers and models',
  connection: 'Check connection status and settings',
  debug: 'Debug tools and system information',
  'event-logs': 'View system events and logs',
  update: 'Check for updates and release notes',
};

const DraggableTabTile = ({
  tab,
  index,
  moveTab,
  onClick,
  isActive,
  hasUpdate,
  statusMessage,
  description,
  isLoading,
}: DraggableTabTileProps) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'tab',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'tab',
    hover: (item: { index: number }) => {
      if (item.index === index) {
        return;
      }

      moveTab(item.index, index);
      item.index = index;
    },
  });

  return (
    <div ref={(node) => drag(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <TabTile
        tab={tab}
        onClick={onClick}
        isActive={isActive}
        hasUpdate={hasUpdate}
        statusMessage={statusMessage}
        description={description}
        isLoading={isLoading}
      />
    </div>
  );
};

interface UsersWindowProps {
  open: boolean;
  onClose: () => void;
}

export const UsersWindow = ({ open, onClose }: UsersWindowProps) => {
  const [developerMode, setDeveloperMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const [loadingTab, setLoadingTab] = useState<TabType | null>(null);
  const tabConfiguration = useStore(tabConfigurationStore);

  // Status hooks
  const { hasUpdate, currentVersion, acknowledgeUpdate } = useUpdateCheck();
  const { hasNewFeatures, unviewedFeatures, acknowledgeAllFeatures } = useFeatures();
  const { hasUnreadNotifications, unreadNotifications, markAllAsRead } = useNotifications();
  const { hasConnectionIssues, currentIssue, acknowledgeIssue } = useConnectionStatus();
  const { hasActiveWarnings, activeIssues, acknowledgeAllIssues } = useDebugStatus();

  const handleDeveloperModeChange = (checked: boolean) => {
    setDeveloperMode(checked);
  };

  const handleBack = () => {
    setActiveTab(null);
  };

  // Only show tabs that are assigned to the user window AND are visible
  const visibleUserTabs = tabConfiguration.userTabs
    .filter((tab: TabVisibilityConfig) => tab.window === 'user' && tab.visible)
    .sort((a: TabVisibilityConfig, b: TabVisibilityConfig) => (a.order || 0) - (b.order || 0));

  const moveTab = (dragIndex: number, hoverIndex: number) => {
    const draggedTab = visibleUserTabs[dragIndex];
    const targetTab = visibleUserTabs[hoverIndex];

    // Update the order of the dragged and target tabs
    const updatedDraggedTab = { ...draggedTab, order: targetTab.order };
    const updatedTargetTab = { ...targetTab, order: draggedTab.order };

    // Update both tabs in the store
    updateTabConfiguration(updatedDraggedTab);
    updateTabConfiguration(updatedTargetTab);
  };

  const handleTabClick = async (tabId: TabType) => {
    setLoadingTab(tabId);
    setActiveTab(tabId);

    // Acknowledge the status based on tab type
    switch (tabId) {
      case 'update':
        await acknowledgeUpdate();
        break;
      case 'features':
        await acknowledgeAllFeatures();
        break;
      case 'notifications':
        await markAllAsRead();
        break;
      case 'connection':
        acknowledgeIssue();
        break;
      case 'debug':
        await acknowledgeAllIssues();
        break;
    }

    // Simulate loading time (remove this in production)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoadingTab(null);
  };

  const getTabComponent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />;
      case 'settings':
        return <SettingsTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'features':
        return <FeaturesTab />;
      case 'data':
        return <DataTab />;
      case 'providers':
        return <ProvidersTab />;
      case 'connection':
        return <ConnectionsTab />;
      case 'debug':
        return <DebugTab />;
      case 'event-logs':
        return <EventLogsTab />;
      case 'update':
        return <UpdateTab />;
      default:
        return null;
    }
  };

  const getTabUpdateStatus = (tabId: TabType): boolean => {
    switch (tabId) {
      case 'update':
        return hasUpdate;
      case 'features':
        return hasNewFeatures;
      case 'notifications':
        return hasUnreadNotifications;
      case 'connection':
        return hasConnectionIssues;
      case 'debug':
        return hasActiveWarnings;
      default:
        return false;
    }
  };

  const getStatusMessage = (tabId: TabType): string => {
    switch (tabId) {
      case 'update':
        return `New update available (v${currentVersion})`;
      case 'features':
        return `${unviewedFeatures.length} new feature${unviewedFeatures.length === 1 ? '' : 's'} to explore`;
      case 'notifications':
        return `${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? '' : 's'}`;
      case 'connection':
        return currentIssue === 'disconnected'
          ? 'Connection lost'
          : currentIssue === 'high-latency'
            ? 'High latency detected'
            : 'Connection issues detected';
      case 'debug': {
        const warnings = activeIssues.filter((i) => i.type === 'warning').length;
        const errors = activeIssues.filter((i) => i.type === 'error').length;

        return `${warnings} warning${warnings === 1 ? '' : 's'}, ${errors} error${errors === 1 ? '' : 's'}`;
      }
      default:
        return '';
    }
  };

  return (
    <>
      <DeveloperWindow open={developerMode} onClose={() => setDeveloperMode(false)} />
      <DndProvider backend={HTML5Backend}>
        <RadixDialog.Root open={open}>
          <RadixDialog.Portal>
            <div className="fixed inset-0 flex items-center justify-center z-[50]">
              <RadixDialog.Overlay asChild>
                <motion.div
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </RadixDialog.Overlay>
              <RadixDialog.Content aria-describedby={undefined} asChild>
                <motion.div
                  className={classNames(
                    'relative',
                    'w-[1200px] h-[90vh]',
                    'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                    'rounded-2xl shadow-2xl',
                    'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                    'flex flex-col overflow-hidden',
                    'z-[51]',
                  )}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Header */}
                  <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] dark:border-[#1A1A1A]">
                    <div className="flex items-center gap-3">
                      {activeTab ? (
                        <motion.button
                          onClick={handleBack}
                          className={classNames(
                            'flex items-center justify-center w-8 h-8 rounded-lg',
                            'bg-[#F5F5F5] dark:bg-[#1A1A1A]',
                            'hover:bg-purple-500/10 dark:hover:bg-purple-500/20',
                            'group transition-all duration-200',
                          )}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <div className="i-ph:arrow-left w-4 h-4 text-bolt-elements-textSecondary group-hover:text-purple-500 transition-colors" />
                        </motion.button>
                      ) : (
                        <motion.div
                          className="i-ph:lightning-fill w-5 h-5 text-purple-500"
                          initial={{ rotate: -10 }}
                          animate={{ rotate: 10 }}
                          transition={{
                            repeat: Infinity,
                            repeatType: 'reverse',
                            duration: 2,
                            ease: 'easeInOut',
                          }}
                        />
                      )}
                      <DialogTitle className="text-lg font-medium text-bolt-elements-textPrimary">
                        {activeTab ? TAB_LABELS[activeTab] : 'Bolt Control Panel'}
                      </DialogTitle>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={developerMode}
                          onCheckedChange={handleDeveloperModeChange}
                          className="data-[state=checked]:bg-purple-500"
                          aria-label="Toggle developer mode"
                        />
                        <label className="text-sm text-bolt-elements-textSecondary">Developer Mode</label>
                      </div>
                      <motion.button
                        onClick={onClose}
                        className={classNames(
                          'flex items-center justify-center w-8 h-8 rounded-lg',
                          'bg-[#F5F5F5] dark:bg-[#1A1A1A]',
                          'hover:bg-purple-500/10 dark:hover:bg-purple-500/20',
                          'group transition-all duration-200',
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <div className="i-ph:x w-4 h-4 text-bolt-elements-textSecondary group-hover:text-purple-500 transition-colors" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Content */}
                  <div
                    className={classNames(
                      'flex-1',
                      'overflow-y-auto',
                      'hover:overflow-y-auto',
                      'scrollbar scrollbar-w-2',
                      'scrollbar-track-transparent',
                      'scrollbar-thumb-[#E5E5E5] hover:scrollbar-thumb-[#CCCCCC]',
                      'dark:scrollbar-thumb-[#333333] dark:hover:scrollbar-thumb-[#444444]',
                      'will-change-scroll',
                      'touch-auto',
                    )}
                  >
                    <motion.div
                      key={activeTab || 'home'}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6"
                    >
                      {activeTab ? (
                        getTabComponent()
                      ) : (
                        <div className="grid grid-cols-4 gap-4">
                          {visibleUserTabs.map((tab: TabVisibilityConfig, index: number) => (
                            <DraggableTabTile
                              key={tab.id}
                              tab={tab}
                              index={index}
                              moveTab={moveTab}
                              onClick={() => handleTabClick(tab.id)}
                              isActive={activeTab === tab.id}
                              hasUpdate={getTabUpdateStatus(tab.id)}
                              statusMessage={getStatusMessage(tab.id)}
                              description={TAB_DESCRIPTIONS[tab.id]}
                              isLoading={loadingTab === tab.id}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              </RadixDialog.Content>
            </div>
          </RadixDialog.Portal>
        </RadixDialog.Root>
      </DndProvider>
    </>
  );
};
