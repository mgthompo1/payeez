<?php
/**
 * Windcave Subscriptions Handler
 *
 * Integrates with WooCommerce Subscriptions plugin and handles
 * Windcave's native subscription invoicing system.
 *
 * @package Windcave_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Windcave Subscriptions class
 */
class Windcave_Subscriptions {

    /**
     * Gateway instance
     *
     * @var Windcave_Gateway
     */
    private $gateway;

    /**
     * Constructor
     *
     * @param Windcave_Gateway $gateway Gateway instance.
     */
    public function __construct( $gateway ) {
        $this->gateway = $gateway;

        // Check if WooCommerce Subscriptions is active
        if ( class_exists( 'WC_Subscriptions' ) ) {
            $this->init_wc_subscriptions_hooks();
        }
    }

    /**
     * Initialize WooCommerce Subscriptions hooks
     */
    private function init_wc_subscriptions_hooks() {
        // Add subscription support to gateway
        add_filter( 'woocommerce_payment_gateway_supports', array( $this, 'add_subscription_support' ), 10, 3 );

        // Handle subscription payments
        add_action( 'woocommerce_scheduled_subscription_payment_windcave', array( $this, 'process_subscription_payment' ), 10, 2 );

        // Handle subscription changes
        add_action( 'woocommerce_subscription_cancelled_windcave', array( $this, 'cancel_subscription' ) );
        add_action( 'woocommerce_subscription_status_cancelled', array( $this, 'on_subscription_cancelled' ) );

        // Handle payment method changes
        add_action( 'woocommerce_subscription_payment_method_updated_to_windcave', array( $this, 'update_subscription_payment_method' ), 10, 2 );

        // Display subscription info in admin
        add_action( 'woocommerce_admin_order_data_after_billing_address', array( $this, 'display_subscription_info' ) );
    }

    /**
     * Add subscription support features
     *
     * @param bool              $supports Whether gateway supports feature.
     * @param string            $feature  Feature name.
     * @param WC_Payment_Gateway $gateway  Gateway instance.
     * @return bool
     */
    public function add_subscription_support( $supports, $feature, $gateway ) {
        if ( 'windcave' !== $gateway->id ) {
            return $supports;
        }

        $subscription_features = array(
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
        );

        if ( in_array( $feature, $subscription_features, true ) ) {
            return true;
        }

        return $supports;
    }

    /**
     * Process a scheduled subscription payment
     *
     * @param float    $amount         Amount to charge.
     * @param WC_Order $renewal_order  Renewal order.
     */
    public function process_subscription_payment( $amount, $renewal_order ) {
        $this->log( 'Processing subscription payment for order #' . $renewal_order->get_id() );

        // Get the subscription
        $subscriptions = wcs_get_subscriptions_for_renewal_order( $renewal_order );
        $subscription  = reset( $subscriptions );

        if ( ! $subscription ) {
            $this->log( 'No subscription found for renewal order' );
            $renewal_order->update_status( 'failed', __( 'Subscription not found.', 'windcave-woocommerce' ) );
            return;
        }

        // Get the stored card token
        $token_id = $this->get_subscription_token_id( $subscription );

        if ( ! $token_id ) {
            $this->log( 'No payment token found for subscription' );
            $renewal_order->update_status( 'failed', __( 'No saved payment method found for subscription.', 'windcave-woocommerce' ) );
            return;
        }

        $token = WC_Payment_Tokens::get( $token_id );

        if ( ! $token || 'windcave' !== $token->get_gateway_id() ) {
            $this->log( 'Invalid token for subscription' );
            $renewal_order->update_status( 'failed', __( 'Invalid payment method for subscription.', 'windcave-woocommerce' ) );
            return;
        }

        // Charge the token
        $api = $this->get_api();

        // Determine the stored card indicator based on subscription type
        $stored_card_indicator = Windcave_API::SCI_RECURRING_FIXED;

        // Get recurring parameters
        $billing_period   = $subscription->get_billing_period();
        $billing_interval = $subscription->get_billing_interval();
        $frequency        = Windcave_API::map_wc_period_to_frequency( $billing_period, $billing_interval );

        $extra_params = array(
            'recurringExpiry'    => '9999-12-31',
            'recurringFrequency' => $frequency,
            'notificationUrl'    => Windcave_Webhook::get_subscription_fprn_url(),
        );

        $result = $api->charge_token(
            $token->get_token(),
            $amount,
            $renewal_order->get_currency(),
            'WC-SUB-' . $renewal_order->get_id(),
            $stored_card_indicator,
            $extra_params
        );

        if ( is_wp_error( $result ) ) {
            $this->log( 'Subscription payment failed: ' . $result->get_error_message() );
            $renewal_order->update_status( 'failed', $result->get_error_message() );
            return;
        }

        if ( isset( $result['authorised'] ) && $result['authorised'] ) {
            $transaction_id = isset( $result['id'] ) ? $result['id'] : '';

            $renewal_order->payment_complete( $transaction_id );
            $renewal_order->add_order_note(
                sprintf(
                    /* translators: 1: Card type 2: Last 4 digits 3: Transaction ID */
                    __( 'Windcave subscription payment complete using saved %1$s ending in %2$s. Transaction ID: %3$s', 'windcave-woocommerce' ),
                    ucfirst( $token->get_card_type() ),
                    $token->get_last4(),
                    $transaction_id
                )
            );

            $this->log( 'Subscription payment successful for order #' . $renewal_order->get_id() );
        } else {
            $error_message = isset( $result['responseText'] ) ? $result['responseText'] : __( 'Payment declined.', 'windcave-woocommerce' );
            $renewal_order->update_status( 'failed', $error_message );
            $this->log( 'Subscription payment declined: ' . $error_message );
        }
    }

