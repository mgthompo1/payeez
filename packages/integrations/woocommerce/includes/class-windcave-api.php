<?php
/**
 * Windcave API Wrapper
 *
 * Handles all communication with the Windcave REST API including:
 * - Sessions (payment initiation)
 * - Transactions (direct payments, refunds)
 * - Subscriptions (recurring billing)
 * - Customers and stored cards
 *
 * @package Windcave_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Windcave API class
 */
class Windcave_API {

    /**
     * API base URLs
     */
    const API_URL_PRODUCTION = 'https://sec.windcave.com/api/v1';
    const API_URL_TEST       = 'https://uat.windcave.com/api/v1';

    /**
     * JavaScript URLs
     */
    const JS_URL_PRODUCTION = 'https://sec.windcave.com/js';
    const JS_URL_TEST       = 'https://uat.windcave.com/js';

    /**
     * Stored Card Indicator constants
     */
    // Initial indicators (first payment in sequence)
    const SCI_CREDENTIAL_ON_FILE_INITIAL         = 'credentialonfileinitial';
    const SCI_UNSCHEDULED_COF_INITIAL            = 'unscheduledcredentialonfileinitial';
    const SCI_RECURRING_FIXED_INITIAL            = 'recurringfixedinitial';
    const SCI_RECURRING_VARIABLE_INITIAL         = 'recurringvariableinitial';
    const SCI_INSTALLMENT_INITIAL                = 'installmentinitial';

    // Established indicators (subsequent payments)
    const SCI_CREDENTIAL_ON_FILE                 = 'credentialonfile';
    const SCI_UNSCHEDULED_COF                    = 'unscheduledcredentialonfile';
    const SCI_RECURRING_NO_EXPIRY                = 'recurringnoexpiry';
    const SCI_RECURRING_FIXED                    = 'recurringfixed';
    const SCI_RECURRING_VARIABLE                 = 'recurringvariable';
    const SCI_INSTALLMENT                        = 'installment';

    // Industry-specific indicators
    const SCI_PARTIAL_SHIPMENT                   = 'partialshipment';
    const SCI_INCREMENTAL                        = 'incremental';
    const SCI_RESUBMISSION                       = 'resubmission';
    const SCI_REAUTHORISATION                    = 'reauthorisation';
    const SCI_DELAYED_CHARGES                    = 'delayedcharges';
    const SCI_NO_SHOW                            = 'noshow';

    // Single payment (no storage)
    const SCI_SINGLE                             = 'single';

    /**
     * Recurring frequency constants
     */
    const FREQ_DAILY                             = 'daily';
    const FREQ_WEEKLY                            = 'weekly';
    const FREQ_EVERY_2_WEEKS                     = 'every2weeks';
    const FREQ_EVERY_4_WEEKS                     = 'every4weeks';
    const FREQ_MONTHLY                           = 'monthly';
    const FREQ_MONTHLY_28TH                      = 'monthly28th';
    const FREQ_MONTHLY_LAST_DAY                  = 'monthlylastcalendarday';
    const FREQ_MONTHLY_SECOND_LAST_DAY           = 'monthlysecondlastcalendarday';
    const FREQ_MONTHLY_THIRD_LAST_DAY            = 'monthlythirdlastcalendarday';
    const FREQ_TWO_MONTHLY                       = 'twomonthly';
    const FREQ_THREE_MONTHLY                     = 'threemonthly';
    const FREQ_SIX_MONTHLY                       = 'sixmonthly';
    const FREQ_ANNUALLY                          = 'annually';

    /**
     * API username
     *
     * @var string
     */
    private $api_username;

    /**
     * API key
     *
     * @var string
     */
    private $api_key;

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
     * Constructor
     *
     * @param string $api_username API username.
     * @param string $api_key      API key.
     * @param bool   $test_mode    Whether to use test mode.
     * @param bool   $debug_mode   Whether to enable debug logging.
     */
    public function __construct( $api_username, $api_key, $test_mode = false, $debug_mode = false ) {
        $this->api_username = $api_username;
        $this->api_key      = $api_key;
        $this->test_mode    = $test_mode;
        $this->debug_mode   = $debug_mode;
    }

