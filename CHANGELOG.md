1# Changelog

All notable changes to Atlas will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3.0] - 2026-01-10

### Added

#### US ACH Payment Infrastructure

**Complete ACH/bank account payment system for US market:**

- **Bank Mandates API** (`/bank-mandates`)
  - Create, list, get, and revoke ACH authorization mandates
  - Captures legal authorization text, IP address, timestamp
  - Amount limits (per-transaction, daily, monthly)
  - Subscription linking support
  - NACHA-compliant authorization capture

- **Micro-Deposit Verification**
  - `POST /bank-accounts/:id/initiate-microdeposits` - Initiate verification
  - Random two-deposit amounts (1-99 cents)
  - 10-day expiry with 3 verification attempts
  - Status tracking (pending, verified, failed)

- **ACH Settlement Processor** (`/process-ach-transfers`)
  - Scheduled function for processing pending transfers
  - Stripe ACH integration for debits and credits
  - Automatic retry and failover logic
  - Expected settlement date tracking

- **ACH Webhook Handler** (`/ach-webhooks`)
  - Stripe ACH event handling (charge.succeeded, charge.failed, payout.paid)
  - ACH return code processing (R01-R99)
  - Risk event recording for returns
  - Automatic transfer status updates

- **Stripe Adapter ACH Methods**
  - `authorizeACH()` - ACH Direct Debit via PaymentIntents
  - `createACHPayout()` - ACH credits/payouts
  - `createExternalBankAccount()` - External account setup

### Fixed

#### Critical: Database Schema Alignment
- **Fixed `profile_id` → `tenant_id`** in bank-accounts API (7 occurrences)
- **Fixed `profile_id` → `tenant_id`** in bank-transfers API (7 occurrences)
- All bank account CRUD operations now work correctly with RLS

#### ACH Transfer Status Enum
- **Added `cancelled` to transfer_status enum** - Cancel endpoint now works
- Migration 00028: Adds cancelled status, unique idempotency index

#### Critical: ACH Infrastructure Fixes (Multi-Rail Orchestration)

**Complete rewrite of ACH processing to use modern Stripe APIs and multi-rail architecture:**

- **Modern Stripe ACH API** (process-ach-transfers)
  - Replaced legacy Stripe bank_account tokens with PaymentIntents + `us_bank_account`
  - Uses modern Stripe API version 2023-10-16
  - Proper mandate data for NACHA compliance
  - Payment method created inline with PaymentIntent (no deprecated tokens)

- **Bank Transfer Attempts Tracking** (Migration 00029)
  - New `bank_transfer_attempts` table mirrors `payment_attempts` pattern
  - Per-attempt status, failure tracking, and raw response storage
  - New `bank_transfer_events` table for webhook event log
  - Full audit trail with idempotency keys per attempt

- **ACH Adapter Architecture** (`_shared/ach/`)
  - `types.ts`: ACH adapter interface, return codes with severity
  - `stripe.ts`: Stripe ACH adapter using PaymentIntents + Financial Connections
  - `index.ts`: ACH orchestrator with routing explainability
  - Future-ready for Moov, PayPal ACH, NACHA file adapters

- **Credential Decryption Fixed**
  - Uses `decryptJson()` helper instead of raw JSON.parse fallback
  - ACH orchestrator properly retrieves and decrypts PSP credentials

- **Micro-Deposit Verification Wired**
  - `POST /bank-accounts/:id/initiate-microdeposits` now calls ACH adapter
  - Stripe SetupIntent created for micro-deposit flow
  - Financial Connections supported for instant verification
  - Verification provider reference stored for status checks

- **bank_account Rejected from confirm-payment**
  - ACH payments must use dedicated `/bank-transfers` API
  - Clear error message with guidance to proper endpoints
  - Prevents confusion between card and ACH payment flows

- **BANK_HASH_SALT Security**
  - Requires environment variable (no hardcoded fallback)
  - Fails fast with clear error if not configured

- **ACH Webhooks Updated**
  - Looks up `bank_transfer_attempts` by provider_reference first
  - Updates attempt status, then propagates to transfer
  - Records all events in `bank_transfer_events` table
  - Backwards compatible with legacy charge events
  - Enhanced ACH return code handling with severity levels

### Changed

#### Mandate Enforcement for Debits
- **Debits now require valid mandate** with proper authorization
- Bank account verification required before debit mandates
- Mandate limit checks (per-transaction, daily, monthly)
- Mandate expiry enforcement

#### Enhanced Transfer Creation
- Account verification required for debit transfers
- Customer ID linked from bank account
- Full mandate validation before processing

---

## [2.2.1] - 2026-01-10

### Fixed

#### Critical: Session Lock Timing
- **Session no longer gets stuck in 'processing'** if body parse/validation fails
- Body parsing and validation now happens BEFORE acquiring the database lock
- Added lock release in catch block for unexpected errors during payment processing
- Prevents orphaned sessions that require manual database intervention

#### PayPal Integration
- **PayPal added to all PSP CHECK constraints** in database schema (migration 00027)
  - `psp_credentials.psp`
  - `payment_attempts.psp`
  - `routing_rules.psp`
  - And related tables (psp_priorities, traffic_split_rules, retry_rules)
- **`requires_action` status** added to `payment_attempts.status` for 3DS/redirect flows
- **Fixed partial capture currency bug** - no longer hardcodes USD, uses order currency
- **Added `paypal` to PaymentMethodType** in OpenAPI spec
- **PayPal vault validation** - explicit error when using PayPal card processing with non-atlas vault

