<?php
/**
 * Atlas API Client
 *
 * Handles communication with the Atlas payment orchestration API.
 *
 * @package Atlas_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Atlas API class
 */
class Atlas_API {

    /**
     * API base URL
     *
     * @var string
     */
    private $api_url;

    /**
     * Public API key
     *
     * @var string
     */
    private $public_key;

    /**
     * Secret API key
     *
     * @var string
     */
    private $secret_key;

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
     * @param string $public_key Public API key.
     * @param string $secret_key Secret API key.
     * @param bool   $test_mode  Whether test mode is enabled.
     * @param bool   $debug_mode Whether debug mode is enabled.
     */
    public function __construct( $public_key, $secret_key, $test_mode = true, $debug_mode = false ) {
        $this->public_key = $public_key;
        $this->secret_key = $secret_key;
        $this->test_mode  = $test_mode;
        $this->debug_mode = $debug_mode;

        // Atlas API URL (Supabase Edge Functions)
        $this->api_url = $this->get_api_base_url();
    }

    /**
     * Get API base URL
     *
     * @return string
     */
    private function get_api_base_url() {
        // TODO: Update with your actual Supabase project URL
        return 'https://yssswpqpwrrglgroxwok.supabase.co/functions/v1';
    }

    /**
     * Create a payment session
     *
     * @param array $params Session parameters.
     * @return array|WP_Error
     */
    public function create_session( $params ) {
        $endpoint = $this->api_url . '/create-session';

        $body = array(
            'amount'            => (int) ( floatval( $params['amount'] ) * 100 ), // Convert to cents
            'currency'          => strtoupper( $params['currency'] ),
            'external_id'       => $params['merchantReference'] ?? 'wc-' . time(),
            'customer_email'    => $params['customer_email'] ?? '',
            'metadata'          => $params['metadata'] ?? array(),
            'return_url'        => $params['callbackUrls']['approved'] ?? home_url(),
            'cancel_url'        => $params['callbackUrls']['cancelled'] ?? wc_get_checkout_url(),
        );

        if ( isset( $params['storeCard'] ) && $params['storeCard'] ) {
            $body['save_payment_method'] = true;
        }

        $response = $this->request( 'POST', $endpoint, $body );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        // Transform response to expected format
        return array(
            'id'    => $response['session_id'] ?? $response['id'],
            'state' => 'pending',
            'links' => array(
                array(
                    'rel'  => 'self',
                    'href' => $endpoint . '/' . ( $response['session_id'] ?? $response['id'] ),
                ),
            ),
        );
    }

    /**
     * Confirm a payment
     *
     * @param string $session_id   Session ID.
     * @param array  $payment_data Payment method data (token or card details).
     * @return array|WP_Error
     */
    public function confirm_payment( $session_id, $payment_data = array() ) {
        $endpoint = $this->api_url . '/confirm-payment/' . $session_id;

        $body = array_merge( array(
            'session_id' => $session_id,
        ), $payment_data );

        return $this->request( 'POST', $endpoint, $body );
    }