    /**
     * Get the API base URL
     *
     * @return string
     */
    public function get_api_url() {
        return $this->test_mode ? self::API_URL_TEST : self::API_URL_PRODUCTION;
    }

    /**
     * Get the JavaScript base URL
     *
     * @return string
     */
    public function get_js_url() {
        return $this->test_mode ? self::JS_URL_TEST : self::JS_URL_PRODUCTION;
    }

    /**
     * Get environment identifier for JavaScript
     *
     * @return string
     */
    public function get_js_environment() {
        return $this->test_mode ? 'uat' : 'sec';
    }

    /**
     * Make an API request
     *
     * @param string $endpoint API endpoint.
     * @param string $method   HTTP method.
     * @param array  $data     Request data.
     * @param array  $headers  Additional headers.
     * @return array|WP_Error
     */
    private function request( $endpoint, $method = 'GET', $data = array(), $headers = array() ) {
        $url = $this->get_api_url() . $endpoint;

        $default_headers = array(
            'Content-Type'  => 'application/json',
            'Authorization' => 'Basic ' . base64_encode( $this->api_username . ':' . $this->api_key ),
        );

        $args = array(
            'method'  => $method,
            'headers' => array_merge( $default_headers, $headers ),
            'timeout' => 60,
        );

        if ( ! empty( $data ) && in_array( $method, array( 'POST', 'PUT', 'PATCH' ), true ) ) {
            $args['body'] = wp_json_encode( $data );
        }

        $this->log( sprintf( 'API Request: %s %s', $method, $url ) );
        if ( ! empty( $data ) ) {
            $this->log( 'Request Data: ' . wp_json_encode( $this->mask_sensitive_data( $data ) ) );
        }

        $response = wp_remote_request( $url, $args );

        if ( is_wp_error( $response ) ) {
            $this->log( 'API Error: ' . $response->get_error_message() );
            return $response;
        }

        $code = wp_remote_retrieve_response_code( $response );
        $body = wp_remote_retrieve_body( $response );

        $this->log( sprintf( 'API Response: %d', $code ) );

        // Mask sensitive data in response body before logging
        $body_for_logging = $body;
        if ( ! empty( $body ) ) {
            $body_decoded = json_decode( $body, true );
            if ( is_array( $body_decoded ) ) {
                $body_for_logging = wp_json_encode( $this->mask_sensitive_data( $body_decoded ) );
            }
        }
        $this->log( 'Response Body: ' . $body_for_logging );

        // Handle empty response for DELETE requests
        if ( empty( $body ) && in_array( $code, array( 200, 204 ), true ) ) {
            return array( 'success' => true );
        }

        $decoded = json_decode( $body, true );

        if ( json_last_error() !== JSON_ERROR_NONE ) {
            return new WP_Error( 'windcave_json_error', __( 'Invalid JSON response from Windcave.', 'windcave-woocommerce' ) );
        }

        if ( $code >= 400 ) {
            $error_message = isset( $decoded['errors'][0]['message'] ) ? $decoded['errors'][0]['message'] : __( 'Unknown API error.', 'windcave-woocommerce' );
            return new WP_Error( 'windcave_api_error', $error_message, array( 'status' => $code, 'response' => $decoded ) );
        }

        return $decoded;
    }

    // =========================================================================
    // SESSION METHODS
    // =========================================================================

    /**
     * Create a payment session
     *
     * @param array $params Session parameters.
     * @return array|WP_Error
     */
    public function create_session( $params ) {
        $defaults = array(
            'type'     => 'purchase',
            'language' => 'en',
        );

        $params = wp_parse_args( $params, $defaults );

        return $this->request( '/sessions', 'POST', $params );
    }

    /**
     * Create a session with stored card indicator for initial card storage
     *
     * @param array  $params              Session parameters.
     * @param string $stored_card_indicator Type of stored card indicator.
     * @param array  $recurring_params    Recurring parameters (for recurring indicators).
     * @return array|WP_Error
     */
    public function create_session_with_card_storage( $params, $stored_card_indicator = self::SCI_CREDENTIAL_ON_FILE_INITIAL, $recurring_params = array() ) {
        $params['storeCard']           = true;
        $params['storedCardIndicator'] = $stored_card_indicator;

        // Add recurring parameters if required
        if ( in_array( $stored_card_indicator, array( self::SCI_RECURRING_FIXED_INITIAL, self::SCI_RECURRING_VARIABLE_INITIAL ), true ) ) {
            if ( ! empty( $recurring_params['expiry'] ) ) {
                $params['recurringExpiry'] = $recurring_params['expiry'];
            }
            if ( ! empty( $recurring_params['frequency'] ) ) {
                $params['recurringFrequency'] = $recurring_params['frequency'];
            }
        }

        return $this->create_session( $params );
    }