### Added
- PayPal wallet payment example in OpenAPI ConfirmPaymentRequest examples

---

## [2.2.0] - 2026-01-10

### Added

#### Stripe-Compatible Error Schema
- **Standardized error response format** following Stripe's pattern:
  - `type`: Error category (api_error, card_error, invalid_request_error, etc.)
  - `code`: Specific error code for programmatic handling
  - `message`: Human-readable error message
  - `decline_code`: Card-specific decline reason
  - `param`: Parameter that caused validation errors
  - `request_id`: Unique ID for debugging and support
  - `doc_url`: Link to error documentation

#### Request Tracing
- **`X-Request-Id` header** on all API responses
- Request IDs included in all error responses
- Format: `req_{timestamp}_{random}` for easy correlation

#### Session Lifecycle Endpoints
- **`GET /sessions/{id}`**: Retrieve session with full details
- **`PATCH /sessions/{id}`**: Update session (amount, metadata, customer, etc.)
- **`POST /sessions/{id}/cancel`**: Cancel with reason tracking
- Support for both API key and client secret authentication
- Full state machine documentation

#### Enhanced `requires_action` Response
- **`next_action` object** with Stripe-compatible format:
  - `type`: Action type (redirect)
  - `redirect_to_url.url`: Redirect URL for 3DS/PayPal
  - `redirect_to_url.return_url`: Return URL after completion
- **`three_d_secure` details** when available:
  - `version`: 3DS version used
  - `authentication_status`: Auth result
  - `eci`: Electronic Commerce Indicator

### Changed

#### HTTP Status Codes (Stripe-Compatible)
- **402 Payment Required**: Card/payment failures (was 400)
- **409 Conflict**: Idempotency conflicts and concurrent requests
- **401 Unauthorized**: Authentication failures
- Proper status codes for all error types

#### Session Config Response
- `capture_provider` now returns actual vault (atlas, basis_theory, vgs)
- Added `environment` field (test/live)
- Added `tokenize_url` for Atlas vault
- Provider-specific config based on tenant settings

#### OpenAPI Specification
- Updated error schemas with full Stripe-compatible format
- Added session lifecycle endpoints
- Added `requires_action` to SessionStatus enum
- Added `windcave` and `paypal` to PSPName enum
- Added PaymentSessionFull schema with next_action

---

## [2.1.0] - 2026-01-10

### Added

#### PayPal PSP Integration
- **Full PayPal adapter** supporting:
  - Advanced Card Payments (PCI SAQ D card processing through PayPal)
  - PayPal Wallet redirect flow
  - 3DS verification with `SCA_WHEN_REQUIRED`
  - PayPal Orders API v2 integration
- **PayPal webhook support**:
  - Signature verification via PayPal's verification API
  - Event normalization for checkout, capture, authorization, and refund events
  - Automatic session status updates from webhooks

#### 3DS Support in Confirm Flow
- **`requires_action` status handling**:
  - Returns redirect URL for 3DS/PayPal approval flows
  - Session status updated to `requires_action`
  - Includes `next_action.redirect_url` in response
  - 3DS version and status included when available

### Security Fixes

#### Critical: Double-Charge Prevention
- **Per-session atomic locking**: Uses database atomic update with conditional WHERE clause to prevent race conditions
- **Stable idempotency keys**: Removed `Date.now()` from key generation - now uses `atlas_{sessionId}_attempt_{attemptNumber}`
- **Blocked re-confirmation from `processing` status**: Prevents duplicate charges if user clicks confirm twice

#### Critical: PCI DSS 3.2.2 Compliance
- **CVC clearing after authorization**: `markTokenUsed()` now re-encrypts card data without CVC after successful payment
- **Token deactivation**: Tokens marked as inactive after use to prevent reuse

#### High: Cross-Tenant Data Leakage
- **Mandatory sessionId in production**: Tokenization endpoint requires valid sessionId in production
- **Session status validation**: Can only tokenize for sessions in `requires_payment_method` state
- **Tenant binding**: Tokens are explicitly bound to the tenant from the session

### Changed

- Webhooks endpoint now supports Stripe, Adyen, and PayPal (was Stripe + Adyen only)
- Confirm-payment flow properly handles PSP `requires_action` responses instead of treating them as failures

---

## [2.0.0] - 2026-01-10

### Breaking Changes

#### SDK v2.0 - New Initialization Pattern
- **`Atlas.configure()` → `Atlas.init()`**: New method name for initialization
- **`apiKey` → `publishableKey`**: Renamed for clarity (client-side key pattern)
- SDK now calls Atlas API directly instead of proxying through merchant's server

### Added

#### Hosted Fields SDK Support (`@atlas/sdk`)
- **`Atlas.elements(options)`**: Create ElementsInstance for custom payment forms
- **Individual Element Creation**:
  - `elements.create('cardNumber', options)` - Card number with brand detection
  - `elements.create('cardExpiry', options)` - Expiration date input
  - `elements.create('cardCvc', options)` - CVC/CVV input
  - `elements.create('cardHolder', options)` - Cardholder name
- **Element Instance Methods**:
  - `element.mount(elementId)` - Mount to DOM element
  - `element.unmount()` - Remove from DOM
  - `element.focus()` / `element.blur()` - Focus control
  - `element.clear()` - Clear input value
  - `element.update(options)` - Update configuration
  - `element.on(event, handler)` - Event subscription
- **Elements Instance Methods**:
  - `elements.createToken()` - Tokenize card data
  - `elements.confirmPayment(options)` - Confirm payment directly

