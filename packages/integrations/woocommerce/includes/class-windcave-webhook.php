<?php
/**
 * Windcave Webhook Handler
 *
 * Handles FPRN (Fail Proof Result Notification) and callbacks from Windcave.
 *
 * FPRN provides an additional level of assurance that the merchant web server
 * receives notification of the payment outcome, even if the cardholder's browser
 * closes prematurely or the server is temporarily unavailable.
 *
 * @package Windcave_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Windcave Webhook class
 */
class Windcave_Webhook {

    /**
     * Constructor
     */
    public function __construct() {
        // FPRN notification endpoint (server-to-server)
        add_action( 'woocommerce_api_windcave_fprn', array( $this, 'handle_fprn' ) );

        // Legacy webhook endpoint (alias for FPRN)
        add_action( 'woocommerce_api_windcave_webhook', array( $this, 'handle_fprn' ) );

        // Callback redirect endpoint (browser redirect)
        add_action( 'woocommerce_api_windcave_callback', array( $this, 'handle_callback' ) );

        // Subscription FPRN endpoint
        add_action( 'woocommerce_api_windcave_subscription_fprn', array( $this, 'handle_subscription_fprn' ) );
    }

    /**
     * Handle FPRN (Fail Proof Result Notification)
     *
     * FPRN notifications can be sent as HTTP GET (default) or HTTP POST.
     * The notification includes sessionId or transactionId as a query parameter (GET)
     * or in the POST body.
     *
     * Important FPRN Guidelines:
     * - Do NOT filter by originating IP address
     * - Do NOT depend on receiving only a single request
     * - Do NOT ignore FPRN requests
     * - Respond with HTTP 200 (empty response is ideal)
     * - Watch for race conditions with redirects
     */
    public function handle_fprn() {
        $this->log( 'FPRN notification received' );
        $this->log( 'Request method: ' . $_SERVER['REQUEST_METHOD'] );

        $session_id     = '';
        $transaction_id = '';
        $is_post_fprn   = false;
        $post_data      = null;

        // Handle HTTP POST FPRN (contains full transaction data)
        if ( 'POST' === $_SERVER['REQUEST_METHOD'] ) {
            $raw_body = file_get_contents( 'php://input' );
            $this->log( 'FPRN POST body: ' . $raw_body );

            if ( ! empty( $raw_body ) ) {
                $post_data = json_decode( $raw_body, true );

                if ( json_last_error() === JSON_ERROR_NONE ) {
                    $is_post_fprn   = true;
                    $session_id     = $post_data['sessionId'] ?? '';
                    $transaction_id = $post_data['id'] ?? $post_data['transactionId'] ?? '';
                }
            }
        }

        // Handle HTTP GET FPRN (default - query string parameters)
        if ( empty( $session_id ) && empty( $transaction_id ) ) {
            $session_id     = isset( $_GET['sessionId'] ) ? sanitize_text_field( wp_unslash( $_GET['sessionId'] ) ) : '';
            $transaction_id = isset( $_GET['transactionId'] ) ? sanitize_text_field( wp_unslash( $_GET['transactionId'] ) ) : '';
        }

        $this->log( "FPRN - Session ID: {$session_id}, Transaction ID: {$transaction_id}" );

        // Must have either session ID or transaction ID
        if ( empty( $session_id ) && empty( $transaction_id ) ) {
            $this->log( 'FPRN: No session or transaction ID found' );
            // Respond with 200 to prevent reattempts for invalid requests
            $this->send_fprn_response( 200 );
        }

        // Find the order
        $order = null;
        if ( ! empty( $session_id ) ) {
            $order = $this->get_order_by_session_id( $session_id );
        }
        if ( ! $order && ! empty( $transaction_id ) ) {
            $order = $this->get_order_by_transaction_id( $transaction_id );
        }

        if ( ! $order ) {
            $this->log( 'FPRN: Order not found' );
            // Respond with 200 to acknowledge receipt (prevents reattempts)
            $this->send_fprn_response( 200 );
        }

        $this->log( 'FPRN: Processing for order #' . $order->get_id() );

        // Check for race condition - if order already processed, just acknowledge
        if ( $order->is_paid() ) {
            $this->log( 'FPRN: Order already paid, acknowledging receipt' );
            $this->send_fprn_response( 200 );
        }

        // Acquire lock to prevent race conditions
        $lock_key = 'windcave_processing_' . $order->get_id();
        if ( get_transient( $lock_key ) ) {
            $this->log( 'FPRN: Order is being processed by another request' );
            $this->send_fprn_response( 200 );
        }
        set_transient( $lock_key, true, 30 ); // Lock for 30 seconds

        try {
            // Get gateway
            $gateway = $this->get_gateway();
            if ( ! $gateway ) {
                $this->log( 'FPRN: Gateway not available' );
                delete_transient( $lock_key );
                $this->send_fprn_response( 200 );
            }

            // For POST FPRN, we already have the transaction data
            if ( $is_post_fprn && ! empty( $post_data ) ) {
                $this->process_fprn_post_data( $order, $post_data, $gateway );
            } else {
                // For GET FPRN, query the session/transaction
                $api = new Windcave_API(
                    $gateway->get_api_username(),
                    $gateway->get_api_key(),
                    $gateway->is_test_mode(),
                    $gateway->is_debug_mode()
                );

                if ( ! empty( $session_id ) ) {
                    $result = $api->get_session( $session_id );
                    if ( ! is_wp_error( $result ) ) {
                        $this->process_session_result( $order, $result, $gateway );
                    } else {
                        $this->log( 'FPRN: Error querying session - ' . $result->get_error_message() );
                    }
                } elseif ( ! empty( $transaction_id ) ) {
                    $result = $api->get_transaction( $transaction_id );
                    if ( ! is_wp_error( $result ) ) {
                        $this->process_transaction_result( $order, $result, $gateway );
                    } else {
                        $this->log( 'FPRN: Error querying transaction - ' . $result->get_error_message() );
                    }
                }
            }
        } finally {
            delete_transient( $lock_key );
        }

        // Always respond with 200 to acknowledge receipt
        $this->send_fprn_response( 200 );
    }

