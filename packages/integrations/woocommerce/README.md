# Windcave for WooCommerce

A WooCommerce payment gateway plugin for [Windcave](https://www.windcave.com/) supporting Drop-in and Hosted Fields integration.

> Note: This codebase is being ported to Atlas. Update branding and API calls before production use.

## Features

- **Two Integration Modes**
  - **Drop-in**: Pre-built payment UI with all payment methods
  - **Hosted Fields**: Customizable card input fields for a seamless checkout experience

- **Payment Methods**
  - Credit/Debit Cards (Visa, Mastercard, Amex, Diners, Discover, JCB, UnionPay)
  - Apple Pay
  - Google Pay
  - PayPal, Alipay, WeChat Pay (via Drop-in)

- **Additional Features**
  - Card tokenization (save cards for future purchases)
  - 3D Secure authentication
  - WooCommerce Blocks checkout support
  - WooCommerce Subscriptions support
  - Refund processing from WooCommerce admin
  - FPRN (Fail Proof Result Notification) for reliable payment confirmation
  - Card scheme compliant storedCardIndicator support
  - Test mode with Windcave UAT environment
  - Debug logging

## Requirements

- WordPress 5.8+
- WooCommerce 6.0+
- PHP 7.4+
- SSL certificate (required for production)
- Windcave merchant account with REST API credentials

## Installation

### Method 1: Upload via WordPress Admin

1. Download the plugin as a ZIP file from this repository
2. Go to **WordPress Admin → Plugins → Add New → Upload Plugin**
3. Choose the ZIP file and click **Install Now**
4. Click **Activate**

### Method 2: Manual Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/mgthompo1/windcave-woocommerce.git
   ```

2. Copy the `windcave-woocommerce` folder to your WordPress plugins directory:
   ```bash
   cp -r windcave-woocommerce /path/to/wordpress/wp-content/plugins/
   ```

3. Go to **WordPress Admin → Plugins** and activate **Windcave for WooCommerce**

### Method 3: Composer (for developers)

```bash
composer require mgthompo1/windcave-woocommerce
```

## Configuration

1. Go to **WooCommerce → Settings → Payments**

2. Click **Manage** next to **Windcave**

3. Configure the following settings:

| Setting | Description |
|---------|-------------|
| **Enable/Disable** | Turn the payment gateway on or off |
| **Title** | Payment method name shown at checkout (e.g., "Credit/Debit Card") |
| **Description** | Description shown at checkout |
| **Test Mode** | Enable to use Windcave UAT (test) environment |
| **Integration Mode** | Choose between Drop-in or Hosted Fields |
| **Test API Username** | Your Windcave UAT API username |
| **Test API Key** | Your Windcave UAT API key |
| **Live API Username** | Your Windcave production API username |
| **Live API Key** | Your Windcave production API key |
| **Supported Card Types** | Select which cards to accept |
| **Enable Apple Pay** | Turn on Apple Pay (requires merchant ID) |
| **Enable Google Pay** | Turn on Google Pay (requires merchant ID) |
| **Debug Mode** | Enable logging for troubleshooting |

4. Click **Save changes**

## Getting Windcave API Credentials

1. Log in to your [Windcave Merchant Portal](https://sec.windcave.com/pxmi3/logon)
2. Navigate to **My Account → REST API**
3. Generate or copy your API username and API key
4. For testing, use the UAT portal at [uat.windcave.com](https://uat.windcave.com)

## Test Cards

When in test mode, use these card numbers:

| Card | Number | Expiry | CVV |
|------|--------|--------|-----|
| Visa (Approved) | 4111 1111 1111 1111 | Any future date | Any 3 digits |
| Mastercard (Approved) | 5431 1111 1111 1111 | Any future date | Any 3 digits |
| Visa (Declined) | 4000 0000 0000 0002 | Any future date | Any 3 digits |

## Integration Modes Explained

### Drop-in
The Drop-in integration provides a complete, pre-built payment form:
- Includes all payment methods (cards, wallets, alternatives)
- Handles UI/UX automatically
- Easier to implement
- Less customization options

### Hosted Fields
Hosted Fields allows you to customize the checkout appearance:
- Individual iframe fields for card number, expiry, CVV
- Style to match your theme
- More control over layout
- Requires more setup

## Apple Pay & Google Pay Express

Express checkout buttons allow customers to pay directly from the cart or mini-cart without going to the checkout page.

### Enabling Express Buttons

1. Go to **WooCommerce → Settings → Payments → Windcave**
2. Enable **Apple Pay** and/or **Google Pay**
3. Configure the respective merchant IDs
4. Enable **Apple Pay Express** and/or **Google Pay Express**
5. Save changes

### Apple Pay Domain Verification

For Apple Pay to work, you must verify your domain with Apple:

1. Get your domain verification file from Windcave or Apple
2. Paste the file contents into the **Apple Pay Domain Verification** field in settings
3. The plugin will serve the file at `/.well-known/apple-developer-merchantid-domain-association`

### Where Express Buttons Appear

- Cart page (below the cart totals)
- Mini-cart widget (WooCommerce Blocks)
- Mini-cart drawer

### Notes

- Apple Pay only appears on Safari (iOS/macOS) or devices with Apple Pay configured
- Google Pay works on Chrome, Firefox, and other supported browsers
- When Express is enabled for a payment method, it's disabled in the Drop-in to avoid duplication

## WooCommerce Subscriptions Support

This plugin fully supports [WooCommerce Subscriptions](https://woocommerce.com/products/woocommerce-subscriptions/) for recurring payments.

### Features
- Automatic recurring payments using saved cards
- Payment method changes by customers and admins
- Subscription suspension and reactivation
- Multiple subscriptions per order
- Proper storedCardIndicator compliance for card schemes

### How It Works

1. **Initial Payment**: When a customer purchases a subscription, their card is tokenized and stored securely with Windcave using the `recurringfixedinitial` indicator.

2. **Renewal Payments**: Subsequent subscription payments automatically charge the saved card using the `recurringfixed` indicator, identifying it as a merchant-initiated recurring transaction.

3. **Payment Method Changes**: Customers can update their payment method from their My Account page.

### Requirements
- WooCommerce Subscriptions 3.0 or higher
- Card tokenization must be enabled in Windcave settings

## FPRN (Fail Proof Result Notification)

FPRN provides reliable server-to-server payment confirmation, ensuring orders are updated even if the customer's browser fails to return to your site.

### How FPRN Works

1. When a payment completes, Windcave sends a notification to your configured FPRN endpoint
2. The plugin verifies the notification and updates the order status
3. This works alongside browser callbacks for redundancy

### FPRN Endpoint

Your FPRN URL is automatically configured:
```
https://yoursite.com/?wc-api=windcave_fprn
```

### Best Practices

- FPRN handles both GET and POST requests from Windcave
- Race condition prevention is built-in using WordPress transients
- Always responds with HTTP 200 to acknowledge receipt
- Duplicate notifications are safely ignored

## Stored Card Indicators

This plugin implements proper storedCardIndicator values for card scheme compliance (Visa, Mastercard requirements).

### Indicator Types

| Indicator | Usage |
|-----------|-------|
| `credentialonfileinitial` | First-time card storage for regular purchases |
| `credentialonfile` | Subsequent purchases using saved card |
| `recurringfixedinitial` | First payment of a subscription |
| `recurringfixed` | Recurring subscription renewals |
| `unscheduledcofinitial` | Initial unscheduled card-on-file storage |
| `unscheduledcof` | Subsequent unscheduled merchant-initiated payments |

### Automatic Handling

The plugin automatically selects the correct indicator based on:
- Whether the card is being stored for the first time
- Whether the order contains a subscription
- Whether this is a renewal payment

## Hooks & Filters

### Filters

```php
// Customize the gateway icon
add_filter('windcave_icon', function($icon_url) {
    return get_stylesheet_directory_uri() . '/images/custom-card-icons.png';
});
```

### Actions

```php
// After successful payment
add_action('woocommerce_payment_complete', function($order_id) {
    $order = wc_get_order($order_id);
    if ($order->get_payment_method() === 'windcave') {
        // Your custom logic
    }
});
```

## File Structure

```
windcave-woocommerce/
├── windcave-woocommerce.php              # Main plugin file
├── includes/
│   ├── class-windcave-gateway.php        # WC_Payment_Gateway implementation
│   ├── class-windcave-api.php            # Windcave REST API wrapper
│   ├── class-windcave-webhook.php        # Webhook/FPRN handler
│   ├── class-windcave-tokens.php         # Saved cards management
│   ├── class-windcave-subscriptions.php  # WooCommerce Subscriptions integration
│   └── blocks/
│       └── class-windcave-blocks-payment.php  # WooCommerce Blocks integration
├── assets/
│   ├── js/
│   │   ├── windcave-checkout.js          # Classic checkout JavaScript
│   │   ├── windcave-applepay-express.js  # Apple Pay Express for cart/mini-cart
│   │   ├── windcave-googlepay-express.js # Google Pay Express for cart/mini-cart
│   │   └── blocks/
│   │       └── index.js                  # React component for Blocks
│   ├── css/
│   │   └── windcave-checkout.css         # Checkout styles
│   └── images/
│       └── windcave-logo.png             # Windcave logo
├── readme.txt                            # WordPress plugin readme
├── README.md                             # This file
└── CHANGELOG.md                          # Version history
```

## Troubleshooting

### Enable Debug Logging

1. Go to **WooCommerce → Settings → Payments → Windcave**
2. Enable **Debug Mode**
3. View logs at **WooCommerce → Status → Logs** (filter by "windcave")
4. Check browser console for `[Windcave Apple Pay]` or `[Windcave Google Pay]` messages

### Payment form not loading

- Check browser console for JavaScript errors
- Ensure you have valid API credentials
- Verify SSL certificate is properly configured
- Clear browser cache and try again

### "Session error" message

- Check WooCommerce logs (**WooCommerce → Status → Logs → windcave**)
- Verify API credentials are correct
- Ensure your Windcave account has REST API access enabled

### 3D Secure popup not appearing

- Check that your browser allows popups from your site
- Some ad blockers may interfere with the 3DS iframe
- Try disabling browser extensions temporarily

### Apple Pay Express button not showing

1. **On iOS/Safari only**: Apple Pay requires Safari on iOS/macOS
2. **Domain verification**: Ensure domain verification file is configured in settings
3. **Merchant ID**: Verify Apple Pay Web Internal Merchant ID is correct
4. **Cards in Wallet**: Device must have cards configured in Apple Wallet
5. **Check console**: Look for `[Windcave Apple Pay] Apple Pay not available` with reasons

### Google Pay Express button not showing

1. **Supported browser**: Requires Chrome, Firefox, or other compatible browser
2. **Google Pay configured**: User must have Google Pay set up
3. **Merchant ID**: Verify Google Pay merchant ID is configured
4. **Check console**: Look for `[Windcave Google Pay]` messages

### Express buttons not appearing in mini-cart

1. **WooCommerce Blocks**: Must be using WooCommerce Blocks mini-cart
2. **Check selectors**: Open dev tools and look for `.wc-block-mini-cart__footer` elements
3. **Enable debug**: Check console for container injection messages
4. **Clear cache**: Some caching plugins may cache the mini-cart without the buttons

### "GoogleMid not provided" error

- This error appears when Google Pay is enabled but the merchant ID is missing
- Go to settings and enter your Google Pay Merchant ID
- If using Express checkout, ensure Google Pay Express is enabled (disables Drop-in Google Pay)

## Contributing

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

## License

This plugin is licensed under the GPL v2 or later.

## Support

- [Open an issue](https://github.com/mgthompo1/windcave-woocommerce/issues) for bug reports
- [Windcave Developer Documentation](https://www.windcave.com/developer-ecommerce-drop-in)
- [WooCommerce Documentation](https://woocommerce.com/documentation/)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### Latest: 1.2.2
- Fixed Hosted Fields 3DSecure premature order placement
- Fixed form submit recursion causing double-submissions
- Fixed order ID parsing for pay-for-order pages
- Improved cart total handling with server-side values
- Fixed Blocks null gateway guard
- Fixed expired tokens now filtered in Blocks checkout

### 1.2.1
- Fixed storeCard only set when customer opts to save card
- Fixed pending payments now set order to on-hold
- Fixed Express checkout now includes billing/shipping addresses
- Improved amount handling with WooCommerce helpers
- Improved API logging with response body masking

### 1.2.0
- Added Apple Pay Express for cart/mini-cart
- Added Google Pay Express for cart/mini-cart
- Added Apple Pay domain verification file hosting
- Added debug mode toggle for Express buttons
- Improved error handling with user-friendly messages
- Extended mini-cart selectors for better mobile support
- Fixed Drop-in not loading when Express is enabled
