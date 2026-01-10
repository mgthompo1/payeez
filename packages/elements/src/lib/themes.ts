/**
 * Atlas Elements - Theme Presets
 *
 * Comprehensive theme system with 5 built-in presets and 40+ CSS variables.
 * Themes can be extended and customized to match any brand.
 *
 * @example
 * ```typescript
 * import { getTheme, mergeTheme } from './themes';
 *
 * // Use a preset theme
 * const nightTheme = getTheme('night');
 *
 * // Extend a theme with custom variables
 * const customTheme = mergeTheme('default', {
 *   colorPrimary: '#8b5cf6',
 *   borderRadius: '12px',
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { AppearanceVariables, ThemePreset } from './types';

// ============================================
// Complete Theme Definitions
// ============================================

/**
 * Default theme - Clean, modern light theme
 */
export const defaultTheme: Required<AppearanceVariables> = {
  // Colors - Primary Palette
  colorPrimary: '#0570de',
  colorBackground: '#ffffff',
  colorBackgroundSecondary: '#f6f9fc',
  colorText: '#1a1f36',
  colorTextSecondary: '#6b7c93',
  colorTextPlaceholder: '#aab7c4',
  colorDanger: '#df1b41',
  colorSuccess: '#30b130',
  colorWarning: '#f5a623',

  // Colors - Icons
  colorIcon: '#6b7c93',
  colorIconHover: '#1a1f36',
  colorIconCardError: '#df1b41',
  colorIconCardCvc: '#6b7c93',
  colorIconTab: '#6b7c93',
  colorIconTabSelected: '#0570de',

  // Typography
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  fontFamilyMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSizeBase: '16px',
  fontSizeXs: '12px',
  fontSizeSm: '14px',
  fontSizeLg: '18px',
  fontSizeXl: '20px',
  fontSizeXxl: '24px',
  fontWeightNormal: '400',
  fontWeightMedium: '500',
  fontWeightBold: '600',
  fontLineHeight: '1.5',
  fontLineHeightLabel: '1.25',
  letterSpacing: 'normal',

  // Borders
  borderRadius: '6px',
  borderRadiusSm: '4px',
  borderRadiusLg: '8px',
  borderWidth: '1px',
  borderColor: '#e6e6e6',
  borderColorHover: '#c4c4c4',
  borderColorFocus: '#0570de',
  borderColorError: '#df1b41',

  // Spacing
  spacingUnit: '16px',
  spacingGridRow: '16px',
  spacingGridColumn: '12px',
  spacingTab: '12px',
  spacingAccordionItem: '12px',
  paddingInputX: '12px',
  paddingInputY: '12px',

  // Focus States
  focusBoxShadow: '0 0 0 3px rgba(5, 112, 222, 0.25)',
  focusOutline: 'none',
  focusRingWidth: '3px',
  focusRingColor: 'rgba(5, 112, 222, 0.25)',
  focusRingOffset: '0px',

  // Shadows
  shadowSm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',

  // Transitions
  transitionDuration: '150ms',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Card Preview
  cardPreviewGradientStart: '#1e293b',
  cardPreviewGradientEnd: '#0f172a',
  cardPreviewTextColor: '#ffffff',
};

/**
 * Night theme - Dark mode optimized
 */
export const nightTheme: Required<AppearanceVariables> = {
  // Colors - Primary Palette
  colorPrimary: '#7c3aed',
  colorBackground: '#0f172a',
  colorBackgroundSecondary: '#1e293b',
  colorText: '#f1f5f9',
  colorTextSecondary: '#94a3b8',
  colorTextPlaceholder: '#64748b',
  colorDanger: '#f87171',
  colorSuccess: '#4ade80',
  colorWarning: '#fbbf24',

  // Colors - Icons
  colorIcon: '#94a3b8',
  colorIconHover: '#f1f5f9',
  colorIconCardError: '#f87171',
  colorIconCardCvc: '#94a3b8',
  colorIconTab: '#94a3b8',
  colorIconTabSelected: '#7c3aed',

  // Typography
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  fontFamilyMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSizeBase: '16px',
  fontSizeXs: '12px',
  fontSizeSm: '14px',
  fontSizeLg: '18px',
  fontSizeXl: '20px',
  fontSizeXxl: '24px',
  fontWeightNormal: '400',
  fontWeightMedium: '500',
  fontWeightBold: '600',
  fontLineHeight: '1.5',
  fontLineHeightLabel: '1.25',
  letterSpacing: 'normal',

  // Borders
  borderRadius: '8px',
  borderRadiusSm: '4px',
  borderRadiusLg: '12px',
  borderWidth: '1px',
  borderColor: '#334155',
  borderColorHover: '#475569',
  borderColorFocus: '#7c3aed',
  borderColorError: '#f87171',

  // Spacing
  spacingUnit: '16px',
  spacingGridRow: '16px',
  spacingGridColumn: '12px',
  spacingTab: '12px',
  spacingAccordionItem: '12px',
  paddingInputX: '12px',
  paddingInputY: '12px',

  // Focus States
  focusBoxShadow: '0 0 0 3px rgba(124, 58, 237, 0.4)',
  focusOutline: 'none',
  focusRingWidth: '3px',
  focusRingColor: 'rgba(124, 58, 237, 0.4)',
  focusRingOffset: '0px',

  // Shadows
  shadowSm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',

  // Transitions
  transitionDuration: '150ms',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Card Preview
  cardPreviewGradientStart: '#1e1b4b',
  cardPreviewGradientEnd: '#312e81',
  cardPreviewTextColor: '#ffffff',
};