    /**
     * Create a session to rebill a stored card
     *
     * @param string $card_id              Stored card ID.
     * @param array  $params               Session parameters.
     * @param string $stored_card_indicator Type of rebill.
     * @param array  $recurring_params     Recurring parameters.
     * @return array|WP_Error
     */
    public function create_session_rebill( $card_id, $params, $stored_card_indicator = self::SCI_CREDENTIAL_ON_FILE, $recurring_params = array() ) {
        $params['cardId']              = $card_id;
        $params['storedCardIndicator'] = $stored_card_indicator;

        // Add recurring parameters if required
        if ( in_array( $stored_card_indicator, array( self::SCI_RECURRING_FIXED, self::SCI_RECURRING_VARIABLE, self::SCI_RECURRING_NO_EXPIRY ), true ) ) {
            if ( ! empty( $recurring_params['expiry'] ) ) {
                $params['recurringExpiry'] = $recurring_params['expiry'];
            } else {
                // Default to no expiry for subscriptions
                $params['recurringExpiry'] = '9999-12-31';
            }
            if ( ! empty( $recurring_params['frequency'] ) ) {
                $params['recurringFrequency'] = $recurring_params['frequency'];
            }
        }

        return $this->create_session( $params );
    }

    /**
     * Get session status
     *
     * @param string $session_id Session ID.
     * @return array|WP_Error
     */
    public function get_session( $session_id ) {
        return $this->request( '/sessions/' . $session_id );
    }

    /**
     * Query session status (alias for get_session)
     *
     * @param string $session_id Session ID.
     * @return array|WP_Error
     */
    public function query_session( $session_id ) {
        return $this->get_session( $session_id );
    }

    // =========================================================================
    // TRANSACTION METHODS
    // =========================================================================

    /**
     * Create a transaction (direct server-to-server payment)
     *
     * @param array $params Transaction parameters.
     * @return array|WP_Error
     */
    public function create_transaction( $params ) {
        return $this->request( '/transactions', 'POST', $params );
    }

    /**
     * Get transaction details
     *
     * @param string $transaction_id Transaction ID.
     * @return array|WP_Error
     */
    public function get_transaction( $transaction_id ) {
        return $this->request( '/transactions/' . $transaction_id );
    }

    /**
     * Process a refund
     *
     * @param string $transaction_id Original transaction ID.
     * @param float  $amount         Refund amount.
     * @param string $merchant_ref   Merchant reference.
     * @return array|WP_Error
     */
    public function refund( $transaction_id, $amount, $merchant_ref ) {
        $params = array(
            'type'                  => 'refund',
            'amount'                => number_format( $amount, 2, '.', '' ),
            'merchantReference'     => $merchant_ref,
            'originalTransactionId' => $transaction_id,
        );

        return $this->create_transaction( $params );
    }

    /**
     * Process a payment using a stored card token
     *
     * @param string $card_id              Stored card ID.
     * @param float  $amount               Payment amount.
     * @param string $currency             Currency code.
     * @param string $merchant_ref         Merchant reference.
     * @param string $stored_card_indicator Stored card indicator.
     * @param array  $extra_params         Additional parameters.
     * @return array|WP_Error
     */
    public function charge_token( $card_id, $amount, $currency, $merchant_ref, $stored_card_indicator = self::SCI_CREDENTIAL_ON_FILE, $extra_params = array() ) {
        $params = array(
            'type'               => 'purchase',
            'amount'             => number_format( $amount, 2, '.', '' ),
            'currency'           => $currency,
            'merchantReference'  => $merchant_ref,
            'cardId'             => $card_id,
            'storedCardIndicator' => $stored_card_indicator,
        );

        // Add recurring parameters for subscription payments
        if ( in_array( $stored_card_indicator, array( self::SCI_RECURRING_FIXED, self::SCI_RECURRING_VARIABLE, self::SCI_RECURRING_NO_EXPIRY ), true ) ) {
            $params['recurringExpiry']    = $extra_params['recurringExpiry'] ?? '9999-12-31';
            $params['recurringFrequency'] = $extra_params['recurringFrequency'] ?? self::FREQ_MONTHLY;
        }

        // Merge any extra parameters
        $params = array_merge( $params, $extra_params );

        return $this->create_transaction( $params );
    }

