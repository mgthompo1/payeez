/**
 * Atlas Elements - Type Definitions
 *
 * Comprehensive type definitions for the Atlas payment form elements,
 * providing maximum customization and composability.
 *
 * @packageDocumentation
 */

// ============================================
// Card Brand Types
// ============================================

/**
 * Supported card brands for detection and display
 */
export type CardBrand =
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

/**
 * Card brand configuration with validation rules
 */
export interface CardBrandConfig {
  /** Display name for the card brand */
  displayName: string;
  /** Regex pattern to detect this card brand */
  pattern: RegExp;
  /** Valid card number lengths */
  lengths: number[];
  /** CVC length (3 or 4) */
  cvcLength: number;
  /** Card number format gaps (e.g., [4, 8, 12] for Visa) */
  gaps: number[];
  /** Whether this brand is supported for payments */
  supported: boolean;
}

// ============================================
// Appearance API Types
// ============================================

/**
 * Theme presets available out of the box
 */
export type ThemePreset = 'default' | 'night' | 'minimal' | 'flat' | 'modern';

/**
 * Font weight options
 */
export type FontWeight = 'normal' | 'medium' | 'bold' | '400' | '500' | '600' | '700';

/**
 * Comprehensive appearance variables for full customization
 */
export interface AppearanceVariables {
  // ---- Color Palette ----
  /** Primary brand color used for focus states and accents */
  colorPrimary?: string;
  /** Background color for inputs and containers */
  colorBackground?: string;
  /** Secondary background for nested elements */
  colorBackgroundSecondary?: string;
  /** Primary text color */
  colorText?: string;
  /** Secondary/muted text color */
  colorTextSecondary?: string;
  /** Placeholder text color */
  colorTextPlaceholder?: string;
  /** Danger/error color */
  colorDanger?: string;
  /** Success color */
  colorSuccess?: string;
  /** Warning color */
  colorWarning?: string;
  /** Icon color */
  colorIcon?: string;
  /** Icon color on hover */
  colorIconHover?: string;
  /** Card error icon color */
  colorIconCardError?: string;
  /** CVC icon color */
  colorIconCardCvc?: string;
  /** Tab icon color */
  colorIconTab?: string;
  /** Selected tab icon color */
  colorIconTabSelected?: string;

  // ---- Typography ----
  /** Primary font family */
  fontFamily?: string;
  /** Monospace font family for card numbers */
  fontFamilyMono?: string;
  /** Base font size (typically 16px) */
  fontSizeBase?: string;
  /** Extra small font size */
  fontSizeXs?: string;
  /** Small font size */
  fontSizeSm?: string;
  /** Large font size */
  fontSizeLg?: string;
  /** Extra large font size */
  fontSizeXl?: string;
  /** 2X large font size */
  fontSizeXxl?: string;
  /** Normal font weight */
  fontWeightNormal?: FontWeight;
  /** Medium font weight */
  fontWeightMedium?: FontWeight;
  /** Bold font weight */
  fontWeightBold?: FontWeight;
  /** Line height for text */
  fontLineHeight?: string;
  /** Line height for labels */
  fontLineHeightLabel?: string;
  /** Letter spacing */
  letterSpacing?: string;

  // ---- Borders ----
  /** Border radius for inputs and containers */
  borderRadius?: string;
  /** Border radius for small elements */
  borderRadiusSm?: string;
  /** Border radius for large elements */
  borderRadiusLg?: string;
  /** Border width */
  borderWidth?: string;
  /** Default border color */
  borderColor?: string;
  /** Border color on hover */
  borderColorHover?: string;
  /** Border color when focused */
  borderColorFocus?: string;
  /** Border color on error */
  borderColorError?: string;

  // ---- Spacing ----
  /** Base spacing unit */
  spacingUnit?: string;
  /** Grid row spacing */
  spacingGridRow?: string;
  /** Grid column spacing */
  spacingGridColumn?: string;
  /** Tab spacing */
  spacingTab?: string;
  /** Accordion item spacing */
  spacingAccordionItem?: string;
  /** Input padding horizontal */
  paddingInputX?: string;
  /** Input padding vertical */
  paddingInputY?: string;

