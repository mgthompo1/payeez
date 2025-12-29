<?php
/**
 * Payeez Webhook Handler
 *
 * @package Payeez_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Payeez Webhook class
 */
class Payeez_Webhook {

    /**
     * Constructor
     */
    public function __construct() {
        add_action( 'woocommerce_api_payeez_webhook', array( $this, 'handle_webhook' ) );
        add_action( 'woocommerce_api_payeez_callback', array( $this, 'handle_callback' ) );
    }

    /**
     * Get webhook URL
     * @return string
     */
    public static function get_webhook_url() {
        return WC()->api_request_url( 'payeez_webhook' );
    }

    /**
     * Get callback URL
     * @param string $type Callback type.
     * @return string
     */
    public static function get_callback_url( $type = 'approved' ) {
        return add_query_arg( 'type', $type, WC()->api_request_url( 'payeez_callback' ) );
    }

    /**
     * Handle webhook
     */
    public function handle_webhook() {
        $payload = file_get_contents( 'php://input' );
        $data = json_decode( $payload, true );

        if ( empty( $data ) ) {
            status_header( 400 );
            exit( 'Invalid payload' );
        }

        // TODO: Verify webhook signature

        $event_type = $data['event'] ?? $data['type'] ?? '';
        $session_id = $data['session_id'] ?? $data['data']['session_id'] ?? '';

        if ( empty( $session_id ) ) {
            status_header( 400 );
            exit( 'Missing session_id' );
        }

        // Find order by session ID
        $orders = wc_get_orders( array(
            'meta_key'   => '_payeez_session_id',
            'meta_value' => $session_id,
            'limit'      => 1,
        ) );

        if ( empty( $orders ) ) {
            status_header( 404 );
            exit( 'Order not found' );
        }

        $order = $orders[0];

        switch ( $event_type ) {
            case 'payment.succeeded':
            case 'payment.captured':
                $transaction_id = $data['data']['transaction_id'] ?? $data['transaction_id'] ?? '';
                if ( ! $order->is_paid() ) {
                    $order->payment_complete( $transaction_id );
                    $order->add_order_note( __( 'Payment confirmed via webhook.', 'payeez-woocommerce' ) );
                }
                break;

            case 'payment.failed':
                $order->update_status( 'failed', __( 'Payment failed.', 'payeez-woocommerce' ) );
                break;

            case 'refund.succeeded':
                $refund_amount = ( $data['data']['amount'] ?? 0 ) / 100;
                $order->add_order_note(
                    sprintf( __( 'Refund of %s confirmed via webhook.', 'payeez-woocommerce' ), wc_price( $refund_amount ) )
                );
                break;
        }

        status_header( 200 );
        exit( 'OK' );
    }

    /**
     * Handle callback redirect
     */
    public function handle_callback() {
        $type = isset( $_GET['type'] ) ? sanitize_text_field( $_GET['type'] ) : 'approved';
        $session_id = isset( $_GET['session_id'] ) ? sanitize_text_field( $_GET['session_id'] ) : '';

        if ( empty( $session_id ) ) {
            wp_safe_redirect( wc_get_checkout_url() );
            exit;
        }

        // Find order
        $orders = wc_get_orders( array(
            'meta_key'   => '_payeez_session_id',
            'meta_value' => $session_id,
            'limit'      => 1,
        ) );

        if ( empty( $orders ) ) {
            wp_safe_redirect( wc_get_checkout_url() );
            exit;
        }

        $order = $orders[0];

        switch ( $type ) {
            case 'approved':
                wp_safe_redirect( $order->get_checkout_order_received_url() );
                break;

            case 'declined':
            case 'cancelled':
            default:
                wc_add_notice( __( 'Payment was not completed. Please try again.', 'payeez-woocommerce' ), 'error' );
                wp_safe_redirect( wc_get_checkout_url() );
                break;
        }

        exit;
    }
}