#### Hosted Fields Documentation
- Complete guide for custom payment form integration
- Element types reference (cardNumber, cardExpiry, cardCvc, cardHolder)
- Event handling examples (ready, change, focus, blur, error)
- Element methods reference table
- Full React component example with validation state tracking
- Drop-in vs Hosted Fields comparison callout

#### API Playground Enhancements
- **Expanded to 45+ endpoints** (was 14):
  - Sessions: create-session, get-session, get-session-config
  - Payments: confirm, capture, refund, list, get
  - Customers: CRUD operations
  - Products: CRUD operations
  - Prices: create, list, get, update
  - Subscriptions: CRUD + cancel
  - Invoices: create, list, get, finalize, pay, void
  - Bank Accounts: create, list, get, verify, delete
  - Webhooks: CRUD operations
- **Grouped by Category**: Endpoints organized into logical groups
- **Default Request Bodies**: Pre-populated examples for all POST/PATCH endpoints
- **Scrollable Dropdown**: Max height for better UX with many endpoints

#### Public Documentation Route
- Created `/docs` route for public-facing API documentation
- Public header with Sign In/Get Started buttons
- Synced with dashboard docs content

### Changed

#### Dashboard Performance
- Added loading skeletons for all 14 dashboard pages
- Next.js optimizations: `optimizePackageImports` for lucide-react, radix-ui, recharts
- Image optimization with AVIF/WebP and 30-day cache
- Compression enabled

### Fixed

- API Playground "Failed to fetch" error - now uses correct Supabase functions URL
- Duplicate key warning in endpoint selector - changed to `${method}-${path}` keys

---

## [1.3.0] - 2026-01-10

### Added

#### Authentication & Session Management

- **GitHub OAuth Login**
  - One-click sign in with GitHub
  - OAuth callback handling with invite token support
  - Seamless integration with existing auth flow

- **Session Security**
  - Visible logout button in dashboard header
  - Idle timeout with 30-minute inactivity auto-logout
  - Warning modal with countdown before session expiry
  - "Stay logged in" option to reset timer

#### Billing Engine - Real Payment Processing

- **Production-Ready Invoice Charging**
  - Wire billing engine to real payment orchestrator
  - Automatic PSP selection via traffic splits and routing rules
  - Smart retry with failover to alternate processors
  - Proper idempotency keys for all charges

- **Shared Payment Processor Module** (`_shared/payment-processor.ts`)
  - Reusable `chargeToken()` function for subscription billing
  - Handles vault token retrieval for card data
  - Supports all 10 PSP adapters (Stripe, Adyen, Windcave, etc.)
  - Up to 3 retry attempts with automatic failover

- **Enhanced Failure Handling**
  - Real payment failure reasons from PSPs
  - Detailed logging for charge success/failure
  - Failure reasons included in customer emails
  - Billing job records track actual error messages

### Changed

#### Dashboard Performance Optimizations

- Replace double auth check with single `getSession()` call
- Parallel query execution in orchestration page
- Move Supabase client creation to component level
- Loading skeletons for improved perceived performance

#### Composable Payment Form Elements (`@atlas/elements`)

**Fully customizable, accessible payment form components:**

- **Individual Elements**
  - `CardNumberElement` - Card number input with brand detection (15 brands)
  - `CardExpiryElement` - MM/YY expiry with validation
  - `CardCvcElement` - CVC/CVV with card-aware length (3-4 digits)
  - `CardholderElement` - Cardholder name input
  - `CardElement` - Combined card form with flexible layout

- **Layout Components**
  - `TabsLayout` - Tabbed payment method selector (default, pills, underline variants)
  - `AccordionLayout` - Accordion payment method selector (radio-style selection)

- **Theming System**
  - 5 presets: `default`, `night`, `minimal`, `flat`, `modern`
  - 40+ CSS variables for full customization
  - Colors, typography, spacing, borders, shadows, transitions

- **Internationalization**
  - 40+ locales with full translations
  - RTL support for Arabic, Hebrew, Persian, Urdu
  - Auto-detection from browser settings

- **Accessibility (WCAG 2.1 AA)**
  - Full ARIA attributes on all elements
  - Keyboard navigation support
  - Screen reader announcements
  - Focus management

- **Card Brand Detection**
  - 15 supported brands: Visa, Mastercard, Amex, Discover, JCB, Diners, UnionPay, Maestro, Elo, Mir, Hiper, Hipercard, Troy, UATP, RuPay
  - Real-time brand icon display
  - Brand-specific validation rules

#### Vault Provider Abstraction Layer

**Provider-agnostic architecture for PCI scope flexibility:**

Enables Atlas to switch between vault/tokenization providers without code changes. Designed for future PCI compliance migration path.

- **Provider Interface** (`packages/api/src/lib/vault/`)
  - `VaultProvider` - Token storage and retrieval
  - `ProxyProvider` - PSP request forwarding with detokenization
  - Unified interface regardless of underlying provider

- **Supported Providers**
  - `atlas` - Current Atlas CDE (encrypted storage in Supabase, AES-256-GCM)
  - `basis_theory` - Basis Theory integration (stay out of PCI scope)
  - `vgs` - Very Good Security (stub for future implementation)

- **Configuration**
  - Single env var switch: `VAULT_PROVIDER=atlas|basis_theory|vgs`
  - Admin/platform-level config (not tenant-exposed)
  - Automatic provider initialization via factory pattern

- **PSP Helper** (`psp-helper.ts`)
  - Provider-agnostic card placeholders (`CARD.NUMBER`, `CARD.CVC`, etc.)
  - Pre-built payload formats for all supported PSPs
  - `forwardToPSP()` convenience function