  // ---- Focus States ----
  /** Box shadow on focus */
  focusBoxShadow?: string;
  /** Outline on focus */
  focusOutline?: string;
  /** Focus ring width */
  focusRingWidth?: string;
  /** Focus ring color */
  focusRingColor?: string;
  /** Focus ring offset */
  focusRingOffset?: string;

  // ---- Shadows ----
  /** Shadow for elevated elements */
  shadowSm?: string;
  /** Default shadow */
  shadow?: string;
  /** Medium shadow */
  shadowMd?: string;
  /** Large shadow */
  shadowLg?: string;

  // ---- Transitions ----
  /** Default transition duration */
  transitionDuration?: string;
  /** Transition timing function */
  transitionTimingFunction?: string;

  // ---- Card Preview ----
  /** Card preview gradient start color */
  cardPreviewGradientStart?: string;
  /** Card preview gradient end color */
  cardPreviewGradientEnd?: string;
  /** Card preview text color */
  cardPreviewTextColor?: string;
}

/**
 * CSS rules for specific element classes
 * Allows granular styling of individual components
 */
export interface AppearanceRules {
  /** Styles for the root container */
  '.atlas-container'?: React.CSSProperties;
  /** Styles for input elements */
  '.atlas-input'?: React.CSSProperties;
  /** Styles for focused inputs */
  '.atlas-input--focus'?: React.CSSProperties;
  /** Styles for invalid inputs */
  '.atlas-input--invalid'?: React.CSSProperties;
  /** Styles for disabled inputs */
  '.atlas-input--disabled'?: React.CSSProperties;
  /** Styles for labels */
  '.atlas-label'?: React.CSSProperties;
  /** Styles for error messages */
  '.atlas-error'?: React.CSSProperties;
  /** Styles for the card preview */
  '.atlas-card-preview'?: React.CSSProperties;
  /** Styles for tabs container */
  '.atlas-tabs'?: React.CSSProperties;
  /** Styles for individual tabs */
  '.atlas-tab'?: React.CSSProperties;
  /** Styles for selected tab */
  '.atlas-tab--selected'?: React.CSSProperties;
  /** Styles for accordion container */
  '.atlas-accordion'?: React.CSSProperties;
  /** Styles for accordion items */
  '.atlas-accordion-item'?: React.CSSProperties;
  /** Styles for security badge */
  '.atlas-security-badge'?: React.CSSProperties;
  /** Allow any custom class */
  [key: string]: React.CSSProperties | undefined;
}

/**
 * Complete appearance configuration
 */
export interface AtlasAppearance {
  /** Base theme preset to extend */
  theme?: ThemePreset;
  /** CSS variables to override */
  variables?: AppearanceVariables;
  /** CSS rules for specific classes */
  rules?: AppearanceRules;
  /** Labels configuration */
  labels?: 'floating' | 'above' | 'hidden';
}

// ============================================
// Layout Types
// ============================================

/**
 * Layout type for payment method selection
 */
export type LayoutType = 'tabs' | 'accordion' | 'auto';

/**
 * Tab layout configuration
 */
export interface TabsLayoutConfig {
  type: 'tabs';
  /** Whether tabs should be collapsed by default */
  defaultCollapsed?: boolean;
  /** Tab position */
  position?: 'top' | 'bottom';
}

/**
 * Accordion layout configuration
 */
export interface AccordionLayoutConfig {
  type: 'accordion';
  /** Whether to show radio buttons */
  radios?: boolean;
  /** Whether accordion items have spacing between them */
  spacedAccordionItems?: boolean;
  /** Default expanded item */
  defaultExpanded?: string;
}

/**
 * Auto layout configuration (responsive)
 */
export interface AutoLayoutConfig {
  type: 'auto';
  /** Breakpoint for switching layouts */
  breakpoint?: number;
  /** Layout for desktop */
  desktop?: 'tabs' | 'accordion';
  /** Layout for mobile */
  mobile?: 'tabs' | 'accordion';
}

/**
 * Combined layout configuration
 */
export type LayoutConfig = TabsLayoutConfig | AccordionLayoutConfig | AutoLayoutConfig;

