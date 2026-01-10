/**
 * Atlas Elements - Card CVC Element
 *
 * A composable, accessible CVC input with real-time validation
 * and customizable styling. Supports both 3-digit (most cards)
 * and 4-digit (Amex) security codes.
 *
 * @example
 * ```tsx
 * <CardCvcElement
 *   cardBrand="visa" // Used to determine 3 or 4 digit CVC
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
  CardBrand,
  CardCvcElementOptions,
  ElementChangeEvent,
  AppearanceVariables,
  Locale,
} from '../lib/types';
import { getTranslations, type Translations } from '../lib/i18n';
import { resolveTheme } from '../lib/themes';

// ============================================
// Helpers
// ============================================

function getCvcLength(brand: CardBrand | undefined): number {
  return brand === 'amex' ? 4 : 3;
}

// ============================================
// CVC Icon Component
// ============================================

const CvcIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
    <rect x="14" y="14" width="6" height="3" fill={color} stroke="none" />
  </svg>
);

// ============================================
// Component Props
// ============================================

export interface CardCvcElementProps extends CardCvcElementOptions {
  /** Card brand to determine CVC length (3 or 4 digits) */
  cardBrand?: CardBrand;
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
  /** Show CVC icon */
  showIcon?: boolean;
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

export interface CardCvcElementRef {
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

export const CardCvcElement = forwardRef<CardCvcElementRef, CardCvcElementProps>(
  (
    {
      cardBrand,
      placeholder,
      disabled = false,
      readOnly = false,
      locale = 'auto',
      appearance = {},
      id,
      className,
      showIcon = true,
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
    const inputId = id || `atlas-card-cvc-${generatedId}`;
    const errorId = `${inputId}-error`;
    const expectedLength = getCvcLength(cardBrand);

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
      (cvcValue: string): string | null => {
        if (!cvcValue) {
          return isTouched ? t.errors.required : null;
        }

        if (cvcValue.length < expectedLength) {
          return t.errors.incompleteCvc;
        }

        // Check if all digits
        if (!/^\d+$/.test(cvcValue)) {
          return t.errors.invalidCvc;
        }

        return null;
      },
      [t, isTouched, expectedLength]
    );

    // Notify change
    const notifyChange = useCallback(
      (newValue: string, newError: string | null) => {
        const isComplete = newValue.length === expectedLength;

        onChange?.({
          complete: isComplete,
          empty: newValue.length === 0,
          error: newError
            ? { message: newError, code: 'invalid_cvc', field: 'cvc' }
            : undefined,
          value: { cvc: newValue },
        });
      },
      [onChange, expectedLength]
    );

    // Handle input change
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const truncated = rawValue.slice(0, expectedLength);

        setValue(truncated);

        const validationError = validate(truncated);
        setError(validationError);

        notifyChange(truncated, validationError);
      },
      [validate, notifyChange, expectedLength]
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
        getValue: () => value,
        isValid: () => !validate(value),
        isComplete: () => value.length === expectedLength,
      }),
      [value, validate, notifyChange, expectedLength]
    );

    // Styles
    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
    };

    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: `${theme.paddingInputY} ${theme.paddingInputX}`,
      paddingRight: showIcon ? '40px' : theme.paddingInputX,
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
      letterSpacing: '0.15em',
    };

    const iconContainerStyle: React.CSSProperties = {
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      color: theme.colorIconCardCvc,
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
          autoComplete="cc-csc"
          placeholder={
            placeholder ||
            (cardBrand === 'amex' ? t.placeholders.cvc4 : t.placeholders.cvc)
          }
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={expectedLength}
          style={inputStyle}
          // Accessibility
          aria-label={t.aria.cvcInput}
          aria-invalid={!!error && isTouched}
          aria-describedby={error && isTouched ? errorId : undefined}
          aria-required="true"
          role="textbox"
          data-atlas-element="card-cvc"
        />

        {showIcon && (
          <div style={iconContainerStyle} aria-hidden="true">
            <CvcIcon size={20} />
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

CardCvcElement.displayName = 'CardCvcElement';

export default CardCvcElement;