- **Refactored Adapter Pattern**
  - Example Windcave adapter using vault abstraction
  - Same adapter code works with any provider
  - Placeholder substitution handled by proxy layer

### Architecture

```
VAULT_PROVIDER env var
        │
        ▼
┌───────────────────┐
│   getVault()      │──┬──▶ AtlasCDEVault (current, in PCI scope)
│   getProxy()      │  ├──▶ BasisTheoryVault (future, out of PCI scope)
└───────────────────┘  └──▶ VGSVault (future, out of PCI scope)
```

### PCI Compliance Path

This abstraction enables a phased approach to PCI compliance:

1. **Phase 1 (Current)**: `VAULT_PROVIDER=atlas` - Full control, in PCI scope
2. **Phase 2 (Future)**: `VAULT_PROVIDER=basis_theory` - Exit PCI scope via BT proxy
3. **Phase 3 (Optional)**: Build isolated CDE infrastructure if needed

### Files Added

```
packages/api/src/lib/vault/
├── index.ts              # Factory and exports
├── types.ts              # Provider interfaces
├── psp-helper.ts         # PSP request builders
├── providers/
│   ├── basis-theory.ts   # Basis Theory provider
│   └── atlas-cde.ts      # Atlas native vault provider
└── adapters/
    └── windcave.ts       # Example refactored adapter
```

---

#### A2A/ACH Bank Payments

**Complete Account-to-Account payment infrastructure:**

- **Bank Account Management**
  - Vaulted bank account storage (AES-256-GCM encryption)
  - ABA routing number validation with checksum
  - IBAN validation (MOD-97) for EU
  - UK sort code, Australian BSB, NZ/CA support
  - Duplicate detection via secure hashing
  - Bank name lookup from routing prefixes

- **Verification Flows**
  - Micro-deposit verification (two small deposits 1-99 cents)
  - Manual verification for B2B/trusted flows
  - Attempt limiting and expiry handling
  - Status tracking: `unverified` → `pending` → `verified`/`failed`

- **Settlement Providers**
  - **NACHA File Generator** - Full ACH file format
    - File/batch/entry records per NACHA spec
    - SEC codes: PPD, CCD, WEB, TEL, CTX
    - Prenote generation for account validation
    - Batch management and submission tracking
  - **Stripe ACH Adapter** - Leverage Stripe's rails
    - Payment method creation from vaulted data
    - PaymentIntent-based transfers
    - Webhook handling for status updates
    - Micro-deposit verification via Stripe

- **Risk-Based Transfer Validation**
  - Velocity limits (daily/monthly count and amount)
  - Negative account list checking
  - Mandate limit enforcement
  - Return history analysis
  - First transfer detection and restrictions
  - Risk scoring with approve/review/block recommendations

- **Mandates (Authorization Proof)**
  - Per-transfer, daily, and monthly limits
  - Expiration support
  - Signed authorization tracking
  - IP and user agent capture

- **Bank Transfers API**
  - Debit and credit directions
  - Idempotency key support
  - Status lifecycle: `pending` → `processing` → `settled`/`failed`/`returned`
  - ACH return code handling with recommended actions

- **Dashboard UI**
  - Bank accounts list with search and filtering
  - Verification status badges
  - Account detail sheet with transfer history
  - Micro-deposit verification modal
  - Add bank account form with real-time validation

- **UI Components** (`@atlas/elements`)
  - `RoutingNumberInput` - Auto-format, validation, bank name display
  - `AccountNumberInput` - Masked display, length validation
  - `BankAccountForm` - Complete form with account type selection
  - `MicrodepositVerification` - Two-amount entry with attempts
  - `BankAccountCard` - Display card with status and actions

### Files Added

```
packages/api/supabase/migrations/
└── 00024_bank_accounts_ach.sql    # Complete schema

packages/api/src/lib/bank/
├── index.ts                        # Module exports
├── types.ts                        # TypeScript interfaces
├── vault.ts                        # Encryption/decryption
├── verification/
│   └── microdeposit.ts            # Micro-deposit flow
├── settlement/
│   ├── nacha.ts                   # NACHA file generator
│   └── stripe-ach.ts              # Stripe ACH adapter
└── risk/
    ├── aba.ts                     # Routing validation
    └── validation.ts              # Risk assessment

packages/api/supabase/functions/
├── bank-accounts/index.ts         # Bank accounts API
└── bank-transfers/index.ts        # Transfers API

packages/web/src/components/bank/
├── index.ts                       # Component exports
├── utils.ts                       # Validation utilities
├── RoutingNumberInput.tsx         # Routing number input
├── AccountNumberInput.tsx         # Account number input
├── BankAccountForm.tsx            # Complete form
├── MicrodepositVerification.tsx   # Verification UI
└── BankAccountCard.tsx            # Account display card

packages/web/src/app/(dashboard)/dashboard/bank-accounts/
└── page.tsx                       # Dashboard page
```

#### Bank Module Enhancements (Platform-Grade)

Based on architecture review, added enterprise-ready abstractions:

- **Settlement Strategy Engine**
  - Cost/speed/liability-based rail selection
  - Pre-configured strategies: NACHA, Stripe ACH, Dwolla, RTP, FedNow
  - UK/EU strategies: Faster Payments, BACS, SEPA, SEPA Instant
  - AU/NZ/CA strategies: NPP, EFT
  - Cost estimation across all eligible rails
  - `selectSettlementStrategy()` with priority (cost/speed/reliability)