    /**
     * Handle subscription cancellation
     *
     * @param WC_Subscription $subscription Subscription object.
     */
    public function cancel_subscription( $subscription ) {
        $this->log( 'Subscription cancelled: ' . $subscription->get_id() );

        // If using Windcave native subscriptions, cancel on their end
        $windcave_subscription_id = $subscription->get_meta( '_windcave_subscription_id' );

        if ( ! empty( $windcave_subscription_id ) ) {
            $api    = $this->get_api();
            $result = $api->cancel_subscription( $windcave_subscription_id );

            if ( is_wp_error( $result ) ) {
                $this->log( 'Failed to cancel Windcave subscription: ' . $result->get_error_message() );
            } else {
                $this->log( 'Windcave subscription cancelled: ' . $windcave_subscription_id );
            }
        }
    }

    /**
     * Handle subscription status change to cancelled
     *
     * @param WC_Subscription $subscription Subscription object.
     */
    public function on_subscription_cancelled( $subscription ) {
        if ( 'windcave' !== $subscription->get_payment_method() ) {
            return;
        }

        $this->cancel_subscription( $subscription );
    }

    /**
     * Update subscription payment method
     *
     * @param WC_Subscription $subscription Subscription object.
     * @param string          $old_payment_method Previous payment method.
     */
    public function update_subscription_payment_method( $subscription, $old_payment_method ) {
        $this->log( 'Updating payment method for subscription: ' . $subscription->get_id() );

        // Get the new token
        $token_id = $this->get_subscription_token_id( $subscription );

        if ( ! $token_id ) {
            return;
        }

        // If using Windcave native subscriptions, update on their end
        $windcave_subscription_id = $subscription->get_meta( '_windcave_subscription_id' );

        if ( ! empty( $windcave_subscription_id ) ) {
            $token = WC_Payment_Tokens::get( $token_id );

            if ( $token && 'windcave' === $token->get_gateway_id() ) {
                $api    = $this->get_api();
                $result = $api->update_subscription( $windcave_subscription_id, array(
                    'cardId' => $token->get_token(),
                ) );

                if ( is_wp_error( $result ) ) {
                    $this->log( 'Failed to update Windcave subscription payment method: ' . $result->get_error_message() );
                } else {
                    $this->log( 'Windcave subscription payment method updated' );
                }
            }
        }
    }

