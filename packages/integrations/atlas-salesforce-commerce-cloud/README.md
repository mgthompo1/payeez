# Atlas for Salesforce Commerce Cloud

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
- Atlas account with API keys

## Installation

### 1. Upload Cartridge

Upload the `int_atlas_sfra` cartridge to your SFCC instance.

### 2. Configure Cartridge Path

Add `int_atlas_sfra` to your cartridge path in Business Manager:

```
Administration > Sites > Manage Sites > [Your Site] > Settings
```

Add to the beginning of your cartridge path:
```
int_atlas_sfra:app_storefront_base
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
Merchant Tools > Site Preferences > Custom Preferences > Atlas
```

Configure the following:

| Preference | Description |
|------------|-------------|
| atlasPublicKey | Your Atlas public key (pk_test_... or pk_live_...) |
| atlasSecretKey | Your Atlas secret key (sk_test_... or sk_live_...) |
| atlasMerchantId | Your merchant ID |
| atlasTestMode | Enable/disable test mode |
| atlasWebhookSecret | Webhook signing secret |
| atlasApplePayEnabled | Enable Apple Pay |
| atlasGooglePayEnabled | Enable Google Pay |

### 5. Configure Service Credentials

Set up the HTTP service credentials:
```
Administration > Operations > Services > Credentials
```

Create credential `atlas.http` with the base URL.

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
int_atlas_sfra/
├── cartridge/
│   ├── cartridge.xml
│   ├── controllers/
│   │   └── Atlas.js           # Payment controller endpoints
│   ├── scripts/
│   │   ├── services/
│   │   │   └── atlasService.js    # API service layer
│   │   └── helpers/
│   │       ├── atlasHelper.js     # Utility functions
│   │       └── atlasWebhook.js    # Webhook handler
│   ├── templates/
│   │   └── default/
│   │       └── atlas/
│   │           └── paymentForm.isml
│   ├── client/
│   │   └── default/
│   │       └── js/
│   │           └── atlas.js       # Client-side SDK
│   └── static/
│       └── default/
│           └── js/
│               └── atlas.min.js   # Built bundle
```

## API Endpoints

### Create Session
`POST /Atlas-CreateSession`

Creates a payment session for the current basket.

### Confirm Payment
`POST /Atlas-ConfirmPayment`

Confirms payment after card entry.

### 3DS Return
`GET /Atlas-ThreeDSReturn`

Handles 3DS redirect return.

### Webhook
`POST /Atlas-Webhook`

Receives async payment notifications.

### Get Saved Cards
`GET /Atlas-GetSavedCards`

Returns saved payment methods for logged-in customer.

## Webhooks

Configure your webhook URL in the Atlas dashboard:

```
https://your-site.com/on/demandware.store/Sites-YourSite-Site/default/Atlas-Webhook
```

Supported events:
- `payment.completed`
- `payment.failed`
- `payment.captured`
- `payment.refunded`
- `payment.voided`
- `3ds.completed`

## Custom Object Types

### AtlasSavedCard

Stores tokenized card information for customers.

| Attribute | Type | Description |
|-----------|------|-------------|
| customerNo | String | Customer number |
| tokenId | String | Atlas token ID |
| cardBrand | String | Card brand (visa, mastercard, etc.) |
| last4 | String | Last 4 digits |
| expiryMonth | String | Expiry month |
| expiryYear | String | Expiry year |
| isDefault | Boolean | Default payment method |
| createdAt | DateTime | Creation timestamp |

## Order Custom Attributes

| Attribute | Description |
|-----------|-------------|
| atlasSessionId | Payment session ID |
| atlasTransactionId | Transaction ID |
| atlasPaymentStatus | Payment status |
| atlasCaptureId | Capture ID |
| atlasRefundId | Refund ID |
| atlasErrorMessage | Error message (if failed) |

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
- Verify cartridge path includes `int_atlas_sfra`
- Check browser console for JavaScript errors
- Ensure Atlas SDK is loaded

### API errors
- Verify API keys in site preferences
- Check service configuration
- Review custom logs: `atlas-AtlasService`

### Webhook failures
- Verify webhook secret is configured
- Check webhook URL is accessible
- Review webhook logs

## Support

- Documentation: https://docs.atlas.com
- Dashboard: https://atlas.netlify.app/dashboard
- GitHub Issues: https://github.com/mgthompo1/atlas/issues

## License

MIT
