# Payeez for Salesforce Commerce Cloud

Payment orchestration integration for Salesforce Commerce Cloud (SFRA).

## Features

- **Multi-Processor Orchestration**: Automatic failover between payment processors
- **Smart Routing**: Route transactions to the optimal processor
- **Card Payments**: Visa, Mastercard, Amex, Discover, and more
- **Digital Wallets**: Apple Pay and Google Pay support
- **Tokenization**: Save cards for returning customers
- **3D Secure**: Built-in 3DS2 authentication
- **Refunds & Captures**: Full order management support

## Requirements

- Salesforce Commerce Cloud (SFRA 6.0+)
- Node.js 18+
- Payeez account with API keys

## Installation

### 1. Upload Cartridge

Upload the `int_payeez_sfra` cartridge to your SFCC instance.

### 2. Configure Cartridge Path

Add `int_payeez_sfra` to your cartridge path in Business Manager:

```
Administration > Sites > Manage Sites > [Your Site] > Settings
```

Add to the beginning of your cartridge path:
```
int_payeez_sfra:app_storefront_base
```

### 3. Import Metadata

Import the metadata from `metadata/` directory:

1. Go to Administration > Site Development > Import & Export
2. Upload and import `site-preferences.xml`
3. Upload and import `custom-objects.xml`
4. Upload and import `services.xml`

### 4. Configure Site Preferences

In Business Manager, go to:
```
Merchant Tools > Site Preferences > Custom Preferences > Payeez
```

Configure the following:

| Preference | Description |
|------------|-------------|
| payeezPublicKey | Your Payeez public key (pk_test_... or pk_live_...) |
| payeezSecretKey | Your Payeez secret key (sk_test_... or sk_live_...) |
| payeezMerchantId | Your merchant ID |
| payeezTestMode | Enable/disable test mode |
| payeezWebhookSecret | Webhook signing secret |
| payeezApplePayEnabled | Enable Apple Pay |
| payeezGooglePayEnabled | Enable Google Pay |

### 5. Configure Service Credentials

Set up the HTTP service credentials:
```
Administration > Operations > Services > Credentials
```

Create credential `payeez.http` with the base URL.

## Development

### Build Client Assets

```bash
npm install
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Cartridge Structure

```
int_payeez_sfra/
├── cartridge/
│   ├── cartridge.xml
│   ├── controllers/
│   │   └── Payeez.js           # Payment controller endpoints
│   ├── scripts/
│   │   ├── services/
│   │   │   └── payeezService.js    # API service layer
│   │   └── helpers/
│   │       ├── payeezHelper.js     # Utility functions
│   │       └── payeezWebhook.js    # Webhook handler
│   ├── templates/
│   │   └── default/
│   │       └── payeez/
│   │           └── paymentForm.isml
│   ├── client/
│   │   └── default/
│   │       └── js/
│   │           └── payeez.js       # Client-side SDK
│   └── static/
│       └── default/
│           └── js/
│               └── payeez.min.js   # Built bundle
```

## API Endpoints

### Create Session
`POST /Payeez-CreateSession`

Creates a payment session for the current basket.

### Confirm Payment
`POST /Payeez-ConfirmPayment`

Confirms payment after card entry.

### 3DS Return
`GET /Payeez-ThreeDSReturn`

Handles 3DS redirect return.

### Webhook
`POST /Payeez-Webhook`

Receives async payment notifications.

### Get Saved Cards
`GET /Payeez-GetSavedCards`

Returns saved payment methods for logged-in customer.

## Webhooks

Configure your webhook URL in the Payeez dashboard:

```
https://your-site.com/on/demandware.store/Sites-YourSite-Site/default/Payeez-Webhook
```

Supported events:
- `payment.completed`
- `payment.failed`
- `payment.captured`
- `payment.refunded`
- `payment.voided`
- `3ds.completed`

## Custom Object Types

### PayeezSavedCard

Stores tokenized card information for customers.

| Attribute | Type | Description |
|-----------|------|-------------|
| customerNo | String | Customer number |
| tokenId | String | Payeez token ID |
| cardBrand | String | Card brand (visa, mastercard, etc.) |
| last4 | String | Last 4 digits |
| expiryMonth | String | Expiry month |
| expiryYear | String | Expiry year |
| isDefault | Boolean | Default payment method |
| createdAt | DateTime | Creation timestamp |

## Order Custom Attributes

| Attribute | Description |
|-----------|-------------|
| payeezSessionId | Payment session ID |
| payeezTransactionId | Transaction ID |
| payeezPaymentStatus | Payment status |
| payeezCaptureId | Capture ID |
| payeezRefundId | Refund ID |
| payeezErrorMessage | Error message (if failed) |

## Testing

### Test Cards

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Declined |
| 4000 0000 0000 3220 | 3DS Required |

### Run Tests

```bash
npm test
npm run test:coverage
```

## Troubleshooting

### Payment form not loading
- Verify cartridge path includes `int_payeez_sfra`
- Check browser console for JavaScript errors
- Ensure Payeez SDK is loaded

### API errors
- Verify API keys in site preferences
- Check service configuration
- Review custom logs: `payeez-PayeezService`

### Webhook failures
- Verify webhook secret is configured
- Check webhook URL is accessible
- Review webhook logs

## Support

- Documentation: https://docs.payeez.com
- Dashboard: https://payeez.netlify.app/dashboard
- GitHub Issues: https://github.com/mgthompo1/payeez/issues

## License

MIT