    /**
     * Create a Windcave native subscription
     *
     * @param WC_Subscription $subscription WC Subscription object.
     * @param string          $card_id      Stored card ID.
     * @return array|WP_Error
     */
    public function create_windcave_subscription( $subscription, $card_id ) {
        $api = $this->get_api();

        // Map WC Subscriptions billing period to Windcave frequency
        $billing_period   = $subscription->get_billing_period();
        $billing_interval = $subscription->get_billing_interval();
        $frequency        = Windcave_API::map_wc_period_to_frequency( $billing_period, $billing_interval );

        // Calculate recurring count (or use a large number for indefinite)
        $end_date = $subscription->get_date( 'end' );
        if ( $end_date ) {
            $start_date = $subscription->get_date( 'start' );
            $count      = $this->calculate_billing_cycles( $start_date, $end_date, $billing_period, $billing_interval );
        } else {
            $count = 9999; // Indefinite
        }

        $params = array(
            'currency'               => $subscription->get_currency(),
            'merchantReference'      => 'WC-SUB-' . $subscription->get_id(),
            'recurringAmount'        => $subscription->get_total(),
            'recurringStartDateTime' => gmdate( 'Y-m-d\TH:i:s\Z' ),
            'recurringTimeZone'      => wp_timezone_string(),
            'recurringCount'         => $count,
            'recurringFrequency'     => $frequency,
            'cardId'                 => $card_id,
            'notificationUrl'        => Windcave_Webhook::get_subscription_fprn_url(),
        );

        // Add customer ID if available
        $customer_id = $subscription->get_customer_id();
        if ( $customer_id ) {
            $windcave_customer_id = get_user_meta( $customer_id, '_windcave_customer_id', true );
            if ( ! empty( $windcave_customer_id ) ) {
                $params['customerId'] = $windcave_customer_id;
            }
        }

        $result = $api->create_subscription( $params );

        if ( ! is_wp_error( $result ) && isset( $result['id'] ) ) {
            $subscription->update_meta_data( '_windcave_subscription_id', $result['id'] );
            $subscription->save();

            $this->log( 'Created Windcave subscription: ' . $result['id'] );
        }

        return $result;
    }

    /**
     * Handle FPRN notification for subscription payments
     *
     * @param string $subscription_id Windcave subscription ID.
     * @param string $invoice_id      Invoice ID.
     * @param string $transaction_id  Transaction ID.
     */
    public static function handle_fprn_notification( $subscription_id, $invoice_id, $transaction_id ) {
        if ( function_exists( 'wc_get_logger' ) ) {
            $logger = wc_get_logger();
            $logger->info( "Subscription FPRN: Sub={$subscription_id}, Invoice={$invoice_id}, Txn={$transaction_id}", array( 'source' => 'windcave-subscriptions' ) );
        }

        // Find WC Subscription by Windcave subscription ID
        $subscriptions = wcs_get_subscriptions( array(
            'meta_key'   => '_windcave_subscription_id',
            'meta_value' => $subscription_id,
            'limit'      => 1,
        ) );

        if ( empty( $subscriptions ) ) {
            return;
        }

        $subscription = reset( $subscriptions );

        // Get gateway
        $gateways = WC()->payment_gateways()->payment_gateways();
        $gateway  = isset( $gateways['windcave'] ) ? $gateways['windcave'] : null;

        if ( ! $gateway ) {
            return;
        }

        // Query invoice to get payment status
        $api = new Windcave_API(
            $gateway->get_api_username(),
            $gateway->get_api_key(),
            $gateway->is_test_mode(),
            $gateway->is_debug_mode()
        );

        $invoice = $api->get_invoice( $invoice_id );

        if ( is_wp_error( $invoice ) ) {
            return;
        }

        $status = isset( $invoice['status'] ) ? $invoice['status'] : '';

        // Handle based on invoice status
        switch ( $status ) {
            case 'paid':
                // Payment successful - create renewal order if needed
                self::handle_successful_invoice_payment( $subscription, $invoice );
                break;

            case 'unpaid':
                // Payment failed - notify admin
                self::handle_failed_invoice_payment( $subscription, $invoice );
                break;
        }
    }

