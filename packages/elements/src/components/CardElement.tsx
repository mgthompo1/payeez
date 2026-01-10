/**
 * Atlas Elements - Combined Card Element
 *
 * A composable card input that combines CardNumber, CardExpiry, and CardCvc
 * elements with flexible layout options.
 *
 * @example
 * ```tsx
 * <CardElement
 *   onChange={(e) => console.log(e.complete, e.brand)}
 *   appearance={appearance}
 *   locale="en"
 *   layout="row" // or "stacked"
 *   hidePostalCode
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
  CardElementOptions,
  ElementChangeEvent,
  AppearanceVariables,
  Locale,
} from '../lib/types';
import { getTranslations, type Translations } from '../lib/i18n';
import { resolveTheme, type ResolvedTheme } from '../lib/themes';
import { CardNumberElement, CardNumberElementRef } from './CardNumberElement';
import { CardExpiryElement, CardExpiryElementRef } from './CardExpiryElement';
import { CardCvcElement, CardCvcElementRef } from './CardCvcElement';
import { CardholderElement, CardholderElementRef } from './CardholderElement';

// ============================================
// Component Props
// ============================================

export interface CardElementProps extends CardElementOptions {
  /** Locale for translations */
  locale?: Locale;
  /** Appearance variables */
  appearance?: {
    theme?: 'default' | 'night' | 'minimal' | 'flat' | 'modern';
    variables?: Partial<AppearanceVariables>;
  };
  /** Layout style: 'row' for inline, 'stacked' for vertical */
  layout?: 'row' | 'stacked';
  /** Whether to show cardholder name field */
  showCardholderName?: boolean;
  /** ID prefix for the elements */
  id?: string;
  /** CSS class name */
  className?: string;
  /** Called when any field changes */
  onChange?: (event: ElementChangeEvent) => void;
  /** Called when any field gains focus */
  onFocus?: (field: 'cardNumber' | 'expiry' | 'cvc' | 'cardholderName') => void;
  /** Called when any field loses focus */
  onBlur?: (field: 'cardNumber' | 'expiry' | 'cvc' | 'cardholderName') => void;
  /** Called when all elements are ready */
  onReady?: () => void;
  /** Called on escape key */
  onEscape?: () => void;
}

export interface CardElementRef {
  /** Focus the card number input */
  focus: () => void;
  /** Blur all inputs */
  blur: () => void;
  /** Clear all inputs */
  clear: () => void;
  /** Get all values */
  getValue: () => {
    cardNumber: string;
    expiry: string;
    cvc: string;
    cardholderName?: string;
    brand: CardBrand;
  };
  /** Check if all inputs are valid */
  isValid: () => boolean;
  /** Check if all inputs are complete */
  isComplete: () => boolean;
  /** Get the detected card brand */
  getBrand: () => CardBrand;
}

// ============================================
// Component
// ============================================

