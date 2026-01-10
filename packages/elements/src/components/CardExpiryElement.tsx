/**
 * Atlas Elements - Card Expiry Element
 *
 * A composable, accessible expiry date input with real-time validation
 * and customizable styling.
 *
 * @example
 * ```tsx
 * <CardExpiryElement
 *   onChange={(e) => console.log(e.complete)}
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
  CardExpiryElementOptions,
  ElementChangeEvent,
  AppearanceVariables,
  Locale,
} from '../lib/types';
import { getTranslations, type Translations } from '../lib/i18n';
import { resolveTheme } from '../lib/themes';

// ============================================
// Validation Helpers
// ============================================

function formatExpiry(value: string): string {
  const cleaned = value.replace(/\D/g, '');

  if (cleaned.length >= 2) {
    let month = cleaned.slice(0, 2);
    const monthNum = parseInt(month, 10);

    // Auto-correct invalid months
    if (monthNum > 12) month = '12';
    if (monthNum === 0) month = '01';

    const year = cleaned.slice(2, 4);
    return year ? `${month}/${year}` : month;
  }

  // Auto-prefix single digit months > 1 with 0
  if (cleaned.length === 1 && parseInt(cleaned, 10) > 1) {
    return `0${cleaned}/`;
  }

  return cleaned;
}

function isValidExpiry(expiry: string): boolean {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;

  const month = parseInt(match[1], 10);
  const year = parseInt('20' + match[2], 10);

  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Check if card is expired
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;

  return true;
}

function isExpired(expiry: string): boolean {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;

  const month = parseInt(match[1], 10);
  const year = parseInt('20' + match[2], 10);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (year < currentYear) return true;
  if (year === currentYear && month < currentMonth) return true;

  return false;
}

// ============================================
// Component Props
// ============================================

export interface CardExpiryElementProps extends CardExpiryElementOptions {
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

export interface CardExpiryElementRef {
  /** Focus the input */
  focus: () => void;
  /** Blur the input */
  blur: () => void;
  /** Clear the input value */
  clear: () => void;
  /** Get the current value */
  getValue: () => string;
  /** Check if the input is valid */
  isValid: () => boolean;
  /** Check if the input is complete */
  isComplete: () => boolean;
}

// ============================================
// Component
// ============================================

export const CardExpiryElement = forwardRef<CardExpiryElementRef, CardExpiryElementProps>(
  (
    {
      placeholder,
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
    const [isFocused, setIsFocused] = useState(false);
    const [isTouched, setIsTouched] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs
    const inputRef = useRef<HTMLInputElement>(null);
    const hasNotifiedReady = useRef(false);

    // Computed values
    const generatedId = useId();
    const inputId = id || `atlas-card-expiry-${generatedId}`;
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
      (expiryValue: string): string | null => {
        if (!expiryValue) {
          return isTouched ? t.errors.required : null;
        }

        if (expiryValue.length < 5) {
          return t.errors.incompleteExpiry;
        }

        if (isExpired(expiryValue)) {
          return t.errors.expiredCard;
        }

        if (!isValidExpiry(expiryValue)) {
          return t.errors.invalidExpiry;
        }

        return null;
      },
      [t, isTouched]
    );

    // Notify change
    const notifyChange = useCallback(
      (newValue: string, newError: string | null) => {
        const isComplete = newValue.length === 5 && isValidExpiry(newValue);

        onChange?.({
          complete: isComplete,
          empty: newValue.length === 0,
          error: newError
            ? { message: newError, code: 'invalid_expiry', field: 'expiry' }
            : undefined,
          value: { expiry: newValue },
        });
      },
      [onChange]
    );

    // Handle input change
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const formatted = formatExpiry(rawValue);

        // Don't allow more than MM/YY
        if (formatted.length > 5) return;

        setValue(formatted);

        const validationError = validate(formatted);
        setError(validationError);

        notifyChange(formatted, validationError);
      },
      [validate, notifyChange]
    );

    // Handle keydown for backspace
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          onEscape?.();
          return;
        }

        // Handle backspace to remove slash
        if (e.key === 'Backspace' && value.length === 3 && value.endsWith('/')) {
          e.preventDefault();
          const newValue = value.slice(0, 2);
          setValue(newValue);
          notifyChange(newValue, validate(newValue));
        }
      },
      [value, validate, notifyChange, onEscape]
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

      const validationError = validate(value);
      setError(validationError);

      onBlur?.();
    }, [value, validate, onBlur]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        clear: () => {
          setValue('');
          setError(null);
          setIsTouched(false);
          notifyChange('', null);
        },
        getValue: () => value,
        isValid: () => !validate(value),
        isComplete: () => value.length === 5 && isValidExpiry(value),
      }),
      [value, validate, notifyChange]
    );

    // Styles
    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
    };

    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: `${theme.paddingInputY} ${theme.paddingInputX}`,
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
      letterSpacing: '0.1em',
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
          autoComplete="cc-exp"
          placeholder={placeholder || t.placeholders.expiryDate}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={5}
          style={inputStyle}
          // Accessibility
          aria-label={t.aria.expiryInput}
          aria-invalid={!!error && isTouched}
          aria-describedby={error && isTouched ? errorId : undefined}
          aria-required="true"
          role="textbox"
          data-atlas-element="card-expiry"
        />

        {error && isTouched && (
          <div id={errorId} style={errorStyle} role="alert" aria-live="polite">
            {error}
          </div>
        )}
      </div>
    );
  }
);

CardExpiryElement.displayName = 'CardExpiryElement';

export default CardExpiryElement;