    /**
     * Send FPRN response
     *
     * Per Windcave guidelines, response should be empty with HTTP 200.
     * HTTP 200, 302, or 303 indicate successful receipt.
     *
     * @param int $status_code HTTP status code.
     */
    private function send_fprn_response( $status_code = 200 ) {
        status_header( $status_code );
        header( 'Content-Type: text/plain' );
        exit( '' ); // Empty response as recommended
    }

    /**
     * Process FPRN POST data (full transaction data in body)
     *
     * @param WC_Order         $order    Order object.
     * @param array            $data     POST data from FPRN.
     * @param Windcave_Gateway $gateway  Gateway instance.
     */
    private function process_fprn_post_data( $order, $data, $gateway ) {
        $this->log( 'Processing FPRN POST data' );

        // Check if this is a transaction response
        if ( isset( $data['authorised'] ) ) {
            $this->process_transaction_result( $order, $data, $gateway );
            return;
        }

        // Check if this is a session response
        if ( isset( $data['state'] ) ) {
            $this->process_session_result( $order, $data, $gateway );
            return;
        }

        $this->log( 'FPRN POST: Unknown data format' );
    }

    /**
     * Handle callback redirect (browser-based return from HPP or redirect methods)
     */
    public function handle_callback() {
        $this->log( 'Callback redirect received' );

        $session_id = isset( $_GET['sessionId'] ) ? sanitize_text_field( wp_unslash( $_GET['sessionId'] ) ) : '';
        $result     = isset( $_GET['result'] ) ? sanitize_text_field( wp_unslash( $_GET['result'] ) ) : '';

        if ( empty( $session_id ) ) {
            $this->log( 'Callback: No session ID' );
            wc_add_notice( __( 'Payment session not found.', 'windcave-woocommerce' ), 'error' );
            wp_safe_redirect( wc_get_checkout_url() );
            exit;
        }

        $order = $this->get_order_by_session_id( $session_id );

        if ( ! $order ) {
            $this->log( 'Callback: Order not found for session ' . $session_id );
            wc_add_notice( __( 'Order not found. Please try again.', 'windcave-woocommerce' ), 'error' );
            wp_safe_redirect( wc_get_checkout_url() );
            exit;
        }

        // Check for race condition - FPRN may have already processed this
        if ( $order->is_paid() ) {
            $this->log( 'Callback: Order already paid (likely by FPRN)' );
            wp_safe_redirect( $order->get_checkout_order_received_url() );
            exit;
        }

        // Acquire lock
        $lock_key = 'windcave_processing_' . $order->get_id();
        $attempts = 0;
        while ( get_transient( $lock_key ) && $attempts < 10 ) {
            usleep( 500000 ); // Wait 0.5 seconds
            $attempts++;

            // Check again if paid while waiting
            $order = wc_get_order( $order->get_id() );
            if ( $order->is_paid() ) {
                $this->log( 'Callback: Order paid while waiting for lock' );
                wp_safe_redirect( $order->get_checkout_order_received_url() );
                exit;
            }
        }

        set_transient( $lock_key, true, 30 );

        try {
            $gateway = $this->get_gateway();
            if ( ! $gateway ) {
                delete_transient( $lock_key );
                wc_add_notice( __( 'Payment gateway not available.', 'windcave-woocommerce' ), 'error' );
                wp_safe_redirect( wc_get_checkout_url() );
                exit;
            }

            $api = new Windcave_API(
                $gateway->get_api_username(),
                $gateway->get_api_key(),
                $gateway->is_test_mode(),
                $gateway->is_debug_mode()
            );

            $session = $api->get_session( $session_id );

            if ( is_wp_error( $session ) ) {
                $this->log( 'Callback: Error fetching session - ' . $session->get_error_message() );
                delete_transient( $lock_key );
                wc_add_notice( __( 'Payment verification failed. Please try again.', 'windcave-woocommerce' ), 'error' );
                wp_safe_redirect( wc_get_checkout_url() );
                exit;
            }

            $processed = $this->process_session_result( $order, $session, $gateway );
            delete_transient( $lock_key );

            if ( $processed ) {
                wp_safe_redirect( $order->get_checkout_order_received_url() );
            } else {
                wp_safe_redirect( wc_get_checkout_url() );
            }
        } catch ( Exception $e ) {
            delete_transient( $lock_key );
            $this->log( 'Callback exception: ' . $e->getMessage() );
            wc_add_notice( __( 'An error occurred. Please try again.', 'windcave-woocommerce' ), 'error' );
            wp_safe_redirect( wc_get_checkout_url() );
        }
        exit;
    }