- **Account Capability Flags**
  - Per-account `can_debit`/`can_credit` detection
  - `supported_rails` array based on country + verification
  - `verification_level`: none → basic → verified → enhanced
  - Account restrictions: `no_debits`, `instant_blocked`, `review_required`, etc.
  - Auto-detection from verification status and return history
  - `canPerformTransfer()` validation helper

- **Verification Provider Abstraction**
  - Pluggable interface like vault providers
  - `VerificationProvider` interface with `initiate()`, `complete()`, `getStatus()`
  - Built-in providers: `manual`, `microdeposit`
  - Stub providers for: `plaid`, `finicity`, `tink`, `truelayer`
  - Auto-registration based on environment variables
  - Supports OAuth redirect flows and embedded widgets

- **Enhanced Mandate Engine**
  - `scope`: single, recurring, standing, blanket
  - `rail`: Links mandate to specific settlement type
  - `revocable`: Account holder cancellation rights
  - Enhanced limits: daily, weekly, monthly, yearly, lifetime
  - Schedule support for recurring mandates
  - `authorization` block: signed_at, consent_text, signature_type, evidence
  - Rail-specific IDs: SEPA mandate ID, BACS DDI reference
  - `validateMandateForTransfer()` with remaining limits
  - SEPA mandate XML generation

### Files Added

```
packages/api/src/lib/bank/
├── settlement/strategy.ts         # Settlement strategy engine
├── capabilities.ts                # Account capability detection
├── verification/index.ts          # Verification provider abstraction
└── mandate.ts                     # Enhanced mandate engine

packages/api/supabase/migrations/
└── 00025_bank_enhancements.sql    # Schema for capabilities, strategies, verification sessions
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Transfer Request                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Account Capabilities                                        │
│  can_debit? supported_rails? restrictions?                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Mandate Validation                                          │
│  scope? limits? schedule? authorization?                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Settlement Strategy Selection                               │
│  priority: cost | speed | reliability                        │
│  → NACHA ($0.25, 3 days)                                    │
│  → RTP ($1.00, instant)                                     │
│  → Stripe ACH (0.8%, 4 days)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Risk Assessment → Execute Transfer                          │
└─────────────────────────────────────────────────────────────┘
```

---

## [1.1.0] - 2026-01-09

### Added

#### SDK API Improvements (`@atlas/sdk`)
- **onChange events** - Real-time form state with `complete`, `empty`, `error`, and `brand` fields
- **onFocus/onBlur callbacks** - Field-level focus tracking for parent integration
- **Appearance API** - Full theming support:
  - Theme presets: `default`, `night`, `minimal`
  - CSS variables: `colorPrimary`, `colorBackground`, `colorText`, `colorDanger`, `colorSuccess`, `fontFamily`, `fontSizeBase`, `borderRadius`, `borderColor`, `spacingUnit`
- **update() method** - Control form state: `{ disabled: boolean, loading: boolean }`
- **clear() method** - Reset all form fields programmatically
- **focus() method** - Focus specific fields: `cardNumber`, `expiry`, `cvc`, `cardHolder`
- **Origin validation** - PostMessage security (enabled in production, relaxed in sandbox)
- **setApiBase()** - Configure custom API endpoint for self-hosted deployments

#### Elements Package (renamed from Tokenizer)
- **Renamed** `@atlas/tokenizer` → `@atlas/elements`
- **Theme support** - Parses appearance config and applies dynamic styling
- **Disabled/Loading states** - Responds to SDK `update()` calls
- **ATLAS_CHANGE messages** - Emits real-time validation state to parent
- **ATLAS_CLEAR/FOCUS messages** - Form control from parent

#### Windcave PSP Integration
- Full REST API adapter for NZ/AU payments
- Supports `purchase`, `authorize`, `capture`, `refund`, `void`
- Handles 202 async polling for transaction completion
- Added to dashboard PSP configuration UI

#### Atlas Native Vault
- In-house encrypted card storage (AES-256-GCM)
- Token expiration and cleanup
- No third-party vault dependencies

### Changed
- SDK config `tokenizerUrl` → `elementsUrl`
- Default URLs: `tokenizer.atlas.io` → `elements.atlas.io`
- Card form uses inline styles for theme flexibility

### Security
- PostMessage origin validation enabled by default
- Origin checks relaxed only for localhost in sandbox mode

---

## [1.2.0] - 2026-01-10

### Added

#### Subscriptions & Recurring Billing

**Complete subscription billing system:**

- **Products API** (`/products`)
  - Create and manage products with metadata
  - Link to multiple pricing tiers
  - Soft delete support

- **Prices API** (`/prices`)
  - One-time and recurring pricing
  - Billing schemes: `per_unit`, `tiered`
  - Usage types: `licensed`, `metered`
  - Intervals: `day`, `week`, `month`, `year` with custom counts
  - Metered aggregation: `sum`, `max`, `last_during_period`, `last_ever`

- **Subscriptions API** (`/subscriptions`)
  - Full lifecycle: `trialing` → `active` → `past_due` → `canceled`/`unpaid`/`paused`
  - Trial periods with/without payment method
  - Pause/resume functionality
  - Cancel at period end
  - Proration support for mid-cycle changes

- **Subscription Items API** (`/subscription-items`)
  - Add/remove/update items on subscriptions
  - Quantity changes with proration

- **Usage Records API** (`/usage-records`)
  - Report metered usage for subscription items
  - Usage summaries with aggregation