    /**
     * Handle successful invoice payment
     *
     * @param WC_Subscription $subscription Subscription object.
     * @param array           $invoice      Invoice data.
     */
    private static function handle_successful_invoice_payment( $subscription, $invoice ) {
        // Check if we already processed this invoice
        $invoice_id = $invoice['id'];
        $processed  = $subscription->get_meta( '_windcave_processed_invoices' );

        if ( ! is_array( $processed ) ) {
            $processed = array();
        }

        if ( in_array( $invoice_id, $processed, true ) ) {
            return; // Already processed
        }

        // Get transaction from invoice
        $transactions = isset( $invoice['transactions'] ) ? $invoice['transactions'] : array();
        $transaction  = ! empty( $transactions ) ? end( $transactions ) : null;

        if ( ! $transaction ) {
            return;
        }

        $transaction_id = isset( $transaction['id'] ) ? $transaction['id'] : '';
        $amount         = isset( $invoice['amount'] ) ? floatval( $invoice['amount'] ) : 0;

        // Record payment
        $subscription->add_order_note(
            sprintf(
                /* translators: 1: Amount 2: Transaction ID */
                __( 'Windcave subscription payment received. Amount: %1$s, Transaction ID: %2$s', 'windcave-woocommerce' ),
                wc_price( $amount ),
                $transaction_id
            )
        );

        // Mark invoice as processed
        $processed[] = $invoice_id;
        $subscription->update_meta_data( '_windcave_processed_invoices', $processed );
        $subscription->save();
    }

    /**
     * Handle failed invoice payment
     *
     * @param WC_Subscription $subscription Subscription object.
     * @param array           $invoice      Invoice data.
     */
    private static function handle_failed_invoice_payment( $subscription, $invoice ) {
        $subscription->add_order_note(
            sprintf(
                /* translators: %s: Invoice ID */
                __( 'Windcave subscription payment failed for invoice %s. Retry will be attempted.', 'windcave-woocommerce' ),
                $invoice['id']
            )
        );
    }

    /**
     * Display subscription info in admin order page
     *
     * @param WC_Order $order Order object.
     */
    public function display_subscription_info( $order ) {
        $windcave_subscription_id = $order->get_meta( '_windcave_subscription_id' );

        if ( empty( $windcave_subscription_id ) ) {
            return;
        }

        echo '<p><strong>' . esc_html__( 'Windcave Subscription ID:', 'windcave-woocommerce' ) . '</strong> ' . esc_html( $windcave_subscription_id ) . '</p>';
    }

    /**
     * Get the token ID for a subscription
     *
     * @param WC_Subscription $subscription Subscription object.
     * @return int|null
     */
    private function get_subscription_token_id( $subscription ) {
        // First check subscription meta
        $token_id = $subscription->get_meta( '_windcave_token_id' );

        if ( $token_id ) {
            return absint( $token_id );
        }

        // Fallback to parent order
        $parent_order = $subscription->get_parent();

        if ( $parent_order ) {
            $token_id = $parent_order->get_meta( '_windcave_token_id' );

            if ( $token_id ) {
                return absint( $token_id );
            }
        }

        // Fallback to customer default token
        $customer_id = $subscription->get_customer_id();

        if ( $customer_id ) {
            $tokens = WC_Payment_Tokens::get_customer_tokens( $customer_id, 'windcave' );

            foreach ( $tokens as $token ) {
                if ( $token->is_default() ) {
                    return $token->get_id();
                }
            }

            // If no default, return first token
            if ( ! empty( $tokens ) ) {
                $first_token = reset( $tokens );
                return $first_token->get_id();
            }
        }

        return null;
    }

    /**
     * Calculate number of billing cycles between two dates
     *
     * @param string $start_date     Start date.
     * @param string $end_date       End date.
     * @param string $period         Billing period.
     * @param int    $interval       Billing interval.
     * @return int
     */
    private function calculate_billing_cycles( $start_date, $end_date, $period, $interval ) {
        $start = new DateTime( $start_date );
        $end   = new DateTime( $end_date );
        $diff  = $start->diff( $end );

        switch ( $period ) {
            case 'day':
                return (int) ceil( $diff->days / $interval );
            case 'week':
                return (int) ceil( $diff->days / ( 7 * $interval ) );
            case 'month':
                return (int) ceil( ( $diff->y * 12 + $diff->m ) / $interval );
            case 'year':
                return (int) ceil( $diff->y / $interval );
            default:
                return 9999;
        }
    }

    /**
     * Get API instance
     *
     * @return Windcave_API
     */
    private function get_api() {
        return new Windcave_API(
            $this->gateway->get_api_username(),
            $this->gateway->get_api_key(),
            $this->gateway->is_test_mode(),
            $this->gateway->is_debug_mode()
        );
    }

    /**
     * Log a message
     *
     * @param string $message Message to log.
     */
    private function log( $message ) {
        if ( function_exists( 'wc_get_logger' ) ) {
            $logger = wc_get_logger();
            $logger->info( $message, array( 'source' => 'windcave-subscriptions' ) );
        }
    }
}