    /**
     * Handle subscription FPRN notifications
     */
    public function handle_subscription_fprn() {
        $this->log( 'Subscription FPRN received' );

        $invoice_id      = isset( $_GET['invoiceId'] ) ? sanitize_text_field( wp_unslash( $_GET['invoiceId'] ) ) : '';
        $subscription_id = isset( $_GET['subscriptionId'] ) ? sanitize_text_field( wp_unslash( $_GET['subscriptionId'] ) ) : '';
        $transaction_id  = isset( $_GET['transactionId'] ) ? sanitize_text_field( wp_unslash( $_GET['transactionId'] ) ) : '';

        // Handle POST data
        if ( 'POST' === $_SERVER['REQUEST_METHOD'] ) {
            $raw_body = file_get_contents( 'php://input' );
            if ( ! empty( $raw_body ) ) {
                $post_data = json_decode( $raw_body, true );
                if ( json_last_error() === JSON_ERROR_NONE ) {
                    $invoice_id      = $post_data['invoiceId'] ?? $invoice_id;
                    $subscription_id = $post_data['subscriptionId'] ?? $subscription_id;
                    $transaction_id  = $post_data['id'] ?? $post_data['transactionId'] ?? $transaction_id;
                }
            }
        }

        $this->log( "Subscription FPRN - Invoice: {$invoice_id}, Subscription: {$subscription_id}, Transaction: {$transaction_id}" );

        // Process subscription payment notification
        if ( ! empty( $subscription_id ) && class_exists( 'Windcave_Subscriptions' ) ) {
            Windcave_Subscriptions::handle_fprn_notification( $subscription_id, $invoice_id, $transaction_id );
        }

        $this->send_fprn_response( 200 );
    }