- **Invoices API** (`/invoices`)
  - Invoice lifecycle: `draft` → `open` → `paid`/`void`/`uncollectible`
  - Line items with descriptions and amounts
  - Actions: finalize, pay, void, mark-uncollectible
  - Automatic invoice generation for subscriptions

- **Coupons API** (`/coupons`)
  - Percentage or fixed amount discounts
  - Duration modes: `once`, `repeating`, `forever`
  - Max redemptions and expiry dates
  - Product-specific coupons

- **Billing Engine** (scheduled function)
  - Automatic invoice generation 1 day before period end
  - Smart retry scheduler (immediate, 1d, 3d, 7d, 14d)
  - Trial ending notifications
  - Automatic subscription cancellation after retry exhaustion

- **Transactional Emails** (Resend integration)
  - Invoice email with pay link when invoice is finalized
  - Payment receipt/confirmation on successful charge
  - Payment failed notification with retry date
  - Trial ending reminder (3 days before)
  - Subscription canceled confirmation
  - Custom domain: `atlaspay.cc`
  - Styled HTML templates matching Atlas branding

#### Hosted Payment Pages

- **Checkout Sessions API** (`/checkout-sessions`)
  - Create hosted checkout for one-time payments and subscriptions
  - Secure access tokens
  - Customizable success/cancel URLs
  - Customer pre-fill support

- **Portal Sessions API** (`/portal-sessions`)
  - Customer self-service portal
  - Configurable features per session
  - Subscription management
  - Invoice history access

- **Hosted Checkout Page** (`/checkout/[token]`)
  - Order summary with line items
  - Guest checkout with email collection
  - Trial period display
  - Subscription billing info
  - Redirect to success URL

- **Customer Portal** (`/portal/[token]`)
  - View active subscriptions
  - Pause/resume/cancel subscriptions
  - Invoice history and downloads
  - Payment method management

- **Invoice Payment Page** (`/invoice/[token]`)
  - Full invoice details with line items
  - Pay now functionality
  - Receipt download
  - Status display (paid, void, uncollectible)

#### Dashboard Updates

- **Products Page** (`/dashboard/products`)
  - Product list with expandable prices
  - Create/edit product dialogs
  - Price management with recurring options

- **Customers Page** (`/dashboard/customers`)
  - Customer list with search
  - Customer detail sheet with subscriptions/invoices
  - Subscription status overview

- **Subscriptions Page** (`/dashboard/subscriptions`)
  - Subscription list with status filtering
  - MRR calculation
  - Pause/resume/cancel actions
  - Trial and billing period display

- **Invoices Page** (`/dashboard/invoices`)
  - Invoice list with status filtering
  - Revenue stats cards
  - Finalize/pay/void actions

#### Database Schema

**New tables (12 total):**
- `customers` - Customer records with billing info
- `products` - What merchants sell
- `prices` - Pricing configurations
- `subscriptions` - Active subscription records
- `subscription_items` - Line items within subscriptions
- `usage_records` - Metered usage tracking
- `invoices` - Billing records
- `invoice_line_items` - Individual charges
- `coupons` - Discount templates
- `customer_discounts` - Applied coupons
- `portal_sessions` - Secure portal access
- `checkout_sessions` - Hosted checkout sessions

### Changed

- Added navigation items for Customers, Products, Subscriptions, Invoices
- Updated sidebar with new icons (Package, UserCircle, Repeat, Receipt)

---

## [Unreleased]

### Added

#### Enhanced Payment Session API
- **Merchant Reference** - Pass order/invoice ID to PSP for reconciliation (`merchant_reference`)
- **Customer Data** - Include customer email, name, phone for fraud prevention
- **Browser Info** - Browser IP and user agent for 3DS/risk assessment
- **Address Verification** - Billing/shipping addresses for AVS fraud scoring
- **Statement Descriptor** - Custom descriptor shown on cardholder statement
- **Metadata** - Arbitrary key-value pairs stored with the session

#### Windcave Adapter Enhancements
- AVS data passing for address verification
- Browser IP forwarding for 3DS risk assessment
- Statement descriptor support
- AVS/CVV/3DS result extraction from responses
- Metadata storage in Windcave's txnData1 field

#### Payment Attempt Tracking
- 3DS version, status, and ECI code tracking
- AVS and CVV result storage
- Browser IP logging per attempt

#### E2E Testing Framework (`packages/e2e`)
- **Playwright Setup** - Multi-browser testing (Chrome, Firefox, Safari, Mobile)
- **PSP Mock Fixtures** - Mock PSP responses for testing orchestration
- **Test Suites**:
  - Orchestration tests: failover, traffic splitting, retry logic
  - Dashboard tests: navigation, settings, API keys
  - Payment flow tests: session creation, validation, event logging

#### Resilience & High Availability Architecture
- **Circuit Breaker Pattern** - Automatic failure detection with state transitions (CLOSED → OPEN → HALF_OPEN)
- **Multi-Region Failover** - SDK automatically routes to healthy endpoints
- **Health Monitoring** - Continuous health checks with cached results
- **Basis Theory Reactor Backup** - Payments continue even when Atlas is completely down
- **Emergency Direct PSP** - Last-resort direct routing to merchant's primary processor
- **Multi-Vault Redundancy** - Dual tokenization with Basis Theory + VGS for vault failover

#### 3D Secure Authentication (`3DS`)
- **Universal 3DS 2.2.0/2.1.0** - Full 3DS authentication flow via Basis Theory
- **Frictionless Flow** - Risk-based authentication for low-risk transactions
- **Challenge Flow** - User verification for higher-risk payments
- **Liability Shift** - Automatic chargeback protection on authenticated transactions
- **Card Brand Support** - Visa, Mastercard, Amex, Discover, JCB

