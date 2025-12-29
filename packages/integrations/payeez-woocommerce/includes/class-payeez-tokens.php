<?php
/**
 * Payeez Token Management
 *
 * @package Payeez_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Payeez Tokens class
 */
class Payeez_Tokens {

    /**
     * Get a user's saved token
     *
     * @param int $token_id Token ID.
     * @param int $user_id  User ID.
     * @return WC_Payment_Token|null
     */
    public static function get_token( $token_id, $user_id ) {
        $token = WC_Payment_Tokens::get( $token_id );

        if ( ! $token || $token->get_user_id() !== $user_id || 'payeez' !== $token->get_gateway_id() ) {
            return null;
        }

        return $token;
    }

    /**
     * Save a card token
     *
     * @param int   $user_id   User ID.
     * @param array $card_data Card data from Payeez.
     * @param bool  $is_default Set as default.
     * @return WC_Payment_Token_CC|null
     */
    public static function save_card( $user_id, $card_data, $is_default = false ) {
        if ( empty( $user_id ) || empty( $card_data['token'] ) ) {
            return null;
        }

        // Check for existing token
        $existing_tokens = WC_Payment_Tokens::get_customer_tokens( $user_id, 'payeez' );
        foreach ( $existing_tokens as $existing ) {
            if ( $existing->get_token() === $card_data['token'] ) {
                return $existing;
            }
        }

        // Create new token
        $token = new WC_Payment_Token_CC();
        $token->set_gateway_id( 'payeez' );
        $token->set_user_id( $user_id );
        $token->set_token( $card_data['token'] );
        $token->set_card_type( strtolower( $card_data['brand'] ?? $card_data['type'] ?? 'card' ) );
        $token->set_last4( $card_data['last4'] ?? substr( $card_data['cardNumber'] ?? '', -4 ) );
        $token->set_expiry_month( $card_data['exp_month'] ?? $card_data['expiryMonth'] ?? '' );
        $token->set_expiry_year( $card_data['exp_year'] ?? $card_data['expiryYear'] ?? '' );
        $token->set_default( $is_default );

        if ( $token->save() ) {
            return $token;
        }

        return null;
    }

    /**
     * Check if token is expired
     *
     * @param WC_Payment_Token_CC $token Token object.
     * @return bool
     */
    public static function is_token_expired( $token ) {
        $expiry_year = $token->get_expiry_year();
        $expiry_month = $token->get_expiry_month();

        if ( empty( $expiry_year ) || empty( $expiry_month ) ) {
            return false;
        }

        $current_year = (int) date( 'Y' );
        $current_month = (int) date( 'm' );

        if ( (int) $expiry_year < $current_year ) {
            return true;
        }

        if ( (int) $expiry_year === $current_year && (int) $expiry_month < $current_month ) {
            return true;
        }

        return false;
    }

    /**
     * Get stored card indicator
     *
     * @param bool   $is_initial  Is initial storage.
     * @param string $payment_type Payment type (single/recurring).
     * @return string
     */
    public static function get_stored_card_indicator( $is_initial = false, $payment_type = 'single' ) {
        if ( $is_initial ) {
            return 'recurring' === $payment_type ? 'initial_recurring' : 'initial';
        }

        return 'recurring' === $payment_type ? 'recurring' : 'cardholder_initiated';
    }
}
