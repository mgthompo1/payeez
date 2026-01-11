"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";

// ============================================
// Atlas Tokenizer v1.1
// Secure Payment Form with Theming Support
// ============================================

// ---- Types ----

interface AtlasAppearance {
  theme?: 'default' | 'night' | 'minimal';
  variables?: {
    colorPrimary?: string;
    colorBackground?: string;
    colorText?: string;
    colorDanger?: string;
    colorSuccess?: string;
    fontFamily?: string;
    fontSizeBase?: string;
    borderRadius?: string;
    borderColor?: string;
    spacingUnit?: string;
  };
  rules?: Record<string, Record<string, string>>;
}

// ---- Card Detection ----

const CARD_PATTERNS = {
  visa: /^4/,
  mastercard: /^(5[1-5]|2[2-7])/,
  amex: /^3[47]/,
  discover: /^(6011|65|64[4-9])/,
  diners: /^(36|38|30[0-5])/,
  jcb: /^35/,
  unionpay: /^62/,
};

type CardBrand = keyof typeof CARD_PATTERNS | null;

// Card brand SVG icons
const CardIcons: Record<string, JSX.Element> = {
  visa: (
    <svg viewBox="0 0 48 32" className="h-6 w-9">
      <rect fill="#1A1F71" width="48" height="32" rx="4"/>
      <path fill="#fff" d="M20.3 11.5l-2.9 9h-2.4l-1.4-7.2c-.1-.3-.2-.5-.5-.6-.5-.3-1.3-.5-2-.7l.1-.5h3.8c.5 0 .9.3 1 .9l.9 5 2.3-5.9h2.4zm5.6 0l-1.9 9h-2.3l1.9-9h2.3zm7.5 6c0-2.4-3.3-2.5-3.3-3.5 0-.3.3-.6 1-.7.3 0 1.2-.1 2.2.4l.4-1.8c-.5-.2-1.2-.4-2.1-.4-2.2 0-3.8 1.2-3.8 2.9 0 1.3 1.1 2 2 2.4.9.4 1.2.7 1.2 1.1 0 .6-.7.9-1.4.9-.6 0-1.3-.1-2-.5l-.4 1.9c.8.3 1.5.5 2.5.5 2.4 0 3.9-1.2 3.9-3zm5.9-6l1.8 9h-2.1l-.3-1.4h-2.9l-.5 1.4h-2.4l3.4-8.2c.2-.5.5-.8 1.1-.8h1.9zm-2.3 5.8h1.9l-.8-3.6-1.1 3.6z"/>
    </svg>
  ),
  mastercard: (
    <svg viewBox="0 0 48 32" className="h-6 w-9">
      <rect fill="#000" width="48" height="32" rx="4"/>
      <circle fill="#EB001B" cx="18" cy="16" r="10"/>
      <circle fill="#F79E1B" cx="30" cy="16" r="10"/>
      <path fill="#FF5F00" d="M24 8.8a10 10 0 0 0-3.8 7.2A10 10 0 0 0 24 23.2a10 10 0 0 0 3.8-7.2A10 10 0 0 0 24 8.8z"/>
    </svg>
  ),
  amex: (
    <svg viewBox="0 0 48 32" className="h-6 w-9">
      <rect fill="#006FCF" width="48" height="32" rx="4"/>
      <path fill="#fff" d="M12 12h3l1.5 3.5L18 12h3v8h-2v-5.5l-2 4h-1l-2-4V20h-2v-8zm15 0h6v1.5h-4v1.5h4v1.5h-4V18h4v2h-6v-8z"/>
    </svg>
  ),
  discover: (
    <svg viewBox="0 0 48 32" className="h-6 w-9">
      <rect fill="#fff" width="48" height="32" rx="4"/>
      <rect fill="#F76F00" x="0" y="16" width="48" height="16" rx="4" ry="4"/>
      <circle fill="#F76F00" cx="26" cy="16" r="8"/>
    </svg>
  ),
  default: (
    <svg viewBox="0 0 48 32" className="h-6 w-9">
      <rect fill="#E5E7EB" width="48" height="32" rx="4"/>
      <rect x="8" y="10" width="32" height="4" rx="1" fill="#9CA3AF"/>
      <rect x="8" y="18" width="20" height="4" rx="1" fill="#9CA3AF"/>
    </svg>
  ),
};

