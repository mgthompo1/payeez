# Payeez

Processor-agnostic payment orchestration platform built on Basis Theory.

## Overview

Payeez provides a unified payment API that:
- **Captures cards securely** via Basis Theory (no PCI scope for you)
- **Routes payments** to multiple PSPs (Stripe, Windcave, Adyen, Fat Zebra, Cybersource)
- **Provides fallback** if capture fails (redirect to PSP hosted checkout)
- **Normalizes webhooks** across all PSPs

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  MERCHANT'S PAGE                                                │
│  └─ payeez.js (tries capture, falls back if fails)             │
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
│  PAYEEZ API (Supabase Edge Functions)                           │
│  ├─ POST /v1/payment-sessions                                   │
│  ├─ POST /v1/sessions/{id}/confirm                              │
│  ├─ Router (picks PSP based on rules)                           │
│  └─ PSP Adapters                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PSPs                                                           │
│  Stripe │ Windcave │ Adyen │ Fat Zebra │ Cybersource            │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@payeez/shared` | Shared types and interfaces |
| `@payeez/sdk` | Browser SDK with Basis Theory Elements |
| `@payeez/api` | Supabase Edge Functions (API + webhooks) |

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
const response = await fetch('https://api.payeez.co/v1/payment-sessions', {
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
<script src="https://js.payeez.co/v1.js"></script>
<script>
  Payeez.mount({
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
  'windcave',
  100
);
```

This routes NZD payments over $100 to Windcave.

## Webhooks

Payeez normalizes webhooks from all PSPs into a common format:

```json
{
  "id": "evt_xxx",
  "type": "payment.succeeded",
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
- `payment.succeeded`
- `payment.failed`
- `refund.succeeded`
- `refund.failed`

## PCI Compliance

Payeez is **not** in PCI scope because:
- Card data is captured directly by Basis Theory Elements
- Only tokenized references are transmitted to Payeez
- PSP calls use Basis Theory's proxy to forward card data

Your merchants complete their own SAQ based on their PSP.

## License

MIT
