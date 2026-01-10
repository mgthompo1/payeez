'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { RoutingNumberInput } from './RoutingNumberInput';
import { AccountNumberInput } from './AccountNumberInput';

export interface BankAccountFormData {
  routingNumber: string;
  accountNumber: string;
  accountType: 'checking' | 'savings';
  holderName: string;
}

export interface BankAccountFormProps {
  onSubmit?: (data: BankAccountFormData) => void | Promise<void>;
  onChange?: (data: Partial<BankAccountFormData>, isComplete: boolean) => void;
  initialData?: Partial<BankAccountFormData>;
  disabled?: boolean;
  loading?: boolean;
  submitLabel?: string;
  showAccountType?: boolean;
  showHolderName?: boolean;
  layout?: 'vertical' | 'horizontal';
  className?: string;
  error?: string;
}

export function BankAccountForm({
  onSubmit,
  onChange,
  initialData,
  disabled = false,
  loading = false,
  submitLabel = 'Add Bank Account',
  showAccountType = true,
  showHolderName = true,
  layout = 'vertical',
  className,
  error: externalError,
}: BankAccountFormProps) {
  const [formData, setFormData] = React.useState<BankAccountFormData>({
    routingNumber: initialData?.routingNumber || '',
    accountNumber: initialData?.accountNumber || '',
    accountType: initialData?.accountType || 'checking',
    holderName: initialData?.holderName || '',
  });

  const [validations, setValidations] = React.useState({
    routingNumber: false,
    accountNumber: false,
    holderName: !showHolderName,
  });

  const [submitError, setSubmitError] = React.useState<string | undefined>();

  const isComplete = React.useMemo(() => {
    const hasRouting = validations.routingNumber;
    const hasAccount = validations.accountNumber;
    const hasHolder = !showHolderName || formData.holderName.trim().length > 0;
    return hasRouting && hasAccount && hasHolder;
  }, [validations, formData.holderName, showHolderName]);

  // Notify parent of changes
  React.useEffect(() => {
    onChange?.(formData, isComplete);
  }, [formData, isComplete, onChange]);

  const updateField = <K extends keyof BankAccountFormData>(
    field: K,
    value: BankAccountFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSubmitError(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isComplete || loading || disabled) return;

    try {
      await onSubmit?.(formData);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to add bank account');
    }
  };

  const displayError = externalError || submitError;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4', className)}
    >
      {showHolderName && (
        <div className="space-y-2">
          <label
            htmlFor="holderName"
            className="text-sm font-medium text-foreground"
          >
            Account Holder Name
          </label>
          <input
            id="holderName"
            type="text"
            autoComplete="name"
            placeholder="John Doe"
            value={formData.holderName}
            onChange={(e) => updateField('holderName', e.target.value)}
            disabled={disabled || loading}
            className={cn(
              'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
            )}
          />
        </div>
      )}

      <div
        className={cn(
          layout === 'horizontal' ? 'grid grid-cols-2 gap-4' : 'space-y-4'
        )}
      >
        <div className="space-y-2">
          <label
            htmlFor="routingNumber"
            className="text-sm font-medium text-foreground"
          >
            Routing Number
          </label>
          <RoutingNumberInput
            id="routingNumber"
            value={formData.routingNumber}
            onChange={(value, isValid) => {
              updateField('routingNumber', value);
              setValidations((prev) => ({ ...prev, routingNumber: isValid }));
            }}
            disabled={disabled || loading}
            showBankName
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="accountNumber"
            className="text-sm font-medium text-foreground"
          >
            Account Number
          </label>
          <AccountNumberInput
            id="accountNumber"
            value={formData.accountNumber}
            onChange={(value, isValid) => {
              updateField('accountNumber', value);
              setValidations((prev) => ({ ...prev, accountNumber: isValid }));
            }}
            disabled={disabled || loading}
            showMasked
          />
        </div>
      </div>

      {showAccountType && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Account Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="accountType"
                value="checking"
                checked={formData.accountType === 'checking'}
                onChange={() => updateField('accountType', 'checking')}
                disabled={disabled || loading}
                className="h-4 w-4 border-input text-primary focus:ring-ring"
              />
              <span className="text-sm">Checking</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="accountType"
                value="savings"
                checked={formData.accountType === 'savings'}
                onChange={() => updateField('accountType', 'savings')}
                disabled={disabled || loading}
                className="h-4 w-4 border-input text-primary focus:ring-ring"
              />
              <span className="text-sm">Savings</span>
            </label>
          </div>
        </div>
      )}

      {displayError && (
        <div className="rounded-md bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{displayError}</p>
        </div>
      )}

      {onSubmit && (
        <button
          type="submit"
          disabled={!isComplete || loading || disabled}
          className={cn(
            'inline-flex items-center justify-center w-full rounded-md text-sm font-medium h-10 px-4 py-2',
            'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
            'disabled:pointer-events-none disabled:opacity-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </>
          ) : (
            submitLabel
          )}
        </button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        By adding your bank account, you authorize debits and credits to this
        account in accordance with our terms.
      </p>
    </form>
  );
}
