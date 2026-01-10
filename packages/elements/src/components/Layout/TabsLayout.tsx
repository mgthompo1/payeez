/**
 * Atlas Elements - Tabs Layout
 *
 * A tabbed layout component for organizing multiple payment methods
 * with accessible keyboard navigation.
 *
 * @example
 * ```tsx
 * <TabsLayout
 *   tabs={[
 *     { id: 'card', label: 'Card', icon: <CardIcon /> },
 *     { id: 'bank', label: 'Bank Transfer', icon: <BankIcon /> },
 *   ]}
 *   activeTab="card"
 *   onTabChange={(id) => console.log(id)}
 *   appearance={appearance}
 * >
 *   {activeTab === 'card' && <CardElement />}
 *   {activeTab === 'bank' && <BankTransferElement />}
 * </TabsLayout>
 * ```
 *
 * @packageDocumentation
 */

"use client";

import React, { useCallback, useMemo, useId, useState } from 'react';
import type { AppearanceVariables, Locale } from '../../lib/types';
import { getTranslations } from '../../lib/i18n';
import { resolveTheme } from '../../lib/themes';

// ============================================
// Types
// ============================================

export interface Tab {
  /** Unique tab identifier */
  id: string;
  /** Tab label */
  label: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Whether the tab is disabled */
  disabled?: boolean;
}

export interface TabsLayoutProps {
  /** Array of tab configurations */
  tabs: Tab[];
  /** Currently active tab ID */
  activeTab?: string;
  /** Default active tab (uncontrolled mode) */
  defaultTab?: string;
  /** Callback when tab changes */
  onTabChange?: (tabId: string) => void;
  /** Tab content */
  children: React.ReactNode;
  /** Locale for translations */
  locale?: Locale;
  /** Appearance variables */
  appearance?: {
    theme?: 'default' | 'night' | 'minimal' | 'flat' | 'modern';
    variables?: Partial<AppearanceVariables>;
  };
  /** CSS class name */
  className?: string;
  /** Visual style variant */
  variant?: 'default' | 'pills' | 'underline';
}

// ============================================
// Component
// ============================================

export const TabsLayout: React.FC<TabsLayoutProps> = ({
  tabs,
  activeTab: controlledActiveTab,
  defaultTab,
  onTabChange,
  children,
  locale = 'auto',
  appearance = {},
  className,
  variant = 'default',
}) => {
  // Internal state for uncontrolled mode
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultTab || tabs[0]?.id || ''
  );

  // Determine if controlled or uncontrolled
  const isControlled = controlledActiveTab !== undefined;
  const activeTab = isControlled ? controlledActiveTab : internalActiveTab;

  // IDs for accessibility
  const generatedId = useId();
  const tabListId = `atlas-tabs-${generatedId}`;

  // Get theme
  const theme = useMemo(() => resolveTheme(appearance), [appearance]);

  // Handle tab selection
  const handleTabClick = useCallback(
    (tabId: string, disabled?: boolean) => {
      if (disabled) return;

      if (!isControlled) {
        setInternalActiveTab(tabId);
      }
      onTabChange?.(tabId);
    },
    [isControlled, onTabChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      const enabledTabs = tabs.filter((t) => !t.disabled);
      const currentEnabledIndex = enabledTabs.findIndex(
        (t) => t.id === tabs[currentIndex].id
      );

      let nextIndex = currentEnabledIndex;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          nextIndex =
            currentEnabledIndex > 0
              ? currentEnabledIndex - 1
              : enabledTabs.length - 1;
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nextIndex =
            currentEnabledIndex < enabledTabs.length - 1
              ? currentEnabledIndex + 1
              : 0;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = enabledTabs.length - 1;
          break;
        default:
          return;
      }

      const nextTab = enabledTabs[nextIndex];
      if (nextTab) {
        handleTabClick(nextTab.id);
        // Focus the tab button
        const button = document.getElementById(`${tabListId}-tab-${nextTab.id}`);
        button?.focus();
      }
    },
    [tabs, handleTabClick, tabListId]
  );

  // Styles
  const containerStyle: React.CSSProperties = {
    width: '100%',
  };

  const tabListStyle: React.CSSProperties = {
    display: 'flex',
    gap: variant === 'pills' ? '8px' : '0',
    borderBottom: variant === 'underline' ? `2px solid ${theme.borderColor}` : 'none',
    marginBottom: theme.spacingUnit,
    padding: variant === 'pills' ? '4px' : '0',
    backgroundColor: variant === 'pills' ? theme.colorBackgroundSecondary : 'transparent',
    borderRadius: variant === 'pills' ? theme.borderRadius : '0',
  };

  const getTabStyle = (tab: Tab, isActive: boolean): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: variant === 'pills' ? '8px 16px' : '12px 16px',
      fontSize: theme.fontSizeBase,
      fontFamily: theme.fontFamily,
      fontWeight: theme.fontWeightMedium as React.CSSProperties['fontWeight'],
      color: isActive ? theme.colorPrimary : theme.colorTextSecondary,
      backgroundColor: 'transparent',
      border: 'none',
      cursor: tab.disabled ? 'not-allowed' : 'pointer',
      opacity: tab.disabled ? 0.5 : 1,
      transition: `all ${theme.transitionDuration} ${theme.transitionTimingFunction}`,
      position: 'relative',
    };

    if (variant === 'pills' && isActive) {
      baseStyle.backgroundColor = theme.colorBackground;
      baseStyle.borderRadius = theme.borderRadius;
      baseStyle.boxShadow = theme.shadowSm;
    }

    if (variant === 'underline' && isActive) {
      baseStyle.borderBottom = `2px solid ${theme.colorPrimary}`;
      baseStyle.marginBottom = '-2px';
    }

    if (variant === 'default') {
      baseStyle.borderBottom = isActive
        ? `2px solid ${theme.colorPrimary}`
        : '2px solid transparent';
    }

    return baseStyle;
  };

  const panelStyle: React.CSSProperties = {
    padding: theme.spacingUnit,
  };

  return (
    <div className={className} style={containerStyle} data-atlas-element="tabs-layout">
      {/* Tab List */}
      <div
        role="tablist"
        aria-label="Payment methods"
        style={tabListStyle}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`${tabListId}-tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tabListId}-panel-${tab.id}`}
              aria-disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              style={getTabStyle(tab, isActive)}
              onClick={() => handleTabClick(tab.id, tab.disabled)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panel */}
      <div
        id={`${tabListId}-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`${tabListId}-tab-${activeTab}`}
        tabIndex={0}
        style={panelStyle}
      >
        {children}
      </div>
    </div>
  );
};

TabsLayout.displayName = 'TabsLayout';

export default TabsLayout;
