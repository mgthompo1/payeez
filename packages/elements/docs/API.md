# Atlas Elements API Reference

Complete API documentation for all exports from `@atlas/elements`.

## Table of Contents

- [Components](#components)
  - [CardElement](#cardelement)
  - [CardNumberElement](#cardnumberelement)
  - [CardExpiryElement](#cardexpiryelement)
  - [CardCvcElement](#cardcvcelement)
  - [CardholderElement](#cardholderelement)
  - [CardBrandIcon](#cardbrandicon)
  - [TabsLayout](#tabslayout)
  - [AccordionLayout](#accordionlayout)
- [Types](#types)
- [Theming Functions](#theming-functions)
- [i18n Functions](#i18n-functions)

---

## Components

### CardElement

Combined card input element with all fields.

```tsx
import { CardElement, CardElementRef } from '@atlas/elements';
```

#### Props: CardElementProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `layout` | `'row' \| 'stacked'` | `'row'` | Layout style for expiry/CVC fields |
| `showCardholderName` | `boolean` | `false` | Show cardholder name field |
| `hidePostalCode` | `boolean` | `true` | Hide postal code (always hidden) |
| `iconPosition` | `'left' \| 'right'` | `'right'` | Card brand icon position |
| `disabled` | `boolean` | `false` | Disable all inputs |
| `locale` | `Locale` | `'auto'` | Locale for translations |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling configuration |
| `id` | `string` | Auto-generated | ID prefix for elements |
| `className` | `string` | - | CSS class name |
| `onChange` | `(event: ElementChangeEvent) => void` | - | Called on any field change |
| `onFocus` | `(field: 'cardNumber' \| 'expiry' \| 'cvc' \| 'cardholderName') => void` | - | Called when field gains focus |
| `onBlur` | `(field: 'cardNumber' \| 'expiry' \| 'cvc' \| 'cardholderName') => void` | - | Called when field loses focus |
| `onReady` | `() => void` | - | Called when all elements are ready |
| `onEscape` | `() => void` | - | Called when Escape key is pressed |

#### Ref: CardElementRef

| Method | Return Type | Description |
|--------|-------------|-------------|
| `focus()` | `void` | Focus the card number input |
| `blur()` | `void` | Blur all inputs |
| `clear()` | `void` | Clear all inputs |
| `getValue()` | `{ cardNumber, expiry, cvc, cardholderName?, brand }` | Get all values |
| `isValid()` | `boolean` | Check if all fields are valid |
| `isComplete()` | `boolean` | Check if all fields are complete |
| `getBrand()` | `CardBrand` | Get detected card brand |

---

### CardNumberElement

Card number input with brand detection and formatting.

```tsx
import { CardNumberElement, CardNumberElementRef } from '@atlas/elements';
```

#### Props: CardNumberElementProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `placeholder` | `string` | i18n | Custom placeholder text |
| `showIcon` | `boolean` | `true` | Show card brand icon |
| `iconPosition` | `'left' \| 'right'` | `'right'` | Icon position |
| `disabled` | `boolean` | `false` | Disable input |
| `readOnly` | `boolean` | `false` | Make input read-only |
| `locale` | `Locale` | `'auto'` | Locale for translations |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `id` | `string` | Auto-generated | Element ID |
| `className` | `string` | - | CSS class name |
| `onChange` | `(event: ElementChangeEvent) => void` | - | Called on change |
| `onFocus` | `() => void` | - | Called on focus |
| `onBlur` | `() => void` | - | Called on blur |
| `onReady` | `() => void` | - | Called when ready |
| `onEscape` | `() => void` | - | Called on Escape key |

#### Ref: CardNumberElementRef

| Method | Return Type | Description |
|--------|-------------|-------------|
| `focus()` | `void` | Focus the input |
| `blur()` | `void` | Blur the input |
| `clear()` | `void` | Clear the value |
| `getValue()` | `string` | Get card number (digits only) |
| `getBrand()` | `CardBrand` | Get detected card brand |
| `isValid()` | `boolean` | Check if valid (Luhn + length) |
| `isComplete()` | `boolean` | Check if complete |

---

### CardExpiryElement

Expiry date input with MM/YY formatting.

```tsx
import { CardExpiryElement, CardExpiryElementRef } from '@atlas/elements';
```

#### Props: CardExpiryElementProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `placeholder` | `string` | i18n | Custom placeholder text |
| `disabled` | `boolean` | `false` | Disable input |
| `readOnly` | `boolean` | `false` | Make input read-only |
| `locale` | `Locale` | `'auto'` | Locale for translations |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `id` | `string` | Auto-generated | Element ID |
| `className` | `string` | - | CSS class name |
| `onChange` | `(event: ElementChangeEvent) => void` | - | Called on change |
| `onFocus` | `() => void` | - | Called on focus |
| `onBlur` | `() => void` | - | Called on blur |
| `onReady` | `() => void` | - | Called when ready |
| `onEscape` | `() => void` | - | Called on Escape key |

#### Ref: CardExpiryElementRef

| Method | Return Type | Description |
|--------|-------------|-------------|
| `focus()` | `void` | Focus the input |
| `blur()` | `void` | Blur the input |
| `clear()` | `void` | Clear the value |
| `getValue()` | `string` | Get expiry (MM/YY format) |
| `isValid()` | `boolean` | Check if valid and not expired |
| `isComplete()` | `boolean` | Check if complete |

---

### CardCvcElement

CVC/CVV input with automatic 3/4 digit handling.

```tsx
import { CardCvcElement, CardCvcElementRef } from '@atlas/elements';
```

#### Props: CardCvcElementProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `cardBrand` | `CardBrand` | - | Card brand to determine CVC length (4 for Amex) |
| `placeholder` | `string` | i18n | Custom placeholder text |
| `showIcon` | `boolean` | `true` | Show CVC icon |
| `disabled` | `boolean` | `false` | Disable input |
| `readOnly` | `boolean` | `false` | Make input read-only |
| `locale` | `Locale` | `'auto'` | Locale for translations |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `id` | `string` | Auto-generated | Element ID |
| `className` | `string` | - | CSS class name |
| `onChange` | `(event: ElementChangeEvent) => void` | - | Called on change |
| `onFocus` | `() => void` | - | Called on focus |
| `onBlur` | `() => void` | - | Called on blur |
| `onReady` | `() => void` | - | Called when ready |
| `onEscape` | `() => void` | - | Called on Escape key |

#### Ref: CardCvcElementRef

| Method | Return Type | Description |
|--------|-------------|-------------|
| `focus()` | `void` | Focus the input |
| `blur()` | `void` | Blur the input |
| `clear()` | `void` | Clear the value |
| `getValue()` | `string` | Get CVC value |
| `isValid()` | `boolean` | Check if valid |
| `isComplete()` | `boolean` | Check if complete |

---

### CardholderElement

Cardholder name input.

```tsx
import { CardholderElement, CardholderElementRef } from '@atlas/elements';
```

#### Props: CardholderElementProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `placeholder` | `string` | i18n | Custom placeholder text |
| `disabled` | `boolean` | `false` | Disable input |
| `readOnly` | `boolean` | `false` | Make input read-only |
| `locale` | `Locale` | `'auto'` | Locale for translations |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `id` | `string` | Auto-generated | Element ID |
| `className` | `string` | - | CSS class name |
| `onChange` | `(event: ElementChangeEvent) => void` | - | Called on change |
| `onFocus` | `() => void` | - | Called on focus |
| `onBlur` | `() => void` | - | Called on blur |
| `onReady` | `() => void` | - | Called when ready |
| `onEscape` | `() => void` | - | Called on Escape key |

#### Ref: CardholderElementRef

| Method | Return Type | Description |
|--------|-------------|-------------|
| `focus()` | `void` | Focus the input |
| `blur()` | `void` | Blur the input |
| `clear()` | `void` | Clear the value |
| `getValue()` | `string` | Get cardholder name |
| `isValid()` | `boolean` | Check if valid |
| `isComplete()` | `boolean` | Check if complete |

---

### CardBrandIcon

SVG icon component for card brands.

```tsx
import { CardBrandIcon } from '@atlas/elements';
```

#### Props

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `brand` | `CardBrand` | Required | Card brand to display |
| `size` | `number` | `32` | Icon size in pixels |
| `className` | `string` | - | CSS class name |

---

### TabsLayout

Tabbed layout for multiple payment methods.

```tsx
import { TabsLayout, Tab } from '@atlas/elements';
```

#### Props: TabsLayoutProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tabs` | `Tab[]` | Required | Array of tab configurations |
| `activeTab` | `string` | - | Controlled active tab ID |
| `defaultTab` | `string` | First tab | Default active tab (uncontrolled) |
| `onTabChange` | `(tabId: string) => void` | - | Called when tab changes |
| `children` | `ReactNode` | Required | Tab content |
| `locale` | `Locale` | `'auto'` | Locale for translations |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `className` | `string` | - | CSS class name |
| `variant` | `'default' \| 'pills' \| 'underline'` | `'default'` | Visual style |

#### Tab Interface

```tsx
interface Tab {
  id: string;           // Unique identifier
  label: string;        // Display label
  icon?: ReactNode;     // Optional icon
  disabled?: boolean;   // Disable tab
}
```

---

### AccordionLayout

Accordion layout for payment method selection.

```tsx
import { AccordionLayout, AccordionItem } from '@atlas/elements';
```

#### Props: AccordionLayoutProps

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `AccordionItem[]` | Required | Array of item configurations |
| `activeItem` | `string` | - | Controlled active item ID |
| `defaultItem` | `string` | First item | Default active item (uncontrolled) |
| `onItemChange` | `(itemId: string) => void` | - | Called when selection changes |
| `multiple` | `boolean` | `false` | Allow multiple open items |
| `locale` | `Locale` | `'auto'` | Locale for translations |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `className` | `string` | - | CSS class name |
| `variant` | `'default' \| 'bordered' \| 'separated'` | `'default'` | Visual style |

#### AccordionItem Interface

```tsx
interface AccordionItem {
  id: string;              // Unique identifier
  label: string;           // Display label
  description?: string;    // Optional description
  icon?: ReactNode;        // Optional icon
  content: ReactNode;      // Panel content
  disabled?: boolean;      // Disable item
}
```

---

## Types

### CardBrand

```tsx
type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'diners'
  | 'jcb'
  | 'unionpay'
  | 'maestro'
  | 'elo'
  | 'mir'
  | 'hiper'
  | 'hipercard'
  | 'cartes_bancaires'
  | 'unknown';
```

### ElementChangeEvent

```tsx
interface ElementChangeEvent {
  complete: boolean;      // All validation passed
  empty: boolean;         // Field is empty
  brand?: CardBrand;      // Detected card brand
  error?: ElementError;   // Validation error
  value: {
    cardNumber?: string;
    expiry?: string;
    cvc?: string;
    cardholderName?: string;
  };
}
```

### ElementError

```tsx
interface ElementError {
  message: string;        // User-friendly message
  code: string;           // Error code
  field: string;          // Field name
}
```

### AppearanceConfig

```tsx
interface AppearanceConfig {
  theme?: ThemePreset;
  variables?: Partial<AppearanceVariables>;
}

type ThemePreset = 'default' | 'night' | 'minimal' | 'flat' | 'modern';
```

### AppearanceVariables

```tsx
interface AppearanceVariables {
  // Colors
  colorPrimary: string;
  colorBackground: string;
  colorBackgroundSecondary: string;
  colorText: string;
  colorTextSecondary: string;
  colorTextPlaceholder: string;
  colorDanger: string;
  colorSuccess: string;
  colorWarning: string;
  colorLabel: string;
  colorIcon: string;
  colorIconCardBrand: string;
  colorIconCardCvc: string;

  // Typography
  fontFamily: string;
  fontFamilyMono: string;
  fontSizeBase: string;
  fontSizeSm: string;
  fontSizeLg: string;
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightBold: number;
  fontLineHeight: number;

  // Borders
  borderRadius: string;
  borderWidth: string;
  borderColor: string;
  borderColorFocus: string;
  borderColorError: string;

  // Shadows
  focusBoxShadow: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;

  // Spacing
  spacingUnit: string;
  paddingInputX: string;
  paddingInputY: string;

  // Transitions
  transitionDuration: string;
  transitionTimingFunction: string;
}
```

### Locale

```tsx
type Locale = 'auto' | SupportedLocale;

type SupportedLocale =
  | 'en' | 'en-US' | 'en-GB' | 'en-AU'
  | 'es' | 'es-ES' | 'es-MX' | 'es-AR'
  | 'fr' | 'fr-FR' | 'fr-CA'
  | 'de' | 'de-DE' | 'de-AT' | 'de-CH'
  | 'pt' | 'pt-BR' | 'pt-PT'
  | 'it'
  | 'nl'
  | 'ja'
  | 'ko'
  | 'zh' | 'zh-CN' | 'zh-TW'
  | 'ar'
  | 'he'
  | 'ru'
  | 'pl'
  | 'tr'
  | 'th'
  | 'vi'
  | 'id'
  | 'ms'
  | 'fil'
  | 'hi'
  | 'bn'
  | 'sv'
  | 'no'
  | 'da'
  | 'fi'
  | 'cs'
  | 'sk'
  | 'ro'
  | 'hu'
  | 'el'
  | 'bg'
  | 'uk'
  | 'hr'
  | 'sl';
```

---

## Theming Functions

### getTheme

Get a preset theme configuration.

```tsx
import { getTheme } from '@atlas/elements';

const theme = getTheme('night');
// Returns: AppearanceVariables
```

### mergeTheme

Merge a preset with custom variables.

```tsx
import { mergeTheme } from '@atlas/elements';

const customTheme = mergeTheme('default', {
  colorPrimary: '#8b5cf6',
  borderRadius: '12px',
});
// Returns: AppearanceVariables
```

### themeToCSSVars

Convert theme to CSS custom properties.

```tsx
import { themeToCSSVars } from '@atlas/elements';

const cssVars = themeToCSSVars(theme);
// Returns: Record<string, string>
// { '--atlas-color-primary': '#0066ff', ... }
```

### applyTheme

Apply theme as CSS variables to an element.

```tsx
import { applyTheme } from '@atlas/elements';

applyTheme(theme, document.body);
// Sets CSS custom properties on the element
```

### resolveTheme

Internal function to resolve appearance config to full theme.

```tsx
import { resolveTheme } from '@atlas/elements';

const resolved = resolveTheme({
  theme: 'modern',
  variables: { colorPrimary: '#ff0000' },
});
// Returns: ResolvedTheme
```

### themes / THEME_PRESETS

Access all preset themes.

```tsx
import { themes, THEME_PRESETS } from '@atlas/elements';

// themes.default, themes.night, etc.
// THEME_PRESETS = ['default', 'night', 'minimal', 'flat', 'modern']
```

---

## i18n Functions

### getTranslations

Get all translations for a locale.

```tsx
import { getTranslations } from '@atlas/elements';

const t = getTranslations('es');
console.log(t.placeholders.cardNumber); // "Número de tarjeta"
```

### detectLocale

Detect locale from browser settings.

```tsx
import { detectLocale } from '@atlas/elements';

const locale = detectLocale();
// Returns: SupportedLocale (e.g., 'en-US')
```

### t

Translate a single key.

```tsx
import { t } from '@atlas/elements';

const message = t('errors.invalidNumber', 'fr');
// Returns: "Le numéro de carte est invalide"
```

### createTranslator

Create a bound translator function.

```tsx
import { createTranslator } from '@atlas/elements';

const translate = createTranslator('de');
console.log(translate('labels.cardNumber'));
// Returns: "Kartennummer"
```

### Constants

```tsx
import { SUPPORTED_LOCALES, RTL_LOCALES } from '@atlas/elements';

// SUPPORTED_LOCALES = ['en', 'en-US', 'en-GB', ...]
// RTL_LOCALES = ['ar', 'he']
```

### Translations Interface

```tsx
interface Translations {
  labels: {
    cardNumber: string;
    expiry: string;
    cvc: string;
    cardholderName: string;
    postalCode: string;
  };
  placeholders: {
    cardNumber: string;
    expiryDate: string;
    cvc: string;
    cvc4: string;
    cardholderName: string;
    postalCode: string;
  };
  errors: {
    required: string;
    invalidNumber: string;
    incompleteNumber: string;
    invalidExpiry: string;
    incompleteExpiry: string;
    expiredCard: string;
    invalidCvc: string;
    incompleteCvc: string;
    invalidName: string;
    invalidPostal: string;
  };
  aria: {
    cardNumberInput: string;
    expiryInput: string;
    cvcInput: string;
    cardholderInput: string;
    showPassword: string;
    hidePassword: string;
  };
  ui: {
    payWith: string;
    orPayWith: string;
    securePayment: string;
    poweredBy: string;
  };
}
```