    // =========================================================================
    // SUBSCRIPTION METHODS
    // =========================================================================

    /**
     * Create a subscription
     *
     * @param array $params Subscription parameters.
     * @return array|WP_Error
     */
    public function create_subscription( $params ) {
        $required = array( 'recurringAmount', 'recurringFrequency', 'recurringCount', 'cardId' );

        foreach ( $required as $field ) {
            if ( empty( $params[ $field ] ) ) {
                return new WP_Error( 'windcave_missing_param', sprintf( __( 'Missing required parameter: %s', 'windcave-woocommerce' ), $field ) );
            }
        }

        // Format amount
        if ( isset( $params['recurringAmount'] ) ) {
            $params['recurringAmount'] = number_format( floatval( $params['recurringAmount'] ), 2, '.', '' );
        }

        // Set default timezone if not provided
        if ( empty( $params['recurringTimeZone'] ) ) {
            $params['recurringTimeZone'] = wp_timezone_string();
        }

        // Set start date if not provided (start immediately)
        if ( empty( $params['recurringStartDateTime'] ) ) {
            $params['recurringStartDateTime'] = gmdate( 'Y-m-d\TH:i:s\Z' );
        }

        return $this->request( '/subscriptions', 'POST', $params );
    }

    /**
     * Get subscription details
     *
     * @param string $subscription_id Subscription ID.
     * @return array|WP_Error
     */
    public function get_subscription( $subscription_id ) {
        return $this->request( '/subscriptions/' . $subscription_id );
    }

    /**
     * Update a subscription
     *
     * @param string $subscription_id Subscription ID.
     * @param array  $params          Parameters to update.
     * @return array|WP_Error
     */
    public function update_subscription( $subscription_id, $params ) {
        // Format amount if provided
        if ( isset( $params['recurringAmount'] ) ) {
            $params['recurringAmount'] = number_format( floatval( $params['recurringAmount'] ), 2, '.', '' );
        }

        return $this->request( '/subscriptions/' . $subscription_id, 'PUT', $params );
    }

    /**
     * Cancel/delete a subscription
     *
     * @param string $subscription_id Subscription ID.
     * @return array|WP_Error
     */
    public function cancel_subscription( $subscription_id ) {
        return $this->request( '/subscriptions/' . $subscription_id, 'DELETE' );
    }

    // =========================================================================
    // INVOICE METHODS
    // =========================================================================

    /**
     * Get invoice details
     *
     * @param string $invoice_id Invoice ID.
     * @return array|WP_Error
     */
    public function get_invoice( $invoice_id ) {
        return $this->request( '/invoices/' . $invoice_id );
    }

    // =========================================================================
    // CUSTOMER METHODS
    // =========================================================================

    /**
     * Get customer details
     *
     * @param string $customer_id Customer ID.
     * @return array|WP_Error
     */
    public function get_customer( $customer_id ) {
        return $this->request( '/customers/' . $customer_id );
    }