/**
 * Minimal theme - Clean, borderless design
 */
export const minimalTheme: Required<AppearanceVariables> = {
  // Colors - Primary Palette
  colorPrimary: '#18181b',
  colorBackground: '#ffffff',
  colorBackgroundSecondary: '#fafafa',
  colorText: '#18181b',
  colorTextSecondary: '#71717a',
  colorTextPlaceholder: '#a1a1aa',
  colorDanger: '#dc2626',
  colorSuccess: '#16a34a',
  colorWarning: '#ca8a04',

  // Colors - Icons
  colorIcon: '#71717a',
  colorIconHover: '#18181b',
  colorIconCardError: '#dc2626',
  colorIconCardCvc: '#71717a',
  colorIconTab: '#71717a',
  colorIconTabSelected: '#18181b',

  // Typography
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
  fontFamilyMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSizeBase: '16px',
  fontSizeXs: '12px',
  fontSizeSm: '14px',
  fontSizeLg: '18px',
  fontSizeXl: '20px',
  fontSizeXxl: '24px',
  fontWeightNormal: '400',
  fontWeightMedium: '500',
  fontWeightBold: '600',
  fontLineHeight: '1.5',
  fontLineHeightLabel: '1.25',
  letterSpacing: 'normal',

  // Borders
  borderRadius: '4px',
  borderRadiusSm: '2px',
  borderRadiusLg: '6px',
  borderWidth: '1px',
  borderColor: '#e4e4e7',
  borderColorHover: '#a1a1aa',
  borderColorFocus: '#18181b',
  borderColorError: '#dc2626',

  // Spacing
  spacingUnit: '12px',
  spacingGridRow: '12px',
  spacingGridColumn: '8px',
  spacingTab: '8px',
  spacingAccordionItem: '8px',
  paddingInputX: '10px',
  paddingInputY: '10px',

  // Focus States
  focusBoxShadow: 'none',
  focusOutline: '2px solid #18181b',
  focusRingWidth: '2px',
  focusRingColor: '#18181b',
  focusRingOffset: '2px',

  // Shadows
  shadowSm: 'none',
  shadow: 'none',
  shadowMd: 'none',
  shadowLg: 'none',

  // Transitions
  transitionDuration: '100ms',
  transitionTimingFunction: 'ease-out',

  // Card Preview
  cardPreviewGradientStart: '#f4f4f5',
  cardPreviewGradientEnd: '#e4e4e7',
  cardPreviewTextColor: '#18181b',
};

/**
 * Flat theme - No borders, soft backgrounds
 */
