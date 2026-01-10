'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MicrodepositVerificationProps {
  onVerify: (amounts: [number, number]) => Promise<{ verified: boolean; error?: string; attemptsRemaining?: number }>;
  onResend?: () => Promise<void>;
  maxAttempts?: number;
  attemptsRemaining?: number;
  expiresAt?: string;
  canResend?: boolean;
  className?: string;
}

export function MicrodepositVerification({
  onVerify,
  onResend,
  maxAttempts = 3,
  attemptsRemaining: initialAttemptsRemaining,
  expiresAt,
  canResend = false,
  className,
}: MicrodepositVerificationProps) {
  const [amount1, setAmount1] = React.useState('');
  const [amount2, setAmount2] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [verified, setVerified] = React.useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = React.useState(
    initialAttemptsRemaining ?? maxAttempts
  );
  const [resending, setResending] = React.useState(false);

  const amount1Ref = React.useRef<HTMLInputElement>(null);
  const amount2Ref = React.useRef<HTMLInputElement>(null);

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  const handleAmount1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 2) {
      setAmount1(value);
      setError(undefined);
      if (value.length === 2) {
        amount2Ref.current?.focus();
      }
    }
  };

  const handleAmount2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 2) {
      setAmount2(value);
      setError(undefined);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    const amt1 = parseInt(amount1, 10);
    const amt2 = parseInt(amount2, 10);

    if (isNaN(amt1) || isNaN(amt2) || amt1 < 1 || amt2 < 1 || amt1 > 99 || amt2 > 99) {
      setError('Please enter valid amounts (1-99 cents each)');
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const result = await onVerify([amt1, amt2]);

      if (result.verified) {
        setVerified(true);
      } else {
        setError(result.error || 'Incorrect amounts. Please try again.');
        if (result.attemptsRemaining !== undefined) {
          setAttemptsRemaining(result.attemptsRemaining);
        } else {
          setAttemptsRemaining((prev) => Math.max(0, prev - 1));
        }
        setAmount1('');
        setAmount2('');
        amount1Ref.current?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!onResend || resending) return;

    setResending(true);
    setError(undefined);

    try {
      await onResend();
      setAmount1('');
      setAmount2('');
      setAttemptsRemaining(maxAttempts);
    } catch (err: any) {
      setError(err.message || 'Failed to resend deposits');
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            xmlns="http://www.w3.org/2000/svg"
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
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Bank Account Verified
        </h3>
        <p className="text-sm text-muted-foreground">
          Your bank account has been successfully verified and is ready to use.
        </p>
      </div>
    );
  }

  if (attemptsRemaining === 0) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-destructive"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Verification Failed
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Maximum verification attempts exceeded. Please add a new bank account
          or contact support.
        </p>
        {canResend && onResend && (
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            {resending ? 'Resending...' : 'Request new deposits'}
          </button>
        )}
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Deposits Expired
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          The micro-deposits have expired. Please request new deposits to
          continue verification.
        </p>
        {canResend && onResend && (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
          >
            {resending ? 'Resending...' : 'Request New Deposits'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('p-6', className)}>
      <div className="text-center mb-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-primary"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Verify Your Bank Account
        </h3>
        <p className="text-sm text-muted-foreground">
          We sent two small deposits to your bank account. Enter the amounts
          below to verify your account.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="flex gap-4 justify-center">
          <div className="space-y-2">
            <label
              htmlFor="amount1"
              className="text-sm font-medium text-foreground block text-center"
            >
              First Deposit
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $0.
              </span>
              <input
                ref={amount1Ref}
                id="amount1"
                type="text"
                inputMode="numeric"
                placeholder="XX"
                value={amount1}
                onChange={handleAmount1Change}
                disabled={loading}
                className={cn(
                  'h-12 w-24 rounded-md border bg-transparent pl-10 pr-3 py-2 text-center text-lg font-mono',
                  'border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                  'placeholder:text-muted-foreground disabled:opacity-50'
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="amount2"
              className="text-sm font-medium text-foreground block text-center"
            >
              Second Deposit
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $0.
              </span>
              <input
                ref={amount2Ref}
                id="amount2"
                type="text"
                inputMode="numeric"
                placeholder="XX"
                value={amount2}
                onChange={handleAmount2Change}
                disabled={loading}
                className={cn(
                  'h-12 w-24 rounded-md border bg-transparent pl-10 pr-3 py-2 text-center text-lg font-mono',
                  'border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                  'placeholder:text-muted-foreground disabled:opacity-50'
                )}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || amount1.length !== 2 || amount2.length !== 2}
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
              Verifying...
            </>
          ) : (
            'Verify Account'
          )}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''}{' '}
          remaining
        </p>
      </form>
    </div>
  );
}
