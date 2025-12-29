<?php
/**
 * Windcave Blocks Payment Method
 *
 * Integrates Windcave with WooCommerce Blocks checkout.
 *
 * @package Windcave_WooCommerce
 */

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

defined( 'ABSPATH' ) || exit;

/**
 * Windcave Blocks Payment class
 */
final class Windcave_Blocks_Payment extends AbstractPaymentMethodType {

    /**
     * Payment method name
     *
     * @var string
     */
    protected $name = 'windcave';

    /**
     * Gateway instance
     *
     * @var Windcave_Gateway
     */
    private $gateway;

    /**
     * Initialize the payment method
     */
    public function initialize() {
        $this->settings = get_option( 'woocommerce_windcave_settings', array() );
        $gateways       = WC()->payment_gateways()->payment_gateways();
        $this->gateway  = isset( $gateways['windcave'] ) ? $gateways['windcave'] : null;
    }

    /**
     * Check if payment method is active
     *
     * @return bool
     */
    public function is_active() {
        return $this->gateway && $this->gateway->is_available();
    }

    /**
     * Get payment method script handles
     *
     * @return array
     */
    public function get_payment_method_script_handles() {
        // Guard against null gateway (can happen if gateway not fully loaded)
        if ( ! $this->gateway ) {
            return array();
        }

        $api = new Windcave_API(
            $this->gateway->get_api_username(),
            $this->gateway->get_api_key(),
            $this->gateway->is_test_mode(),
            $this->gateway->is_debug_mode()
        );

        $js_url = $api->get_js_url();
        $integration_mode = $this->gateway->get_integration_mode();

        // Register Windcave libraries - only load the scripts needed for the selected mode
        if ( 'dropin' === $integration_mode ) {
            wp_register_script(
                'windcave-dropin-lib',
                $js_url . '/lib/drop-in-v1.js',
                array(),
                null,
                true
            );
            wp_register_script(
                'windcave-dropin',
                $js_url . '/windcavepayments-dropin-v1.js',
                array( 'windcave-dropin-lib' ),
                null,
                true
            );
            $deps = array( 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities', 'wp-i18n', 'windcave-dropin' );
        } else {
            wp_register_script(
                'windcave-hosted-fields-lib',
                $js_url . '/lib/hosted-fields-v1.js',
                array(),
                null,
                true
            );
            wp_register_script(
                'windcave-hosted-fields',
                $js_url . '/windcavepayments-hostedfields-v1.js',
                array( 'windcave-hosted-fields-lib' ),
                null,
                true
            );
            $deps = array( 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities', 'wp-i18n', 'windcave-hosted-fields' );
        }

        // Register our blocks script
        wp_register_script(
            'windcave-blocks',
            WINDCAVE_PLUGIN_URL . 'assets/js/blocks/index.js',
            $deps,
            WINDCAVE_VERSION,
            true
        );

        // Localize script data
        wp_localize_script( 'windcave-blocks', 'windcaveBlocksData', array(
            'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
            'nonce'       => wp_create_nonce( 'windcave_nonce' ),
            'environment' => $api->get_js_environment(),
        ) );

        return array( 'windcave-blocks' );
    }

    /**
     * Get payment method script handles for admin
     *
     * @return array
     */
    public function get_payment_method_script_handles_for_admin() {
        return $this->get_payment_method_script_handles();
    }

    /**
     * Get payment method data
     *
     * @return array
     */
    public function get_payment_method_data() {
        $data = array(
            'title'              => $this->get_setting( 'title', __( 'Credit/Debit Card', 'windcave-woocommerce' ) ),
            'description'        => $this->get_setting( 'description', '' ),
            'supports'           => $this->get_supported_features(),
            'integrationMode'    => $this->get_setting( 'integration_mode', 'dropin' ),
            'supportedCards'     => $this->get_setting( 'supported_cards', array( 'visa', 'mastercard' ) ),
            // Don't show Apple Pay/Google Pay in drop-in if Express is enabled (to avoid duplication)
            'enableApplePay'     => 'yes' === $this->get_setting( 'enable_apple_pay', 'no' ) && 'yes' !== $this->get_setting( 'enable_apple_pay_express', 'no' ),
            'enableGooglePay'    => 'yes' === $this->get_setting( 'enable_google_pay', 'no' ) && 'yes' !== $this->get_setting( 'enable_google_pay_express', 'no' ),
            'applePayMerchantId' => $this->get_setting( 'apple_pay_merchant_id', '' ),
            'googlePayMerchantId'=> $this->get_setting( 'google_pay_merchant_id', '' ),
            'isTestMode'         => 'yes' === $this->get_setting( 'test_mode', 'yes' ),
            'storeName'          => get_bloginfo( 'name' ),
            'currency'           => get_woocommerce_currency(),
            'country'            => WC()->countries->get_base_country(),
            'icons'              => $this->get_card_icons(),
            'i18n'               => array(
                'cardError'        => __( 'Please check your card details.', 'windcave-woocommerce' ),
                'paymentError'     => __( 'Payment failed. Please try again.', 'windcave-woocommerce' ),
                'sessionError'     => __( 'Could not initialize payment. Please refresh and try again.', 'windcave-woocommerce' ),
                'cardNumberLabel'  => __( 'Card Number', 'windcave-woocommerce' ),
                'expiryLabel'      => __( 'Expiry Date', 'windcave-woocommerce' ),
                'cvvLabel'         => __( 'CVV', 'windcave-woocommerce' ),
                'cardholderLabel'  => __( 'Cardholder Name', 'windcave-woocommerce' ),
                'testModeNotice'   => __( 'TEST MODE ENABLED', 'windcave-woocommerce' ),
            ),
        );

        // Add saved tokens for logged in users
        if ( is_user_logged_in() ) {
            $data['savedTokens'] = $this->get_saved_tokens();
        }

        return $data;
    }

    /**
     * Get supported features
     *
     * @return array
     */
    public function get_supported_features() {
        return array(
            'products',
        );
    }

    /**
     * Get card icons
     *
     * @return array
     */
    private function get_card_icons() {
        $icons = array();
        $supported_cards = $this->get_setting( 'supported_cards', array( 'visa', 'mastercard' ) );

        foreach ( $supported_cards as $card ) {
            $icons[] = array(
                'id'  => $card,
                'src' => WINDCAVE_PLUGIN_URL . 'assets/images/' . $card . '.svg',
                'alt' => ucfirst( $card ),
            );
        }

        return $icons;
    }

    /**
     * Get saved tokens for current user (excludes expired cards)
     *
     * @return array
     */
    private function get_saved_tokens() {
        $tokens = array();

        // Use Windcave_Tokens::get_valid_customer_tokens() to exclude expired cards
        if ( class_exists( 'Windcave_Tokens' ) ) {
            $customer_tokens = Windcave_Tokens::get_valid_customer_tokens( get_current_user_id() );
        } else {
            $customer_tokens = WC_Payment_Tokens::get_customer_tokens( get_current_user_id(), 'windcave' );
        }

        foreach ( $customer_tokens as $token ) {
            $tokens[] = array(
                'id'          => $token->get_id(),
                'cardType'    => $token->get_card_type(),
                'last4'       => $token->get_last4(),
                'expiryMonth' => $token->get_expiry_month(),
                'expiryYear'  => $token->get_expiry_year(),
            );
        }

        return $tokens;
    }
}
