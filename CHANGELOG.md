# Changelog

All notable changes to Payeez will be documented in this file.

## [Unreleased]

### Added

#### Resilience & High Availability Architecture
- **Circuit Breaker Pattern** - Automatic failure detection with state transitions (CLOSED → OPEN → HALF_OPEN)
- **Multi-Region Failover** - SDK automatically routes to healthy endpoints
- **Health Monitoring** - Continuous health checks with cached results
- **Basis Theory Reactor Backup** - Payments continue even when Payeez is completely down
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
  - PSP adapters for Stripe, Adyen, Braintree
  - Activated when Payeez primary systems are down
  - Transaction recording for later sync

- VGS token handling in `confirm-payment` edge function
  - Added `vgs_data` field to ConfirmRequest interface
  - VGS proxy configuration for Stripe adapter

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
- Processor logos section (Stripe, Adyen, Braintree, etc.)
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

**Layer 2: Multi-Region Payeez Endpoints**
- Primary and secondary endpoint URLs
- Health-based routing with circuit breaker
- Automatic failover on endpoint failures

**Layer 3: Basis Theory Reactor**
- Backup orchestrator running in BT infrastructure
- Activated when Payeez is completely unavailable
- Processes payments directly with merchant's primary PSP
- Transactions flagged for later reconciliation

**Layer 4: Emergency Direct PSP**
- Last resort direct routing to processor
- Bypasses all Payeez infrastructure
- Ensures payments always succeed

### 3D Secure Flow

```
┌─────────┐     ┌─────────┐     ┌───────────┐     ┌─────────┐
│ Client  │────▶│ Payeez  │────▶│ BT 3DS    │────▶│ Card    │
│         │◀────│ API     │◀────│ Service   │◀────│ Network │
└─────────┘     └─────────┘     └───────────┘     └─────────┘
     │                                                  │
     │          ┌──────────────┐                        │
     └─────────▶│ Challenge    │◀───────────────────────┘
                │ (if needed)  │
                └──────────────┘
```

1. Merchant initiates 3DS authentication
2. Payeez calls Basis Theory Universal 3DS
3. Frictionless: Immediate authentication result
4. Challenge: User completes verification in iframe
5. Result returned with authentication value and ECI

### Network Tokens Flow

```
┌─────────┐     ┌─────────┐     ┌───────────┐     ┌─────────┐
│ Card    │────▶│ Payeez  │────▶│ Basis     │────▶│ Visa/MC │
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
- **Payment Processors**: Stripe, Adyen, Braintree, Checkout.com, etc.
- **Resilience**: Circuit Breaker, Basis Theory Reactors
- **Security**: 3D Secure 2.2.0, Network Tokens, PCI DSS compliant
