# Atlas Elements

A modern, composable, PSP-agnostic payment form library with full customization support.

## Features

- **Composable Architecture**: Use individual elements or the combined CardElement
- **40+ Appearance Variables**: Full control over styling
- **5 Theme Presets**: Default, Night, Minimal, Flat, Modern
- **WCAG Accessibility**: Full ARIA support with keyboard navigation
- **i18n Support**: 40+ locales with RTL support
- **Layout Components**: Tabs and Accordion for multiple payment methods

## Installation

```bash
npm install @atlas/elements
# or
yarn add @atlas/elements
# or
pnpm add @atlas/elements
```

## Quick Start

### Combined CardElement

The simplest way to collect card details:

```tsx
import { CardElement } from '@atlas/elements';

function PaymentForm() {
  const handleChange = (event) => {
    if (event.complete) {
      console.log('Card details complete:', event.value);
      console.log('Card brand:', event.brand);
    }
    if (event.error) {
      console.error('Validation error:', event.error.message);
    }
  };

  return (
    <CardElement
      appearance={{ theme: 'modern' }}
      locale="en"
      onChange={handleChange}
      layout="row" // or "stacked"
      showCardholderName
    />
  );
}
```

### Composable Elements

For maximum control, use individual elements:

```tsx
import {
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  CardholderElement,
} from '@atlas/elements';

function CustomPaymentForm() {
  const [brand, setBrand] = useState('unknown');

  const appearance = {
    theme: 'default',
    variables: {
      colorPrimary: '#0066ff',
      borderRadius: '8px',
    },
  };

  return (
    <div className="payment-form">
      <CardholderElement
        appearance={appearance}
        placeholder="John Doe"
      />

      <CardNumberElement
        appearance={appearance}
        onChange={(e) => setBrand(e.brand)}
        showIcon
        iconPosition="right"
      />

      <div className="row">
        <CardExpiryElement appearance={appearance} />
        <CardCvcElement
          appearance={appearance}
          cardBrand={brand} // Pass brand for 3/4 digit CVC
        />
      </div>
    </div>
  );
}
```

## Components

### CardElement

Combined card input with all fields.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `layout` | `'row' \| 'stacked'` | `'row'` | Field layout style |
| `showCardholderName` | `boolean` | `false` | Show cardholder name field |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `locale` | `Locale` | `'auto'` | Locale for translations |
| `disabled` | `boolean` | `false` | Disable all inputs |
| `onChange` | `(event) => void` | - | Called on any field change |
| `onFocus` | `(field) => void` | - | Called when a field gains focus |
| `onBlur` | `(field) => void` | - | Called when a field loses focus |
| `onReady` | `() => void` | - | Called when all elements are ready |

### CardNumberElement

Card number input with brand detection.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showIcon` | `boolean` | `true` | Show card brand icon |
| `iconPosition` | `'left' \| 'right'` | `'right'` | Icon position |
| `placeholder` | `string` | Auto (i18n) | Custom placeholder |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `locale` | `Locale` | `'auto'` | Locale for translations |

**Ref Methods:**
- `focus()` - Focus the input
- `blur()` - Blur the input
- `clear()` - Clear the value
- `getValue()` - Get card number (digits only)
- `getBrand()` - Get detected card brand
- `isValid()` - Check if valid
- `isComplete()` - Check if complete

### CardExpiryElement

Expiry date input (MM/YY format).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | `string` | Auto (i18n) | Custom placeholder |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `locale` | `Locale` | `'auto'` | Locale for translations |

### CardCvcElement

CVC/CVV input with automatic 3/4 digit handling.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `cardBrand` | `CardBrand` | - | Card brand for CVC length |
| `showIcon` | `boolean` | `true` | Show CVC icon |
| `placeholder` | `string` | Auto (i18n) | Custom placeholder |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `locale` | `Locale` | `'auto'` | Locale for translations |

### CardholderElement

Cardholder name input.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | `string` | Auto (i18n) | Custom placeholder |
| `appearance` | `AppearanceConfig` | `{}` | Theme and styling |
| `locale` | `Locale` | `'auto'` | Locale for translations |

## Layout Components

### TabsLayout

Organize payment methods with tabs.

```tsx
import { TabsLayout, CardElement } from '@atlas/elements';