    /**
     * Process session result and update order
     *
     * @param WC_Order         $order   Order object.
     * @param array            $session Session data from API.
     * @param Windcave_Gateway $gateway Gateway instance.
     * @return bool
     */
    private function process_session_result( $order, $session, $gateway ) {
        $state = isset( $session['state'] ) ? $session['state'] : '';

        $this->log( 'Session state: ' . $state );

        // Double-check if already processed
        if ( $order->is_paid() ) {
            $this->log( 'Order already paid' );
            return true;
        }

        switch ( $state ) {
            case 'complete':
                $transactions = isset( $session['transactions'] ) ? $session['transactions'] : array();
                $transaction  = ! empty( $transactions ) ? end( $transactions ) : null;

                if ( $transaction ) {
                    return $this->process_transaction_result( $order, $transaction, $gateway );
                }

                $this->log( 'Session complete but no transactions found' );
                return false;

            case 'failed':
            case 'expired':
                $error_message = __( 'Payment failed or session expired.', 'windcave-woocommerce' );
                if ( ! $order->has_status( 'failed' ) ) {
                    $order->update_status( 'failed', $error_message );
                }
                wc_add_notice( $error_message, 'error' );
                $this->log( 'Session failed or expired' );
                return false;

            case 'pending':
                $this->log( 'Session still pending' );
                return false;

            default:
                $this->log( 'Unknown session state: ' . $state );
                return false;
        }
    }

    /**
     * Process transaction result and update order
     *
     * @param WC_Order         $order       Order object.
     * @param array            $transaction Transaction data.
     * @param Windcave_Gateway $gateway     Gateway instance.
     * @return bool
     */
    private function process_transaction_result( $order, $transaction, $gateway ) {
        // Double-check if already processed
        if ( $order->is_paid() ) {
            $this->log( 'Order already paid' );
            return true;
        }

        $authorised     = isset( $transaction['authorised'] ) && $transaction['authorised'];
        $transaction_id = isset( $transaction['id'] ) ? $transaction['id'] : '';
        $response_text  = isset( $transaction['responseText'] ) ? $transaction['responseText'] : '';
        $reco           = isset( $transaction['reCo'] ) ? $transaction['reCo'] : '';

        $this->log( "Transaction result - Authorised: " . ( $authorised ? 'yes' : 'no' ) . ", ReCo: {$reco}" );

        if ( $authorised ) {
            $order->payment_complete( $transaction_id );
            $order->add_order_note(
                sprintf(
                    /* translators: %s: Transaction ID */
                    __( 'Windcave payment complete. Transaction ID: %s', 'windcave-woocommerce' ),
                    $transaction_id
                )
            );

            // Store transaction details
            $order->update_meta_data( '_windcave_transaction_id', $transaction_id );
            if ( ! empty( $reco ) ) {
                $order->update_meta_data( '_windcave_response_code', $reco );
            }
            $order->save();

            // Save card if requested
            if ( $gateway->supports( 'tokenization' ) && isset( $transaction['card'] ) ) {
                $this->maybe_save_card( $order, $transaction, $gateway );
            }

            $this->log( 'Payment complete for order #' . $order->get_id() );
            return true;
        } else {
            $error_message = ! empty( $response_text ) ? $response_text : __( 'Payment declined.', 'windcave-woocommerce' );

            if ( ! $order->has_status( 'failed' ) ) {
                $order->update_status( 'failed', $error_message );
            }

            $order->add_order_note(
                sprintf(
                    /* translators: 1: Response code 2: Response text */
                    __( 'Windcave payment declined. Response: %1$s - %2$s', 'windcave-woocommerce' ),
                    $reco,
                    $response_text
                )
            );

            wc_add_notice( $error_message, 'error' );
            $this->log( 'Payment declined: ' . $error_message );
            return false;
        }
    }