export const flatTheme: Required<AppearanceVariables> = {
  // Colors - Primary Palette
  colorPrimary: '#6366f1',
  colorBackground: '#f8fafc',
  colorBackgroundSecondary: '#f1f5f9',
  colorText: '#1e293b',
  colorTextSecondary: '#64748b',
  colorTextPlaceholder: '#94a3b8',
  colorDanger: '#ef4444',
  colorSuccess: '#22c55e',
  colorWarning: '#f59e0b',

  // Colors - Icons
  colorIcon: '#64748b',
  colorIconHover: '#1e293b',
  colorIconCardError: '#ef4444',
  colorIconCardCvc: '#64748b',
  colorIconTab: '#64748b',
  colorIconTabSelected: '#6366f1',

  // Typography
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  fontSizeBase: '15px',
  fontSizeXs: '11px',
  fontSizeSm: '13px',
  fontSizeLg: '17px',
  fontSizeXl: '19px',
  fontSizeXxl: '23px',
  fontWeightNormal: '400',
  fontWeightMedium: '500',
  fontWeightBold: '600',
  fontLineHeight: '1.6',
  fontLineHeightLabel: '1.3',
  letterSpacing: '-0.01em',

  // Borders
  borderRadius: '12px',
  borderRadiusSm: '8px',
  borderRadiusLg: '16px',
  borderWidth: '0px',
  borderColor: 'transparent',
  borderColorHover: 'transparent',
  borderColorFocus: 'transparent',
  borderColorError: 'transparent',

  // Spacing
  spacingUnit: '16px',
  spacingGridRow: '16px',
  spacingGridColumn: '12px',
  spacingTab: '12px',
  spacingAccordionItem: '12px',
  paddingInputX: '16px',
  paddingInputY: '14px',

  // Focus States
  focusBoxShadow: '0 0 0 4px rgba(99, 102, 241, 0.2)',
  focusOutline: 'none',
  focusRingWidth: '4px',
  focusRingColor: 'rgba(99, 102, 241, 0.2)',
  focusRingOffset: '0px',

  // Shadows
  shadowSm: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
  shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',

  // Transitions
  transitionDuration: '200ms',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Card Preview
  cardPreviewGradientStart: '#6366f1',
  cardPreviewGradientEnd: '#4f46e5',
  cardPreviewTextColor: '#ffffff',
};

/**
 * Modern theme - Contemporary, polished styling
 */
export const modernTheme: Required<AppearanceVariables> = {
  // Colors - Primary Palette
  colorPrimary: '#635bff',
  colorBackground: '#ffffff',
  colorBackgroundSecondary: '#f7f7f7',
  colorText: '#32325d',
  colorTextSecondary: '#6b7c93',
  colorTextPlaceholder: '#aab7c4',
  colorDanger: '#fa755a',
  colorSuccess: '#3ecf8e',
  colorWarning: '#f5a623',

  // Colors - Icons
  colorIcon: '#6b7c93',
  colorIconHover: '#32325d',
  colorIconCardError: '#fa755a',
  colorIconCardCvc: '#6b7c93',
  colorIconTab: '#6b7c93',
  colorIconTabSelected: '#635bff',

  // Typography
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  fontFamilyMono: '"Roboto Mono", ui-monospace, SFMono-Regular, monospace',
  fontSizeBase: '16px',
  fontSizeXs: '12px',
  fontSizeSm: '14px',
  fontSizeLg: '18px',
  fontSizeXl: '20px',
  fontSizeXxl: '24px',
  fontWeightNormal: '400',
  fontWeightMedium: '500',
  fontWeightBold: '600',
  fontLineHeight: '1.5',
  fontLineHeightLabel: '1.25',
  letterSpacing: 'normal',

  // Borders
  borderRadius: '4px',
  borderRadiusSm: '3px',
  borderRadiusLg: '6px',
  borderWidth: '1px',
  borderColor: '#e6ebf1',
  borderColorHover: '#c4c9cf',
  borderColorFocus: '#635bff',
  borderColorError: '#fa755a',

  // Spacing
  spacingUnit: '16px',
  spacingGridRow: '16px',
  spacingGridColumn: '12px',
  spacingTab: '12px',
  spacingAccordionItem: '12px',
  paddingInputX: '12px',
  paddingInputY: '10px',

  // Focus States
  focusBoxShadow: '0 0 0 1px #635bff, 0 0 0 3px rgba(99, 91, 255, 0.2)',
  focusOutline: 'none',
  focusRingWidth: '3px',
  focusRingColor: 'rgba(99, 91, 255, 0.2)',
  focusRingOffset: '0px',

  // Shadows
  shadowSm: '0 1px 1px rgba(0, 0, 0, 0.03)',
  shadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 6px rgba(0, 0, 0, 0.07)',
  shadowLg: '0 8px 16px rgba(0, 0, 0, 0.1)',

  // Transitions
  transitionDuration: '150ms',
  transitionTimingFunction: 'ease',

  // Card Preview
  cardPreviewGradientStart: '#32325d',
  cardPreviewGradientEnd: '#424770',
  cardPreviewTextColor: '#ffffff',
};

// ============================================
// Theme Registry
// ============================================

