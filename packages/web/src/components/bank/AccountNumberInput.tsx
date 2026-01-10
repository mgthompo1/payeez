'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { validateAccountNumber, maskAccountNumber } from './utils';

export interface AccountNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string, isValid: boolean) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  showMasked?: boolean;
  error?: string;
}

export function AccountNumberInput({
  value = '',
  onChange,
  onValidationChange,
  showMasked = false,
  error: externalError,
  className,
  disabled,
  ...props
}: AccountNumberInputProps) {
  const [internalValue, setInternalValue] = React.useState(value);
  const [touched, setTouched] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | undefined>();
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync with external value
  React.useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  // Validate
  React.useEffect(() => {
    const cleaned = internalValue.replace(/[^0-9]/g, '');

    if (cleaned.length >= 4) {
      const result = validateAccountNumber(cleaned);
      setValidationError(result.valid ? undefined : result.error);
      onValidationChange?.(result.valid, result.error);
    } else if (touched && cleaned.length > 0) {
      const error = 'Account number too short';
      setValidationError(error);
      onValidationChange?.(false, error);
    } else {
      setValidationError(undefined);
    }
  }, [internalValue, touched, onValidationChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/[^0-9]/g, '');

    // Limit to 17 digits (max account number length)
    if (newValue.length > 17) return;

    setInternalValue(newValue);

    const isValid = newValue.length >= 4 && validateAccountNumber(newValue).valid;
    onChange?.(newValue, isValid);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setTouched(true);
    props.onBlur?.(e);
  };

  const displayError = externalError || (touched ? validationError : undefined);
  const isValid = !displayError && internalValue.length >= 4;

  // Show masked value when not focused and showMasked is enabled
  const displayValue =
    showMasked && !isFocused && internalValue.length > 0
      ? maskAccountNumber(internalValue)
      : internalValue;

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type={isFocused ? 'text' : showMasked ? 'text' : 'text'}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Account number"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          aria-invalid={!!displayError}
          className={cn(
            'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            displayError && 'border-destructive ring-destructive/20',
            isValid && !isFocused && 'border-green-500',
            showMasked && !isFocused && 'font-mono tracking-wider',
            className
          )}
          {...props}
        />
        {isValid && !isFocused && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {displayError && (
        <p className="text-sm text-destructive">{displayError}</p>
      )}
    </div>
  );
}
