'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BankAccountCardProps {
  id: string;
  bankName?: string | null;
  accountType: 'checking' | 'savings';
  last4: string;
  routingLast4: string;
  holderName?: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'failed';
  isDefault?: boolean;
  nickname?: string | null;
  onVerify?: () => void;
  onSetDefault?: () => void;
  onRemove?: () => void;
  className?: string;
}

export function BankAccountCard({
  id,
  bankName,
  accountType,
  last4,
  routingLast4,
  holderName,
  verificationStatus,
  isDefault = false,
  nickname,
  onVerify,
  onSetDefault,
  onRemove,
  className,
}: BankAccountCardProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const statusConfig = {
    unverified: {
      label: 'Unverified',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    },
    pending: {
      label: 'Pending Verification',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    },
    verified: {
      label: 'Verified',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
  };

  const status = statusConfig[verificationStatus];

  return (
    <div
      className={cn(
        'relative rounded-lg border bg-card p-4 shadow-sm',
        isDefault && 'ring-2 ring-primary',
        className
      )}
    >
      {isDefault && (
        <span className="absolute -top-2.5 left-4 px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
          Default
        </span>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Bank icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
            <svg
              className="w-6 h-6 text-muted-foreground"
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

          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {nickname || bankName || 'Bank Account'}
              </span>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                  status.className
                )}
              >
                {status.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {accountType.charAt(0).toUpperCase() + accountType.slice(1)} ••••{last4}
            </p>
            {holderName && (
              <p className="text-sm text-muted-foreground">{holderName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Routing: •••••{routingLast4}
            </p>
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            aria-label="More options"
          >
            <svg
              className="w-5 h-5 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 rounded-md bg-popover border shadow-lg z-10">
              <div className="py-1">
                {verificationStatus === 'unverified' && onVerify && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onVerify();
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
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
                    Verify Account
                  </button>
                )}

                {verificationStatus === 'pending' && onVerify && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onVerify();
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
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
                    Complete Verification
                  </button>
                )}

                {!isDefault && verificationStatus === 'verified' && onSetDefault && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onSetDefault();
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Set as Default
                  </button>
                )}

                {onRemove && (
                  <>
                    <div className="border-t my-1" />
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onRemove();
                      }}
                      className="flex w-full items-center px-4 py-2 text-sm text-destructive hover:bg-muted"
                    >
                      <svg
                        className="mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Remove Account
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
