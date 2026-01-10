# Changelog

All notable changes to Atlas will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-01-10

### Added

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