// ============================================
// Element Types
// ============================================

/**
 * Available element types that can be mounted individually
 */
export type ElementType =
  | 'card'           // Combined card element
  | 'cardNumber'     // Card number only
  | 'cardExpiry'     // Expiry date only
  | 'cardCvc'        // CVC only
  | 'cardHolder'     // Cardholder name
  | 'postalCode'     // Postal/ZIP code
  | 'address';       // Full address

/**
 * Configuration for the Card Number Element
 */
export interface CardNumberElementOptions {
  /** Placeholder text */
  placeholder?: string;
  /** Whether to show the card brand icon */
  showIcon?: boolean;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
}

/**
 * Configuration for the Card Expiry Element
 */
export interface CardExpiryElementOptions {
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
}

/**
 * Configuration for the Card CVC Element
 */
export interface CardCvcElementOptions {
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
}

/**
 * Configuration for the combined Card Element
 */
export interface CardElementOptions {
  /** Hide the postal code field */
  hidePostalCode?: boolean;
  /** Hide the cardholder name field */
  hideCardholderName?: boolean;
  /** Icon position for card brand */
  iconPosition?: 'left' | 'right';
  /** Disabled state */
  disabled?: boolean;
  /** Show card preview */
  showCardPreview?: boolean;
}

/**
 * Configuration for the Address Element
 */
export interface AddressElementOptions {
  /** Mode for address collection */
  mode?: 'shipping' | 'billing';
  /** Countries to allow */
  allowedCountries?: string[];
  /** Default country */
  defaultCountry?: string;
  /** Fields to display */
  fields?: {
    phone?: 'always' | 'never' | 'auto';
    name?: 'always' | 'never' | 'auto';
  };
  /** Enable autocomplete */
  autocomplete?: boolean;
}

// ============================================
// Event Types
// ============================================

/**
 * Change event payload
 */
export interface ElementChangeEvent {
  /** Whether all required fields are complete and valid */
  complete: boolean;
  /** Whether all fields are empty */
  empty: boolean;
  /** Detected card brand (for card elements) */
  brand?: CardBrand;
  /** Current error if any */
  error?: ElementError;
  /** Values for each field */
  value?: {
    cardNumber?: string;
    expiry?: string;
    cvc?: string;
    postalCode?: string;
    cardholderName?: string;
  };
}

/**
 * Focus event payload
 */
export interface ElementFocusEvent {
  /** Which field was focused */
  field: string;
  /** Element type */
  elementType: ElementType;
}

/**
 * Blur event payload
 */
export interface ElementBlurEvent {
  /** Which field was blurred */
  field: string;
  /** Element type */
  elementType: ElementType;
}

/**
 * Ready event payload
 */
export interface ElementReadyEvent {
  /** Element type that is ready */
  elementType: ElementType;
}

/**
 * Error object
 */
export interface ElementError {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Field that has the error */
  field?: string;
  /** Error type */
  type?: 'validation_error' | 'api_error' | 'card_error';
}

/**
 * Token created event payload
 */
export interface TokenCreatedEvent {
  /** Token ID for the payment */
  tokenId: string;
  /** Card details (masked) */
  card: {
    brand: CardBrand;
    last4: string;
    expiryMonth: string;
    expiryYear: string;
  };
}

// ============================================
// Element Instance Types
// ============================================

/**
 * Event handler types
 */
export interface ElementEventHandlers {
  /** Called when the element is ready */
  onReady?: (event: ElementReadyEvent) => void;
  /** Called when a field value changes */
  onChange?: (event: ElementChangeEvent) => void;
  /** Called when a field gains focus */
  onFocus?: (event: ElementFocusEvent) => void;
  /** Called when a field loses focus */
  onBlur?: (event: ElementBlurEvent) => void;
  /** Called when an error occurs */
  onError?: (error: ElementError) => void;
  /** Called when tokenization succeeds */
  onSuccess?: (event: TokenCreatedEvent) => void;
  /** Called when escape key is pressed */
  onEscape?: () => void;
}

/**
 * Methods available on an element instance
 */
