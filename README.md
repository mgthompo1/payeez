# Atlas

Processor-agnostic payment orchestration platform built on Basis Theory.

## Overview

Atlas provides a unified payment API that:
- **Captures cards securely** via Basis Theory (no PCI scope for you)
- **Routes payments** to multiple PSPs (Stripe, Adyen, Authorize.net, Chase, Nuvei, dLocal, Braintree, Checkout.com, Airwallex)
- **Provides fallback** if capture fails (redirect to PSP hosted checkout)
- **Normalizes webhooks** across all PSPs
- **Subscription billing** with products, prices, trials, and metered usage
- **Hosted pages** for checkout, customer portal, and invoice payment

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  MERCHANT'S PAGE                                                │
│  └─ atlas.js (tries capture, falls back if fails)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPTURE LAYER (Basis Theory)                                   │
│  ├─ Hosted fields / Elements                                    │
│  ├─ Tokenizes PAN → alias                                       │
│  └─ You NEVER see card data                                     │
└─────────────────────────────────────────────────────────────────┘
                              │ (token only)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ATLAS API (Supabase Edge Functions)                           │
│  ├─ POST /create-session                                        │
│  ├─ POST /confirm-payment/{id}                                  │
│  ├─ Router (picks PSP based on rules)                           │
│  └─ PSP Adapters                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PSPs                                                           │
│  Stripe │ Adyen │ Authorize.net │ Chase │ Nuvei │ dLocal │ Braintree │ Checkout.com │ Airwallex │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@atlas/shared` | Shared types and interfaces |
| `@atlas/sdk` | Browser SDK with Basis Theory Elements |
| `@atlas/api` | Supabase Edge Functions (API + webhooks) |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

```bash
cd packages/api
npx supabase start
npx supabase db push
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in:
- Supabase credentials (from `supabase start` output)
- Basis Theory API keys (from your Basis Theory dashboard)
- PSP credentials (Stripe, etc.)

### 4. Start development

```bash
npm run dev
```

## Integration Example

### Server-side: Create a payment session

```javascript
const response = await fetch('https://api.atlas.co/functions/v1/create-session', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_xxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 4990,  // $49.90 in cents
    currency: 'NZD',
    external_id: 'order_123',
    customer: { email: 'buyer@example.com' },
    success_url: 'https://yoursite.com/success',
  }),
});

const { id, client_secret } = await response.json();
```

### Client-side: Mount payment form

```html
<div id="payment-form"></div>
<script src="https://js.atlas.co/v1.js"></script>
<script>
  Atlas.mount({
    sessionId: 'ps_xxx',
    clientSecret: 'cs_xxx',
    elementId: 'payment-form',
    onSuccess: (payment) => {
      window.location.href = '/success';
    },
    onError: (error) => {
      console.error(error);
    },
  });
</script>
```

## Routing Rules

Configure routing rules to direct payments to specific PSPs:

```sql
INSERT INTO routing_rules (tenant_id, priority, conditions, psp, weight)
VALUES (
  'your-tenant-id',
  10,
  '{"currency": "NZD", "amount_gte": 10000}',
  'adyen',
  100
);
```

This routes NZD payments over $100 to Adyen.

## Webhooks

Atlas normalizes webhooks from all PSPs into a common format:

```json
{
  "id": "evt_xxx",
  "type": "payment.captured",
  "data": {
    "payment_id": "py_xxx",
    "session_id": "ps_xxx",
    "amount": 4990,
    "currency": "NZD",
    "psp": "stripe"
  }
}
```

Event types:
- `payment.authorized`
- `payment.captured`
- `payment.failed`
- `refund.succeeded`
- `refund.failed`

## PCI Compliance

Atlas is **not** in PCI scope because:
- Card data is captured directly by Basis Theory Elements
- Only tokenized references are transmitted to Atlas
- PSP calls use Basis Theory's proxy to forward card data

Your merchants complete their own SAQ based on their PSP.

## Subscription Billing

Atlas includes Stripe-like subscription billing:

```javascript
// Create a subscription
const subscription = await fetch('https://api.atlas.co/functions/v1/subscriptions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_xxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    customer: 'cus_xxx',
    items: [{ price: 'price_xxx', quantity: 1 }],
    trial_period_days: 14,
  }),
});
```

Features:
- **Products & Prices** - One-time and recurring pricing
- **Subscriptions** - Full lifecycle management (trialing → active → canceled)
- **Usage-based billing** - Metered pricing with aggregation
- **Invoices** - Automatic invoice generation and collection
- **Coupons** - Percentage and fixed-amount discounts

## Hosted Pages

Pre-built, conversion-optimized payment pages:

```javascript
// Create a checkout session
const session = await fetch('https://api.atlas.co/functions/v1/checkout-sessions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_xxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mode: 'subscription',
    line_items: [{ price: 'price_xxx', quantity: 1 }],
    success_url: 'https://yoursite.com/success',
    cancel_url: 'https://yoursite.com/canceled',
  }),
});

// Redirect customer to hosted checkout
window.location.href = session.url;
```

Available pages:
- **Checkout** - Collect payment for one-time purchases or subscriptions
- **Customer Portal** - Self-service subscription and billing management
- **Invoice** - View and pay individual invoices

## License

MIT