// ---- Validation Helpers ----

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

function detectCardBrand(number: string): CardBrand {
  const cleaned = number.replace(/\D/g, '');
  for (const [brand, pattern] of Object.entries(CARD_PATTERNS)) {
    if (pattern.test(cleaned)) {
      return brand as CardBrand;
    }
  }
  return null;
}

function getMaxLength(brand: CardBrand): number {
  if (brand === 'amex') return 15;
  if (brand === 'diners') return 14;
  return 16;
}

function formatCardNumber(value: string, brand: CardBrand): string {
  const cleaned = value.replace(/\D/g, '');
  const maxLen = getMaxLength(brand);
  const truncated = cleaned.slice(0, maxLen);

  if (brand === 'amex') {
    return truncated.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' ')
    );
  }

  return truncated.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    let month = cleaned.slice(0, 2);
    if (parseInt(month, 10) > 12) month = '12';
    if (parseInt(month, 10) === 0) month = '01';
    const year = cleaned.slice(2, 4);
    return year ? `${month}/${year}` : month;
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
  const expDate = new Date(year, month);

  return expDate > now;
}

// ---- Theme Presets ----

const THEME_PRESETS: Record<string, AtlasAppearance['variables']> = {
  default: {
    colorPrimary: '#3b82f6',
    colorBackground: '#ffffff',
    colorText: '#1f2937',
    colorDanger: '#ef4444',
    colorSuccess: '#22c55e',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSizeBase: '16px',
    borderRadius: '8px',
    borderColor: '#e5e7eb',
    spacingUnit: '16px',
  },
  night: {
    colorPrimary: '#6366f1',
    colorBackground: '#1f2937',
    colorText: '#f9fafb',
    colorDanger: '#f87171',
    colorSuccess: '#4ade80',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSizeBase: '16px',
    borderRadius: '8px',
    borderColor: '#374151',
    spacingUnit: '16px',
  },
  minimal: {
    colorPrimary: '#000000',
    colorBackground: '#ffffff',
    colorText: '#000000',
    colorDanger: '#dc2626',
    colorSuccess: '#16a34a',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSizeBase: '16px',
    borderRadius: '4px',
    borderColor: '#d1d5db',
    spacingUnit: '12px',
  },
};

// ---- Main Component ----

