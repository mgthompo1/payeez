# Atlas for Salesforce Order Management

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
- Atlas account with API keys

## Installation

### 1. Clone and Deploy

```bash
# Clone the repository
git clone https://github.com/mgthompo1/atlas.git
cd atlas/packages/integrations/atlas-salesforce-oms

# Authenticate to your org
sf org login web -a MyOrg

# Deploy to org
sf project deploy start --target-org MyOrg
```

### 2. Configure Custom Settings

Navigate to Setup > Custom Settings > Atlas Settings > Manage

Create a new organization default with:

| Field | Description |
|-------|-------------|
| PublicKey__c | Your Atlas public key (pk_test_... or pk_live_...) |
| SecretKey__c | Your Atlas secret key (sk_test_... or sk_live_...) |
| MerchantId__c | Your merchant ID |
| TestMode__c | Enable/disable test mode |
| WebhookSecret__c | Webhook signing secret |

### 3. Configure Remote Site Settings

Add the Atlas API endpoint to Remote Site Settings:
- URL: `https://yssswpqpwrrglgroxwok.supabase.co`

### 4. Upload Static Resource

Upload the Atlas SDK JavaScript file as a static resource:
- Name: `AtlasSDK`
- File: atlas.min.js from CDN

### 5. Configure Webhook

Set up your webhook URL in the Atlas dashboard:

```
https://your-salesforce-instance.my.salesforce.com/services/apexrest/atlas/webhook
```

Configure a Connected App or Public Site for webhook authentication.

## Project Structure

```
force-app/
├── main/
│   └── default/
│       ├── classes/
│       │   ├── AtlasService.cls           # API service layer
│       │   ├── AtlasModels.cls            # Data models
│       │   ├── AtlasException.cls         # Custom exception
│       │   ├── AtlasOMSAdapter.cls        # OMS integration adapter
│       │   ├── AtlasPaymentController.cls # LWC controller
│       │   └── AtlasWebhookResource.cls   # REST webhook handler
│       ├── lwc/
│       │   └── atlasPayment/              # Lightning Web Component
│       ├── objects/
│       │   ├── AtlasSettings__c/          # Custom settings
│       │   ├── AtlasOrderPayment__c/      # Payment records
│       │   ├── AtlasSavedCard__c/         # Saved cards
│       │   └── AtlasPaymentLog__c/        # Payment logs
│       └── flows/
│           └── Atlas_Capture_On_Fulfillment.flow
```

## Usage

### Lightning Web Component

Add the `atlasPayment` component to Order Summary or Order record pages:

1. Go to Setup > Object Manager > Order Summary > Lightning Record Pages
2. Edit the page
3. Drag `Atlas Payment` component onto the page
4. Save and activate

### Apex Integration

```apex
// Process payment for order
AtlasPaymentResponse response = AtlasOMSAdapter.processOrderPayment(orderSummaryId);

// Capture on fulfillment
AtlasCaptureResponse capture = AtlasOMSAdapter.captureForFulfillment(
    orderSummaryId,
    fulfillmentOrderId,
    100.00
);

// Process refund
AtlasRefundResponse refund = AtlasOMSAdapter.processRefund(
    orderSummaryId,
    50.00,
    'Customer return'
);
```

### Flow Integration

Use the provided Flow actions:

- **Atlas: Create Session** - Create payment session
- **Atlas: Capture Payment** - Capture authorized amount
- **Atlas: Refund Payment** - Process refund

## Custom Objects

### AtlasOrderPayment__c

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

### AtlasSavedCard__c

Stores tokenized card information.

| Field | Type | Description |
|-------|------|-------------|
| TokenId__c | Text | Atlas token ID |
| CardBrand__c | Text | Card brand |
| Last4__c | Text | Last 4 digits |
| ExpiryMonth__c | Text | Expiry month |
| ExpiryYear__c | Text | Expiry year |

### AtlasPaymentLog__c

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
- Review debug logs for AtlasService

### LWC Not Loading

- Verify AtlasSDK static resource is uploaded
- Check browser console for JavaScript errors
- Ensure component is properly configured on page

### Webhook Failures

- Verify webhook secret is configured
- Check Connected App or Public Site setup
- Review REST API logs

## Support

- Documentation: https://docs.atlas.com
- Dashboard: https://atlas.netlify.app/dashboard
- GitHub Issues: https://github.com/mgthompo1/atlas/issues

## License

MIT
