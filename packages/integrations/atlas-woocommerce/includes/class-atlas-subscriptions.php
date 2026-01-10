<?php
/**
 * Atlas WooCommerce Subscriptions Integration
 *
 * @package Atlas_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Atlas Subscriptions class
 */
class Atlas_Subscriptions {

    /**
     * Constructor
     */
    public function __construct() {
        add_action( 'woocommerce_scheduled_subscription_payment_atlas', array( $this, 'process_renewal' ), 10, 2 );
    }

    /**
     * Process subscription renewal
     *
     * @param float    $amount       Renewal amount.
     * @param WC_Order $renewal_order Renewal order.
     */
    public function process_renewal( $amount, $renewal_order ) {
        // Get parent subscription
        $subscriptions = wcs_get_subscriptions_for_renewal_order( $renewal_order );

        if ( empty( $subscriptions ) ) {
            $renewal_order->update_status( 'failed', __( 'Subscription not found.', 'atlas-woocommerce' ) );
            return;
        }

        $subscription = array_pop( $subscriptions );

        // Get token from subscription
        $token_id = $subscription->get_meta( '_atlas_token_id' );

        if ( empty( $token_id ) ) {
            $renewal_order->update_status( 'failed', __( 'No saved payment method found.', 'atlas-woocommerce' ) );
            return;
        }

        // Get token
        $token = Atlas_Tokens::get_token( $token_id, $subscription->get_customer_id() );

        if ( ! $token ) {
            $renewal_order->update_status( 'failed', __( 'Invalid payment token.', 'atlas-woocommerce' ) );
            return;
        }

        // Check expiry
        if ( Atlas_Tokens::is_token_expired( $token ) ) {
            $renewal_order->update_status( 'failed', __( 'Payment method has expired.', 'atlas-woocommerce' ) );
            return;
        }

        // Get gateway settings
        $gateway = new Atlas_Gateway();

        // Create API instance
        $api = new Atlas_API(
            $gateway->get_public_key(),
            $gateway->get_secret_key(),
            'yes' === $gateway->get_option( 'test_mode' ),
            'yes' === $gateway->get_option( 'debug_mode' )
        );

        // Charge token
        $result = $api->charge_token(
            $token->get_token(),
            $amount,
            $renewal_order->get_currency(),
            'WC-' . $renewal_order->get_id() . '-renewal',
            'recurring'
        );

        if ( is_wp_error( $result ) ) {
            $renewal_order->update_status( 'failed', $result->get_error_message() );
            return;
        }

        if ( $result['authorised'] ) {
            $renewal_order->payment_complete( $result['id'] );
            $renewal_order->add_order_note(
                sprintf( __( 'Subscription renewal payment successful. Transaction ID: %s', 'atlas-woocommerce' ), $result['id'] )
            );
        } else {
            $renewal_order->update_status( 'failed', $result['responseText'] ?? __( 'Payment declined.', 'atlas-woocommerce' ) );
        }
    }
}
