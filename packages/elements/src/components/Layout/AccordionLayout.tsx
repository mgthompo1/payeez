/**
 * Atlas Elements - Accordion Layout
 *
 * An accordion layout component for organizing multiple payment methods
 * with accessible keyboard navigation.
 *
 * @example
 * ```tsx
 * <AccordionLayout
 *   items={[
 *     { id: 'card', label: 'Card', icon: <CardIcon />, content: <CardElement /> },
 *     { id: 'bank', label: 'Bank Transfer', icon: <BankIcon />, content: <BankElement /> },
 *   ]}
 *   activeItem="card"
 *   onItemChange={(id) => console.log(id)}
 *   appearance={appearance}
 * />
 * ```
 *
 * @packageDocumentation
 */

"use client";

import React, { useCallback, useMemo, useId, useState } from 'react';
import type { AppearanceVariables, Locale } from '../../lib/types';
import { resolveTheme } from '../../lib/themes';

// ============================================
// Types
// ============================================

export interface AccordionItem {
  /** Unique item identifier */
  id: string;
  /** Item label */
  label: string;
  /** Optional description */
  description?: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Item content */
  content: React.ReactNode;
  /** Whether the item is disabled */
  disabled?: boolean;
}

export interface AccordionLayoutProps {
  /** Array of accordion item configurations */
  items: AccordionItem[];
  /** Currently active item ID */
  activeItem?: string;
  /** Default active item (uncontrolled mode) */
  defaultItem?: string;
  /** Callback when item changes */
  onItemChange?: (itemId: string) => void;
  /** Allow multiple items open */
  multiple?: boolean;
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
  variant?: 'default' | 'bordered' | 'separated';
}

// ============================================
// Chevron Icon
// ============================================

const ChevronIcon: React.FC<{ expanded: boolean; color?: string }> = ({
  expanded,
  color = 'currentColor',
}) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      transition: 'transform 200ms ease',
    }}
  >
    <polyline points="6 9 10 13 14 9" />
  </svg>
);

// ============================================
// Component
// ============================================