function PaymentMethods() {
  const [activeTab, setActiveTab] = useState('card');

  return (
    <TabsLayout
      tabs={[
        { id: 'card', label: 'Card', icon: <CreditCardIcon /> },
        { id: 'bank', label: 'Bank Transfer', icon: <BankIcon /> },
        { id: 'wallet', label: 'Wallet', icon: <WalletIcon /> },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      variant="pills" // 'default', 'pills', 'underline'
    >
      {activeTab === 'card' && <CardElement />}
      {activeTab === 'bank' && <BankTransferForm />}
      {activeTab === 'wallet' && <WalletForm />}
    </TabsLayout>
  );
}
```

### AccordionLayout

Organize payment methods with an accordion (radio-style selection).

```tsx
import { AccordionLayout, CardElement } from '@atlas/elements';

function PaymentMethods() {
  const [activeMethod, setActiveMethod] = useState('card');

  return (
    <AccordionLayout
      items={[
        {
          id: 'card',
          label: 'Credit or Debit Card',
          description: 'Visa, Mastercard, Amex, and more',
          icon: <CreditCardIcon />,
          content: <CardElement />,
        },
        {
          id: 'bank',
          label: 'Bank Transfer',
          description: 'Pay directly from your bank account',
          icon: <BankIcon />,
          content: <BankTransferForm />,
        },
      ]}
      activeItem={activeMethod}
      onItemChange={setActiveMethod}
      variant="bordered" // 'default', 'bordered', 'separated'
    />
  );
}
```

## Theming

### Theme Presets

Five built-in presets:

```tsx
// Default - Clean, modern look
<CardElement appearance={{ theme: 'default' }} />

// Night - Dark mode
<CardElement appearance={{ theme: 'night' }} />

// Minimal - Subtle, lightweight
<CardElement appearance={{ theme: 'minimal' }} />

// Flat - No shadows, flat design
<CardElement appearance={{ theme: 'flat' }} />

// Modern - Contemporary appearance
<CardElement appearance={{ theme: 'modern' }} />
```

### Custom Variables

Override any of the 40+ variables:

```tsx
<CardElement
  appearance={{
    theme: 'default',
    variables: {
      // Colors
      colorPrimary: '#0066ff',
      colorBackground: '#ffffff',
      colorText: '#1a1a1a',
      colorTextSecondary: '#6b7280',
      colorDanger: '#dc2626',
      colorSuccess: '#16a34a',

      // Typography
      fontFamily: '"Inter", system-ui, sans-serif',
      fontFamilyMono: '"JetBrains Mono", monospace',
      fontSizeBase: '16px',
      fontSizeSm: '14px',
      fontSizeLg: '18px',
      fontWeightNormal: 400,
      fontWeightMedium: 500,
      fontWeightBold: 600,
      fontLineHeight: 1.5,

      // Borders
      borderRadius: '8px',
      borderWidth: '1px',
      borderColor: '#e5e7eb',
      borderColorFocus: '#0066ff',
      borderColorError: '#dc2626',

      // Shadows
      focusBoxShadow: '0 0 0 3px rgba(0, 102, 255, 0.15)',
      shadowSm: '0 1px 2px rgba(0, 0, 0, 0.05)',
      shadowMd: '0 4px 6px rgba(0, 0, 0, 0.1)',

      // Spacing
      spacingUnit: '16px',
      paddingInputX: '12px',
      paddingInputY: '10px',

      // Transitions
      transitionDuration: '150ms',
      transitionTimingFunction: 'ease-in-out',
    },
  }}
/>
```

### Programmatic Theming

```tsx
import { getTheme, mergeTheme, applyTheme } from '@atlas/elements';

// Get a preset theme
const nightTheme = getTheme('night');

// Merge with custom overrides
const customTheme = mergeTheme('default', {
  colorPrimary: '#8b5cf6',
  borderRadius: '12px',
});

// Apply as CSS variables
applyTheme(customTheme, document.body);
```

## Internationalization

### Automatic Locale Detection

```tsx
// Auto-detect from browser
<CardElement locale="auto" />
```

### Explicit Locale

```tsx
// Set specific locale
<CardElement locale="es" /> // Spanish
<CardElement locale="fr" /> // French
<CardElement locale="de" /> // German
<CardElement locale="ja" /> // Japanese
<CardElement locale="zh" /> // Chinese
```

### Supported Locales

40+ locales including:
- English (en, en-US, en-GB, en-AU)
- Spanish (es, es-ES, es-MX)
- French (fr, fr-FR, fr-CA)
- German (de, de-DE, de-AT)
- Portuguese (pt, pt-BR, pt-PT)
- Italian (it)
- Dutch (nl)
- Japanese (ja)
- Chinese (zh, zh-CN, zh-TW)
- Arabic (ar) - RTL support
- Hebrew (he) - RTL support
- And many more...

### Custom Translations

```tsx
import { getTranslations, createTranslator } from '@atlas/elements';

// Get all translations for a locale
const translations = getTranslations('es');
console.log(translations.placeholders.cardNumber); // "Número de tarjeta"

// Create a translator function
const t = createTranslator('fr');
console.log(t('errors.invalidNumber')); // "Le numéro de carte est invalide"
```

## Accessibility

All elements include full WCAG 2.1 AA compliance:

- Semantic HTML with proper roles
- ARIA labels and descriptions
- Keyboard navigation (Tab, Shift+Tab, Arrow keys)
- Focus management and visible focus states
- Screen reader announcements for errors
- High contrast support
- Reduced motion support

### ARIA Attributes

```html
<!-- Card Number Input -->
<input
  role="textbox"
  aria-label="Card number"
  aria-required="true"
  aria-invalid="false"
  aria-describedby="error-id"
/>

<!-- Error Message -->
<div role="alert" aria-live="polite">
  Your card number is invalid.
</div>
```

## Card Brand Detection

Automatic detection for 15+ card networks:

| Brand | Prefix Pattern |
|-------|---------------|
| Visa | 4 |
| Mastercard | 51-55, 22-27 |
| Amex | 34, 37 |
| Discover | 6011, 65, 644-649 |
| Diners | 36, 38, 300-305 |
| JCB | 35 |
| UnionPay | 62 |
| Maestro | 5018, 5020, 5038, 6304, 6759 |
| Elo | 4011, 4312, 5066, 509, 636297 |
| MIR | 2200-2204 |
| Hiper | 637095, 637568, 637599 |
| Hipercard | 3841, 606282 |
| Cartes Bancaires | Co-branded with Visa/MC |

## Validation

Built-in validation includes:

- **Card Number**: Luhn algorithm, length validation, brand-specific rules
- **Expiry**: MM/YY format, expired card detection
- **CVC**: 3 digits (4 for Amex)
- **Cardholder**: Name format validation

### Change Event

```tsx
interface ElementChangeEvent {
  complete: boolean;          // All validation passed
  empty: boolean;             // Field is empty
  brand?: CardBrand;          // Detected card brand
  error?: {
    message: string;          // User-friendly error
    code: string;             // Error code
    field: string;            // Field name
  };
  value: {
    cardNumber?: string;
    expiry?: string;
    cvc?: string;
    cardholderName?: string;
  };
}
```

## Best Practices

1. **Use the combined CardElement** for simple forms
2. **Use composable elements** when you need custom layouts
3. **Pass the card brand** to CardCvcElement for correct digit count
4. **Set explicit locale** for consistent UX
5. **Handle all error states** for better user feedback
6. **Test with keyboard** to ensure accessibility
7. **Use theme presets** as a starting point, then customize

## Examples

### Modern Checkout

```tsx
import { CardElement } from '@atlas/elements';

<CardElement
  appearance={{
    theme: 'modern',
    variables: {
      colorPrimary: '#635bff',
    },
  }}
  layout="row"
  showCardholderName
/>
```

### Dark Mode Form

```tsx
import { CardElement } from '@atlas/elements';

<CardElement
  appearance={{
    theme: 'night',
    variables: {
      colorBackground: '#0f172a',
      colorText: '#f1f5f9',
      colorPrimary: '#38bdf8',
    },
  }}
/>
```

### Multi-Method with Accordion

```tsx
import { AccordionLayout, CardElement } from '@atlas/elements';

<AccordionLayout
  items={[
    {
      id: 'card',
      label: 'Pay with Card',
      content: <CardElement showCardholderName />,
    },
    {
      id: 'paypal',
      label: 'PayPal',
      content: <PayPalButton />,
    },
  ]}
  variant="separated"
/>
```