export interface ElementMethods {
  /** Mount the element to a DOM node */
  mount: (container: string | HTMLElement) => void;
  /** Unmount and clean up the element */
  unmount: () => void;
  /** Focus a specific field */
  focus: (field?: string) => void;
  /** Blur the currently focused field */
  blur: () => void;
  /** Clear all field values */
  clear: () => void;
  /** Update element options */
  update: (options: Partial<CardElementOptions>) => void;
  /** Trigger tokenization */
  confirm: () => Promise<TokenCreatedEvent>;
  /** Destroy the element instance */
  destroy: () => void;
}

/**
 * Complete element instance
 */
export type ElementInstance = ElementMethods & ElementEventHandlers;

// ============================================
// SDK Configuration Types
// ============================================

/**
 * Locale/language code
 */
export type Locale =
  | 'auto'
  | 'en' | 'en-US' | 'en-GB' | 'en-AU' | 'en-NZ' | 'en-CA'
  | 'es' | 'es-ES' | 'es-MX' | 'es-AR'
  | 'fr' | 'fr-FR' | 'fr-CA'
  | 'de' | 'de-DE' | 'de-AT' | 'de-CH'
  | 'it' | 'it-IT'
  | 'pt' | 'pt-BR' | 'pt-PT'
  | 'nl' | 'nl-NL' | 'nl-BE'
  | 'pl' | 'pl-PL'
  | 'ja' | 'ja-JP'
  | 'zh' | 'zh-CN' | 'zh-TW' | 'zh-HK'
  | 'ko' | 'ko-KR'
  | 'ru' | 'ru-RU'
  | 'ar' | 'ar-SA'
  | 'he' | 'he-IL'
  | 'th' | 'th-TH'
  | 'vi' | 'vi-VN'
  | 'id' | 'id-ID'
  | 'ms' | 'ms-MY'
  | 'tr' | 'tr-TR'
  | 'sv' | 'sv-SE'
  | 'da' | 'da-DK'
  | 'fi' | 'fi-FI'
  | 'nb' | 'nb-NO'
  | 'cs' | 'cs-CZ'
  | 'el' | 'el-GR'
  | 'hu' | 'hu-HU'
  | 'ro' | 'ro-RO'
  | 'sk' | 'sk-SK'
  | 'bg' | 'bg-BG'
  | 'hr' | 'hr-HR'
  | 'uk' | 'uk-UA';

/**
 * SDK initialization options
 */
export interface AtlasSDKOptions {
  /** API key for authentication */
  apiKey: string;
  /** Locale for translations */
  locale?: Locale;
  /** Custom appearance configuration */
  appearance?: AtlasAppearance;
  /** Layout configuration */
  layout?: LayoutConfig;
  /** Fonts to load */
  fonts?: Array<{
    family: string;
    src: string;
    weight?: string;
    style?: string;
  }>;
  /** Enable loader during processing */
  loader?: 'auto' | 'always' | 'never';
}

/**
 * Element creation options
 */
export interface CreateElementOptions {
  /** Element type to create */
  type: ElementType;
  /** Element-specific options */
  options?: CardElementOptions | CardNumberElementOptions | CardExpiryElementOptions | CardCvcElementOptions | AddressElementOptions;
  /** Event handlers */
  handlers?: ElementEventHandlers;
}

// ============================================
// Validation Types
// ============================================

/**
 * Field validation state
 */
export interface FieldValidation {
  /** Whether the field is valid */
  valid: boolean;
  /** Whether the field has been touched */
  touched: boolean;
  /** Whether the field is dirty (value changed) */
  dirty: boolean;
  /** Current error message if invalid */
  error?: string;
  /** Error code if invalid */
  errorCode?: string;
}

/**
 * Form validation state
 */
export interface FormValidation {
  /** Whether the entire form is valid */
  valid: boolean;
  /** Whether all required fields are complete */
  complete: boolean;
  /** Individual field validations */
  fields: {
    cardNumber?: FieldValidation;
    expiry?: FieldValidation;
    cvc?: FieldValidation;
    cardholderName?: FieldValidation;
    postalCode?: FieldValidation;
  };
}