    /**
     * Create a customer
     *
     * @param array $params Customer parameters.
     * @return array|WP_Error
     */
    public function create_customer( $params ) {
        return $this->request( '/customers', 'POST', $params );
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Mask sensitive data for logging
     *
     * @param array $data Data to mask.
     * @return array
     */
    private function mask_sensitive_data( $data ) {
        $sensitive_keys = array( 'cardNumber', 'cvv', 'cvc', 'cvc2', 'securityCode', 'cardId' );

        foreach ( $sensitive_keys as $key ) {
            if ( isset( $data[ $key ] ) && is_string( $data[ $key ] ) && strlen( $data[ $key ] ) > 4 ) {
                $data[ $key ] = str_repeat( '*', strlen( $data[ $key ] ) - 4 ) . substr( $data[ $key ], -4 );
            }
        }

        // Recursively mask nested arrays
        foreach ( $data as $key => $value ) {
            if ( is_array( $value ) ) {
                $data[ $key ] = $this->mask_sensitive_data( $value );
            }
        }

        return $data;
    }

    /**
     * Log a message
     *
     * @param string $message Message to log.
     */
    private function log( $message ) {
        if ( ! $this->debug_mode ) {
            return;
        }

        if ( function_exists( 'wc_get_logger' ) ) {
            $logger = wc_get_logger();
            $logger->debug( $message, array( 'source' => 'windcave-api' ) );
        }
    }

    /**
     * Extract session ID from links array
     *
     * @param array $links Links array from session response.
     * @return string|null
     */
    public static function get_session_id_from_links( $links ) {
        foreach ( $links as $link ) {
            if ( isset( $link['rel'] ) && 'self' === $link['rel'] && isset( $link['href'] ) ) {
                $parts = explode( '/', $link['href'] );
                return end( $parts );
            }
        }
        return null;
    }

    /**
     * Get the AJAX submit URL from links
     *
     * @param array $links Links array from session response.
     * @return string|null
     */
    public static function get_ajax_submit_url( $links ) {
        foreach ( $links as $link ) {
            if ( isset( $link['rel'] ) && 'ajaxSubmitCard' === $link['rel'] && isset( $link['href'] ) ) {
                return $link['href'];
            }
        }
        return null;
    }

    /**
     * Get subscription ID from links array
     *
     * @param array $links Links array from subscription response.
     * @return string|null
     */
    public static function get_subscription_id_from_links( $links ) {
        return self::get_session_id_from_links( $links ); // Same logic
    }

    /**
     * Get list of valid recurring frequencies
     *
     * @return array
     */
    public static function get_recurring_frequencies() {
        return array(
            self::FREQ_DAILY                   => __( 'Daily', 'windcave-woocommerce' ),
            self::FREQ_WEEKLY                  => __( 'Weekly', 'windcave-woocommerce' ),
            self::FREQ_EVERY_2_WEEKS           => __( 'Every 2 Weeks', 'windcave-woocommerce' ),
            self::FREQ_EVERY_4_WEEKS           => __( 'Every 4 Weeks', 'windcave-woocommerce' ),
            self::FREQ_MONTHLY                 => __( 'Monthly', 'windcave-woocommerce' ),
            self::FREQ_MONTHLY_28TH            => __( 'Monthly (28th)', 'windcave-woocommerce' ),
            self::FREQ_MONTHLY_LAST_DAY        => __( 'Monthly (Last Day)', 'windcave-woocommerce' ),
            self::FREQ_TWO_MONTHLY             => __( 'Every 2 Months', 'windcave-woocommerce' ),
            self::FREQ_THREE_MONTHLY           => __( 'Every 3 Months', 'windcave-woocommerce' ),
            self::FREQ_SIX_MONTHLY             => __( 'Every 6 Months', 'windcave-woocommerce' ),
            self::FREQ_ANNUALLY                => __( 'Annually', 'windcave-woocommerce' ),
        );
    }

    /**
     * Map WooCommerce Subscriptions period to Windcave frequency
     *
     * @param string $period WC Subscriptions period (day, week, month, year).
     * @param int    $interval Interval count.
     * @return string
     */
    public static function map_wc_period_to_frequency( $period, $interval = 1 ) {
        switch ( $period ) {
            case 'day':
                return self::FREQ_DAILY;

            case 'week':
                if ( $interval === 2 ) {
                    return self::FREQ_EVERY_2_WEEKS;
                } elseif ( $interval === 4 ) {
                    return self::FREQ_EVERY_4_WEEKS;
                }
                return self::FREQ_WEEKLY;

            case 'month':
                if ( $interval === 2 ) {
                    return self::FREQ_TWO_MONTHLY;
                } elseif ( $interval === 3 ) {
                    return self::FREQ_THREE_MONTHLY;
                } elseif ( $interval === 6 ) {
                    return self::FREQ_SIX_MONTHLY;
                }
                return self::FREQ_MONTHLY;

            case 'year':
                return self::FREQ_ANNUALLY;

            default:
                return self::FREQ_MONTHLY;
        }
    }
}