export const CardElement = forwardRef<CardElementRef, CardElementProps>(
  (
    {
      hidePostalCode = true,
      iconPosition = 'right',
      disabled = false,
      layout = 'row',
      showCardholderName = false,
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
    // State for each field
    const [cardState, setCardState] = useState({
      cardNumber: { complete: false, empty: true, error: null as string | null },
      expiry: { complete: false, empty: true, error: null as string | null },
      cvc: { complete: false, empty: true, error: null as string | null },
      cardholderName: { complete: false, empty: true, error: null as string | null },
      brand: 'unknown' as CardBrand,
    });

    // Refs
    const cardNumberRef = useRef<CardNumberElementRef>(null);
    const expiryRef = useRef<CardExpiryElementRef>(null);
    const cvcRef = useRef<CardCvcElementRef>(null);
    const cardholderRef = useRef<CardholderElementRef>(null);
    const readyCount = useRef(0);

    // Computed values
    const generatedId = useId();
    const idPrefix = id || `atlas-card-${generatedId}`;

    // Get translations and theme
    const t: Translations = useMemo(() => getTranslations(locale), [locale]);
    const theme: ResolvedTheme = useMemo(() => resolveTheme(appearance), [appearance]);

    // Check if all required fields are complete
    const checkComplete = useCallback(() => {
      const required = [cardState.cardNumber.complete, cardState.expiry.complete, cardState.cvc.complete];
      if (showCardholderName) {
        required.push(cardState.cardholderName.complete);
      }
      return required.every(Boolean);
    }, [cardState, showCardholderName]);

    // Check if all fields are empty
    const checkEmpty = useCallback(() => {
      const fields = [cardState.cardNumber.empty, cardState.expiry.empty, cardState.cvc.empty];
      if (showCardholderName) {
        fields.push(cardState.cardholderName.empty);
      }
      return fields.every(Boolean);
    }, [cardState, showCardholderName]);

    // Get first error
    const getFirstError = useCallback(() => {
      if (cardState.cardNumber.error) return { message: cardState.cardNumber.error, code: 'invalid_number', field: 'cardNumber' };
      if (cardState.expiry.error) return { message: cardState.expiry.error, code: 'invalid_expiry', field: 'expiry' };
      if (cardState.cvc.error) return { message: cardState.cvc.error, code: 'invalid_cvc', field: 'cvc' };
      if (showCardholderName && cardState.cardholderName.error) return { message: cardState.cardholderName.error, code: 'invalid_name', field: 'cardholderName' };
      return undefined;
    }, [cardState, showCardholderName]);

    // Notify parent of changes
    const notifyChange = useCallback(() => {
      onChange?.({
        complete: checkComplete(),
        empty: checkEmpty(),
        brand: cardState.brand,
        error: getFirstError() as ElementChangeEvent['error'],
        value: {
          cardNumber: cardNumberRef.current?.getValue() || '',
          expiry: expiryRef.current?.getValue() || '',
          cvc: cvcRef.current?.getValue() || '',
          ...(showCardholderName && { cardholderName: cardholderRef.current?.getValue() || '' }),
        },
      });
    }, [onChange, checkComplete, checkEmpty, cardState.brand, getFirstError, showCardholderName]);

    // Handle card number change
    const handleCardNumberChange = useCallback((e: ElementChangeEvent) => {
      setCardState(prev => ({
        ...prev,
        cardNumber: { complete: e.complete, empty: e.empty, error: e.error?.message || null },
        brand: e.brand || 'unknown',
      }));
    }, []);

    // Handle expiry change
    const handleExpiryChange = useCallback((e: ElementChangeEvent) => {
      setCardState(prev => ({
        ...prev,
        expiry: { complete: e.complete, empty: e.empty, error: e.error?.message || null },
      }));
    }, []);

    // Handle CVC change
    const handleCvcChange = useCallback((e: ElementChangeEvent) => {
      setCardState(prev => ({
        ...prev,
        cvc: { complete: e.complete, empty: e.empty, error: e.error?.message || null },
      }));
    }, []);

    // Handle cardholder change
    const handleCardholderChange = useCallback((e: ElementChangeEvent) => {
      setCardState(prev => ({
        ...prev,
        cardholderName: { complete: e.complete, empty: e.empty, error: e.error?.message || null },
      }));
    }, []);

    // Effect to notify changes
    React.useEffect(() => {
      notifyChange();
    }, [cardState, notifyChange]);

    // Handle ready events
    const handleReady = useCallback(() => {
      readyCount.current++;
      const expectedCount = showCardholderName ? 4 : 3;
      if (readyCount.current === expectedCount) {
        onReady?.();
      }
    }, [onReady, showCardholderName]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        focus: () => cardNumberRef.current?.focus(),
        blur: () => {
          cardNumberRef.current?.blur();
          expiryRef.current?.blur();
          cvcRef.current?.blur();
          cardholderRef.current?.blur();
        },
        clear: () => {
          cardNumberRef.current?.clear();
          expiryRef.current?.clear();
          cvcRef.current?.clear();
          cardholderRef.current?.clear();
        },
        getValue: () => ({
          cardNumber: cardNumberRef.current?.getValue() || '',
          expiry: expiryRef.current?.getValue() || '',
          cvc: cvcRef.current?.getValue() || '',
          ...(showCardholderName && { cardholderName: cardholderRef.current?.getValue() || '' }),
          brand: cardState.brand,
        }),
        isValid: () => {
          const valid = [
            cardNumberRef.current?.isValid() ?? false,
            expiryRef.current?.isValid() ?? false,
            cvcRef.current?.isValid() ?? false,
          ];
          if (showCardholderName) {
            valid.push(cardholderRef.current?.isValid() ?? false);
          }
          return valid.every(Boolean);
        },
        isComplete: () => checkComplete(),
        getBrand: () => cardState.brand,
      }),
      [cardState.brand, checkComplete, showCardholderName]
    );

    // Styles based on layout
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacingUnit,
      width: '100%',
    };

    const rowStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: layout === 'stacked' ? 'column' : 'row',
      gap: theme.spacingUnit,
      width: '100%',
    };

    const cardNumberStyle: React.CSSProperties = {
      flex: layout === 'row' ? '2' : undefined,
      width: layout === 'stacked' ? '100%' : undefined,
    };

    const smallFieldStyle: React.CSSProperties = {
      flex: layout === 'row' ? '1' : undefined,
      width: layout === 'stacked' ? '100%' : undefined,
      minWidth: layout === 'row' ? '80px' : undefined,
    };

    const labelStyle: React.CSSProperties = {
      display: 'block',
      marginBottom: '4px',
      fontSize: theme.fontSizeSm,
      fontWeight: theme.fontWeightMedium as React.CSSProperties['fontWeight'],
      color: theme.colorLabel,
      fontFamily: theme.fontFamily,
    };

    return (
      <div className={className} style={containerStyle} data-atlas-element="card">
        {/* Cardholder Name (optional) */}
        {showCardholderName && (
          <div>
            <label htmlFor={`${idPrefix}-cardholder`} style={labelStyle}>
              {t.labels.cardholderName}
            </label>
            <CardholderElement
              ref={cardholderRef}
              id={`${idPrefix}-cardholder`}
              locale={locale}
              appearance={appearance}
              disabled={disabled}
              onChange={handleCardholderChange}
              onFocus={() => onFocus?.('cardholderName')}
              onBlur={() => onBlur?.('cardholderName')}
              onReady={handleReady}
              onEscape={onEscape}
            />
          </div>
        )}

        {/* Card Number */}
        <div>
          <label htmlFor={`${idPrefix}-number`} style={labelStyle}>
            {t.labels.cardNumber}
          </label>
          <CardNumberElement
            ref={cardNumberRef}
            id={`${idPrefix}-number`}
            locale={locale}
            appearance={appearance}
            disabled={disabled}
            showIcon
            iconPosition={iconPosition}
            onChange={handleCardNumberChange}
            onFocus={() => onFocus?.('cardNumber')}
            onBlur={() => onBlur?.('cardNumber')}
            onReady={handleReady}
            onEscape={onEscape}
          />
        </div>

        {/* Expiry and CVC row */}
        <div style={rowStyle}>
          <div style={layout === 'row' ? smallFieldStyle : cardNumberStyle}>
            <label htmlFor={`${idPrefix}-expiry`} style={labelStyle}>
              {t.labels.expiry}
            </label>
            <CardExpiryElement
              ref={expiryRef}
              id={`${idPrefix}-expiry`}
              locale={locale}
              appearance={appearance}
              disabled={disabled}
              onChange={handleExpiryChange}
              onFocus={() => onFocus?.('expiry')}
              onBlur={() => onBlur?.('expiry')}
              onReady={handleReady}
              onEscape={onEscape}
            />
          </div>

          <div style={layout === 'row' ? smallFieldStyle : cardNumberStyle}>
            <label htmlFor={`${idPrefix}-cvc`} style={labelStyle}>
              {t.labels.cvc}
            </label>
            <CardCvcElement
              ref={cvcRef}
              id={`${idPrefix}-cvc`}
              cardBrand={cardState.brand}
              locale={locale}
              appearance={appearance}
              disabled={disabled}
              showIcon
              onChange={handleCvcChange}
              onFocus={() => onFocus?.('cvc')}
              onBlur={() => onBlur?.('cvc')}
              onReady={handleReady}
              onEscape={onEscape}
            />
          </div>
        </div>
      </div>
    );
  }
);

CardElement.displayName = 'CardElement';

export default CardElement;
