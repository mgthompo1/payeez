/**
 * Atlas Elements - Card Number Element
 *
 * A composable, accessible card number input with real-time validation,
 * card brand detection, and customizable styling.
 *
 * @example
 * ```tsx
 * <CardNumberElement
 *   onChange={(e) => console.log(e.brand, e.complete)}
 *   onFocus={() => console.log('focused')}
 *   appearance={appearance}
 *   locale="en"
 * />
 * ```
 *
 * @packageDocumentation
 */

"use client";

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  useMemo,
  useId,
} from 'react';
import type {
  CardBrand,
  CardNumberElementOptions,
  ElementChangeEvent,
  AppearanceVariables,
  Locale,
} from '../lib/types';
import { getTranslations, type Translations } from '../lib/i18n';
import { resolveTheme } from '../lib/themes';
import { CardBrandIcon } from './CardBrandIcon';

// ============================================
// Card Detection Patterns
// ============================================

const CARD_PATTERNS: Record<CardBrand, RegExp> = {
  visa: /^4/,
  mastercard: /^(5[1-5]|2[2-7])/,
  amex: /^3[47]/,
  discover: /^(6011|65|64[4-9])/,
  diners: /^(36|38|30[0-5])/,
  jcb: /^35/,
  unionpay: /^62/,
  maestro: /^(5018|5020|5038|6304|6759|676[1-3])/,
  elo: /^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|651|652|655)/,
  mir: /^220[0-4]/,
  hiper: /^(637095|637568|637599|637609|637612)/,
  hipercard: /^(3841|606282)/,
  cartes_bancaires: /^(4|5[1-5])/,
  unknown: /^$/,
};

const CARD_LENGTHS: Partial<Record<CardBrand, number[]>> = {
  visa: [16, 19],
  mastercard: [16],
  amex: [15],
  discover: [16, 19],
  diners: [14, 16, 19],
  jcb: [16, 19],
  unionpay: [16, 17, 18, 19],
  maestro: [12, 13, 14, 15, 16, 17, 18, 19],
  elo: [16],
  mir: [16, 17, 18, 19],
};

const CARD_GAPS: Partial<Record<CardBrand, number[]>> = {
  amex: [4, 10],
  default: [4, 8, 12],
};

// ============================================
// Validation Helpers
// ============================================

function detectCardBrand(number: string): CardBrand {
  const cleaned = number.replace(/\D/g, '');
  for (const [brand, pattern] of Object.entries(CARD_PATTERNS)) {
    if (brand !== 'unknown' && pattern.test(cleaned)) {
      return brand as CardBrand;
    }
  }
  return 'unknown';
}

