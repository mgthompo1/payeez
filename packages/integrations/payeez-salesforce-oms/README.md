# Payeez for Salesforce Order Management

Payment orchestration integration for Salesforce Order Management System (OMS).

## Features

- **Multi-Processor Orchestration**: Automatic failover between payment processors
- **Smart Routing**: Route transactions to the optimal processor
- **Card Payments**: Visa, Mastercard, Amex, Discover, and more
- **Tokenization**: Save cards for returning customers
- **Captures & Refunds**: Full order lifecycle support
- **Lightning Web Component**: Ready-to-use payment UI
- **Webhook Support**: Async payment status updates

## Requirements

- Salesforce Order Management (OMS)
- Salesforce CLI (sf)
- Payeez account with API keys

## Installation

### 1. Clone and Deploy

```bash
# Clone the repository
git clone https://github.com/mgthompo1/payeez.git
cd payeez/packages/integrations/payeez-salesforce-oms

# Authenticate to your org
sf org login web -a MyOrg

# Deploy to org
sf project deploy start --target-org MyOrg
```

### 2. Configure Custom Settings

Navigate to Setup > Custom Settings > Payeez Settings > Manage

Create a new organization default with:

| Field | Description |
|-------|-------------|
| PublicKey__c | Your Payeez public key (pk_test_... or pk_live_...) |
| SecretKey__c | Your Payeez secret key (sk_test_... or sk_live_...) |
| MerchantId__c | Your merchant ID |
| TestMode__c | Enable/disable test mode |
| WebhookSecret__c | Webhook signing secret |

### 3. Configure Remote Site Settings

Add the Payeez API endpoint to Remote Site Settings:
- URL: `https://yssswpqpwrrglgroxwok.supabase.co`

### 4. Upload Static Resource

Upload the Payeez SDK JavaScript file as a static resource:
- Name: `PayeezSDK`
- File: payeez.min.js from CDN

### 5. Configure Webhook

Set up your webhook URL in the Payeez dashboard:

```
https://your-salesforce-instance.my.salesforce.com/services/apexrest/payeez/webhook
```

Configure a Connected App or Public Site for webhook authentication.

## Project Structure

```
force-app/
├── main/
│   └── default/
│       ├── classes/
│       │   ├── PayeezService.cls           # API service layer
│       │   ├── PayeezModels.cls            # Data models
│       │   ├── PayeezException.cls         # Custom exception
│       │   ├── PayeezOMSAdapter.cls        # OMS integration adapter
│       │   ├── PayeezPaymentController.cls # LWC controller
│       │   └── PayeezWebhookResource.cls   # REST webhook handler
│       ├── lwc/
│       │   └── payeezPayment/              # Lightning Web Component
│       ├── objects/
│       │   ├── PayeezSettings__c/          # Custom settings
│       │   ├── PayeezOrderPayment__c/      # Payment records
│       │   ├── PayeezSavedCard__c/         # Saved cards
│       │   └── PayeezPaymentLog__c/        # Payment logs
│       └── flows/
│           └── Payeez_Capture_On_Fulfillment.flow
```

## Usage

### Lightning Web Component

Add the `payeezPayment` component to Order Summary or Order record pages:

1. Go to Setup > Object Manager > Order Summary > Lightning Record Pages
2. Edit the page
3. Drag `Payeez Payment` component onto the page
4. Save and activate

### Apex Integration

```apex
// Process payment for order
PayeezPaymentResponse response = PayeezOMSAdapter.processOrderPayment(orderSummaryId);

// Capture on fulfillment
PayeezCaptureResponse capture = PayeezOMSAdapter.captureForFulfillment(
    orderSummaryId,
    fulfillmentOrderId,
    100.00
);

// Process refund
PayeezRefundResponse refund = PayeezOMSAdapter.processRefund(
    orderSummaryId,
    50.00,
    'Customer return'
);
```

### Flow Integration

Use the provided Flow actions:

- **Payeez: Create Session** - Create payment session
- **Payeez: Capture Payment** - Capture authorized amount
- **Payeez: Refund Payment** - Process refund

## Custom Objects

### PayeezOrderPayment__c

Stores payment information for orders.

| Field | Type | Description |
|-------|------|-------------|
| OrderSummaryId__c | Lookup | Order Summary reference |
| SessionId__c | Text | Payment session ID |
| TransactionId__c | Text | Transaction ID |
| Status__c | Picklist | Payment status |
| CapturedAmount__c | Currency | Captured amount |
| RefundedAmount__c | Currency | Refunded amount |
| ErrorMessage__c | Text | Error message (if failed) |

### PayeezSavedCard__c

Stores tokenized card information.

| Field | Type | Description |
|-------|------|-------------|
| TokenId__c | Text | Payeez token ID |
| CardBrand__c | Text | Card brand |
| Last4__c | Text | Last 4 digits |
| ExpiryMonth__c | Text | Expiry month |
| ExpiryYear__c | Text | Expiry year |

### PayeezPaymentLog__c

Audit log for payment operations.

| Field | Type | Description |
|-------|------|-------------|
| OrderSummaryId__c | Lookup | Order Summary reference |
| Action__c | Picklist | Action type (Capture, Refund, etc.) |
| Amount__c | Currency | Amount |
| ReferenceId__c | Text | Reference ID |

## Webhook Events

Supported webhook events:

- `payment.completed` - Payment authorized successfully
- `payment.failed` - Payment declined or failed
- `payment.captured` - Payment captured
- `payment.refunded` - Payment refunded (full or partial)

## Testing

### Test Cards

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Declined |
| 4000 0000 0000 3220 | 3DS Required |

### Run Tests

```bash
sf apex run test --target-org MyOrg --code-coverage --result-format human
```

## Troubleshooting

### API Errors

- Verify API keys in custom settings
- Check Remote Site Settings
- Review debug logs for PayeezService

### LWC Not Loading

- Verify PayeezSDK static resource is uploaded
- Check browser console for JavaScript errors
- Ensure component is properly configured on page

### Webhook Failures

- Verify webhook secret is configured
- Check Connected App or Public Site setup
- Review REST API logs

## Support

- Documentation: https://docs.payeez.com
- Dashboard: https://payeez.netlify.app/dashboard
- GitHub Issues: https://github.com/mgthompo1/payeez/issues

## License

MIT
