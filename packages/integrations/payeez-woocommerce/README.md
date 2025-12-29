# Payeez for WooCommerce

Accept payments via Payeez payment orchestration with support for cards, Apple Pay, Google Pay, and multi-processor failover.

## Features

- **Multi-Processor Orchestration**: Automatic failover between payment processors
- **Smart Routing**: Route transactions to the optimal processor
- **Card Payments**: Visa, Mastercard, Amex, Discover, and more
- **Digital Wallets**: Apple Pay and Google Pay support
- **Tokenization**: Save cards for returning customers
- **Subscriptions**: Full WooCommerce Subscriptions support
- **3D Secure**: Built-in 3DS authentication
- **Refunds**: Process refunds directly from WooCommerce

## Requirements

- WordPress 5.8+
- WooCommerce 6.0+
- PHP 7.4+
- SSL certificate (HTTPS)
- Payeez account with API keys

## Installation

1. Upload the `payeez-woocommerce` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to WooCommerce > Settings > Payments > Payeez
4. Enter your API keys from the Payeez dashboard
5. Enable the gateway

## Configuration

### API Keys

1. Log in to your [Payeez Dashboard](https://payeez.netlify.app/dashboard/api-keys)
2. Copy your Public Key (`pk_test_...` or `pk_live_...`)
3. Copy your Secret Key (`sk_test_...` or `sk_live_...`)
4. Paste them in the WooCommerce Payeez settings

### Test Mode

Enable test mode to process test transactions without charging real cards.

Test card numbers:
- `4242 4242 4242 4242` - Successful payment
- `4000 0000 0000 0002` - Declined payment
- `4000 0000 0000 3220` - 3DS required

### Apple Pay

1. Enable Apple Pay in settings
2. Paste your domain verification file contents
3. Register your domain in the Payeez dashboard

### Google Pay

1. Enable Google Pay in settings
2. Configure your Google Pay merchant ID in Payeez dashboard

## Hooks & Filters

### Filters

```php
// Customize gateway icon
add_filter('payeez_icon', function($icon_url) {
    return 'your-custom-icon-url.png';
});

// Modify session parameters
add_filter('payeez_session_params', function($params, $order) {
    $params['metadata']['custom_field'] = 'value';
    return $params;
}, 10, 2);
```

### Actions

```php
// After successful payment
add_action('payeez_payment_complete', function($order, $transaction_id) {
    // Your custom logic
}, 10, 2);

// After refund
add_action('payeez_refund_complete', function($order, $refund_id, $amount) {
    // Your custom logic
}, 10, 3);
```

## WooCommerce Subscriptions

The plugin fully supports WooCommerce Subscriptions:

- Initial subscription payments
- Automatic renewal payments
- Payment method changes
- Subscription suspensions/reactivations

Cards are automatically saved for subscription orders.

## Troubleshooting

### Enable Debug Logging

1. Go to WooCommerce > Settings > Payments > Payeez
2. Enable "Debug Mode"
3. Logs appear in WooCommerce > Status > Logs

### Common Issues

**Payment form not showing**
- Ensure jQuery is loaded
- Check browser console for JavaScript errors
- Verify API keys are correct

**Card declined**
- Check if using test cards in test mode
- Verify sufficient funds/limits
- Check processor error in Payeez dashboard

**Apple Pay not working**
- Domain must be verified
- Safari browser required
- HTTPS required

## Support

- Documentation: https://docs.payeez.com
- Dashboard: https://payeez.netlify.app/dashboard
- GitHub Issues: https://github.com/mgthompo1/payeez/issues

## License

GPL-2.0-or-later
