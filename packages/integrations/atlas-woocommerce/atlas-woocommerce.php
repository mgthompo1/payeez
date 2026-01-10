<?php
/**
 * Plugin Name: Atlas for WooCommerce
 * Plugin URI: https://github.com/mgthompo1/atlas
 * Description: Accept payments via Atlas payment orchestration with support for cards, Apple Pay, Google Pay, and multi-processor failover.
 * Version: 1.0.0
 * Author: Atlas
 * Author URI: https://atlas.com
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: atlas-woocommerce
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 6.0
 * WC tested up to: 9.0
 */

defined( 'ABSPATH' ) || exit;

// Plugin constants
define( 'ATLAS_VERSION', '1.0.0' );
define( 'ATLAS_PLUGIN_FILE', __FILE__ );
define( 'ATLAS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'ATLAS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Check if WooCommerce is active
 */
function atlas_check_woocommerce() {
    if ( ! class_exists( 'WooCommerce' ) ) {
        add_action( 'admin_notices', 'atlas_woocommerce_missing_notice' );
        return false;
    }
    return true;
}

/**
 * Admin notice for missing WooCommerce
 */
function atlas_woocommerce_missing_notice() {
    ?>
    <div class="notice notice-error">
        <p><?php esc_html_e( 'Atlas for WooCommerce requires WooCommerce to be installed and active.', 'atlas-woocommerce' ); ?></p>
    </div>
    <?php
}

/**
 * Initialize the plugin
 */
function atlas_init() {
    if ( ! atlas_check_woocommerce() ) {
        return;
    }

    // Load plugin classes
    require_once ATLAS_PLUGIN_DIR . 'includes/class-atlas-api.php';
    require_once ATLAS_PLUGIN_DIR . 'includes/class-atlas-webhook.php';
    require_once ATLAS_PLUGIN_DIR . 'includes/class-atlas-tokens.php';
    require_once ATLAS_PLUGIN_DIR . 'includes/class-atlas-gateway.php';

    // Load subscriptions support if WooCommerce Subscriptions is active
    if ( class_exists( 'WC_Subscriptions' ) ) {
        require_once ATLAS_PLUGIN_DIR . 'includes/class-atlas-subscriptions.php';
    }

    // Initialize webhook handler
    new Atlas_Webhook();

    // Initialize subscriptions handler if available
    if ( class_exists( 'Atlas_Subscriptions' ) ) {
        new Atlas_Subscriptions();
    }
}
add_action( 'plugins_loaded', 'atlas_init' );

/**
 * Register the payment gateway
 */
function atlas_add_gateway( $gateways ) {
    $gateways[] = 'Atlas_Gateway';
    return $gateways;
}
add_filter( 'woocommerce_payment_gateways', 'atlas_add_gateway' );

/**
 * Declare HPOS compatibility
 */
function atlas_declare_hpos_compatibility() {
    if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
    }
}
add_action( 'before_woocommerce_init', 'atlas_declare_hpos_compatibility' );

/**
 * Register WooCommerce Blocks integration
 */
function atlas_register_blocks_integration() {
    if ( ! class_exists( 'Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType' ) ) {
        return;
    }

    require_once ATLAS_PLUGIN_DIR . 'includes/blocks/class-atlas-blocks-payment.php';

    add_action(
        'woocommerce_blocks_payment_method_type_registration',
        function( Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry $payment_method_registry ) {
            $payment_method_registry->register( new Atlas_Blocks_Payment() );
        }
    );
}
add_action( 'woocommerce_blocks_loaded', 'atlas_register_blocks_integration' );

/**
 * Add plugin action links
 */
function atlas_plugin_action_links( $links ) {
    $settings_link = '<a href="' . admin_url( 'admin.php?page=wc-settings&tab=checkout&section=atlas' ) . '">' . __( 'Settings', 'atlas-woocommerce' ) . '</a>';
    array_unshift( $links, $settings_link );
    return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'atlas_plugin_action_links' );

/**
 * Load plugin text domain
 */
function atlas_load_textdomain() {
    load_plugin_textdomain( 'atlas-woocommerce', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'init', 'atlas_load_textdomain' );

/**
 * Serve Apple Pay domain verification file
 */
function atlas_serve_apple_pay_domain_verification() {
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
    $request_path = strtok( $request_uri, '?' );

    if ( '/.well-known/apple-developer-merchantid-domain-association' !== $request_path ) {
        return;
    }

    $settings = get_option( 'woocommerce_atlas_settings', array() );
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
add_action( 'init', 'atlas_serve_apple_pay_domain_verification', 1 );
