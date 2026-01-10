/**
 * Atlas Elements
 *
 * A modern, composable, PSP-agnostic payment form library
 * with full customization support.
 *
 * Features:
 * - Composable elements (CardNumber, Expiry, CVC, etc.)
 * - Combined CardElement for convenience
 * - 40+ appearance variables
 * - 5 built-in theme presets
 * - Full WCAG accessibility (ARIA)
 * - i18n support for 40+ locales
 * - Layout components (Tabs, Accordion)
 *
 * @example
 * ```tsx
 * import {
 *   CardElement,
 *   CardNumberElement,
 *   CardExpiryElement,
 *   CardCvcElement,
 *   TabsLayout,
 *   getTheme,
 * } from '@atlas/elements';
 *
 * // Combined element
 * <CardElement
 *   appearance={{ theme: 'modern', variables: { colorPrimary: '#0066ff' } }}
 *   locale="en"
 *   onChange={(e) => console.log(e.complete)}
 * />
 *
 * // Composable elements
 * <CardNumberElement onChange={(e) => setBrand(e.brand)} />
 * <CardExpiryElement />
 * <CardCvcElement cardBrand={brand} />
 * ```
 *
 * @packageDocumentation
 */

// ============================================
// Components
// ============================================

export {
  // Individual Elements
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  CardholderElement,
  // Combined Element
  CardElement,
  // Icons
  CardBrandIcon,
  // Layouts
  TabsLayout,
  AccordionLayout,
} from './components';

export type {
  // Element Props & Refs
  CardNumberElementProps,
  CardNumberElementRef,
  CardExpiryElementProps,
  CardExpiryElementRef,
  CardCvcElementProps,
  CardCvcElementRef,
  CardholderElementProps,
  CardholderElementRef,
  CardElementProps,
  CardElementRef,
  // Layout Types
  TabsLayoutProps,
  Tab,
  AccordionLayoutProps,
  AccordionItem,
} from './components';

// ============================================
// Types
// ============================================

export type {
  // Card Types
  CardBrand,
  // Element Options
  CardNumberElementOptions,
  CardExpiryElementOptions,
  CardCvcElementOptions,
  CardElementOptions,
  // Events
  ElementChangeEvent,
  ElementError,
  // Appearance
  AppearanceVariables,
  ThemePreset,
  AppearanceConfig,
  // Layout
  LayoutType,
  LayoutConfig,
  // Locale
  Locale,
  SupportedLocale,
} from './lib/types';

// ============================================
// Theming
// ============================================

export {
  getTheme,
  mergeTheme,
  themeToCSSVars,
  applyTheme,
  resolveTheme,
  themes,
  THEME_PRESETS,
} from './lib/themes';

export type { ResolvedTheme } from './lib/themes';

// ============================================
// i18n
// ============================================

export {
  getTranslations,
  detectLocale,
  t,
  createTranslator,
  SUPPORTED_LOCALES,
  RTL_LOCALES,
} from './lib/i18n';

export type { Translations, TranslatorFunction } from './lib/i18n';
