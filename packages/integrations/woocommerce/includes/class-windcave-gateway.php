<?php
/**
 * Windcave Payment Gateway
 *
 * Main WooCommerce payment gateway class for Windcave.
 *
 * @package Windcave_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Windcave Gateway class
 */
class Windcave_Gateway extends WC_Payment_Gateway {

    /**
     * Integration mode constants
     */
    const MODE_DROPIN       = 'dropin';
    const MODE_HOSTED_FIELDS = 'hosted_fields';

    /**
     * Test mode flag
     *
     * @var bool
     */
    private $test_mode;

    /**
     * Debug mode flag
     *
     * @var bool
     */
    private $debug_mode;

    /**
     * Integration mode
     *
     * @var string
     */
    private $integration_mode;

    /**
     * Test API username
     *
     * @var string
     */
    private $test_api_username;

    /**
     * Test API key
     *
     * @var string
     */
    private $test_api_key;

    /**
     * Live API username
     *
     * @var string
     */
    private $live_api_username;

    /**
     * Live API key
     *
     * @var string
     */
    private $live_api_key;

    /**
     * Supported card types
     *
     * @var array
     */
    private $supported_cards;

    /**
     * Enable Apple Pay
     *
     * @var bool
     */
    private $enable_apple_pay;

    /**
     * Enable Apple Pay Express (cart/mini-cart)
     *
     * @var bool
     */
    private $enable_apple_pay_express;

    /**
     * Enable Google Pay
     *
     * @var bool
     */
    private $enable_google_pay;

    /**
     * Enable Google Pay Express (cart/mini-cart)
     *
     * @var bool
     */
    private $enable_google_pay_express;

    /**
     * Apple Pay merchant ID
     *
     * @var string
     */
    private $apple_pay_merchant_id;

    /**
     * Google Pay merchant ID
     *
     * @var string
     */
    private $google_pay_merchant_id;

    /**
     * Enable tokenization (saved cards)
     *
     * @var bool
     */
    private $enable_tokenization;