export default function TokenizerPage() {
  // Form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardBrand, setCardBrand] = useState<CardBrand>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  // SDK-controlled state
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Appearance
  const [appearance, setAppearance] = useState<AtlasAppearance>({});

  // Refs
  const cardNumberRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvcRef = useRef<HTMLInputElement>(null);
  const cardHolderRef = useRef<HTMLInputElement>(null);
  const parentOriginRef = useRef<string>("*");

  // Compute merged theme variables
  const themeVars = useMemo(() => {
    const preset = THEME_PRESETS[appearance.theme || 'default'];
    return { ...preset, ...appearance.variables };
  }, [appearance]);

  // Parse appearance from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const appearanceParam = urlParams.get("appearance");
    parentOriginRef.current = urlParams.get("parentOrigin") || "*";

    if (appearanceParam) {
      try {
        const parsed = JSON.parse(atob(appearanceParam));
        setAppearance(parsed);
      } catch (e) {
        console.warn('Failed to parse appearance config');
      }
    }
  }, []);

  // Notify parent of height changes
  const notifyHeight = useCallback(() => {
    const height = document.body.scrollHeight;
    window.parent.postMessage(
      { type: "ATLAS_RESIZE", payload: { height } },
      parentOriginRef.current
    );
  }, []);

  useEffect(() => {
    notifyHeight();
    const observer = new ResizeObserver(notifyHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [notifyHeight]);

  // Send change events to parent
  const notifyChange = useCallback(() => {
    const cleanNumber = cardNumber.replace(/\s/g, '');
    const isEmpty = !cleanNumber && !cardHolder && !expiry && !cvc;
    const cvcLen = cardBrand === 'amex' ? 4 : 3;

    // Check if all fields are valid and complete
    const isCardValid = isValidLuhn(cleanNumber);
    const isExpiryValid = isValidExpiry(expiry);
    const isCvcValid = cvc.length === cvcLen;
    const isHolderValid = cardHolder.trim().length > 0;
    const isComplete = isCardValid && isExpiryValid && isCvcValid && isHolderValid;

    // Find first error
    let error: { message: string; code: string; field?: string } | undefined;
    if (touched.cardNumber && cleanNumber && !isCardValid) {
      error = { message: 'Invalid card number', code: 'invalid_number', field: 'cardNumber' };
    } else if (touched.expiry && expiry && !isExpiryValid) {
      error = { message: 'Invalid or expired date', code: 'invalid_expiry', field: 'expiry' };
    } else if (touched.cvc && cvc && !isCvcValid) {
      error = { message: `CVC must be ${cvcLen} digits`, code: 'invalid_cvc', field: 'cvc' };
    }

    window.parent.postMessage({
      type: "ATLAS_CHANGE",
      payload: {
        complete: isComplete,
        empty: isEmpty,
        error,
        brand: cardBrand,
      }
    }, parentOriginRef.current);
  }, [cardNumber, cardHolder, expiry, cvc, cardBrand, touched]);

  // Debounced change notification
  useEffect(() => {
    const timer = setTimeout(notifyChange, 100);
    return () => clearTimeout(timer);
  }, [notifyChange]);

  // Handle messages from parent SDK
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const { type, payload } = event.data || {};

      switch (type) {
        case "ATLAS_CONFIRM":
          await tokenize();
          break;

        case "ATLAS_UPDATE":
          if (payload?.disabled !== undefined) setDisabled(payload.disabled);
          if (payload?.loading !== undefined) setLoading(payload.loading);
          break;

        case "ATLAS_CLEAR":
          setCardNumber("");
          setCardHolder("");
          setExpiry("");
          setCvc("");
          setCardBrand(null);
          setErrors({});
          setTouched({});
          break;

        case "ATLAS_FOCUS":
          const fieldMap: Record<string, React.RefObject<HTMLInputElement>> = {
            cardNumber: cardNumberRef,
            expiry: expiryRef,
            cvc: cvcRef,
            cardHolder: cardHolderRef,
          };
          fieldMap[payload?.field]?.current?.focus();
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "ATLAS_READY" }, parentOriginRef.current);

    return () => window.removeEventListener("message", handleMessage);
  }, [cardNumber, cardHolder, expiry, cvc]);

  // Validate all fields
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    const cleanNumber = cardNumber.replace(/\s/g, '');
    if (!cleanNumber) {
      newErrors.cardNumber = "Card number is required";
    } else if (!isValidLuhn(cleanNumber)) {
      newErrors.cardNumber = "Invalid card number";
    }

    if (!cardHolder.trim()) {
      newErrors.cardHolder = "Cardholder name is required";
    }

    if (!expiry) {
      newErrors.expiry = "Expiry date is required";
    } else if (!isValidExpiry(expiry)) {
      newErrors.expiry = "Invalid or expired date";
    }

    const cvcLen = cardBrand === 'amex' ? 4 : 3;
    if (!cvc) {
      newErrors.cvc = "CVC is required";
    } else if (cvc.length !== cvcLen) {
      newErrors.cvc = `CVC must be ${cvcLen} digits`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [cardNumber, cardHolder, expiry, cvc, cardBrand]);

  // Tokenize and send to parent
  const tokenize = async () => {
    if (processing || disabled || loading) return;

    setTouched({ cardNumber: true, cardHolder: true, expiry: true, cvc: true });

    if (!validate()) {
      window.parent.postMessage({
        type: "ATLAS_ERROR",
        payload: { message: "Please correct the form errors", code: "validation_error" }
      }, parentOriginRef.current);
      return;
    }

    setProcessing(true);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("sessionId");
      const [expiryMonth, expiryYear] = expiry.split('/');

      const res = await fetch("/api/tokenize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pan: cardNumber.replace(/\s/g, ""),
          cardHolderName: cardHolder.trim(),
          expiryMonth,
          expiryYear,
          cvc,
          sessionId,
          cardBrand,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Tokenization failed");
      }

      const data = await res.json();

      window.parent.postMessage({
        type: "ATLAS_TOKEN_CREATED",
        payload: {
          tokenId: data.tokenId,
          card: {
            brand: cardBrand,
            last4: cardNumber.replace(/\s/g, '').slice(-4),
            expiryMonth,
            expiryYear: '20' + expiryYear,
          }
        }
      }, parentOriginRef.current);

    } catch (err: any) {
      setErrors({ form: err.message });
      window.parent.postMessage({
        type: "ATLAS_ERROR",
        payload: { message: err.message, code: "tokenization_error" }
      }, parentOriginRef.current);
    } finally {
      setProcessing(false);
    }
  };

  // Input handlers
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const brand = detectCardBrand(raw);
    setCardBrand(brand);
    const formatted = formatCardNumber(raw, brand);
    setCardNumber(formatted);

    const maxLen = getMaxLength(brand);
    if (formatted.replace(/\s/g, '').length === maxLen) {
      expiryRef.current?.focus();
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiry(e.target.value);
    setExpiry(formatted);

    if (formatted.length === 5) {
      cvcRef.current?.focus();
    }
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '');
    const maxLen = cardBrand === 'amex' ? 4 : 3;
    setCvc(cleaned.slice(0, maxLen));
  };

  const handleFocus = (field: string) => {
    setFocused(field);
    window.parent.postMessage({
      type: "ATLAS_FOCUS",
      payload: { field }
    }, parentOriginRef.current);
  };

  const handleBlur = (field: string) => {
    setFocused(null);
    setTouched(prev => ({ ...prev, [field]: true }));
    window.parent.postMessage({
      type: "ATLAS_BLUR",
      payload: { field }
    }, parentOriginRef.current);
  };

  const getFieldState = (field: string) => {
    const hasError = touched[field] && errors[field];
    const isFocused = focused === field;
    return { hasError, isFocused };
  };

  const isFormDisabled = disabled || loading || processing;

  // Dynamic styles based on theme
  const containerStyle: React.CSSProperties = {
    fontFamily: themeVars.fontFamily,
    fontSize: themeVars.fontSizeBase,
    color: themeVars.colorText,
    backgroundColor: themeVars.colorBackground,
    padding: themeVars.spacingUnit,
  };

  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    fontSize: themeVars.fontSizeBase,
    fontFamily: themeVars.fontFamily,
    color: themeVars.colorText,
    backgroundColor: themeVars.colorBackground,
    border: `1px solid ${themeVars.borderColor}`,
    borderRadius: themeVars.borderRadius,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const getInputStyle = (field: string): React.CSSProperties => {
    const { hasError, isFocused } = getFieldState(field);
    return {
      ...inputBaseStyle,
      borderColor: hasError
        ? themeVars.colorDanger
        : isFocused
          ? themeVars.colorPrimary
          : themeVars.borderColor,
      boxShadow: isFocused
        ? `0 0 0 3px ${hasError ? themeVars.colorDanger : themeVars.colorPrimary}20`
        : 'none',
      opacity: isFormDisabled ? 0.6 : 1,
    };
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 500,
    color: themeVars.colorText,
  };

  const errorStyle: React.CSSProperties = {
    marginTop: '4px',
    fontSize: '13px',
    color: themeVars.colorDanger,
  };

  // Card preview gradient based on theme
  const cardGradient = appearance.theme === 'night'
    ? 'linear-gradient(135deg, #374151 0%, #1f2937 100%)'
    : appearance.theme === 'minimal'
      ? 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
      : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';

  const cardTextColor = appearance.theme === 'minimal' ? '#1f2937' : '#ffffff';

  return (
    <div style={containerStyle} className="w-full max-w-md mx-auto">
      {/* Card Preview */}
      <div
        style={{
          background: cardGradient,
          color: cardTextColor,
          borderRadius: themeVars.borderRadius,
          padding: themeVars.spacingUnit,
          marginBottom: themeVars.spacingUnit,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }}>
            Payment Card
          </div>
          <div style={{ height: '32px', width: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {CardIcons[cardBrand || 'default']}
          </div>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '18px', letterSpacing: '0.15em', marginBottom: '16px' }}>
          {cardNumber || '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>
              Card Holder
            </div>
            <div style={{ letterSpacing: '0.05em' }}>{cardHolder || 'YOUR NAME'}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>
              Expires
            </div>
            <div>{expiry || 'MM/YY'}</div>
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: themeVars.spacingUnit }}>
        {/* Card Number */}
        <div>
          <label style={labelStyle}>Card Number</label>
          <div style={{ position: 'relative' }}>
            <input
              ref={cardNumberRef}
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={handleCardNumberChange}
              onFocus={() => handleFocus('cardNumber')}
              onBlur={() => handleBlur('cardNumber')}
              style={{ ...getInputStyle('cardNumber'), paddingRight: '48px' }}
              disabled={isFormDisabled}
            />
            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
              {CardIcons[cardBrand || 'default']}
            </div>
          </div>
          {touched.cardNumber && errors.cardNumber && (
            <p style={errorStyle}>{errors.cardNumber}</p>
          )}
        </div>

        {/* Cardholder Name */}
        <div>
          <label style={labelStyle}>Cardholder Name</label>
          <input
            ref={cardHolderRef}
            type="text"
            autoComplete="cc-name"
            placeholder="John Doe"
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
            onFocus={() => handleFocus('cardHolder')}
            onBlur={() => handleBlur('cardHolder')}
            style={getInputStyle('cardHolder')}
            disabled={isFormDisabled}
          />
          {touched.cardHolder && errors.cardHolder && (
            <p style={errorStyle}>{errors.cardHolder}</p>
          )}
        </div>

        {/* Expiry and CVC Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: themeVars.spacingUnit }}>
          <div>
            <label style={labelStyle}>Expiry Date</label>
            <input
              ref={expiryRef}
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={expiry}
              onChange={handleExpiryChange}
              onFocus={() => handleFocus('expiry')}
              onBlur={() => handleBlur('expiry')}
              style={getInputStyle('expiry')}
              disabled={isFormDisabled}
              maxLength={5}
            />
            {touched.expiry && errors.expiry && (
              <p style={errorStyle}>{errors.expiry}</p>
            )}
          </div>
          <div>
            <label style={labelStyle}>CVC</label>
            <input
              ref={cvcRef}
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder={cardBrand === 'amex' ? '1234' : '123'}
              value={cvc}
              onChange={handleCvcChange}
              onFocus={() => handleFocus('cvc')}
              onBlur={() => handleBlur('cvc')}
              style={getInputStyle('cvc')}
              disabled={isFormDisabled}
              maxLength={cardBrand === 'amex' ? 4 : 3}
            />
            {touched.cvc && errors.cvc && (
              <p style={errorStyle}>{errors.cvc}</p>
            )}
          </div>
        </div>

        {/* Form Error */}
        {errors.form && (
          <div style={{
            padding: '12px',
            backgroundColor: `${themeVars.colorDanger}10`,
            border: `1px solid ${themeVars.colorDanger}30`,
            borderRadius: themeVars.borderRadius,
          }}>
            <p style={{ fontSize: '14px', color: themeVars.colorDanger, margin: 0 }}>
              {errors.form}
            </p>
          </div>
        )}

        {/* Processing Indicator */}
        {(processing || loading) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
            color: themeVars.colorText,
            opacity: 0.7,
          }}>
            <svg
              style={{ animation: 'spin 1s linear infinite', height: '20px', width: '20px' }}
              viewBox="0 0 24 24"
            >
              <circle
                style={{ opacity: 0.25 }}
                cx="12" cy="12" r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                style={{ opacity: 0.75 }}
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span style={{ fontSize: '14px' }}>
              {loading ? 'Loading...' : 'Processing payment...'}
            </span>
          </div>
        )}

        {/* Security Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          paddingTop: '8px',
          opacity: 0.5,
        }}>
          <svg style={{ height: '16px', width: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span style={{ fontSize: '12px' }}>Secured with 256-bit encryption</span>
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