/**
 * All available theme presets
 */
export const themes: Record<ThemePreset, Required<AppearanceVariables>> = {
  default: defaultTheme,
  night: nightTheme,
  minimal: minimalTheme,
  flat: flatTheme,
  modern: modernTheme,
};

/**
 * Array of available theme preset names
 */
export const THEME_PRESETS: ThemePreset[] = ['default', 'night', 'minimal', 'flat', 'modern'];

/**
 * Type for resolved theme (all variables required)
 */
export type ResolvedTheme = Required<AppearanceVariables>;

// ============================================
// Theme Utilities
// ============================================

/**
 * Gets a theme by name
 *
 * @param name - The theme preset name
 * @returns The complete theme variables
 *
 * @example
 * ```typescript
 * const theme = getTheme('night');
 * console.log(theme.colorPrimary); // "#7c3aed"
 * ```
 */
export function getTheme(name: ThemePreset): Required<AppearanceVariables> {
  return themes[name] || themes.default;
}

/**
 * Merges custom variables with a base theme
 *
 * @param base - The base theme to extend
 * @param overrides - Custom variables to override
 * @returns The merged theme
 *
 * @example
 * ```typescript
 * const customTheme = mergeTheme('default', {
 *   colorPrimary: '#8b5cf6',
 *   borderRadius: '12px',
 * });
 * ```
 */
export function mergeTheme(
  base: ThemePreset,
  overrides: Partial<AppearanceVariables>
): Required<AppearanceVariables> {
  const baseTheme = getTheme(base);
  return { ...baseTheme, ...overrides } as Required<AppearanceVariables>;
}

/**
 * Creates CSS custom properties from theme variables
 *
 * @param theme - The theme variables
 * @param prefix - Optional prefix for CSS variable names (default: 'atlas')
 * @returns CSS custom properties object
 *
 * @example
 * ```typescript
 * const cssVars = themeToCSSVars(getTheme('default'));
 * // { '--atlas-color-primary': '#0570de', ... }
 * ```
 */
export function themeToCSSVars(
  theme: Partial<AppearanceVariables>,
  prefix = 'atlas'
): Record<string, string> {
  const cssVars: Record<string, string> = {};

  for (const [key, value] of Object.entries(theme)) {
    if (value !== undefined) {
      // Convert camelCase to kebab-case
      const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      cssVars[`--${prefix}-${kebabKey}`] = value;
    }
  }

  return cssVars;
}

/**
 * Applies theme CSS variables to a style object
 *
 * @param theme - The theme variables
 * @param existingStyles - Optional existing styles to merge with
 * @returns Style object with CSS variables
 */
export function applyTheme(
  theme: Partial<AppearanceVariables>,
  existingStyles: React.CSSProperties = {}
): React.CSSProperties {
  const cssVars = themeToCSSVars(theme);
  return { ...existingStyles, ...cssVars } as React.CSSProperties;
}

/**
 * Resolves a theme from appearance configuration
 *
 * @param appearance - The appearance configuration
 * @returns The resolved theme variables
 */
export function resolveTheme(appearance: {
  theme?: ThemePreset;
  variables?: Partial<AppearanceVariables>;
}): Required<AppearanceVariables> {
  const baseTheme = getTheme(appearance.theme || 'default');
  if (appearance.variables) {
    return { ...baseTheme, ...appearance.variables } as Required<AppearanceVariables>;
  }
  return baseTheme;
}

/**
 * Gets the contrast color (black or white) for a given background
 *
 * @param hexColor - The background color in hex format
 * @returns '#ffffff' or '#000000'
 */
export function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Generates a shade of a color
 *
 * @param hexColor - The base color in hex format
 * @param percent - Percentage to lighten (positive) or darken (negative)
 * @returns The shaded color in hex format
 */
export function shadeColor(hexColor: string, percent: number): string {
  const hex = hexColor.replace('#', '');
  const num = parseInt(hex, 16);

  let r = (num >> 16) + Math.round(2.55 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(2.55 * percent);
  let b = (num & 0x0000ff) + Math.round(2.55 * percent);

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Creates an alpha variant of a color
 *
 * @param hexColor - The color in hex format
 * @param alpha - The alpha value (0-1)
 * @returns The color in rgba format
 */
export function withAlpha(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default {
  themes,
  getTheme,
  mergeTheme,
  themeToCSSVars,
  applyTheme,
  resolveTheme,
  getContrastColor,
  shadeColor,
  withAlpha,
};