    /**
     * Maybe save card token for future use
     *
     * @param WC_Order         $order       Order object.
     * @param array            $transaction Transaction data.
     * @param Windcave_Gateway $gateway     Gateway instance.
     */
    private function maybe_save_card( $order, $transaction, $gateway ) {
        // Check if customer requested to save card
        $save_card = $order->get_meta( '_windcave_save_card' );
        if ( 'yes' !== $save_card ) {
            return;
        }

        $customer_id = $order->get_customer_id();
        if ( ! $customer_id ) {
            return;
        }

        $card = isset( $transaction['card'] ) ? $transaction['card'] : array();
        if ( empty( $card['id'] ) ) {
            return;
        }

        // Use token management class
        $saved = Windcave_Tokens::save_card( $customer_id, $card );

        if ( $saved ) {
            $this->log( 'Saved card token for customer: ' . $customer_id );
            $order->add_order_note( __( 'Card saved for future payments.', 'windcave-woocommerce' ) );
        }
    }

    /**
     * Get order by Windcave session ID
     *
     * @param string $session_id Session ID.
     * @return WC_Order|null
     */
    private function get_order_by_session_id( $session_id ) {
        $orders = wc_get_orders( array(
            'meta_key'   => '_windcave_session_id',
            'meta_value' => $session_id,
            'limit'      => 1,
        ) );

        return ! empty( $orders ) ? $orders[0] : null;
    }

    /**
     * Get order by Windcave transaction ID
     *
     * @param string $transaction_id Transaction ID.
     * @return WC_Order|null
     */
    private function get_order_by_transaction_id( $transaction_id ) {
        $orders = wc_get_orders( array(
            'meta_key'   => '_windcave_transaction_id',
            'meta_value' => $transaction_id,
            'limit'      => 1,
        ) );

        if ( ! empty( $orders ) ) {
            return $orders[0];
        }

        // Also check by WooCommerce transaction ID
        $orders = wc_get_orders( array(
            'transaction_id' => $transaction_id,
            'limit'          => 1,
        ) );

        return ! empty( $orders ) ? $orders[0] : null;
    }

    /**
     * Get the Windcave gateway instance
     *
     * @return Windcave_Gateway|null
     */
    private function get_gateway() {
        $gateways = WC()->payment_gateways()->payment_gateways();
        return isset( $gateways['windcave'] ) ? $gateways['windcave'] : null;
    }

    /**
     * Log a message
     *
     * @param string $message Message to log.
     */
    private function log( $message ) {
        if ( function_exists( 'wc_get_logger' ) ) {
            $logger = wc_get_logger();
            $logger->info( $message, array( 'source' => 'windcave-fprn' ) );
        }
    }

    /**
     * Get FPRN notification URL
     *
     * @return string
     */
    public static function get_fprn_url() {
        return WC()->api_request_url( 'windcave_fprn' );
    }

    /**
     * Get webhook URL (alias for FPRN)
     *
     * @return string
     */
    public static function get_webhook_url() {
        return self::get_fprn_url();
    }

    /**
     * Get callback URL for browser redirects
     *
     * @param string $result Result type (approved, declined, cancelled).
     * @return string
     */
    public static function get_callback_url( $result = 'approved' ) {
        return add_query_arg( 'result', $result, WC()->api_request_url( 'windcave_callback' ) );
    }

    /**
     * Get subscription FPRN URL
     *
     * @return string
     */
    public static function get_subscription_fprn_url() {
        return WC()->api_request_url( 'windcave_subscription_fprn' );
    }
}