    /**
     * Get session status
     *
     * @param string $session_id Session ID.
     * @return array|WP_Error
     */
    public function get_session( $session_id ) {
        $endpoint = $this->api_url . '/get-session-config/' . $session_id;
        return $this->request( 'GET', $endpoint );
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

    /**
     * Charge a saved token
     *
     * @param string $token               Payment token.
     * @param float  $amount              Amount to charge.
     * @param string $currency            Currency code.
     * @param string $merchant_reference  Merchant reference.
     * @param string $stored_card_indicator Stored card indicator.
     * @return array|WP_Error
     */
    public function charge_token( $token, $amount, $currency, $merchant_reference, $stored_card_indicator = 'recurring' ) {
        $endpoint = $this->api_url . '/confirm-payment';

        $body = array(
            'payment_method_token' => $token,
            'amount'               => (int) ( floatval( $amount ) * 100 ),
            'currency'             => strtoupper( $currency ),
            'external_id'          => $merchant_reference,
            'stored_card_indicator' => $stored_card_indicator,
        );

        $response = $this->request( 'POST', $endpoint, $body );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        return array(
            'authorised'   => 'succeeded' === ( $response['status'] ?? '' ),
            'id'           => $response['transaction_id'] ?? $response['id'] ?? '',
            'responseText' => $response['error_message'] ?? '',
            'card'         => $response['payment_method'] ?? array(),
        );
    }

    /**
     * Capture a payment
     *
     * @param string $transaction_id Transaction ID.
     * @param float  $amount         Amount to capture (null for full amount).
     * @return array|WP_Error
     */
    public function capture( $transaction_id, $amount = null ) {
        $endpoint = $this->api_url . '/capture-payment/' . $transaction_id;

        $body = array();
        if ( null !== $amount ) {
            $body['amount'] = (int) ( floatval( $amount ) * 100 );
        }

        $response = $this->request( 'POST', $endpoint, $body );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        return array(
            'authorised'   => 'captured' === ( $response['status'] ?? '' ),
            'id'           => $response['transaction_id'] ?? '',
            'responseText' => $response['error_message'] ?? '',
        );
    }

    /**
     * Refund a payment
     *
     * @param string $transaction_id    Transaction ID.
     * @param float  $amount            Amount to refund.
     * @param string $merchant_reference Merchant reference.
     * @return array|WP_Error
     */
    public function refund( $transaction_id, $amount, $merchant_reference = '' ) {
        $endpoint = $this->api_url . '/refund-payment/' . $transaction_id;

        $body = array(
            'amount' => (int) ( floatval( $amount ) * 100 ),
        );

        if ( $merchant_reference ) {
            $body['reason'] = $merchant_reference;
        }

        $response = $this->request( 'POST', $endpoint, $body );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        return array(
            'authorised'   => 'succeeded' === ( $response['status'] ?? '' ),
            'id'           => $response['refund_id'] ?? $response['id'] ?? '',
            'responseText' => $response['error_message'] ?? '',
        );
    }

    /**
     * Make an API request
     *
     * @param string $method   HTTP method.
     * @param string $endpoint API endpoint.
     * @param array  $body     Request body.
     * @return array|WP_Error
     */
    private function request( $method, $endpoint, $body = array() ) {
        $this->log( sprintf( 'API Request: %s %s', $method, $endpoint ) );

        $args = array(
            'method'  => $method,
            'headers' => array(
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $this->secret_key,
                'X-Public-Key'  => $this->public_key,
            ),
            'timeout' => 30,
        );

        if ( ! empty( $body ) && in_array( $method, array( 'POST', 'PUT', 'PATCH' ), true ) ) {
            $args['body'] = wp_json_encode( $body );
            $this->log( 'Request body: ' . $args['body'] );
        }

        $response = wp_remote_request( $endpoint, $args );

        if ( is_wp_error( $response ) ) {
            $this->log_error( 'API Error: ' . $response->get_error_message() );
            return $response;
        }

        $status_code = wp_remote_retrieve_response_code( $response );
        $body        = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body, true );

        $this->log( sprintf( 'API Response (%d): %s', $status_code, $body ) );

        if ( $status_code >= 400 ) {
            $error_message = isset( $data['error'] ) ? $data['error'] : __( 'API request failed.', 'atlas-woocommerce' );
            return new WP_Error( 'atlas_api_error', $error_message );
        }

        return $data;
    }

    /**
     * Get session ID from links array
     *
     * @param array $links Links array from session response.
     * @return string
     */
    public static function get_session_id_from_links( $links ) {
        foreach ( $links as $link ) {
            if ( 'self' === $link['rel'] ) {
                return basename( $link['href'] );
            }
        }
        return '';
    }

    /**
     * Get AJAX submit URL from links
     *
     * @param array $links Links array.
     * @return string
     */
    public static function get_ajax_submit_url( $links ) {
        foreach ( $links as $link ) {
            if ( 'ajaxSubmit' === $link['rel'] ) {
                return $link['href'];
            }
        }
        return '';
    }

    /**
     * Get JS SDK URL
     *
     * @return string
     */
    public function get_js_url() {
        // Atlas SDK URL
        return 'https://js.atlas.com/v1';
    }

    /**
     * Get JS environment
     *
     * @return string
     */
    public function get_js_environment() {
        return $this->test_mode ? 'sandbox' : 'production';
    }

    /**
     * Log debug message
     *
     * @param string $message Message to log.
     */
    private function log( $message ) {
        if ( ! $this->debug_mode ) {
            return;
        }

        if ( function_exists( 'wc_get_logger' ) ) {
            $logger = wc_get_logger();
            $logger->debug( $message, array( 'source' => 'atlas' ) );
        }
    }

    /**
     * Log error message
     *
     * @param string $message Error message.
     */
    private function log_error( $message ) {
        if ( function_exists( 'wc_get_logger' ) ) {
            $logger = wc_get_logger();
            $logger->error( $message, array( 'source' => 'atlas' ) );
        }
    }
}
