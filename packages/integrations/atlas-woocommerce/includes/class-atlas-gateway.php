<?php
/**
 * Atlas Payment Gateway
 *
 * @package Atlas_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Atlas Gateway class
 */
class Atlas_Gateway extends WC_Payment_Gateway {

    /**
     * Test mode flag
     * @var bool
     */
    private $test_mode;

    /**
     * Debug mode flag
     * @var bool
     */
    private $debug_mode;

    /**
     * Test public key
     * @var string
     */
    private $test_public_key;

    /**
     * Test secret key
     * @var string
     */
    private $test_secret_key;

    /**
     * Live public key
     * @var string
     */
    private $live_public_key;

    /**
     * Live secret key
     * @var string
     */
    private $live_secret_key;

    /**
     * Enable tokenization
     * @var bool
     */
    private $enable_tokenization;

    /**
     * Enable Apple Pay
     * @var bool
     */
    private $enable_apple_pay;

    /**
     * Enable Google Pay
     * @var bool
     */
    private $enable_google_pay;

    /**
     * Constructor
     */
    public function __construct() {
        $this->id                 = 'atlas';
        $this->icon               = apply_filters( 'atlas_icon', ATLAS_PLUGIN_URL . 'assets/images/atlas-logo.svg' );
        $this->has_fields         = true;
        $this->method_title       = __( 'Atlas', 'atlas-woocommerce' );
        $this->method_description = __( 'Accept payments via Atlas with multi-processor orchestration, failover, and smart routing.', 'atlas-woocommerce' );

        // Supported features
        $this->supports = array(
            'products',
            'refunds',
            'tokenization',
            'add_payment_method',
        );

        // Add subscription support if WooCommerce Subscriptions is active
        if ( class_exists( 'WC_Subscriptions' ) ) {
            $this->supports = array_merge( $this->supports, array(
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
            ) );
        }

        // Load settings
        $this->init_form_fields();
        $this->init_settings();

        // Get settings
        $this->title              = $this->get_option( 'title' );
        $this->description        = $this->get_option( 'description' );
        $this->test_mode          = 'yes' === $this->get_option( 'test_mode' );
        $this->debug_mode         = 'yes' === $this->get_option( 'debug_mode' );
        $this->test_public_key    = $this->get_option( 'test_public_key' );
        $this->test_secret_key    = $this->get_option( 'test_secret_key' );
        $this->live_public_key    = $this->get_option( 'live_public_key' );
        $this->live_secret_key    = $this->get_option( 'live_secret_key' );
        $this->enable_tokenization = 'yes' === $this->get_option( 'enable_tokenization', 'yes' );
        $this->enable_apple_pay   = 'yes' === $this->get_option( 'enable_apple_pay' );
        $this->enable_google_pay  = 'yes' === $this->get_option( 'enable_google_pay' );

        // Hooks
        add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'payment_scripts' ) );
        add_action( 'wp_ajax_atlas_create_session', array( $this, 'ajax_create_session' ) );
        add_action( 'wp_ajax_nopriv_atlas_create_session', array( $this, 'ajax_create_session' ) );
    }

    /**
     * Initialize form fields
     */
    public function init_form_fields() {
        $this->form_fields = array(
            'enabled' => array(
                'title'   => __( 'Enable/Disable', 'atlas-woocommerce' ),
                'type'    => 'checkbox',
                'label'   => __( 'Enable Atlas', 'atlas-woocommerce' ),
                'default' => 'no',
            ),
            'title' => array(
                'title'       => __( 'Title', 'atlas-woocommerce' ),
                'type'        => 'text',
                'description' => __( 'Title shown at checkout.', 'atlas-woocommerce' ),
                'default'     => __( 'Credit/Debit Card', 'atlas-woocommerce' ),
                'desc_tip'    => true,
            ),
            'description' => array(
                'title'       => __( 'Description', 'atlas-woocommerce' ),
                'type'        => 'textarea',
                'description' => __( 'Description shown at checkout.', 'atlas-woocommerce' ),
                'default'     => __( 'Pay securely with your card. Your payment is protected by Atlas.', 'atlas-woocommerce' ),
                'desc_tip'    => true,
            ),
            'test_mode' => array(
                'title'       => __( 'Test Mode', 'atlas-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable test mode', 'atlas-woocommerce' ),
                'description' => __( 'Use Atlas sandbox environment for testing.', 'atlas-woocommerce' ),
                'default'     => 'yes',
                'desc_tip'    => true,
            ),
            'test_public_key' => array(
                'title'       => __( 'Test Public Key', 'atlas-woocommerce' ),
                'type'        => 'text',
                'description' => __( 'Your Atlas test public key (pk_test_...).', 'atlas-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'test_secret_key' => array(
                'title'       => __( 'Test Secret Key', 'atlas-woocommerce' ),
                'type'        => 'password',
                'description' => __( 'Your Atlas test secret key (sk_test_...).', 'atlas-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'live_public_key' => array(
                'title'       => __( 'Live Public Key', 'atlas-woocommerce' ),
                'type'        => 'text',
                'description' => __( 'Your Atlas live public key (pk_live_...).', 'atlas-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'live_secret_key' => array(
                'title'       => __( 'Live Secret Key', 'atlas-woocommerce' ),
                'type'        => 'password',
                'description' => __( 'Your Atlas live secret key (sk_live_...).', 'atlas-woocommerce' ),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'enable_tokenization' => array(
                'title'       => __( 'Saved Cards', 'atlas-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Allow customers to save cards', 'atlas-woocommerce' ),
                'description' => __( 'Enable card tokenization for faster checkout.', 'atlas-woocommerce' ),
                'default'     => 'yes',
                'desc_tip'    => true,
            ),
            'enable_apple_pay' => array(
                'title'       => __( 'Apple Pay', 'atlas-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable Apple Pay', 'atlas-woocommerce' ),
                'default'     => 'no',
            ),
            'enable_google_pay' => array(
                'title'       => __( 'Google Pay', 'atlas-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable Google Pay', 'atlas-woocommerce' ),
                'default'     => 'no',
            ),
            'apple_pay_domain_verification' => array(
                'title'       => __( 'Apple Pay Domain Verification', 'atlas-woocommerce' ),
                'type'        => 'textarea',
                'description' => __( 'Apple Pay domain verification file contents.', 'atlas-woocommerce' ),
                'default'     => '',
                'css'         => 'width: 100%; height: 80px; font-family: monospace;',
            ),
            'debug_mode' => array(
                'title'       => __( 'Debug Mode', 'atlas-woocommerce' ),
                'type'        => 'checkbox',
                'label'       => __( 'Enable debug logging', 'atlas-woocommerce' ),
                'description' => __( 'Logs are saved in WooCommerce > Status > Logs.', 'atlas-woocommerce' ),
                'default'     => 'no',
                'desc_tip'    => true,
            ),
        );
    }

    /**
     * Get public key
     * @return string
     */
    public function get_public_key() {
        return $this->test_mode ? $this->test_public_key : $this->live_public_key;
    }

    /**
     * Get secret key
     * @return string
     */
    public function get_secret_key() {
        return $this->test_mode ? $this->test_secret_key : $this->live_secret_key;
    }

    /**
     * Check if gateway is available
     * @return bool
     */
    public function is_available() {
        if ( ! parent::is_available() ) {
            return false;
        }

        if ( empty( $this->get_public_key() ) || empty( $this->get_secret_key() ) ) {
            return false;
        }

        return true;
    }

    /**
     * Enqueue payment scripts
     */
    public function payment_scripts() {
        if ( ! is_checkout() && ! isset( $_GET['pay_for_order'] ) ) {
            return;
        }

        if ( 'no' === $this->enabled ) {
            return;
        }

        // Atlas JS SDK
        wp_enqueue_script(
            'atlas-sdk',
            'https://js.atlas.com/v1/atlas.js',
            array(),
            ATLAS_VERSION,
            true
        );

        // Plugin checkout script
        wp_enqueue_script(
            'atlas-checkout',
            ATLAS_PLUGIN_URL . 'assets/js/atlas-checkout.js',
            array( 'jquery', 'atlas-sdk' ),
            ATLAS_VERSION,
            true
        );

        // Plugin styles
        wp_enqueue_style(
            'atlas-checkout',
            ATLAS_PLUGIN_URL . 'assets/css/atlas-checkout.css',
            array(),
            ATLAS_VERSION
        );

        // Localize script
        wp_localize_script( 'atlas-checkout', 'atlas_params', array(
            'ajax_url'       => admin_url( 'admin-ajax.php' ),
            'nonce'          => wp_create_nonce( 'atlas_nonce' ),
            'public_key'     => $this->get_public_key(),
            'is_test_mode'   => $this->test_mode,
            'enable_apple_pay'  => $this->enable_apple_pay,
            'enable_google_pay' => $this->enable_google_pay,
            'currency'       => get_woocommerce_currency(),
            'country'        => WC()->countries->get_base_country(),
            'i18n'           => array(
                'card_error'    => __( 'Please check your card details.', 'atlas-woocommerce' ),
                'payment_error' => __( 'Payment failed. Please try again.', 'atlas-woocommerce' ),
            ),
        ) );
    }

    /**
     * Payment fields on checkout
     */
    public function payment_fields() {
        if ( $this->description ) {
            echo '<p>' . wp_kses_post( $this->description ) . '</p>';
        }

        if ( $this->test_mode ) {
            echo '<p class="atlas-test-mode">' . esc_html__( 'TEST MODE', 'atlas-woocommerce' ) . '</p>';
        }

        // Saved cards
        if ( $this->supports( 'tokenization' ) && is_checkout() && is_user_logged_in() ) {
            $this->saved_payment_methods();
        }

        // Payment form container (Atlas Elements will be mounted here)
        echo '<div id="atlas-card-element"></div>';
        echo '<div id="atlas-card-errors" role="alert"></div>';

        // Save card checkbox
        if ( $this->supports( 'tokenization' ) && is_checkout() && is_user_logged_in() ) {
            $this->save_payment_method_checkbox();
        }

        // Hidden fields
        echo '<input type="hidden" id="atlas-session-id" name="atlas_session_id" value="" />';
        echo '<input type="hidden" id="atlas-payment-method-id" name="atlas_payment_method_id" value="" />';
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
        $token_id = isset( $_POST['wc-atlas-payment-token'] ) ? wc_clean( wp_unslash( $_POST['wc-atlas-payment-token'] ) ) : '';

        if ( ! empty( $token_id ) && 'new' !== $token_id ) {
            return $this->process_token_payment( $order, $token_id );
        }

        // Get session ID from frontend
        $session_id = isset( $_POST['atlas_session_id'] ) ? sanitize_text_field( wp_unslash( $_POST['atlas_session_id'] ) ) : '';

        if ( empty( $session_id ) ) {
            wc_add_notice( __( 'Payment session not found. Please try again.', 'atlas-woocommerce' ), 'error' );
            return array( 'result' => 'failure' );
        }

        // Store session ID
        $order->update_meta_data( '_atlas_session_id', $session_id );
        $order->save();

        // Verify payment
        return $this->verify_payment( $order, $session_id );
    }

    /**
     * Verify payment
     *
     * @param WC_Order $order      Order object.
     * @param string   $session_id Session ID.
     * @return array
     */
    private function verify_payment( $order, $session_id ) {
        $api = $this->get_api();
        $session = $api->get_session( $session_id );

        if ( is_wp_error( $session ) ) {
            wc_add_notice( __( 'Could not verify payment. Please try again.', 'atlas-woocommerce' ), 'error' );
            return array( 'result' => 'failure' );
        }

        $status = $session['status'] ?? '';

        if ( 'succeeded' === $status || 'captured' === $status ) {
            $transaction_id = $session['payment_attempt_id'] ?? $session['id'] ?? '';

            $order->payment_complete( $transaction_id );
            $order->add_order_note(
                sprintf( __( 'Atlas payment complete. Transaction ID: %s', 'atlas-woocommerce' ), $transaction_id )
            );

            WC()->cart->empty_cart();

            return array(
                'result'   => 'success',
                'redirect' => $this->get_return_url( $order ),
            );
        }

        wc_add_notice( __( 'Payment failed. Please try again.', 'atlas-woocommerce' ), 'error' );
        return array( 'result' => 'failure' );
    }

    /**
     * Process token payment
     *
     * @param WC_Order $order    Order.
     * @param int      $token_id Token ID.
     * @return array
     */
    private function process_token_payment( $order, $token_id ) {
        $token = Atlas_Tokens::get_token( $token_id, get_current_user_id() );

        if ( ! $token ) {
            wc_add_notice( __( 'Invalid payment method.', 'atlas-woocommerce' ), 'error' );
            return array( 'result' => 'failure' );
        }

        $api = $this->get_api();
        $result = $api->charge_token(
            $token->get_token(),
            $order->get_total(),
            $order->get_currency(),
            'WC-' . $order->get_id()
        );

        if ( is_wp_error( $result ) ) {
            wc_add_notice( __( 'Payment failed. Please try again.', 'atlas-woocommerce' ), 'error' );
            return array( 'result' => 'failure' );
        }

        if ( $result['authorised'] ) {
            $order->payment_complete( $result['id'] );
            $order->add_order_note(
                sprintf( __( 'Atlas payment complete using saved card. Transaction ID: %s', 'atlas-woocommerce' ), $result['id'] )
            );

            WC()->cart->empty_cart();

            return array(
                'result'   => 'success',
                'redirect' => $this->get_return_url( $order ),
            );
        }

        wc_add_notice( $result['responseText'] ?? __( 'Payment declined.', 'atlas-woocommerce' ), 'error' );
        return array( 'result' => 'failure' );
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
            return new WP_Error( 'atlas_refund_error', __( 'Order not found.', 'atlas-woocommerce' ) );
        }

        $transaction_id = $order->get_transaction_id();

        if ( empty( $transaction_id ) ) {
            return new WP_Error( 'atlas_refund_error', __( 'Transaction ID not found.', 'atlas-woocommerce' ) );
        }

        $api = $this->get_api();
        $result = $api->refund( $transaction_id, $amount, $reason );

        if ( is_wp_error( $result ) ) {
            return $result;
        }

        if ( $result['authorised'] ) {
            $order->add_order_note(
                sprintf( __( 'Refunded %s via Atlas. Refund ID: %s', 'atlas-woocommerce' ), wc_price( $amount ), $result['id'] )
            );
            return true;
        }

        return new WP_Error( 'atlas_refund_error', $result['responseText'] ?? __( 'Refund failed.', 'atlas-woocommerce' ) );
    }

    /**
     * AJAX handler for creating session
     */
    public function ajax_create_session() {
        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['nonce'] ?? '' ) ), 'atlas_nonce' ) ) {
            wp_send_json_error( array( 'message' => __( 'Security check failed.', 'atlas-woocommerce' ) ) );
        }

        $order_id = isset( $_POST['order_id'] ) ? absint( $_POST['order_id'] ) : 0;

        // Get amount from cart or order
        if ( $order_id ) {
            $order = wc_get_order( $order_id );
            $amount = $order->get_total();
            $currency = $order->get_currency();
            $email = $order->get_billing_email();
        } else {
            $amount = WC()->cart->get_total( 'edit' );
            $currency = get_woocommerce_currency();
            $email = '';
        }

        $api = $this->get_api();

        $params = array(
            'amount'           => $amount,
            'currency'         => $currency,
            'merchantReference' => $order_id ? 'WC-' . $order_id : 'cart-' . time(),
            'customer_email'   => $email,
            'callbackUrls'     => array(
                'approved'  => Atlas_Webhook::get_callback_url( 'approved' ),
                'declined'  => Atlas_Webhook::get_callback_url( 'declined' ),
                'cancelled' => wc_get_checkout_url(),
            ),
        );

        // Check if should save card
        if ( isset( $_POST['save_card'] ) && 'true' === $_POST['save_card'] ) {
            $params['storeCard'] = true;
        }

        $session = $api->create_session( $params );

        if ( is_wp_error( $session ) ) {
            wp_send_json_error( array( 'message' => $session->get_error_message() ) );
        }

        wp_send_json_success( array(
            'sessionId' => $session['id'],
            'publicKey' => $this->get_public_key(),
        ) );
    }

    /**
     * Get API instance
     * @return Atlas_API
     */
    private function get_api() {
        return new Atlas_API(
            $this->get_public_key(),
            $this->get_secret_key(),
            $this->test_mode,
            $this->debug_mode
        );
    }
}
