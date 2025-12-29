# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2024-12-20

### Added
- **Tokenization Setting**: New "Saved Cards" toggle in settings to enable/disable card saving for customers
- **Subscriptions Info**: Settings section shows when WooCommerce Subscriptions is detected

## [1.2.2] - 2024-12-20

### Fixed
- **Hosted Fields 3DSecure**: No longer treats 3DSecure challenge as payment complete (was causing premature order placement)
- **Form Submit Recursion**: Uses native form.submit() instead of jQuery trigger to prevent double-submissions
- **Order ID Parsing**: Removed incorrect `key` URL parameter fallback (key is a string, not an order ID)
- **Cart Total Parsing**: Now uses server-side cart total; improved fallback parsing for international number formats
- **Blocks Null Gateway**: Added guard to prevent fatal errors when gateway not fully initialized
- **Expired Tokens in Blocks**: Now filters out expired cards using get_valid_customer_tokens()

## [1.2.1] - 2024-12-20

### Fixed
- **Card Storage**: storeCard now only set when customer opts to save card, subscription orders, or add-payment-method page
- **Pending Payments**: Orders with pending payments now set to on-hold instead of redirecting to thank-you page
- **Express Checkout Addresses**: Apple Pay and Google Pay Express orders now include billing/shipping addresses from wallet
- **Amount Handling**: Uses wc_format_decimal() instead of floatval() for proper currency handling
- **API Logging**: Response bodies are now masked to prevent sensitive data from appearing in logs
- **Missing API Method**: Added query_session() method alias for get_session()

### Changed
- Refactored duplicate order creation methods into unified create_order_from_cart() with payment type parameter

## [1.2.0] - 2024-12-19

### Added
- **Apple Pay Express**: Quick checkout button on cart page and mini-cart
- **Google Pay Express**: Quick checkout button on cart page and mini-cart
- **Domain Verification Hosting**: Automatically serve Apple Pay domain verification file from settings
- **Debug Mode for Express**: Console logging controlled by WooCommerce debug setting
- **User-friendly Error Messages**: Clear error messages for common payment failures
- **Extended Mini-cart Support**: Better compatibility with WooCommerce Blocks on mobile

### Changed
- Improved container detection for WooCommerce Blocks mini-cart
- Enhanced logging format with `[Windcave Apple Pay]` and `[Windcave Google Pay]` prefixes
- When Express is enabled, corresponding payment method is hidden from Drop-in to avoid duplication

### Fixed
- Drop-in not loading when Google Pay Express is enabled ("GoogleMid not provided" error)
- Express buttons not appearing on some mobile devices
- Double-click required to complete payment in some cases

## [1.1.0] - 2024-12-01

### Added
- **WooCommerce Subscriptions Support**: Full integration for recurring payments
- **FPRN Handling**: Fail Proof Result Notification for reliable payment confirmation
- **storedCardIndicator Compliance**: Proper card scheme compliance (Visa, Mastercard)
- **Token Expiry Checking**: Automatic validation of saved card expiry dates

### Changed
- Improved race condition handling between browser callbacks and FPRN
- Enhanced token storage with proper indicators

### Fixed
- Orders not completing when browser closes before callback
- Duplicate order processing from multiple callbacks

## [1.0.0] - 2024-11-01

### Added
- Initial release
- **Drop-in Integration**: Pre-built payment UI with all Windcave payment methods
- **Hosted Fields Integration**: Customizable card input fields
- **Card Payments**: Visa, Mastercard, Amex, Diners, Discover, JCB, UnionPay
- **Apple Pay**: Checkout integration (requires merchant configuration)
- **Google Pay**: Checkout integration (requires merchant configuration)
- **Card Tokenization**: Save cards for future purchases
- **3D Secure**: Full 3DS authentication support
- **WooCommerce Blocks**: React-based checkout support
- **Refund Processing**: Process refunds from WooCommerce admin
- **Test Mode**: Windcave UAT environment support
- **Debug Logging**: Comprehensive logging for troubleshooting

---

## Upgrade Notes

### Upgrading to 1.2.0
- If you previously had Google Pay enabled, check settings after upgrade
- New Apple Pay Express and Google Pay Express options are disabled by default
- Debug logging format has changed - look for `[Windcave ...]` prefix in console

### Upgrading to 1.1.0
- Existing saved cards will continue to work
- Subscription renewals will use proper `recurringfixed` indicator automatically
- FPRN is automatically enabled, no configuration needed
