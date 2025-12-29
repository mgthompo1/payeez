=== Windcave for WooCommerce ===
Contributors: mgthompo1
Tags: woocommerce, payment, windcave, credit card, apple pay, google pay
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Accept payments via Windcave with Drop-in and Hosted Fields integration, supporting cards, Apple Pay, Google Pay, and more.

== Description ==

Windcave for WooCommerce enables you to accept credit/debit card payments and digital wallets through Windcave's secure payment gateway.

= Features =

* **Two Integration Modes**: Choose between Drop-in (pre-built UI) or Hosted Fields (customizable)
* **All Major Cards**: Accept Visa, Mastercard, American Express, Diners, Discover, JCB, and UnionPay
* **Digital Wallets**: Apple Pay and Google Pay support
* **Alternative Payments**: PayPal, Alipay, WeChat Pay (via Drop-in)
* **Card Tokenization**: Allow customers to save cards for faster checkout
* **3D Secure**: Built-in 3DS authentication support
* **WooCommerce Blocks**: Full support for the new block-based checkout
* **Refunds**: Process refunds directly from WooCommerce
* **Test Mode**: Test your integration with Windcave's UAT environment

= Requirements =

* WordPress 5.8 or higher
* WooCommerce 6.0 or higher
* PHP 7.4 or higher
* SSL certificate (required for live payments)
* Windcave merchant account with REST API credentials

= Getting Started =

1. Install and activate the plugin
2. Go to WooCommerce > Settings > Payments > Windcave
3. Enter your Windcave API credentials
4. Configure your preferred integration mode and payment options
5. Enable the gateway and start accepting payments

== Installation ==

= Automatic Installation =

1. Log in to your WordPress dashboard
2. Navigate to Plugins > Add New
3. Search for "Windcave for WooCommerce"
4. Click "Install Now" and then "Activate"

= Manual Installation =

1. Download the plugin ZIP file
2. Log in to your WordPress dashboard
3. Navigate to Plugins > Add New > Upload Plugin
4. Choose the ZIP file and click "Install Now"
5. Activate the plugin

= Configuration =

1. Go to WooCommerce > Settings > Payments
2. Click "Manage" next to Windcave
3. Configure your settings:
   - Enable/Disable the gateway
   - Set title and description
   - Enable Test Mode for testing
   - Choose Integration Mode (Drop-in or Hosted Fields)
   - Enter your API credentials (test and/or live)
   - Select supported card types
   - Configure Apple Pay and Google Pay if needed
   - Enable debug logging if needed

== Frequently Asked Questions ==

= What is the difference between Drop-in and Hosted Fields? =

**Drop-in** provides a complete, pre-built payment form that includes all payment methods. It's easier to set up and automatically handles the UI.

**Hosted Fields** allows you to customize the payment form appearance while still maintaining PCI compliance. Individual fields (card number, expiry, CVV) are rendered in iframes.

= Do I need PCI compliance? =

Both Drop-in and Hosted Fields handle card data in secure iframes, which helps reduce your PCI compliance scope. However, you should still ensure your site uses SSL and follows security best practices.

= How do I test the integration? =

Enable "Test Mode" in the plugin settings and use your Windcave UAT (test) API credentials. You can then use test card numbers to simulate transactions.

= Can customers save their cards? =

Yes, the plugin supports card tokenization. Customers can save their cards during checkout for faster future payments. Saved cards are stored securely by Windcave.

= Does it work with WooCommerce Blocks? =

Yes, the plugin fully supports both the classic checkout shortcode and the new WooCommerce Blocks checkout.

= How do I enable Apple Pay or Google Pay? =

1. Enable the respective option in the plugin settings
2. Enter your Apple Pay Merchant ID and/or Google Pay Merchant ID
3. Ensure you have completed the Apple/Google Pay setup with Windcave

== Changelog ==

= 1.0.0 =
* Initial release
* Drop-in and Hosted Fields integration
* Credit/debit card payments
* Apple Pay and Google Pay support
* Card tokenization
* WooCommerce Blocks support
* Refund processing
* Test mode support

== Upgrade Notice ==

= 1.0.0 =
Initial release of Windcave for WooCommerce.

== Screenshots ==

1. Plugin settings page
2. Drop-in payment form on checkout
3. Hosted Fields payment form on checkout
4. Saved payment methods
5. Order payment details
