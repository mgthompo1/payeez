<?php
/**
 * Plugin Name: Payeez for WooCommerce
 * Plugin URI: https://github.com/mgthompo1/payeez
 * Description: Accept payments via Payeez payment orchestration with support for cards, Apple Pay, Google Pay, and multi-processor failover.
 * Version: 1.0.0
 * Author: Payeez
 * Author URI: https://payeez.com
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: payeez-woocommerce
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 9.0
 */

defined( 'ABSPATH' ) || exit;

// Plugin constants
define( 'PAYEEZ_VERSION', '1.0.0' );
define( 'PAYEEZ_PLUGIN_FILE', __FILE__ );
define( 'PAYEEZ_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'PAYEEZ_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Check if WooCommerce is active
 */
function payeez_check_woocommerce() {
    if ( ! class_exists( 'WooCommerce' ) ) {
        add_action( 'admin_notices', 'payeez_woocommerce_missing_notice' );
        return false;
    }
    return true;
}

/**
 * Admin notice for missing WooCommerce
 */
function payeez_woocommerce_missing_notice() {
    ?>
    <div class="notice notice-error">
        <p><?php esc_html_e( 'Payeez for WooCommerce requires WooCommerce to be installed and active.', 'payeez-woocommerce' ); ?></p>
    </div>
    <?php
}

/**
 * Initialize the plugin
 */
function payeez_init() {
    if ( ! payeez_check_woocommerce() ) {
        return;
    }

    // Load plugin classes
    require_once PAYEEZ_PLUGIN_DIR . 'includes/class-payeez-api.php';
    require_once PAYEEZ_PLUGIN_DIR . 'includes/class-payeez-webhook.php';
    require_once PAYEEZ_PLUGIN_DIR . 'includes/class-payeez-tokens.php';
    require_once PAYEEZ_PLUGIN_DIR . 'includes/class-payeez-gateway.php';

    // Load subscriptions support if WooCommerce Subscriptions is active
    if ( class_exists( 'WC_Subscriptions' ) ) {
        require_once PAYEEZ_PLUGIN_DIR . 'includes/class-payeez-subscriptions.php';
    }

    // Initialize webhook handler
    new Payeez_Webhook();

    // Initialize subscriptions handler if available
    if ( class_exists( 'Payeez_Subscriptions' ) ) {
        new Payeez_Subscriptions();
    }
}
add_action( 'plugins_loaded', 'payeez_init' );

/**
 * Register the payment gateway
 */
function payeez_add_gateway( $gateways ) {
    $gateways[] = 'Payeez_Gateway';
    return $gateways;
}
add_filter( 'woocommerce_payment_gateways', 'payeez_add_gateway' );

/**
 * Declare HPOS compatibility
 */
function payeez_declare_hpos_compatibility() {
    if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
    }
}
add_action( 'before_woocommerce_init', 'payeez_declare_hpos_compatibility' );

/**
 * Register WooCommerce Blocks integration
 */
function payeez_register_blocks_integration() {
    if ( ! class_exists( 'Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType' ) ) {
        return;
    }

    require_once PAYEEZ_PLUGIN_DIR . 'includes/blocks/class-payeez-blocks-payment.php';

    add_action(
        'woocommerce_blocks_payment_method_type_registration',
        function( Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry $payment_method_registry ) {
            $payment_method_registry->register( new Payeez_Blocks_Payment() );
        }
    );
}
add_action( 'woocommerce_blocks_loaded', 'payeez_register_blocks_integration' );

/**
 * Add plugin action links
 */
function payeez_plugin_action_links( $links ) {
    $settings_link = '<a href="' . admin_url( 'admin.php?page=wc-settings&tab=checkout&section=payeez' ) . '">' . __( 'Settings', 'payeez-woocommerce' ) . '</a>';
    array_unshift( $links, $settings_link );
    return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'payeez_plugin_action_links' );

/**
 * Load plugin text domain
 */
function payeez_load_textdomain() {
    load_plugin_textdomain( 'payeez-woocommerce', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'init', 'payeez_load_textdomain' );

/**
 * Serve Apple Pay domain verification file
 */
function payeez_serve_apple_pay_domain_verification() {
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
    $request_path = strtok( $request_uri, '?' );

    if ( '/.well-known/apple-developer-merchantid-domain-association' !== $request_path ) {
        return;
    }

    $settings = get_option( 'woocommerce_payeez_settings', array() );
    $verification_content = isset( $settings['apple_pay_domain_verification'] ) ? $settings['apple_pay_domain_verification'] : '';

    if ( empty( $verification_content ) ) {
        status_header( 404 );
        exit;
    }

    header( 'Content-Type: text/plain; charset=utf-8' );
    header( 'Content-Length: ' . strlen( $verification_content ) );
    header( 'Cache-Control: public, max-age=86400' );
    echo $verification_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    exit;
}
add_action( 'init', 'payeez_serve_apple_pay_domain_verification', 1 );
