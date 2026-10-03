import React, { useState } from 'react';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/divider/divider.js';
import '@material/web/icon/icon.js';

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  needsReviewCount: number;
}

export default function Sidebar({ currentTab, setTab, needsReviewCount }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState({
    overview: true,
    management: true,
    data: true
  });

  const toggleGroup = (group: 'overview' | 'management' | 'data') => {
    setGroupsOpen(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const navItems = {
    overview: [
      { id: 'overview', label: 'Overview', icon: 'dashboard' },
      { id: 'analytics', label: 'Analytics', icon: 'bar_chart' }
    ],
    management: [
      { id: 'table', label: 'All Feedback', icon: 'table_rows' },
      { id: 'analyzer', label: 'Analyzer', icon: 'document_scanner', badge: needsReviewCount > 0 }
    ],
    data: [
      { id: 'integrations', label: 'Integrations', icon: 'integration_instructions' },
      { id: 'settings', label: 'Settings', icon: 'settings' }
    ]
  };

  const renderNavList = (items: Array<{ id: string, label: string, icon: string, badge?: boolean }>) => {
    return items.map(item => {
      const isActive = currentTab === item.id;
      return (
        <div
          key={item.id}
          onClick={() => setTab(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: isCollapsed ? '12px 0' : '10px 16px',
            margin: '4px 12px',
            borderRadius: '100px',
            cursor: 'pointer',
            backgroundColor: isActive ? 'var(--md-sys-color-secondary-container)' : 'transparent',
            color: isActive ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface)',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            transition: 'all var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)',
            position: 'relative'
          }}
          title={item.label}
        >
          <md-icon style={{ fontSize: '24px', marginRight: isCollapsed ? '0' : '12px' }}>
            {item.icon}
          </md-icon>
          
          {!isCollapsed && (
            <span className={isActive ? 'md-typescale-label-large-prominent' : 'md-typescale-label-large'} style={{ flex: 1 }}>
              {item.label}
            </span>
          )}

          {item.badge && (
            <span style={{
              position: 'absolute',
              top: '8px',
              right: isCollapsed ? '12px' : '16px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--sentiment-negative)'
            }} />
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* Desktop Navigation Sidebar */}
      <aside
        style={{
          width: isCollapsed ? '80px' : '260px',
          height: '100vh',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRight: '1px solid var(--md-sys-color-outline-variant)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)',
          position: 'sticky',
          top: 0,
          flexShrink: 0
        }}
        className="desktop-nav"
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          padding: '16px 20px',
          height: '64px',
          borderBottom: '1px solid var(--md-sys-color-outline-variant)'
        }}>
          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>✒️</span>
              <span className="md-typescale-title-medium" style={{ color: 'var(--md-sys-color-primary)' }}>
                InkScribe AI
              </span>
            </div>
          )}
          <md-icon-button onClick={() => setIsCollapsed(!isCollapsed)}>
            <md-icon>{isCollapsed ? 'menu_open' : 'menu'}</md-icon>
          </md-icon-button>
        </div>

        {/* Grouped sections */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: '16px' }}>
          {/* Overview Group */}
          <div>
            {!isCollapsed && (
              <div 
                onClick={() => toggleGroup('overview')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '8px 24px', 
                  color: 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
                className="md-typescale-label-small"
              >
                <span>Overview</span>
                <md-icon style={{ fontSize: '16px' }}>
                  {groupsOpen.overview ? 'expand_more' : 'chevron_right'}
                </md-icon>
              </div>
            )}
            {(groupsOpen.overview || isCollapsed) && renderNavList(navItems.overview)}
          </div>

          <div style={{ margin: '8px 0' }}><md-divider /></div>

          {/* Feedback Management Group */}
          <div>
            {!isCollapsed && (
              <div 
                onClick={() => toggleGroup('management')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '8px 24px', 
                  color: 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
                className="md-typescale-label-small"
              >
                <span>Feedback Management</span>
                <md-icon style={{ fontSize: '16px' }}>
                  {groupsOpen.management ? 'expand_more' : 'chevron_right'}
                </md-icon>
              </div>
            )}
            {(groupsOpen.management || isCollapsed) && renderNavList(navItems.management)}
          </div>

          <div style={{ margin: '8px 0' }}><md-divider /></div>

          {/* Data Group */}
          <div>
            {!isCollapsed && (
              <div 
                onClick={() => toggleGroup('data')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '8px 24px', 
                  color: 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
                className="md-typescale-label-small"
              >
                <span>Data</span>
                <md-icon style={{ fontSize: '16px' }}>
                  {groupsOpen.data ? 'expand_more' : 'chevron_right'}
                </md-icon>
              </div>
            )}
            {(groupsOpen.data || isCollapsed) && renderNavList(navItems.data)}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px',
          textAlign: isCollapsed ? 'center' : 'left',
          borderTop: '1px solid var(--md-sys-color-outline-variant)',
          color: 'var(--md-sys-color-on-surface-variant)',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}
        className="md-typescale-label-small"
      >
        {isCollapsed ? 'v1.0' : '© 2026 InkScribe AI v1.0'}
        </div>
      </aside>

      {/* Mobile Navigation Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderTop: '1px solid var(--md-sys-color-outline-variant)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 100,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
        }}
        className="mobile-nav"
      >
        {[
          { id: 'overview', label: 'Overview', icon: 'dashboard' },
          { id: 'analytics', label: 'Analytics', icon: 'bar_chart' },
          { id: 'table', label: 'All Feedback', icon: 'table_rows' },
          { id: 'analyzer', label: 'Analyzer', icon: 'document_scanner', badge: needsReviewCount > 0 },
          { id: 'integrations', label: 'Integrations', icon: 'integration_instructions' },
          { id: 'settings', label: 'Settings', icon: 'settings' }
        ].map(item => {
          const isActive = currentTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
                cursor: 'pointer',
                flex: 1,
                height: '100%',
                position: 'relative'
              }}
            >
              <div style={{
                backgroundColor: isActive ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                borderRadius: '16px',
                padding: '4px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '2px',
                transition: 'background-color var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard)'
              }}>
                <md-icon style={{ fontSize: '22px' }}>{item.icon}</md-icon>
              </div>
              <span className="md-typescale-label-small" style={{ fontWeight: isActive ? '700' : '500' }}>
                {item.label}
              </span>
              {item.badge && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '30%',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--sentiment-negative)'
                }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* Embed responsive media styles in JSX for simplicity */}
      <style>{`
        @media (min-width: 721px) {
          .mobile-nav { display: none !important; }
        }
        @media (max-width: 720px) {
          .desktop-nav { display: none !important; }
        }
      `}</style>
    </>
  );
}