#### Network Tokens
- **Token Enrichment** - Convert card tokens to network tokens for higher auth rates (5-10% improvement)
- **Cryptogram Generation** - Dynamic cryptograms for cardholder-initiated transactions (CIT)
- **Lifecycle Management** - Automatic card updates from networks
- **Lower Interchange** - Reduced processing costs with network tokenization

#### API Card Collection Proxy
- **B2B Partner Integrations** - Receive cards via API without PCI scope
- **AI Agent Payments** - Enable autonomous systems to process payments
- **Webhook Card Collection** - Intercept and tokenize card data from webhooks
- **Content Type Support** - JSON, XML, form-urlencoded parsing
- **Field Path Mapping** - Configurable card data extraction from any request structure

#### SDK (`packages/sdk`)
- **Resilience Methods**
  - `getCircuitBreakerState()` - Check current circuit breaker status
  - `getHealthStatus()` - Query endpoint health
  - `getPendingSyncTransactions()` - List transactions from fallback mode
  - `syncPendingTransactions()` - Reconcile fallback transactions when recovered
- **3DS Methods**
  - `authenticate3DS()` - Initiate 3D Secure authentication
  - `handle3DSChallenge()` - Handle challenge flow iframe
- **Network Token Methods**
  - `createNetworkToken()` - Create network token for a card
  - `getCryptogram()` - Generate cryptogram for network token
- VGS (Very Good Security) vault integration support
  - `mountVGSCardElement()` - Mount VGS Collect card form
  - `confirmCardVGS()` - Confirm payment with VGS tokens
  - Updated `unmount()` to handle VGS form cleanup
- Multi-vault provider support (Basis Theory + VGS)
- Updated `confirmCard()` to route to appropriate vault provider

#### API (`packages/api`)

##### Edge Functions
- **`health/index.ts`** - Health check endpoint for load balancers and circuit breakers
  - Checks database connectivity
  - Checks Basis Theory API status
  - Returns `healthy`, `degraded`, or `down` status

- **`threeds-authenticate/index.ts`** - 3D Secure authentication endpoint
  - `POST /v1/3ds/authenticate` - Initiate 3DS authentication
  - `GET /v1/3ds/sessions/:id/result` - Get authentication result
  - `POST /v1/3ds/sessions/:id/challenge-complete` - Complete challenge flow
  - Card brand detection for merchant config lookup

- **`network-tokens/index.ts`** - Network token management
  - `POST /v1/network-tokens` - Create network token for a card
  - `POST /v1/network-tokens/:id/cryptogram` - Generate cryptogram
  - `GET /v1/network-tokens/:id` - Get network token details
  - `DELETE /v1/network-tokens/:id` - Delete/suspend network token

- **`card-collection-proxy/index.ts`** - API card collection proxy
  - Intercepts incoming card data from partners
  - Tokenizes via Basis Theory Token Intents
  - Forwards tokenized request to merchant destination
  - Supports JSON, XML, form-urlencoded content types
  - Rate limiting and authentication options

##### Shared Modules
- **`_shared/resilience.ts`** - Resilience utilities
  - `CircuitBreaker` class with state management
  - `HealthChecker` class with caching
  - `FailoverExecutor` for endpoint failover
  - `retryWithBackoff()` function
  - `dualVaultTokenize()` for multi-vault redundancy

##### Basis Theory Reactor
- **`basis-theory-reactor/backup-orchestrator.js`** - Backup payment orchestrator
  - Runs in Basis Theory infrastructure (not Supabase)
  - PSP adapters for major processors (Adyen, Braintree, etc.)
  - Activated when Atlas primary systems are down
  - Transaction recording for later sync

- VGS token handling in `confirm-payment` edge function
  - Added `vgs_data` field to ConfirmRequest interface
  - VGS proxy configuration for PSP adapters

##### Database Migrations
- **`00005_resilience_3ds_network_tokens.sql`** - Resilience and advanced features schema
  - `service_health` - Service health monitoring
  - `merchant_resilience_config` - Per-merchant resilience settings
  - `fallback_transactions` - Transactions processed in fallback mode
  - `threeds_config` - 3DS merchant configuration
  - `threeds_sessions` - 3DS authentication sessions
  - `network_tokens` - Network token storage
  - `network_token_events` - Token lifecycle events
  - `card_collection_proxies` - Proxy configuration
  - `proxy_token_intents` - Token intent tracking
  - `get_healthy_services()` - Function to query healthy services
  - `record_health_check()` - Function to record health status

- **`00004_orchestration_rules.sql`** - Orchestration rules schema
  - `orchestration_rules` table with weighted routing
  - `retry_rules` table for intelligent retry logic
  - `psp_health` table for processor health monitoring
  - `vault_provider` enum type

