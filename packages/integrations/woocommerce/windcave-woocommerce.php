<?php
/**
 * Plugin Name: Windcave for WooCommerce
 * Plugin URI: https://github.com/mgthompo1/windcave-woocommerce
 * Description: Accept payments via Windcave (Drop-in & Hosted Fields) with support for cards, Apple Pay, Google Pay, and more.
 * Version: 1.2.3
 * Author: Mitchell Thompson
 * Author URI: https://github.com/mgthompo1
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: windcave-woocommerce
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 8.4
 */

defined( 'ABSPATH' ) || exit;

// Plugin constants
define( 'WINDCAVE_VERSION', '1.2.3' );
define( 'WINDCAVE_PLUGIN_FILE', __FILE__ );
define( 'WINDCAVE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'WINDCAVE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Check if WooCommerce is active
 */
function windcave_check_woocommerce() {
    if ( ! class_exists( 'WooCommerce' ) ) {
        add_action( 'admin_notices', 'windcave_woocommerce_missing_notice' );
        return false;
    }
    return true;
}

/**
 * Admin notice for missing WooCommerce
 */
function windcave_woocommerce_missing_notice() {
    ?>
    <div class="notice notice-error">
        <p><?php esc_html_e( 'Windcave for WooCommerce requires WooCommerce to be installed and active.', 'windcave-woocommerce' ); ?></p>
    </div>
    <?php
}

/**
 * Initialize the plugin
 */
function windcave_init() {
    if ( ! windcave_check_woocommerce() ) {
        return;
    }

    // Load plugin classes
    require_once WINDCAVE_PLUGIN_DIR . 'includes/class-windcave-api.php';
    require_once WINDCAVE_PLUGIN_DIR . 'includes/class-windcave-webhook.php';
    require_once WINDCAVE_PLUGIN_DIR . 'includes/class-windcave-tokens.php';
    require_once WINDCAVE_PLUGIN_DIR . 'includes/class-windcave-gateway.php';

    // Load subscriptions support if WooCommerce Subscriptions is active
    if ( class_exists( 'WC_Subscriptions' ) ) {
        require_once WINDCAVE_PLUGIN_DIR . 'includes/class-windcave-subscriptions.php';
    }

    // Initialize webhook handler
    new Windcave_Webhook();

    // Initialize subscriptions handler if available
    if ( class_exists( 'Windcave_Subscriptions' ) ) {
        new Windcave_Subscriptions();
    }
}
add_action( 'plugins_loaded', 'windcave_init' );

/**
 * Register the payment gateway
 */
function windcave_add_gateway( $gateways ) {
    $gateways[] = 'Windcave_Gateway';
    return $gateways;
}
add_filter( 'woocommerce_payment_gateways', 'windcave_add_gateway' );

/**
 * Declare HPOS compatibility
 */
function windcave_declare_hpos_compatibility() {
    if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
    }
}
add_action( 'before_woocommerce_init', 'windcave_declare_hpos_compatibility' );

/**
 * Register WooCommerce Blocks integration
 */
function windcave_register_blocks_integration() {
    if ( ! class_exists( 'Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType' ) ) {
        return;
    }

    require_once WINDCAVE_PLUGIN_DIR . 'includes/blocks/class-windcave-blocks-payment.php';

    add_action(
        'woocommerce_blocks_payment_method_type_registration',
        function( Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry $payment_method_registry ) {
            $payment_method_registry->register( new Windcave_Blocks_Payment() );
        }
    );
}
add_action( 'woocommerce_blocks_loaded', 'windcave_register_blocks_integration' );

/**
 * Add plugin action links
 */
function windcave_plugin_action_links( $links ) {
    $settings_link = '<a href="' . admin_url( 'admin.php?page=wc-settings&tab=checkout&section=windcave' ) . '">' . __( 'Settings', 'windcave-woocommerce' ) . '</a>';
    array_unshift( $links, $settings_link );
    return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'windcave_plugin_action_links' );

/**
 * Load plugin text domain
 */
function windcave_load_textdomain() {
    load_plugin_textdomain( 'windcave-woocommerce', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'init', 'windcave_load_textdomain' );

/**
 * Serve Apple Pay domain verification file
 * Handles requests to /.well-known/apple-developer-merchantid-domain-association
 */
function windcave_serve_apple_pay_domain_verification() {
    // Check if this is a request for the Apple Pay verification file
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';

    // Remove query string if present
    $request_path = strtok( $request_uri, '?' );

    if ( '/.well-known/apple-developer-merchantid-domain-association' !== $request_path ) {
        return;
    }

    // Get the domain verification content from settings
    $settings = get_option( 'woocommerce_windcave_settings', array() );
    $verification_content = isset( $settings['apple_pay_domain_verification'] ) ? $settings['apple_pay_domain_verification'] : '';

    if ( empty( $verification_content ) ) {
        // Return 404 if no verification content is set
        status_header( 404 );
        exit;
    }

    // Serve the file
    header( 'Content-Type: text/plain; charset=utf-8' );
    header( 'Content-Length: ' . strlen( $verification_content ) );
    header( 'Cache-Control: public, max-age=86400' ); // Cache for 24 hours
    echo $verification_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    exit;
}
add_action( 'init', 'windcave_serve_apple_pay_domain_verification', 1 ); // Priority 1 to run early
