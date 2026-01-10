'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { validateRoutingNumber, formatRoutingNumber, getBankName } from './utils';

export interface RoutingNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string, isValid: boolean) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  showBankName?: boolean;
  format?: boolean;
  error?: string;
}

export function RoutingNumberInput({
  value = '',
  onChange,
  onValidationChange,
  showBankName = true,
  format = true,
  error: externalError,
  className,
  disabled,
  ...props
}: RoutingNumberInputProps) {
  const [internalValue, setInternalValue] = React.useState(value);
  const [touched, setTouched] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | undefined>();
  const [bankName, setBankName] = React.useState<string | null>(null);

  // Sync with external value
  React.useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  // Validate and update bank name
  React.useEffect(() => {
    const cleaned = internalValue.replace(/[^0-9]/g, '');

    if (cleaned.length === 9) {
      const result = validateRoutingNumber(cleaned);
      setValidationError(result.valid ? undefined : result.error);
      onValidationChange?.(result.valid, result.error);

      if (result.valid && showBankName) {
        setBankName(getBankName(cleaned));
      } else {
        setBankName(null);
      }
    } else if (touched && cleaned.length > 0) {
      const error = 'Routing number must be 9 digits';
      setValidationError(error);
      onValidationChange?.(false, error);
      setBankName(null);
    } else {
      setValidationError(undefined);
      setBankName(null);
    }
  }, [internalValue, touched, showBankName, onValidationChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value.replace(/[^0-9-]/g, '');

    // Remove formatting if needed
    const cleaned = newValue.replace(/[^0-9]/g, '');

    // Limit to 9 digits
    if (cleaned.length > 9) return;

    // Apply formatting if enabled
    if (format) {
      newValue = formatRoutingNumber(cleaned);
    } else {
      newValue = cleaned;
    }

    setInternalValue(newValue);

    const isValid = cleaned.length === 9 && validateRoutingNumber(cleaned).valid;
    onChange?.(cleaned, isValid);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    props.onBlur?.(e);
  };

  const displayError = externalError || (touched ? validationError : undefined);
  const isValid = !displayError && internalValue.replace(/[^0-9]/g, '').length === 9;

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="XXX-XXX-XXX"
          value={format ? formatRoutingNumber(internalValue) : internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          aria-invalid={!!displayError}
          className={cn(
            'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            displayError && 'border-destructive ring-destructive/20',
            isValid && 'border-green-500',
            className
          )}
          {...props}
        />
        {isValid && (
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

      {bankName && !displayError && (
        <p className="text-sm text-muted-foreground">{bankName}</p>
      )}
    </div>
  );
}