function isValidLuhn(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

function formatCardNumber(value: string, brand: CardBrand): string {
  const cleaned = value.replace(/\D/g, '');
  const lengths = CARD_LENGTHS[brand] || [16];
  const maxLen = Math.max(...lengths);
  const truncated = cleaned.slice(0, maxLen);

  const gaps = CARD_GAPS[brand] || CARD_GAPS.default!;
  let formatted = '';
  let gapIndex = 0;

  for (let i = 0; i < truncated.length; i++) {
    if (gapIndex < gaps.length && i === gaps[gapIndex]) {
      formatted += ' ';
      gapIndex++;
    }
    formatted += truncated[i];
  }

  return formatted;
}

function getMaxLength(brand: CardBrand): number {
  const lengths = CARD_LENGTHS[brand] || [16];
  return Math.max(...lengths);
}

// ============================================
// Component Props
// ============================================

export interface CardNumberElementProps extends CardNumberElementOptions {
  /** Locale for translations */
  locale?: Locale;
  /** Appearance variables */
  appearance?: {
    theme?: 'default' | 'night' | 'minimal' | 'flat' | 'modern';
    variables?: Partial<AppearanceVariables>;
  };
  /** ID for the input element */
  id?: string;
  /** CSS class name */
  className?: string;
  /** Called when the value changes */
  onChange?: (event: ElementChangeEvent) => void;
  /** Called when the input gains focus */
  onFocus?: () => void;
  /** Called when the input loses focus */
  onBlur?: () => void;
  /** Called when the input is ready */
  onReady?: () => void;
  /** Called on escape key */
  onEscape?: () => void;
}

export interface CardNumberElementRef {
  /** Focus the input */
  focus: () => void;
  /** Blur the input */
  blur: () => void;
  /** Clear the input value */
  clear: () => void;
  /** Get the current value */
  getValue: () => string;
  /** Get the detected card brand */
  getBrand: () => CardBrand;
  /** Check if the input is valid */
  isValid: () => boolean;
  /** Check if the input is complete */
  isComplete: () => boolean;
}

// ============================================
// Component
// ============================================

export const CardNumberElement = forwardRef<CardNumberElementRef, CardNumberElementProps>(
  (
    {
      placeholder,
      showIcon = true,
      iconPosition = 'right',
      disabled = false,
      readOnly = false,
      locale = 'auto',
      appearance = {},
      id,
      className,
      onChange,
      onFocus,
      onBlur,
      onReady,
      onEscape,
    },
    ref
  ) => {
    // State
    const [value, setValue] = useState('');
    const [brand, setBrand] = useState<CardBrand>('unknown');
    const [isFocused, setIsFocused] = useState(false);
    const [isTouched, setIsTouched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs
    const inputRef = useRef<HTMLInputElement>(null);
    const hasNotifiedReady = useRef(false);

    // Computed values
    const generatedId = useId();
    const inputId = id || `atlas-card-number-${generatedId}`;
    const errorId = `${inputId}-error`;

    // Get translations and theme
    const t: Translations = useMemo(() => getTranslations(locale), [locale]);
    const theme = useMemo(() => resolveTheme(appearance), [appearance]);

    // Notify ready
    React.useEffect(() => {
      if (!hasNotifiedReady.current) {
        hasNotifiedReady.current = true;
        onReady?.();
      }
    }, [onReady]);

    // Validation
    const validate = useCallback(
      (cardValue: string, cardBrand: CardBrand): string | null => {
        const cleaned = cardValue.replace(/\s/g, '');

        if (!cleaned) {
          return isTouched ? t.errors.required : null;
        }

        const expectedLength = getMaxLength(cardBrand);
        if (cleaned.length < expectedLength) {
          return t.errors.incompleteNumber;
        }

        if (!isValidLuhn(cleaned)) {
          return t.errors.invalidNumber;
        }

        return null;
      },
      [t, isTouched]
    );

    // Notify change
    const notifyChange = useCallback(
      (newValue: string, newBrand: CardBrand, newError: string | null) => {
        const cleaned = newValue.replace(/\s/g, '');
        const expectedLength = getMaxLength(newBrand);
        const isComplete = cleaned.length === expectedLength && isValidLuhn(cleaned);

        onChange?.({
          complete: isComplete,
          empty: cleaned.length === 0,
          brand: newBrand,
          error: newError
            ? { message: newError, code: 'invalid_number', field: 'cardNumber' }
            : undefined,
          value: { cardNumber: cleaned },
        });
      },
      [onChange]
    );

    // Handle input change
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const detectedBrand = detectCardBrand(rawValue);
        const formatted = formatCardNumber(rawValue, detectedBrand);

        setBrand(detectedBrand);
        setValue(formatted);

        const validationError = validate(formatted, detectedBrand);
        setError(validationError);

        notifyChange(formatted, detectedBrand, validationError);
      },
      [validate, notifyChange]
    );

    // Handle focus
    const handleFocus = useCallback(() => {
      setIsFocused(true);
      onFocus?.();
    }, [onFocus]);

    // Handle blur
    const handleBlur = useCallback(() => {
      setIsFocused(false);
      setIsTouched(true);

      const validationError = validate(value, brand);
      setError(validationError);

      onBlur?.();
    }, [value, brand, validate, onBlur]);

    // Handle keydown
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          onEscape?.();
        }
      },
      [onEscape]
    );

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        clear: () => {
          setValue('');
          setBrand('unknown');
          setError(null);
          setIsTouched(false);
          notifyChange('', 'unknown', null);
        },
        getValue: () => value.replace(/\s/g, ''),
        getBrand: () => brand,
        isValid: () => !validate(value, brand),
        isComplete: () => {
          const cleaned = value.replace(/\s/g, '');
          const expectedLength = getMaxLength(brand);
          return cleaned.length === expectedLength && isValidLuhn(cleaned);
        },
      }),
      [value, brand, validate, notifyChange]
    );

    // Styles
    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
    };

    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: `${theme.paddingInputY} ${theme.paddingInputX}`,
      paddingRight: showIcon && iconPosition === 'right' ? '48px' : theme.paddingInputX,
      paddingLeft: showIcon && iconPosition === 'left' ? '48px' : theme.paddingInputX,
      fontSize: theme.fontSizeBase,
      fontFamily: theme.fontFamilyMono,
      color: theme.colorText,
      backgroundColor: theme.colorBackground,
      border: `${theme.borderWidth} solid ${
        error && isTouched
          ? theme.borderColorError
          : isFocused
          ? theme.borderColorFocus
          : theme.borderColor
      }`,
      borderRadius: theme.borderRadius,
      outline: 'none',
      transition: `border-color ${theme.transitionDuration} ${theme.transitionTimingFunction}, box-shadow ${theme.transitionDuration} ${theme.transitionTimingFunction}`,
      boxShadow: isFocused ? theme.focusBoxShadow : 'none',
      opacity: disabled ? 0.6 : 1,
      cursor: disabled ? 'not-allowed' : 'text',
      letterSpacing: '0.05em',
    };

    const iconContainerStyle: React.CSSProperties = {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      ...(iconPosition === 'left' ? { left: '12px' } : { right: '12px' }),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    };

    const errorStyle: React.CSSProperties = {
      marginTop: '4px',
      fontSize: theme.fontSizeSm,
      color: theme.colorDanger,
      lineHeight: theme.fontLineHeight,
    };

    return (
      <div className={className} style={containerStyle}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder={placeholder || t.placeholders.cardNumber}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          readOnly={readOnly}
          style={inputStyle}
          // Accessibility
          aria-label={t.aria.cardNumberInput}
          aria-invalid={!!error && isTouched}
          aria-describedby={error && isTouched ? errorId : undefined}
          aria-required="true"
          role="textbox"
          data-atlas-element="card-number"
        />

        {showIcon && (
          <div style={iconContainerStyle} aria-hidden="true">
            <CardBrandIcon brand={brand} size={32} />
          </div>
        )}

        {error && isTouched && (
          <div id={errorId} style={errorStyle} role="alert" aria-live="polite">
            {error}
          </div>
        )}
      </div>
    );
  }
);

CardNumberElement.displayName = 'CardNumberElement';

export default CardNumberElement;