#### Web (`packages/web`)
- Complete UI redesign with dark theme
  - Modern dark color scheme (#0a0a0a, #111, white/10 borders)
  - Gradient accents (violet-500 to fuchsia-500)
  - Developer-focused, tech-forward design

##### Landing Page (`src/app/page.tsx`)
- Dark theme with animated gradient orbs
- Terminal-style code blocks with syntax highlighting
- Processor logos section (Adyen, Braintree, Nuvei, etc.)
- Feature grid with hover effects
- CTA section with grid pattern background

##### Dashboard Layout (`src/app/(dashboard)/layout.tsx`)
- Dark theme sidebar with gradient logo
- Test mode badge indicator
- User profile section at bottom
- Navigation with icons

##### Dashboard Pages
- **Overview** (`dashboard/page.tsx`)
  - Gradient stat cards with decorative backgrounds
  - Getting Started checklist
  - Quick Integration panel with code example
  - Recent activity feed

- **Transactions** (`dashboard/transactions/page.tsx`)
  - Dark theme search and filters
  - Status badges with color coding
  - Empty state with icon

- **API Keys** (`dashboard/api-keys/page.tsx`)
  - Dark theme table and dialogs
  - Copy to clipboard with feedback
  - Environment badges (live/test)
  - Warning alert for new key display

- **Webhooks** (`dashboard/webhooks/page.tsx`)
  - Dark theme endpoint management
  - Event selection with toggle chips
  - Delivery status indicators
  - Success/failure icons

- **Settings** (`dashboard/settings/page.tsx`)
  - Tabbed interface (General, Processors, Routing)
  - PSP connection cards with status
  - Environment configuration
  - Link to orchestration dashboard

- **Orchestration** (`dashboard/orchestration/page.tsx`)
  - Traffic distribution visualization bar
  - Weighted routing configuration
  - Retry rules with processor colors
  - PSP health monitoring cards
  - Removed Vault configuration tab (internal detail)

- **API Docs** (`dashboard/docs/page.tsx`)
  - Interactive tabbed documentation
  - Copy-to-clipboard code blocks
  - Collapsible endpoint cards
  - Request/response examples

##### Assets
- `public/grid.svg` - Background pattern for CTA sections

##### UI Components (via shadcn)
- Select component
- Dialog component
- Slider component
- Switch component
- Tabs component

### Changed
- Removed all user-facing references to Basis Theory and VGS (internal implementation details)
- Updated all dashboard pages to consistent dark theme
- Improved API documentation with interactive examples

### Fixed
- Supabase migration error for `vault_provider` type (conditional creation)
- Missing Select UI component build error
- Missing grid.svg 404 error

---

## Architecture Overview

### Payment Flow
1. Client mounts card element (Basis Theory or VGS)
2. Card data tokenized by vault provider
3. Client calls `confirmCard()` with session ID
4. Edge function processes payment with orchestration rules
5. Request routed to PSP based on weighted distribution
6. Retry logic handles failures with alternate processors

### Resilience Architecture (Enterprise Grade)

```
┌─────────────────────────────────────────────────────────────────┐
│                     SDK with Circuit Breaker                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Primary  │→ │ Fallback │→ │ BT       │→ │ Emergency        │ │
│  │ Endpoint │  │ Endpoints│  │ Reactor  │  │ Direct PSP       │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Layer 1: Multi-Vault Tokenization**
- Primary: Basis Theory
- Fallback: VGS (Very Good Security)
- Automatic failover if primary vault is unavailable

**Layer 2: Multi-Region Atlas Endpoints**
- Primary and secondary endpoint URLs
- Health-based routing with circuit breaker
- Automatic failover on endpoint failures

**Layer 3: Basis Theory Reactor**
- Backup orchestrator running in BT infrastructure
- Activated when Atlas is completely unavailable
- Processes payments directly with merchant's primary PSP
- Transactions flagged for later reconciliation

**Layer 4: Emergency Direct PSP**
- Last resort direct routing to processor
- Bypasses all Atlas infrastructure
- Ensures payments always succeed

### 3D Secure Flow

```
┌─────────┐     ┌─────────┐     ┌───────────┐     ┌─────────┐
│ Client  │────▶│ Atlas  │────▶│ BT 3DS    │────▶│ Card    │
│         │◀────│ API     │◀────│ Service   │◀────│ Network │
└─────────┘     └─────────┘     └───────────┘     └─────────┘
     │                                                  │
     │          ┌──────────────┐                        │
     └─────────▶│ Challenge    │◀───────────────────────┘
                │ (if needed)  │
                └──────────────┘
```

1. Merchant initiates 3DS authentication
2. Atlas calls Basis Theory Universal 3DS
3. Frictionless: Immediate authentication result
4. Challenge: User completes verification in iframe
5. Result returned with authentication value and ECI

### Network Tokens Flow

```
┌─────────┐     ┌─────────┐     ┌───────────┐     ┌─────────┐
│ Card    │────▶│ Atlas  │────▶│ Basis     │────▶│ Visa/MC │
│ Token   │     │ API     │     │ Theory    │     │ Network │
└─────────┘     └─────────┘     └───────────┘     └─────────┘
                     │                                  │
                     ▼                                  ▼
              ┌──────────────┐                ┌──────────────┐
              │ Network      │                │ Cryptogram   │
              │ Token ID     │                │ (TAVV/DTVV)  │
              └──────────────┘                └──────────────┘
```

- Convert card tokens to network tokens
- Generate cryptograms for each transaction
- Automatic card lifecycle updates from networks
- 5-10% higher authorization rates
- Lower interchange costs

### Orchestration System
- **Weighted Routing**: Distribute traffic across PSPs by percentage
- **Retry Rules**: Automatic failover on specific error codes
- **Health Monitoring**: Track PSP success rates and latency

### Technology Stack
- **Frontend**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL (Supabase)
- **Vault Providers**: Basis Theory, VGS
- **Payment Processors**: Adyen, Braintree, Checkout.com, Nuvei, Windcave, etc.
- **Resilience**: Circuit Breaker, Basis Theory Reactors
- **Security**: 3D Secure 2.2.0, Network Tokens, PCI DSS compliant