    /**
     * Constructor
     */
    public function __construct() {
        $this->id                 = 'windcave';
        $this->icon               = apply_filters( 'windcave_icon', WINDCAVE_PLUGIN_URL . 'assets/images/windcave-logo.png' );
        $this->has_fields         = true;
        $this->method_title       = __( 'Windcave', 'windcave-woocommerce' );
        $this->method_description = __( 'Accept payments via Windcave using Drop-in or Hosted Fields integration.', 'windcave-woocommerce' );

        // Supported features
        $this->supports = array(
            'products',
            'refunds',
            'tokenization',
            'add_payment_method',
        );

        // Add subscription support if WooCommerce Subscriptions is active
        if ( class_exists( 'WC_Subscriptions' ) ) {
            $this->supports = array_merge(
                $this->supports,
                array(
                    'subscriptions',
                    'subscription_cancellation',
                    'subscription_suspension',
                    'subscription_reactivation',
                    'subscription_amount_changes',
                    'subscription_date_changes',
                    'subscription_payment_method_change',
                    'subscription_payment_method_change_customer',
                    'subscription_payment_method_change_admin',
                    'multiple_subscriptions',
                )
            );
        }

        // Load settings
        $this->init_form_fields();
        $this->init_settings();

        // Get settings
        $this->title                  = $this->get_option( 'title' );
        $this->description            = $this->get_option( 'description' );
        $this->test_mode              = 'yes' === $this->get_option( 'test_mode' );
        $this->debug_mode             = 'yes' === $this->get_option( 'debug_mode' );
        $this->integration_mode       = $this->get_option( 'integration_mode', self::MODE_DROPIN );
        $this->test_api_username      = $this->get_option( 'test_api_username' );
        $this->test_api_key           = $this->get_option( 'test_api_key' );
        $this->live_api_username      = $this->get_option( 'live_api_username' );
        $this->live_api_key           = $this->get_option( 'live_api_key' );
        $this->supported_cards        = $this->get_option( 'supported_cards', array( 'visa', 'mastercard' ) );
        $this->enable_apple_pay         = 'yes' === $this->get_option( 'enable_apple_pay' );
        $this->enable_apple_pay_express = 'yes' === $this->get_option( 'enable_apple_pay_express' );
        $this->enable_google_pay        = 'yes' === $this->get_option( 'enable_google_pay' );
        $this->enable_google_pay_express = 'yes' === $this->get_option( 'enable_google_pay_express' );
        $this->apple_pay_merchant_id    = $this->get_option( 'apple_pay_merchant_id' );
        $this->google_pay_merchant_id   = $this->get_option( 'google_pay_merchant_id' );
        $this->enable_tokenization      = 'yes' === $this->get_option( 'enable_tokenization', 'yes' );

        // Remove tokenization support if disabled
        if ( ! $this->enable_tokenization ) {
            $this->supports = array_diff( $this->supports, array( 'tokenization', 'add_payment_method' ) );
        }

        // Hooks
        add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'payment_scripts' ) );
        add_action( 'woocommerce_api_windcave_create_session', array( $this, 'ajax_create_session' ) );
        add_action( 'wp_ajax_windcave_create_session', array( $this, 'ajax_create_session' ) );
        add_action( 'wp_ajax_nopriv_windcave_create_session', array( $this, 'ajax_create_session' ) );

        // Apple Pay Express hooks
        if ( $this->enable_apple_pay_express && $this->enable_apple_pay && ! empty( $this->apple_pay_merchant_id ) ) {
            add_action( 'woocommerce_proceed_to_checkout', array( $this, 'display_apple_pay_express_button' ), 20 );
            add_action( 'woocommerce_widget_shopping_cart_buttons', array( $this, 'display_apple_pay_express_button' ), 20 );
            add_action( 'wp_ajax_windcave_create_express_session', array( $this, 'ajax_create_express_session' ) );
            add_action( 'wp_ajax_nopriv_windcave_create_express_session', array( $this, 'ajax_create_express_session' ) );
            add_action( 'wp_ajax_windcave_process_express_payment', array( $this, 'ajax_process_express_payment' ) );
            add_action( 'wp_ajax_nopriv_windcave_process_express_payment', array( $this, 'ajax_process_express_payment' ) );
        }

        // Google Pay Express hooks
        if ( $this->enable_google_pay_express && $this->enable_google_pay ) {
            add_action( 'woocommerce_proceed_to_checkout', array( $this, 'display_google_pay_express_button' ), 21 );
            add_action( 'woocommerce_widget_shopping_cart_buttons', array( $this, 'display_google_pay_express_button' ), 21 );
            add_action( 'wp_ajax_windcave_create_googlepay_express_session', array( $this, 'ajax_create_googlepay_express_session' ) );
            add_action( 'wp_ajax_nopriv_windcave_create_googlepay_express_session', array( $this, 'ajax_create_googlepay_express_session' ) );
            add_action( 'wp_ajax_windcave_process_googlepay_express_payment', array( $this, 'ajax_process_googlepay_express_payment' ) );
            add_action( 'wp_ajax_nopriv_windcave_process_googlepay_express_payment', array( $this, 'ajax_process_googlepay_express_payment' ) );
        }
    }

    /**
     * Initialize form fields for admin settings
     */
    public function init_form_fields() {
        $this->form_fields = array(
            'enabled'              => array(
                'title'   => __( 'Enable/Disable', 'windcave-woocommerce' ),
                'type'    => 'checkbox',
                'label'   => __( 'Enable Windcave', 'windcave-woocommerce' ),
                'default' => 'no',
            ),
            'title'                => array(
                'title'       => __( 'Title', 'windcave-woocommerce' ),
                'type'        => 'text',
                'description' => __( 'Title shown to customers at checkout.', 'windcave-woocommerce' ),
                'default'     => __( 'Credit/Debit Card', 'windcave-woocommerce' ),
                'desc_tip'    => true,
            ),
            'description'          => array(
                'title'       => __( 'Description', 'windcave-woocommerce' ),
                'type'        => 'textarea',
                'description' => __( 'Description shown to customers at checkout.', 'windcave-woocommerce' ),
                'default'     => __( 'Pay securely using your credit or debit card.', 'windcave-woocommerce' ),
                'desc_tip'    => true,
            ),
            'test_mode'            => array(
                'title'       => __( 'Test Mode', 'windcave-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable test mode', 'windcave-woocommerce' ),
                'description' => __( 'Use Windcave UAT environment for testing.', 'windcave-woocommerce' ),
                'default'     => 'yes',
                'desc_tip'    => true,
            ),
            'integration_mode'     => array(
                'title'       => __( 'Integration Mode', 'windcave-woocommerce' ),
                'type'        => 'select',
                'description' => __( 'Choose between Drop-in (pre-built UI) or Hosted Fields (customizable fields).', 'windcave-woocommerce' ),
                'default'     => self::MODE_DROPIN,
                'options'     => array(
                    self::MODE_DROPIN        => __( 'Drop-in (Recommended)', 'windcave-woocommerce' ),
                    self::MODE_HOSTED_FIELDS => __( 'Hosted Fields', 'windcave-woocommerce' ),
                ),
                'desc_tip'    => true,
            ),
            'test_api_username'    => array(
                'title'       => __( 'Test API Username', 'windcave-woocommerce' ),
                'type'        => 'text',
                'description' => __( 'Your Windcave test API username.', 'windcave-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'test_api_key'         => array(
                'title'       => __( 'Test API Key', 'windcave-woocommerce' ),
                'type'        => 'password',
                'description' => __( 'Your Windcave test API key.', 'windcave-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'live_api_username'    => array(
                'title'       => __( 'Live API Username', 'windcave-woocommerce' ),
                'type'        => 'text',
                'description' => __( 'Your Windcave live API username.', 'windcave-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'live_api_key'         => array(
                'title'       => __( 'Live API Key', 'windcave-woocommerce' ),
                'type'        => 'password',
                'description' => __( 'Your Windcave live API key.', 'windcave-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'supported_cards'      => array(
                'title'       => __( 'Supported Card Types', 'windcave-woocommerce' ),
                'type'        => 'multiselect',
                'description' => __( 'Select which card types to accept.', 'windcave-woocommerce' ),
                'default'     => array( 'visa', 'mastercard' ),
                'options'     => array(
                    'visa'       => 'Visa',
                    'mastercard' => 'Mastercard',
                    'amex'       => 'American Express',
                    'diners'     => 'Diners Club',
                    'discover'   => 'Discover',
                    'jcb'        => 'JCB',
                    'unionpay'   => 'UnionPay',
                ),
                'desc_tip'    => true,
                'class'       => 'wc-enhanced-select',
            ),
            'tokenization_title'   => array(
                'title'       => __( 'Saved Cards & Subscriptions', 'windcave-woocommerce' ),
                'type'        => 'title',
                'description' => class_exists( 'WC_Subscriptions' )
                    ? __( 'WooCommerce Subscriptions detected. Recurring payments are automatically supported.', 'windcave-woocommerce' )
                    : '',
            ),
            'enable_tokenization'  => array(
                'title'       => __( 'Saved Cards', 'windcave-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Allow customers to save cards for future purchases', 'windcave-woocommerce' ),
                'description' => __( 'Customers can save their card securely with Windcave and reuse it for faster checkout.', 'windcave-woocommerce' ),
                'default'     => 'yes',
                'desc_tip'    => true,
            ),
            'wallet_payments'      => array(
                'title' => __( 'Digital Wallets', 'windcave-woocommerce' ),
                'type'  => 'title',
            ),
            'enable_apple_pay'     => array(
                'title'       => __( 'Apple Pay', 'windcave-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable Apple Pay', 'windcave-woocommerce' ),
                'description' => __( 'Requires Apple Pay merchant ID configuration.', 'windcave-woocommerce' ),
                'default'     => 'no',
                'desc_tip'    => true,
            ),
            'apple_pay_merchant_id' => array(
                'title'       => __( 'Apple Pay Merchant ID', 'windcave-woocommerce' ),
                'type'        => 'text',
                'description' => __( 'Your Apple Pay Web Internal Merchant ID from Windcave.', 'windcave-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'enable_apple_pay_express' => array(
                'title'       => __( 'Apple Pay Express', 'windcave-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable Apple Pay Express button on cart', 'windcave-woocommerce' ),
                'description' => __( 'Shows an Apple Pay button on the cart page and mini-cart for quick checkout.', 'windcave-woocommerce' ),
                'default'     => 'no',
                'desc_tip'    => true,
            ),
            'apple_pay_domain_verification' => array(
                'title'       => __( 'Apple Pay Domain Verification', 'windcave-woocommerce' ),
                'type'        => 'textarea',
                'description' => __( 'Paste the contents of your Apple Pay domain verification file here. This will be served at /.well-known/apple-developer-merchantid-domain-association', 'windcave-woocommerce' ),
                'default'     => '',
                'desc_tip'    => false,
                'css'         => 'width: 100%; height: 100px; font-family: monospace;',
            ),
            'enable_google_pay'    => array(
                'title'       => __( 'Google Pay', 'windcave-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable Google Pay', 'windcave-woocommerce' ),
                'description' => __( 'Requires Google Pay merchant ID configuration.', 'windcave-woocommerce' ),
                'default'     => 'no',
                'desc_tip'    => true,
            ),
            'google_pay_merchant_id' => array(
                'title'       => __( 'Google Pay Merchant ID', 'windcave-woocommerce' ),
                'type'        => 'text',
                'description' => __( 'Your Google Pay merchant ID from Google Pay Console.', 'windcave-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'enable_google_pay_express' => array(
                'title'       => __( 'Google Pay Express', 'windcave-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable Google Pay Express button on cart', 'windcave-woocommerce' ),
                'description' => __( 'Shows a Google Pay button on the cart page and mini-cart for quick checkout.', 'windcave-woocommerce' ),
                'default'     => 'no',
                'desc_tip'    => true,
            ),
            'debug_mode'           => array(
                'title'       => __( 'Debug Mode', 'windcave-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable debug logging', 'windcave-woocommerce' ),
                'description' => __( 'Log Windcave API requests and responses. Logs are saved in WooCommerce > Status > Logs.', 'windcave-woocommerce' ),
                'default'     => 'no',
                'desc_tip'    => true,
            ),
        );
    }

    /**
     * Get API username
     *
     * @return string
     */
    public function get_api_username() {
        return $this->test_mode ? $this->test_api_username : $this->live_api_username;
    }

    /**
     * Get API key
     *
     * @return string
     */
    public function get_api_key() {
        return $this->test_mode ? $this->test_api_key : $this->live_api_key;
    }

    /**
     * Check if test mode is enabled
     *
     * @return bool
     */
    public function is_test_mode() {
        return $this->test_mode;
    }

    /**
     * Check if debug mode is enabled
     *
     * @return bool
     */
    public function is_debug_mode() {
        return $this->debug_mode;
    }

    /**
     * Get integration mode
     *
     * @return string
     */
    public function get_integration_mode() {
        return $this->integration_mode;
    }

    /**
     * Check if gateway is available
     *
     * @return bool
     */
    public function is_available() {
        if ( ! parent::is_available() ) {
            return false;
        }

        // Check API credentials
        if ( empty( $this->get_api_username() ) || empty( $this->get_api_key() ) ) {
            return false;
        }

        return true;
    }

    /**
     * Enqueue payment scripts
     */
    public function payment_scripts() {
        $is_checkout = is_checkout() || isset( $_GET['pay_for_order'] ) || is_add_payment_method_page();
        $is_cart = is_cart();

        // Load Apple Pay Express scripts for cart and mini-cart
        // Mini-cart can appear on any page (usually in header), so always load when enabled
        if ( $this->enable_apple_pay_express && $this->enable_apple_pay && ! empty( $this->apple_pay_merchant_id ) ) {
            // Load on all frontend pages since mini-cart could be anywhere
            if ( ! is_admin() ) {
                $this->enqueue_apple_pay_express_scripts();
            }
        }

        // Load Google Pay Express scripts for cart and mini-cart
        if ( $this->enable_google_pay_express && $this->enable_google_pay ) {
            // Load on all frontend pages since mini-cart could be anywhere
            if ( ! is_admin() ) {
                $this->enqueue_google_pay_express_scripts();
            }
        }

        // Only load checkout scripts on checkout pages
        if ( ! $is_checkout ) {
            return;
        }

        if ( 'no' === $this->enabled ) {
            return;
        }

        $api = $this->get_api();
        $js_url = $api->get_js_url();

        // Windcave JS libraries
        if ( self::MODE_DROPIN === $this->integration_mode ) {
            wp_enqueue_script( 'windcave-dropin-lib', $js_url . '/lib/drop-in-v1.js', array(), null, true );
            wp_enqueue_script( 'windcave-dropin', $js_url . '/windcavepayments-dropin-v1.js', array( 'windcave-dropin-lib' ), null, true );
        }

        wp_enqueue_script( 'windcave-hosted-fields-lib', $js_url . '/lib/hosted-fields-v1.js', array(), null, true );
        wp_enqueue_script( 'windcave-hosted-fields', $js_url . '/windcavepayments-hostedfields-v1.js', array( 'windcave-hosted-fields-lib' ), null, true );

        // Apple Pay
        if ( $this->enable_apple_pay ) {
            wp_enqueue_script( 'windcave-applepay', $js_url . '/windcavepayments-applepay-v1.js', array(), null, true );
        }

        // Google Pay
        if ( $this->enable_google_pay ) {
            wp_enqueue_script( 'windcave-googlepay', $js_url . '/windcavepayments-googlepay-v1.js', array(), null, true );
        }

        // Plugin checkout script
        $deps = self::MODE_DROPIN === $this->integration_mode
            ? array( 'jquery', 'windcave-dropin' )
            : array( 'jquery', 'windcave-hosted-fields' );

        wp_enqueue_script(
            'windcave-checkout',
            WINDCAVE_PLUGIN_URL . 'assets/js/windcave-checkout.js',
            $deps,
            WINDCAVE_VERSION,
            true
        );

        // Plugin styles
        wp_enqueue_style(
            'windcave-checkout',
            WINDCAVE_PLUGIN_URL . 'assets/css/windcave-checkout.css',
            array(),
            WINDCAVE_VERSION
        );

        // Localize script
        // Get cart total from server side (more reliable than DOM parsing)
        $cart_total = '0.00';
        if ( WC()->cart ) {
            $cart_total = wc_format_decimal( WC()->cart->get_total( 'edit' ), wc_get_price_decimals() );
        }

        wp_localize_script( 'windcave-checkout', 'windcave_params', array(
            'ajax_url'           => admin_url( 'admin-ajax.php' ),
            'create_session_url' => WC()->api_request_url( 'windcave_create_session' ),
            'nonce'              => wp_create_nonce( 'windcave_nonce' ),
            'integration_mode'   => $this->integration_mode,
            'environment'        => $api->get_js_environment(),
            'supported_cards'    => $this->supported_cards,
            // Don't show Apple Pay/Google Pay in drop-in if Express is enabled (to avoid duplication)
            'enable_apple_pay'   => $this->enable_apple_pay && ! $this->enable_apple_pay_express,
            'enable_google_pay'  => $this->enable_google_pay && ! $this->enable_google_pay_express,
            'apple_pay_merchant_id'  => $this->apple_pay_merchant_id,
            'google_pay_merchant_id' => $this->google_pay_merchant_id,
            'is_test_mode'       => $this->test_mode,
            'store_name'         => get_bloginfo( 'name' ),
            'currency'           => get_woocommerce_currency(),
            'country'            => WC()->countries->get_base_country(),
            'cart_total'         => $cart_total,
            'i18n'               => array(
                'card_error'          => __( 'Please check your card details.', 'windcave-woocommerce' ),
                'payment_error'       => __( 'Payment failed. Please try again.', 'windcave-woocommerce' ),
                'session_error'       => __( 'Could not initialize payment. Please refresh and try again.', 'windcave-woocommerce' ),
                'card_number_label'   => __( 'Card Number', 'windcave-woocommerce' ),
                'expiry_label'        => __( 'Expiry Date', 'windcave-woocommerce' ),
                'cvv_label'           => __( 'CVV', 'windcave-woocommerce' ),
                'cardholder_label'    => __( 'Cardholder Name', 'windcave-woocommerce' ),
            ),
        ) );
    }

    /**
     * Enqueue Apple Pay Express scripts
     */
    private function enqueue_apple_pay_express_scripts() {
        $api = $this->get_api();
        $js_url = $api->get_js_url();

        // Apple Pay library
        wp_enqueue_script( 'windcave-applepay', $js_url . '/windcavepayments-applepay-v1.js', array(), null, true );

        // Apple Pay Express script
        wp_enqueue_script(
            'windcave-applepay-express',
            WINDCAVE_PLUGIN_URL . 'assets/js/windcave-applepay-express.js',
            array( 'jquery', 'windcave-applepay' ),
            WINDCAVE_VERSION,
            true
        );

        // Plugin styles
        wp_enqueue_style(
            'windcave-checkout',
            WINDCAVE_PLUGIN_URL . 'assets/css/windcave-checkout.css',
            array(),
            WINDCAVE_VERSION
        );

        // Get cart total
        $cart_total = '0.00';
        if ( WC()->cart ) {
            $cart_total = number_format( WC()->cart->get_total( 'edit' ), 2, '.', '' );
        }

        // Localize script
        wp_localize_script( 'windcave-applepay-express', 'windcaveApplePayExpressData', array(
            'ajaxUrl'           => admin_url( 'admin-ajax.php' ),
            'nonce'             => wp_create_nonce( 'windcave_applepay_express_nonce' ),
            'merchantId'        => $this->apple_pay_merchant_id,
            'storeName'         => get_bloginfo( 'name' ),
            'countryCode'       => WC()->countries->get_base_country(),
            'currencyCode'      => get_woocommerce_currency(),
            'cartTotal'         => $cart_total,
            'supportedNetworks' => $this->get_apple_pay_networks(),
            'isTestMode'        => $this->test_mode,
            'debugMode'         => $this->debug_mode,
        ) );
    }

    /**
     * Enqueue Google Pay Express scripts
     */
    private function enqueue_google_pay_express_scripts() {
        $api = $this->get_api();
        $js_url = $api->get_js_url();

        // Google Pay library
        wp_enqueue_script( 'windcave-googlepay', $js_url . '/windcavepayments-googlepay-v1.js', array(), null, true );

        // Google Pay Express script
        wp_enqueue_script(
            'windcave-googlepay-express',
            WINDCAVE_PLUGIN_URL . 'assets/js/windcave-googlepay-express.js',
            array( 'jquery', 'windcave-googlepay' ),
            WINDCAVE_VERSION,
            true
        );

        // Plugin styles
        wp_enqueue_style(
            'windcave-checkout',
            WINDCAVE_PLUGIN_URL . 'assets/css/windcave-checkout.css',
            array(),
            WINDCAVE_VERSION
        );

        // Get cart total
        $cart_total = '0.00';
        if ( WC()->cart ) {
            $cart_total = number_format( WC()->cart->get_total( 'edit' ), 2, '.', '' );
        }

        // Localize script
        wp_localize_script( 'windcave-googlepay-express', 'windcaveGooglePayExpressData', array(
            'ajaxUrl'           => admin_url( 'admin-ajax.php' ),
            'nonce'             => wp_create_nonce( 'windcave_googlepay_express_nonce' ),
            'merchantId'        => $this->get_api_username(), // Windcave merchant ID
            'googleMerchantId'  => $this->google_pay_merchant_id,
            'storeName'         => get_bloginfo( 'name' ),
            'countryCode'       => WC()->countries->get_base_country(),
            'currencyCode'      => get_woocommerce_currency(),
            'cartTotal'         => $cart_total,
            'supportedNetworks' => $this->get_google_pay_networks(),
            'isTestMode'        => $this->test_mode,
            'debugMode'         => $this->debug_mode,
        ) );
    }

    /**
     * Get supported Apple Pay networks based on supported cards
     *
     * @return array
     */
    private function get_apple_pay_networks() {
        $networks = array();
        $card_to_network = array(
            'visa'       => 'visa',
            'mastercard' => 'masterCard',
            'amex'       => 'amex',
            'discover'   => 'discover',
            'jcb'        => 'jcb',
        );

        foreach ( $this->supported_cards as $card ) {
            if ( isset( $card_to_network[ $card ] ) ) {
                $networks[] = $card_to_network[ $card ];
            }
        }

        return ! empty( $networks ) ? $networks : array( 'visa', 'masterCard' );
    }

    /**
     * Get supported Google Pay networks based on supported cards
     *
     * @return array
     */
    private function get_google_pay_networks() {
        $networks = array();
        $card_to_network = array(
            'visa'       => 'visa',
            'mastercard' => 'masterCard',
            'amex'       => 'amex',
            'discover'   => 'discover',
            'jcb'        => 'jcb',
        );

        foreach ( $this->supported_cards as $card ) {
            if ( isset( $card_to_network[ $card ] ) ) {
                $networks[] = $card_to_network[ $card ];
            }
        }

        return ! empty( $networks ) ? $networks : array( 'visa', 'masterCard' );
    }

    /**
     * Payment fields on checkout
     */
    public function payment_fields() {
        // Display description
        if ( $this->description ) {
            echo '<p>' . wp_kses_post( $this->description ) . '</p>';
        }

        // Test mode notice
        if ( $this->test_mode ) {
            echo '<p class="windcave-test-mode-notice">' . esc_html__( 'TEST MODE ENABLED', 'windcave-woocommerce' ) . '</p>';
        }

        // Saved cards (tokenization)
        if ( $this->supports( 'tokenization' ) && is_checkout() && is_user_logged_in() ) {
            $this->saved_payment_methods();
        }

        // Payment form container
        echo '<div id="windcave-payment-form" class="windcave-payment-form">';

        if ( self::MODE_DROPIN === $this->integration_mode ) {
            // Drop-in container
            echo '<div id="windcave-dropin-container"></div>';
        } else {
            // Hosted Fields containers
            echo '<div class="windcave-hosted-fields">';
            echo '<div class="windcave-field-wrapper">';
            echo '<label for="windcave-card-number">' . esc_html__( 'Card Number', 'windcave-woocommerce' ) . '</label>';
            echo '<div id="windcave-card-number" class="windcave-hosted-field"></div>';
            echo '</div>';
            echo '<div class="windcave-field-row">';
            echo '<div class="windcave-field-wrapper windcave-field-half">';
            echo '<label for="windcave-expiry">' . esc_html__( 'Expiry Date', 'windcave-woocommerce' ) . '</label>';
            echo '<div id="windcave-expiry" class="windcave-hosted-field"></div>';
            echo '</div>';
            echo '<div class="windcave-field-wrapper windcave-field-half">';
            echo '<label for="windcave-cvv">' . esc_html__( 'CVV', 'windcave-woocommerce' ) . '</label>';
            echo '<div id="windcave-cvv" class="windcave-hosted-field"></div>';
            echo '</div>';
            echo '</div>';
            echo '<div class="windcave-field-wrapper">';
            echo '<label for="windcave-cardholder">' . esc_html__( 'Cardholder Name', 'windcave-woocommerce' ) . '</label>';
            echo '<div id="windcave-cardholder" class="windcave-hosted-field"></div>';
            echo '</div>';
            echo '</div>';
        }

        echo '</div>';

        // Save card checkbox for logged in users
        if ( $this->supports( 'tokenization' ) && is_checkout() && is_user_logged_in() ) {
            $this->save_payment_method_checkbox();
        }

        // Hidden fields
        echo '<input type="hidden" id="windcave-session-id" name="windcave_session_id" value="" />';
        echo '<input type="hidden" id="windcave-payment-complete" name="windcave_payment_complete" value="" />';
    }

    /**
     * Validate fields
     *
     * @return bool
     */
    public function validate_fields() {
        // Check if using saved card
        if ( isset( $_POST['wc-windcave-payment-token'] ) && 'new' !== $_POST['wc-windcave-payment-token'] ) {
            return true;
        }

        // For new cards, validation happens on frontend via Windcave
        return true;
    }

    /**
     * Process payment
     *
     * @param int $order_id Order ID.
     * @return array
     */
    public function process_payment( $order_id ) {
        $order = wc_get_order( $order_id );

        // Check for saved token
        $token_id = isset( $_POST['wc-windcave-payment-token'] ) ? wc_clean( wp_unslash( $_POST['wc-windcave-payment-token'] ) ) : '';

        if ( ! empty( $token_id ) && 'new' !== $token_id ) {
            return $this->process_token_payment( $order, $token_id );
        }

        // Get session ID from frontend
        $session_id = isset( $_POST['windcave_session_id'] ) ? sanitize_text_field( wp_unslash( $_POST['windcave_session_id'] ) ) : '';
        $payment_complete = isset( $_POST['windcave_payment_complete'] ) ? sanitize_text_field( wp_unslash( $_POST['windcave_payment_complete'] ) ) : '';

        if ( empty( $session_id ) ) {
            wc_add_notice( __( 'Payment session not found. Please try again.', 'windcave-woocommerce' ), 'error' );
            return array( 'result' => 'failure' );
        }

        // Store session ID in order meta
        $order->update_meta_data( '_windcave_session_id', $session_id );

        // Check if customer wants to save card
        if ( isset( $_POST['wc-windcave-new-payment-method'] ) && 'true' === $_POST['wc-windcave-new-payment-method'] ) {
            $order->update_meta_data( '_windcave_save_card', 'yes' );
        }

        $order->save();

        // If payment already complete on frontend (Drop-in)
        if ( 'true' === $payment_complete ) {
            return $this->verify_payment( $order, $session_id );
        }

        // For Hosted Fields, need to verify the session
        return $this->verify_payment( $order, $session_id );
    }

    /**
     * Process payment using a saved token
     *
     * @param WC_Order $order    Order object.
     * @param int      $token_id Token ID.
     * @return array
     */
    private function process_token_payment( $order, $token_id ) {
        $token = Windcave_Tokens::get_token( $token_id, get_current_user_id() );

        if ( ! $token ) {
            wc_add_notice( __( 'Invalid payment method. Please select another.', 'windcave-woocommerce' ), 'error' );
            return array( 'result' => 'failure' );
        }

        // Check if token is expired
        if ( Windcave_Tokens::is_token_expired( $token ) ) {
            wc_add_notice( __( 'This card has expired. Please use a different payment method.', 'windcave-woocommerce' ), 'error' );
            return array( 'result' => 'failure' );
        }

        // Determine payment type and storedCardIndicator
        $payment_type = 'single';
        $is_subscription_payment = false;

        if ( class_exists( 'WC_Subscriptions' ) && function_exists( 'wcs_order_contains_subscription' ) ) {
            if ( wcs_order_contains_subscription( $order ) ) {
                $payment_type = 'recurring';
                $is_subscription_payment = true;
            } elseif ( function_exists( 'wcs_order_contains_renewal' ) && wcs_order_contains_renewal( $order ) ) {
                $payment_type = 'recurring';
                $is_subscription_payment = true;
            }
        }

        // Get appropriate storedCardIndicator (not initial since this is using a saved token)
        $stored_card_indicator = Windcave_Tokens::get_stored_card_indicator( false, $payment_type );

        $api = $this->get_api();
        $result = $api->charge_token(
            $token->get_token(),
            $order->get_total(),
            $order->get_currency(),
            $this->get_merchant_reference( $order ),
            $stored_card_indicator
        );

        if ( is_wp_error( $result ) ) {
            $this->log( 'Token payment error: ' . $result->get_error_message() );
            wc_add_notice( __( 'Payment failed. Please try again or use a different card.', 'windcave-woocommerce' ), 'error' );
            return array( 'result' => 'failure' );
        }

        if ( isset( $result['authorised'] ) && $result['authorised'] ) {
            $order->payment_complete( $result['id'] ?? '' );

            // Store transaction metadata
            $order->update_meta_data( '_windcave_transaction_id', $result['id'] ?? '' );
            if ( isset( $result['card']['id'] ) ) {
                $order->update_meta_data( '_windcave_card_id', $result['card']['id'] );
            }
            $order->save();

            // Build order note with subscription info if applicable
            $note_text = sprintf(
                /* translators: 1: Card type 2: Last 4 digits 3: Transaction ID */
                __( 'Windcave payment complete using saved %1$s ending in %2$s. Transaction ID: %3$s', 'windcave-woocommerce' ),
                ucfirst( $token->get_card_type() ),
                $token->get_last4(),
                $result['id'] ?? ''
            );

            if ( $is_subscription_payment ) {
                $note_text .= ' ' . __( '(Subscription payment)', 'windcave-woocommerce' );
            }

            $order->add_order_note( $note_text );

            WC()->cart->empty_cart();

            return array(
                'result'   => 'success',
                'redirect' => $this->get_return_url( $order ),
            );
        }

        $error_message = isset( $result['responseText'] ) ? $result['responseText'] : __( 'Payment declined.', 'windcave-woocommerce' );
        wc_add_notice( $error_message, 'error' );
        return array( 'result' => 'failure' );
    }

    /**
     * Verify payment by checking session status
     *
     * @param WC_Order $order      Order object.
     * @param string   $session_id Session ID.
     * @return array
     */
    private function verify_payment( $order, $session_id ) {
        $api = $this->get_api();
        $session = $api->get_session( $session_id );

        if ( is_wp_error( $session ) ) {
            $this->log( 'Session verification error: ' . $session->get_error_message() );
            wc_add_notice( __( 'Could not verify payment. Please try again.', 'windcave-woocommerce' ), 'error' );
            return array( 'result' => 'failure' );
        }

        $state = isset( $session['state'] ) ? $session['state'] : '';

        switch ( $state ) {
            case 'complete':
                $transactions = isset( $session['transactions'] ) ? $session['transactions'] : array();
                $transaction  = ! empty( $transactions ) ? end( $transactions ) : null;

                if ( $transaction && isset( $transaction['authorised'] ) && $transaction['authorised'] ) {
                    $transaction_id = isset( $transaction['id'] ) ? $transaction['id'] : '';

                    $order->payment_complete( $transaction_id );
                    $order->add_order_note(
                        sprintf(
                            /* translators: %s: Transaction ID */
                            __( 'Windcave payment complete. Transaction ID: %s', 'windcave-woocommerce' ),
                            $transaction_id
                        )
                    );

                    // Save card if requested or if subscription order
                    $should_save_card = 'yes' === $order->get_meta( '_windcave_save_card' );

                    // Always save card for subscription orders
                    if ( class_exists( 'WC_Subscriptions' ) && function_exists( 'wcs_order_contains_subscription' ) ) {
                        if ( wcs_order_contains_subscription( $order ) ) {
                            $should_save_card = true;
                        }
                    }

                    if ( $should_save_card && isset( $transaction['card'] ) ) {
                        $saved_token = Windcave_Tokens::save_card( $order->get_customer_id(), $transaction['card'], true );

                        // Store token ID for subscription renewals
                        if ( $saved_token && class_exists( 'WC_Subscriptions' ) ) {
                            $order->update_meta_data( '_windcave_token_id', $saved_token->get_id() );
                            $order->save();

                            // Also store on related subscriptions
                            if ( function_exists( 'wcs_get_subscriptions_for_order' ) ) {
                                $subscriptions = wcs_get_subscriptions_for_order( $order, array( 'order_type' => 'parent' ) );
                                foreach ( $subscriptions as $subscription ) {
                                    $subscription->update_meta_data( '_windcave_token_id', $saved_token->get_id() );
                                    $subscription->save();
                                }
                            }
                        }
                    }

                    WC()->cart->empty_cart();

                    return array(
                        'result'   => 'success',
                        'redirect' => $this->get_return_url( $order ),
                    );
                }

                $error_message = isset( $transaction['responseText'] ) ? $transaction['responseText'] : __( 'Payment declined.', 'windcave-woocommerce' );
                wc_add_notice( $error_message, 'error' );
                return array( 'result' => 'failure' );

            case 'pending':
                // Payment still processing (3DS redirect or async payment)
                // Set order to on-hold and don't redirect to thank-you page yet
                $order->update_status( 'on-hold', __( 'Awaiting payment confirmation from Windcave.', 'windcave-woocommerce' ) );
                $order->save();

                // Return a special response - the frontend should handle this
                // by waiting for the payment to complete rather than redirecting
                return array(
                    'result'   => 'success',
                    'redirect' => wc_get_checkout_url(), // Stay on checkout, don't go to thank-you
                    'messages' => __( 'Payment is being processed. Please wait...', 'windcave-woocommerce' ),
                );

            default:
                wc_add_notice( __( 'Payment failed. Please try again.', 'windcave-woocommerce' ), 'error' );
                return array( 'result' => 'failure' );
        }
    }

    /**
     * Process refund
     *
     * @param int    $order_id Order ID.
     * @param float  $amount   Refund amount.
     * @param string $reason   Refund reason.
     * @return bool|WP_Error
     */
    public function process_refund( $order_id, $amount = null, $reason = '' ) {
        $order = wc_get_order( $order_id );

        if ( ! $order ) {
            return new WP_Error( 'windcave_refund_error', __( 'Order not found.', 'windcave-woocommerce' ) );
        }

        $transaction_id = $order->get_transaction_id();

        if ( empty( $transaction_id ) ) {
            return new WP_Error( 'windcave_refund_error', __( 'Transaction ID not found.', 'windcave-woocommerce' ) );
        }

        $api = $this->get_api();
        $result = $api->refund(
            $transaction_id,
            $amount,
            $this->get_merchant_reference( $order ) . '-refund'
        );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        if ( isset( $result['authorised'] ) && $result['authorised'] ) {
            $order->add_order_note(
                sprintf(
                    /* translators: 1: Refund amount 2: Refund transaction ID */
                    __( 'Refunded %1$s via Windcave. Refund Transaction ID: %2$s', 'windcave-woocommerce' ),
                    wc_price( $amount ),
                    $result['id'] ?? ''
                )
            );
            return true;
        }

        $error_message = isset( $result['responseText'] ) ? $result['responseText'] : __( 'Refund failed.', 'windcave-woocommerce' );
        return new WP_Error( 'windcave_refund_error', $error_message );
    }

    /**
     * AJAX handler for creating a session
     */
    public function ajax_create_session() {
        $this->log( 'AJAX create_session called', true );

        // Verify nonce - return error instead of dying silently
        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ?? '' ) ), 'windcave_nonce' ) ) {
            $this->log_error( 'AJAX create_session: Nonce verification failed' );
            wp_send_json_error( array(
                'message' => __( 'Security check failed. Please refresh the page and try again.', 'windcave-woocommerce' ),
            ) );
        }

        $order_id = isset( $_POST['order_id'] ) ? absint( $_POST['order_id'] ) : 0;
        $amount   = isset( $_POST['amount'] ) ? wc_format_decimal( sanitize_text_field( wp_unslash( $_POST['amount'] ) ) ) : 0;
        $currency = isset( $_POST['currency'] ) ? sanitize_text_field( wp_unslash( $_POST['currency'] ) ) : get_woocommerce_currency();

        $this->log( sprintf( 'AJAX create_session: order_id=%d, amount=%s, currency=%s', $order_id, $amount, $currency ), true );

        // If no order yet (checkout), get cart total
        if ( ! $order_id && WC()->cart ) {
            $amount   = WC()->cart->get_total( 'edit' );
            $currency = get_woocommerce_currency();
            $this->log( sprintf( 'AJAX create_session: Using cart total: %s %s', $amount, $currency ), true );
        }

        if ( $order_id ) {
            $order = wc_get_order( $order_id );
            if ( $order ) {
                $amount   = $order->get_total();
                $currency = $order->get_currency();
                $this->log( sprintf( 'AJAX create_session: Using order total: %s %s', $amount, $currency ), true );
            }
        }

        // Check if API credentials are configured
        $api_username = $this->get_api_username();
        $api_key = $this->get_api_key();

        if ( empty( $api_username ) || empty( $api_key ) ) {
            $this->log_error( 'AJAX create_session: API credentials not configured' );
            wp_send_json_error( array(
                'message' => __( 'Windcave API credentials are not configured. Please contact the store administrator.', 'windcave-woocommerce' ),
            ) );
        }

        $api = $this->get_api();

        // Determine if this is a subscription order
        $is_subscription_order = false;
        $payment_type = 'single';

        if ( $order_id && class_exists( 'WC_Subscriptions' ) && function_exists( 'wcs_order_contains_subscription' ) ) {
            $order_obj = wc_get_order( $order_id );
            if ( $order_obj && wcs_order_contains_subscription( $order_obj ) ) {
                $is_subscription_order = true;
                $payment_type = 'recurring';
            }
        }

        $params = array(
            'type'              => 'purchase',
            'amount'            => number_format( $amount, 2, '.', '' ),
            'currency'          => $currency,
            'merchantReference' => $order_id ? $this->get_merchant_reference( wc_get_order( $order_id ) ) : 'cart-' . time(),
            'callbackUrls'      => array(
                'approved'  => Windcave_Webhook::get_callback_url( 'approved' ),
                'declined'  => Windcave_Webhook::get_callback_url( 'declined' ),
                'cancelled' => Windcave_Webhook::get_callback_url( 'cancelled' ),
            ),
            'notificationUrl'   => Windcave_Webhook::get_webhook_url(),
        );

        // Determine if we should store the card
        // Only store when: customer requests it, subscription order, or add-payment-method page
        $should_store_card = false;
        $save_card_requested = isset( $_POST['save_card'] ) && 'true' === sanitize_text_field( wp_unslash( $_POST['save_card'] ) );
        $is_add_payment_method = isset( $_POST['is_add_payment_method'] ) && 'true' === sanitize_text_field( wp_unslash( $_POST['is_add_payment_method'] ) );

        if ( $this->supports( 'tokenization' ) ) {
            // Store card if: customer requested, subscription order, or add-payment-method page
            if ( $save_card_requested || $is_subscription_order || $is_add_payment_method ) {
                $should_store_card = true;
                $params['storeCard'] = true;

                // Set appropriate storedCardIndicator for initial card storage
                $stored_card_indicator = Windcave_Tokens::get_stored_card_indicator( true, $payment_type );
                $params['storedCardIndicator'] = $stored_card_indicator;
            }
        }

        $this->log( 'AJAX create_session: Creating session with Windcave API', true );
        $session = $api->create_session( $params );

        if ( is_wp_error( $session ) ) {
            $this->log_error( 'AJAX create_session: API error - ' . $session->get_error_message() );
            wp_send_json_error( array(
                'message' => $session->get_error_message(),
            ) );
        }

        // Get session ID from links
        $session_id = Windcave_API::get_session_id_from_links( $session['links'] ?? array() );
        $ajax_submit_url = Windcave_API::get_ajax_submit_url( $session['links'] ?? array() );

        $this->log( sprintf( 'AJAX create_session: Session created successfully, ID=%s', $session_id ), true );

        wp_send_json_success( array(
            'sessionId'     => $session_id,
            'links'         => $session['links'] ?? array(),
            'ajaxSubmitUrl' => $ajax_submit_url,
        ) );
    }

    /**
     * Get API instance
     *
     * @return Windcave_API
     */
    private function get_api() {
        return new Windcave_API(
            $this->get_api_username(),
            $this->get_api_key(),
            $this->test_mode,
            $this->debug_mode
        );
    }

    /**
     * Get merchant reference for an order
     *
     * @param WC_Order $order Order object.
     * @return string
     */
    private function get_merchant_reference( $order ) {
        return 'WC-' . $order->get_id();
    }

    /**
     * Log a debug message (only when debug mode is enabled)
     *
     * @param string $message Message to log.
     * @param bool   $force   Force logging even if debug mode is off.
     */
    private function log( $message, $force = false ) {
        if ( ! $this->debug_mode && ! $force ) {
            return;
        }

        if ( function_exists( 'wc_get_logger' ) ) {
            $logger = wc_get_logger();
            $logger->debug( $message, array( 'source' => 'windcave' ) );
        }
    }

    /**
     * Log an error message (always logged regardless of debug mode)
     *
     * @param string $message Message to log.
     */
    private function log_error( $message ) {
        if ( function_exists( 'wc_get_logger' ) ) {
            $logger = wc_get_logger();
            $logger->error( $message, array( 'source' => 'windcave' ) );
        }
    }

    /**
     * Display Apple Pay Express button container
     * Scripts are pre-loaded via payment_scripts() to ensure they're available for mini-cart
     */
    public function display_apple_pay_express_button() {
        // Only output the container - scripts are loaded in payment_scripts()
        ?>
        <div id="windcave-applepay-express-container" class="windcave-applepay-express"></div>
        <?php
    }

    /**
     * AJAX handler for creating an Express session
     */
    public function ajax_create_express_session() {
        $this->log( 'AJAX create_express_session called', true );

        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ?? '' ) ), 'windcave_applepay_express_nonce' ) ) {
            $this->log_error( 'AJAX create_express_session: Nonce verification failed' );
            wp_send_json_error( array( 'message' => __( 'Security check failed.', 'windcave-woocommerce' ) ) );
        }

        if ( ! WC()->cart || WC()->cart->is_empty() ) {
            wp_send_json_error( array( 'message' => __( 'Cart is empty.', 'windcave-woocommerce' ) ) );
        }

        $amount   = WC()->cart->get_total( 'edit' );
        $currency = get_woocommerce_currency();

        $this->log( sprintf( 'AJAX create_express_session: amount=%s, currency=%s', $amount, $currency ), true );

        $api = $this->get_api();

        $params = array(
            'type'              => 'purchase',
            'amount'            => number_format( $amount, 2, '.', '' ),
            'currency'          => $currency,
            'merchantReference' => 'express-' . time(),
            'callbackUrls'      => array(
                'approved'  => Windcave_Webhook::get_callback_url( 'approved' ),
                'declined'  => Windcave_Webhook::get_callback_url( 'declined' ),
                'cancelled' => Windcave_Webhook::get_callback_url( 'cancelled' ),
            ),
            'notificationUrl'   => Windcave_Webhook::get_webhook_url(),
        );

        $session = $api->create_session( $params );

        if ( is_wp_error( $session ) ) {
            $this->log_error( 'AJAX create_express_session: API error - ' . $session->get_error_message() );
            wp_send_json_error( array( 'message' => $session->get_error_message() ) );
        }

        // Find the ajaxSubmitApplePay link
        $apple_pay_url = '';
        $session_id = '';
        foreach ( $session['links'] ?? array() as $link ) {
            if ( 'ajaxSubmitApplePay' === $link['rel'] ) {
                $apple_pay_url = $link['href'];
            }
            if ( 'self' === $link['rel'] ) {
                $session_id = basename( $link['href'] );
            }
        }

        if ( empty( $apple_pay_url ) ) {
            $this->log_error( 'AJAX create_express_session: No ajaxSubmitApplePay link found' );
            wp_send_json_error( array( 'message' => __( 'Apple Pay is not available for this transaction.', 'windcave-woocommerce' ) ) );
        }

        $this->log( sprintf( 'AJAX create_express_session: Session created, ID=%s', $session_id ), true );

        // Store session ID in WC session for later use
        WC()->session->set( 'windcave_express_session_id', $session_id );

        wp_send_json_success( array(
            'sessionId'    => $session_id,
            'applePayUrl'  => $apple_pay_url,
            'amount'       => number_format( $amount, 2, '.', '' ),
            'currency'     => $currency,
        ) );
    }

    /**
     * AJAX handler for processing Express payment
     */
    public function ajax_process_express_payment() {
        $this->log( 'AJAX process_express_payment called', true );

        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ?? '' ) ), 'windcave_applepay_express_nonce' ) ) {
            $this->log_error( 'AJAX process_express_payment: Nonce verification failed' );
            wp_send_json_error( array( 'message' => __( 'Security check failed.', 'windcave-woocommerce' ) ) );
        }

        $session_id = sanitize_text_field( wp_unslash( $_POST['session_id'] ?? '' ) );

        if ( empty( $session_id ) ) {
            wp_send_json_error( array( 'message' => __( 'Invalid session.', 'windcave-woocommerce' ) ) );
        }

        // Query the session to get the result
        $api = $this->get_api();
        $session = $api->query_session( $session_id );

        if ( is_wp_error( $session ) ) {
            $this->log_error( 'AJAX process_express_payment: Session query error - ' . $session->get_error_message() );
            wp_send_json_error( array( 'message' => $session->get_error_message() ) );
        }

        $state = $session['state'] ?? '';
        $this->log( sprintf( 'AJAX process_express_payment: Session state=%s', $state ), true );

        if ( 'complete' !== $state ) {
            wp_send_json_error( array( 'message' => __( 'Payment was not completed.', 'windcave-woocommerce' ) ) );
        }

        // Get transaction details
        $transactions = $session['transactions'] ?? array();
        if ( empty( $transactions ) ) {
            wp_send_json_error( array( 'message' => __( 'No transaction found.', 'windcave-woocommerce' ) ) );
        }

        $transaction = $transactions[0];
        $authorised = $transaction['authorised'] ?? false;

        if ( ! $authorised ) {
            $error_message = $transaction['responseText'] ?? __( 'Payment declined.', 'windcave-woocommerce' );
            wp_send_json_error( array( 'message' => $error_message ) );
        }

        // Create the order from cart
        try {
            $order = $this->create_order_from_cart( $session, $transaction );

            if ( is_wp_error( $order ) ) {
                throw new Exception( $order->get_error_message() );
            }

            // Clear the cart
            WC()->cart->empty_cart();

            $this->log( sprintf( 'AJAX process_express_payment: Order created, ID=%d', $order->get_id() ), true );

            wp_send_json_success( array(
                'redirect' => $order->get_checkout_order_received_url(),
            ) );

        } catch ( Exception $e ) {
            $this->log_error( 'AJAX process_express_payment: Order creation error - ' . $e->getMessage() );
            wp_send_json_error( array( 'message' => $e->getMessage() ) );
        }
    }

    /**
     * Create order from cart for Express checkout (Apple Pay or Google Pay)
     *
     * @param array  $session      Session data.
     * @param array  $transaction  Transaction data.
     * @param string $payment_type Payment type ('apple_pay' or 'google_pay').
     * @return WC_Order|WP_Error
     */
    private function create_order_from_cart( $session, $transaction, $payment_type = 'apple_pay' ) {
        // Create the order
        $order = wc_create_order();

        if ( is_wp_error( $order ) ) {
            return $order;
        }

        // Add cart items to order
        foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
            $product = $cart_item['data'];
            $order->add_product( $product, $cart_item['quantity'], array(
                'subtotal' => $cart_item['line_subtotal'],
                'total'    => $cart_item['line_total'],
            ) );
        }

        // Set order details
        $order->set_payment_method( $this );
        $order->set_currency( get_woocommerce_currency() );
        $order->set_prices_include_tax( 'yes' === get_option( 'woocommerce_prices_include_tax' ) );

        // Extract and set billing/shipping from wallet payment data
        $this->set_express_order_addresses( $order, $transaction );

        // Add shipping if applicable
        if ( WC()->cart->needs_shipping() ) {
            $packages = WC()->shipping()->get_packages();
            foreach ( $packages as $package ) {
                $chosen_method = WC()->session->get( 'chosen_shipping_methods' );
                if ( ! empty( $chosen_method[0] ) ) {
                    foreach ( $package['rates'] as $rate ) {
                        if ( $rate->id === $chosen_method[0] ) {
                            $item = new WC_Order_Item_Shipping();
                            $item->set_method_title( $rate->label );
                            $item->set_method_id( $rate->id );
                            $item->set_total( $rate->cost );
                            $order->add_item( $item );
                            break;
                        }
                    }
                }
            }
        }

        // Apply coupons
        foreach ( WC()->cart->get_applied_coupons() as $coupon_code ) {
            $order->apply_coupon( $coupon_code );
        }

        // Set customer if logged in
        if ( is_user_logged_in() ) {
            $order->set_customer_id( get_current_user_id() );
        }

        // Calculate totals
        $order->calculate_totals();

        // Store transaction data
        $order->update_meta_data( '_windcave_session_id', $session['id'] ?? '' );
        $order->update_meta_data( '_windcave_transaction_id', $transaction['id'] ?? '' );
        $order->update_meta_data( '_windcave_dpstxnref', $transaction['dpsTxnRef'] ?? '' );
        $order->update_meta_data( '_windcave_reco', $transaction['reco'] ?? '' );
        $order->update_meta_data( '_windcave_response_text', $transaction['responseText'] ?? '' );
        $order->update_meta_data( '_windcave_card_type', $transaction['card']['type'] ?? '' );
        $order->update_meta_data( '_windcave_card_last4', substr( $transaction['card']['cardNumber'] ?? '', -4 ) );
        $order->update_meta_data( '_windcave_payment_type', $payment_type );

        // Set as paid
        $order->payment_complete( $transaction['id'] ?? '' );

        // Add order note
        $payment_label = 'apple_pay' === $payment_type ? 'Apple Pay' : 'Google Pay';
        $order->add_order_note(
            sprintf(
                /* translators: 1: Payment type 2: Transaction ID */
                __( '%1$s Express payment completed. Transaction ID: %2$s', 'windcave-woocommerce' ),
                $payment_label,
                $transaction['id'] ?? ''
            )
        );

        $order->save();

        return $order;
    }

    /**
     * Set billing and shipping addresses from Express checkout data
     *
     * @param WC_Order $order       Order object.
     * @param array    $transaction Transaction data from Windcave.
     */
    private function set_express_order_addresses( $order, $transaction ) {
        // Extract billing contact from transaction
        // Windcave returns billing info in the card/billingContact field for wallet payments
        $billing_contact = $transaction['card']['billingContact'] ?? array();
        $shipping_contact = $transaction['shippingContact'] ?? array();

        // Set billing address if available
        if ( ! empty( $billing_contact ) ) {
            $name_parts = $this->parse_wallet_name( $billing_contact['name'] ?? '' );

            $order->set_billing_first_name( $name_parts['first_name'] );
            $order->set_billing_last_name( $name_parts['last_name'] );
            $order->set_billing_email( $billing_contact['email'] ?? '' );
            $order->set_billing_phone( $billing_contact['phone'] ?? '' );
            $order->set_billing_address_1( $billing_contact['addressLine1'] ?? ( $billing_contact['street'] ?? '' ) );
            $order->set_billing_address_2( $billing_contact['addressLine2'] ?? '' );
            $order->set_billing_city( $billing_contact['city'] ?? ( $billing_contact['locality'] ?? '' ) );
            $order->set_billing_state( $billing_contact['state'] ?? ( $billing_contact['administrativeArea'] ?? '' ) );
            $order->set_billing_postcode( $billing_contact['postalCode'] ?? '' );
            $order->set_billing_country( $billing_contact['countryCode'] ?? ( $billing_contact['country'] ?? '' ) );
        }

        // Set shipping address if available, otherwise copy from billing
        if ( ! empty( $shipping_contact ) ) {
            $name_parts = $this->parse_wallet_name( $shipping_contact['name'] ?? '' );

            $order->set_shipping_first_name( $name_parts['first_name'] );
            $order->set_shipping_last_name( $name_parts['last_name'] );
            $order->set_shipping_address_1( $shipping_contact['addressLine1'] ?? ( $shipping_contact['street'] ?? '' ) );
            $order->set_shipping_address_2( $shipping_contact['addressLine2'] ?? '' );
            $order->set_shipping_city( $shipping_contact['city'] ?? ( $shipping_contact['locality'] ?? '' ) );
            $order->set_shipping_state( $shipping_contact['state'] ?? ( $shipping_contact['administrativeArea'] ?? '' ) );
            $order->set_shipping_postcode( $shipping_contact['postalCode'] ?? '' );
            $order->set_shipping_country( $shipping_contact['countryCode'] ?? ( $shipping_contact['country'] ?? '' ) );
        } elseif ( ! empty( $billing_contact ) ) {
            // Copy billing to shipping if shipping not provided
            $name_parts = $this->parse_wallet_name( $billing_contact['name'] ?? '' );

            $order->set_shipping_first_name( $name_parts['first_name'] );
            $order->set_shipping_last_name( $name_parts['last_name'] );
            $order->set_shipping_address_1( $billing_contact['addressLine1'] ?? ( $billing_contact['street'] ?? '' ) );
            $order->set_shipping_address_2( $billing_contact['addressLine2'] ?? '' );
            $order->set_shipping_city( $billing_contact['city'] ?? ( $billing_contact['locality'] ?? '' ) );
            $order->set_shipping_state( $billing_contact['state'] ?? ( $billing_contact['administrativeArea'] ?? '' ) );
            $order->set_shipping_postcode( $billing_contact['postalCode'] ?? '' );
            $order->set_shipping_country( $billing_contact['countryCode'] ?? ( $billing_contact['country'] ?? '' ) );
        }
    }

    /**
     * Parse name from wallet payment into first and last name
     *
     * @param string $full_name Full name from wallet.
     * @return array Array with 'first_name' and 'last_name'.
     */
    private function parse_wallet_name( $full_name ) {
        $full_name = trim( $full_name );

        if ( empty( $full_name ) ) {
            return array(
                'first_name' => '',
                'last_name'  => '',
            );
        }

        $parts = explode( ' ', $full_name, 2 );

        return array(
            'first_name' => $parts[0] ?? '',
            'last_name'  => $parts[1] ?? '',
        );
    }

    /**
     * Display Google Pay Express button container
     */
    public function display_google_pay_express_button() {
        ?>
        <div id="windcave-googlepay-express-container" class="windcave-googlepay-express"></div>
        <?php
    }

    /**
     * AJAX handler for creating a Google Pay Express session
     */
    public function ajax_create_googlepay_express_session() {
        $this->log( 'AJAX create_googlepay_express_session called', true );

        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ?? '' ) ), 'windcave_googlepay_express_nonce' ) ) {
            $this->log_error( 'AJAX create_googlepay_express_session: Nonce verification failed' );
            wp_send_json_error( array( 'message' => __( 'Security check failed.', 'windcave-woocommerce' ) ) );
        }

        if ( ! WC()->cart || WC()->cart->is_empty() ) {
            wp_send_json_error( array( 'message' => __( 'Cart is empty.', 'windcave-woocommerce' ) ) );
        }

        $amount   = WC()->cart->get_total( 'edit' );
        $currency = get_woocommerce_currency();

        $this->log( sprintf( 'AJAX create_googlepay_express_session: amount=%s, currency=%s', $amount, $currency ), true );

        $api = $this->get_api();

        $params = array(
            'type'              => 'purchase',
            'amount'            => number_format( $amount, 2, '.', '' ),
            'currency'          => $currency,
            'merchantReference' => 'gpay-express-' . time(),
            'callbackUrls'      => array(
                'approved'  => Windcave_Webhook::get_callback_url( 'approved' ),
                'declined'  => Windcave_Webhook::get_callback_url( 'declined' ),
                'cancelled' => Windcave_Webhook::get_callback_url( 'cancelled' ),
            ),
            'notificationUrl'   => Windcave_Webhook::get_webhook_url(),
        );

        $session = $api->create_session( $params );

        if ( is_wp_error( $session ) ) {
            $this->log_error( 'AJAX create_googlepay_express_session: API error - ' . $session->get_error_message() );
            wp_send_json_error( array( 'message' => $session->get_error_message() ) );
        }

        // Find the ajaxSubmitGooglePay link
        $google_pay_url = '';
        $session_id = '';
        foreach ( $session['links'] ?? array() as $link ) {
            if ( 'ajaxSubmitGooglePay' === $link['rel'] ) {
                $google_pay_url = $link['href'];
            }
            if ( 'self' === $link['rel'] ) {
                $session_id = basename( $link['href'] );
            }
        }

        if ( empty( $google_pay_url ) ) {
            $this->log_error( 'AJAX create_googlepay_express_session: No ajaxSubmitGooglePay link found' );
            wp_send_json_error( array( 'message' => __( 'Google Pay is not available for this transaction.', 'windcave-woocommerce' ) ) );
        }

        $this->log( sprintf( 'AJAX create_googlepay_express_session: Session created, ID=%s', $session_id ), true );

        // Store session ID in WC session for later use
        WC()->session->set( 'windcave_googlepay_express_session_id', $session_id );

        wp_send_json_success( array(
            'sessionId'     => $session_id,
            'googlePayUrl'  => $google_pay_url,
            'amount'        => number_format( $amount, 2, '.', '' ),
            'currency'      => $currency,
        ) );
    }

    /**
     * AJAX handler for processing Google Pay Express payment
     */
    public function ajax_process_googlepay_express_payment() {
        $this->log( 'AJAX process_googlepay_express_payment called', true );

        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ?? '' ) ), 'windcave_googlepay_express_nonce' ) ) {
            $this->log_error( 'AJAX process_googlepay_express_payment: Nonce verification failed' );
            wp_send_json_error( array( 'message' => __( 'Security check failed.', 'windcave-woocommerce' ) ) );
        }

        $session_id = sanitize_text_field( wp_unslash( $_POST['session_id'] ?? '' ) );

        if ( empty( $session_id ) ) {
            wp_send_json_error( array( 'message' => __( 'Invalid session.', 'windcave-woocommerce' ) ) );
        }

        // Query the session to get the result
        $api = $this->get_api();
        $session = $api->query_session( $session_id );

        if ( is_wp_error( $session ) ) {
            $this->log_error( 'AJAX process_googlepay_express_payment: Session query error - ' . $session->get_error_message() );
            wp_send_json_error( array( 'message' => $session->get_error_message() ) );
        }

        $state = $session['state'] ?? '';
        $this->log( sprintf( 'AJAX process_googlepay_express_payment: Session state=%s', $state ), true );

        if ( 'complete' !== $state ) {
            wp_send_json_error( array( 'message' => __( 'Payment was not completed.', 'windcave-woocommerce' ) ) );
        }

        // Get transaction details
        $transactions = $session['transactions'] ?? array();
        if ( empty( $transactions ) ) {
            wp_send_json_error( array( 'message' => __( 'No transaction found.', 'windcave-woocommerce' ) ) );
        }

        $transaction = $transactions[0];
        $authorised = $transaction['authorised'] ?? false;

        if ( ! $authorised ) {
            $error_message = $transaction['responseText'] ?? __( 'Payment declined.', 'windcave-woocommerce' );
            wp_send_json_error( array( 'message' => $error_message ) );
        }

        // Create the order from cart using unified method
        try {
            $order = $this->create_order_from_cart( $session, $transaction, 'google_pay' );

            if ( is_wp_error( $order ) ) {
                throw new Exception( $order->get_error_message() );
            }

            // Clear the cart
            WC()->cart->empty_cart();

            $this->log( sprintf( 'AJAX process_googlepay_express_payment: Order created, ID=%d', $order->get_id() ), true );

            wp_send_json_success( array(
                'redirect' => $order->get_checkout_order_received_url(),
            ) );

        } catch ( Exception $e ) {
            $this->log_error( 'AJAX process_googlepay_express_payment: Order creation error - ' . $e->getMessage() );
            wp_send_json_error( array( 'message' => $e->getMessage() ) );
        }
    }
}
