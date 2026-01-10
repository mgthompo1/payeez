/**
 * Atlas Elements - Cardholder Name Element
 *
 * A composable, accessible cardholder name input with real-time validation
 * and customizable styling.
 *
 * @example
 * ```tsx
 * <CardholderElement
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
  ElementChangeEvent,
  AppearanceVariables,
  Locale,
} from '../lib/types';
import { getTranslations, type Translations } from '../lib/i18n';
import { resolveTheme } from '../lib/themes';

// ============================================
// Validation Helpers
// ============================================

function isValidName(name: string): boolean {
  // Must contain at least 2 characters and only letters, spaces, hyphens, apostrophes
  const cleaned = name.trim();
  if (cleaned.length < 2) return false;
  return /^[a-zA-ZÀ-ÿ\s\-'\.]+$/.test(cleaned);
}

// ============================================
// Component Props
// ============================================

export interface CardholderElementOptions {
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input is read-only */
  readOnly?: boolean;
}

export interface CardholderElementProps extends CardholderElementOptions {
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

export interface CardholderElementRef {
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

export const CardholderElement = forwardRef<CardholderElementRef, CardholderElementProps>(
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
    const inputId = id || `atlas-cardholder-${generatedId}`;
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
      (nameValue: string): string | null => {
        if (!nameValue.trim()) {
          return isTouched ? t.errors.required : null;
        }

        if (!isValidName(nameValue)) {
          return t.errors.invalidName || 'Please enter a valid name';
        }

        return null;
      },
      [t, isTouched]
    );

    // Notify change
    const notifyChange = useCallback(
      (newValue: string, newError: string | null) => {
        const isComplete = newValue.trim().length >= 2 && isValidName(newValue);

        onChange?.({
          complete: isComplete,
          empty: newValue.trim().length === 0,
          error: newError
            ? { message: newError, code: 'invalid_name', field: 'cardholderName' }
            : undefined,
          value: { cardholderName: newValue.trim() },
        });
      },
      [onChange]
    );

    // Handle input change
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);

        const validationError = validate(newValue);
        setError(validationError);

        notifyChange(newValue, validationError);
      },
      [validate, notifyChange]
    );

    // Handle keydown
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          onEscape?.();
        }
      },
      [onEscape]
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
        getValue: () => value.trim(),
        isValid: () => !validate(value),
        isComplete: () => value.trim().length >= 2 && isValidName(value),
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
      fontFamily: theme.fontFamily,
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
          autoComplete="cc-name"
          placeholder={placeholder || t.placeholders.cardholderName}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          readOnly={readOnly}
          style={inputStyle}
          // Accessibility
          aria-label={t.aria.cardholderInput}
          aria-invalid={!!error && isTouched}
          aria-describedby={error && isTouched ? errorId : undefined}
          aria-required="true"
          role="textbox"
          data-atlas-element="cardholder"
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

CardholderElement.displayName = 'CardholderElement';

export default CardholderElement;