export const AccordionLayout: React.FC<AccordionLayoutProps> = ({
  items,
  activeItem: controlledActiveItem,
  defaultItem,
  onItemChange,
  multiple = false,
  locale = 'auto',
  appearance = {},
  className,
  variant = 'default',
}) => {
  // Internal state for uncontrolled mode
  const [internalActiveItems, setInternalActiveItems] = useState<string[]>(
    defaultItem ? [defaultItem] : items[0]?.id ? [items[0].id] : []
  );

  // Determine if controlled or uncontrolled
  const isControlled = controlledActiveItem !== undefined;
  const activeItems = isControlled ? [controlledActiveItem] : internalActiveItems;

  // IDs for accessibility
  const generatedId = useId();
  const accordionId = `atlas-accordion-${generatedId}`;

  // Get theme
  const theme = useMemo(() => resolveTheme(appearance), [appearance]);

  // Handle item toggle
  const handleItemToggle = useCallback(
    (itemId: string, disabled?: boolean) => {
      if (disabled) return;

      if (!isControlled) {
        setInternalActiveItems((prev) => {
          if (multiple) {
            // Toggle in array
            return prev.includes(itemId)
              ? prev.filter((id) => id !== itemId)
              : [...prev, itemId];
          } else {
            // Single selection - close if already open, otherwise switch
            return prev.includes(itemId) ? [] : [itemId];
          }
        });
      }
      onItemChange?.(itemId);
    },
    [isControlled, multiple, onItemChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      const enabledItems = items.filter((item) => !item.disabled);
      const currentEnabledIndex = enabledItems.findIndex(
        (item) => item.id === items[currentIndex].id
      );

      let nextIndex = currentEnabledIndex;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          nextIndex =
            currentEnabledIndex > 0
              ? currentEnabledIndex - 1
              : enabledItems.length - 1;
          break;
        case 'ArrowDown':
          e.preventDefault();
          nextIndex =
            currentEnabledIndex < enabledItems.length - 1
              ? currentEnabledIndex + 1
              : 0;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = enabledItems.length - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleItemToggle(items[currentIndex].id, items[currentIndex].disabled);
          return;
        default:
          return;
      }

      const nextItem = enabledItems[nextIndex];
      if (nextItem) {
        const button = document.getElementById(`${accordionId}-trigger-${nextItem.id}`);
        button?.focus();
      }
    },
    [items, handleItemToggle, accordionId]
  );

  // Styles
  const containerStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: variant === 'separated' ? '12px' : '0',
  };

  const getItemStyle = (index: number, isExpanded: boolean): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      backgroundColor: theme.colorBackground,
      overflow: 'hidden',
    };

    if (variant === 'bordered' || variant === 'default') {
      baseStyle.border = `${theme.borderWidth} solid ${theme.borderColor}`;
      if (index > 0 && variant === 'default') {
        baseStyle.borderTop = 'none';
      }
      if (index === 0) {
        baseStyle.borderTopLeftRadius = theme.borderRadius;
        baseStyle.borderTopRightRadius = theme.borderRadius;
      }
      if (index === items.length - 1) {
        baseStyle.borderBottomLeftRadius = theme.borderRadius;
        baseStyle.borderBottomRightRadius = theme.borderRadius;
      }
    }

    if (variant === 'separated') {
      baseStyle.border = `${theme.borderWidth} solid ${theme.borderColor}`;
      baseStyle.borderRadius = theme.borderRadius;
    }

    return baseStyle;
  };

  const getTriggerStyle = (item: AccordionItem, isExpanded: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '16px',
    fontSize: theme.fontSizeBase,
    fontFamily: theme.fontFamily,
    fontWeight: theme.fontWeightMedium as React.CSSProperties['fontWeight'],
    color: theme.colorText,
    backgroundColor: isExpanded ? theme.colorBackgroundSecondary : 'transparent',
    border: 'none',
    cursor: item.disabled ? 'not-allowed' : 'pointer',
    opacity: item.disabled ? 0.5 : 1,
    textAlign: 'left',
    transition: `background-color ${theme.transitionDuration} ${theme.transitionTimingFunction}`,
  });

  const labelContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: theme.fontSizeSm,
    color: theme.colorTextSecondary,
    marginTop: '2px',
  };

  const contentStyle: React.CSSProperties = {
    padding: '16px',
    paddingTop: '0',
    borderTop: `${theme.borderWidth} solid ${theme.borderColor}`,
  };

  const radioStyle = (isSelected: boolean): React.CSSProperties => ({
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: `2px solid ${isSelected ? theme.colorPrimary : theme.borderColor}`,
    backgroundColor: isSelected ? theme.colorPrimary : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: `all ${theme.transitionDuration} ${theme.transitionTimingFunction}`,
  });

  const radioInnerStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#fff',
  };

  return (
    <div
      className={className}
      style={containerStyle}
      data-atlas-element="accordion-layout"
      role="group"
    >
      {items.map((item, index) => {
        const isExpanded = activeItems.includes(item.id);
        return (
          <div key={item.id} style={getItemStyle(index, isExpanded)}>
            {/* Trigger */}
            <button
              id={`${accordionId}-trigger-${item.id}`}
              aria-expanded={isExpanded}
              aria-controls={`${accordionId}-content-${item.id}`}
              aria-disabled={item.disabled}
              style={getTriggerStyle(item, isExpanded)}
              onClick={() => handleItemToggle(item.id, item.disabled)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <div style={labelContainerStyle}>
                {/* Radio indicator for single selection */}
                {!multiple && (
                  <div style={radioStyle(isExpanded)} aria-hidden="true">
                    {isExpanded && <div style={radioInnerStyle} />}
                  </div>
                )}

                {item.icon && <span aria-hidden="true">{item.icon}</span>}

                <div>
                  <div>{item.label}</div>
                  {item.description && (
                    <div style={descriptionStyle}>{item.description}</div>
                  )}
                </div>
              </div>

              {multiple && (
                <ChevronIcon expanded={isExpanded} color={theme.colorTextSecondary} />
              )}
            </button>

            {/* Content */}
            {isExpanded && (
              <div
                id={`${accordionId}-content-${item.id}`}
                role="region"
                aria-labelledby={`${accordionId}-trigger-${item.id}`}
                style={contentStyle}
              >
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

AccordionLayout.displayName = 'AccordionLayout';

export default AccordionLayout;
