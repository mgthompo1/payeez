<?php
/**
 * Windcave Token Management
 *
 * Handles saved payment methods / card tokenization with proper
 * storedCardIndicator support for card scheme compliance.
 *
 * @package Windcave_WooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Windcave Tokens class
 */
class Windcave_Tokens {

    /**
     * Save a card token from transaction data
     *
     * @param int   $customer_id Customer ID.
     * @param array $card        Card data from Windcave.
     * @param bool  $set_default Whether to set as default token.
     * @return WC_Payment_Token_CC|false
     */
    public static function save_card( $customer_id, $card, $set_default = false ) {
        if ( ! $customer_id || empty( $card['id'] ) ) {
            return false;
        }

        // Check if token already exists
        if ( self::token_exists( $customer_id, $card['id'] ) ) {
            // Update existing token's expiry if needed
            return self::update_token_expiry( $customer_id, $card );
        }

        $token = new WC_Payment_Token_CC();
        $token->set_token( $card['id'] );
        $token->set_gateway_id( 'windcave' );
        $token->set_card_type( self::normalize_card_type( $card['cardScheme'] ?? $card['type'] ?? '' ) );
        $token->set_last4( self::extract_last4( $card['cardNumber'] ?? '' ) );
        $token->set_expiry_month( str_pad( $card['dateExpiryMonth'] ?? '', 2, '0', STR_PAD_LEFT ) );
        $token->set_expiry_year( self::normalize_expiry_year( $card['dateExpiryYear'] ?? '' ) );
        $token->set_user_id( $customer_id );

        if ( $set_default ) {
            $token->set_default( true );
        }

        if ( $token->save() ) {
            self::log( "Saved new card token for customer {$customer_id}: " . self::format_token_display( $token ) );
            return $token;
        }

        return false;
    }

    /**
     * Update token expiry date (for expired card rebill scenarios)
     *
     * @param int   $customer_id Customer ID.
     * @param array $card        Card data from Windcave.
     * @return WC_Payment_Token_CC|false
     */
    public static function update_token_expiry( $customer_id, $card ) {
        $existing_tokens = WC_Payment_Tokens::get_customer_tokens( $customer_id, 'windcave' );

        foreach ( $existing_tokens as $token ) {
            if ( $token->get_token() === $card['id'] ) {
                $new_month = str_pad( $card['dateExpiryMonth'] ?? '', 2, '0', STR_PAD_LEFT );
                $new_year  = self::normalize_expiry_year( $card['dateExpiryYear'] ?? '' );

                // Update if expiry changed
                if ( $token->get_expiry_month() !== $new_month || $token->get_expiry_year() !== $new_year ) {
                    $token->set_expiry_month( $new_month );
                    $token->set_expiry_year( $new_year );
                    $token->save();

                    self::log( "Updated token expiry for customer {$customer_id}: " . self::format_token_display( $token ) );
                }

                return $token;
            }
        }

        return false;
    }

    /**
     * Check if a token already exists for a customer
     *
     * @param int    $customer_id Customer ID.
     * @param string $token_value Token value (card ID).
     * @return bool
     */
    public static function token_exists( $customer_id, $token_value ) {
        $existing_tokens = WC_Payment_Tokens::get_customer_tokens( $customer_id, 'windcave' );

        foreach ( $existing_tokens as $token ) {
            if ( $token->get_token() === $token_value ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get a token by ID
     *
     * @param int $token_id Token ID.
     * @param int $customer_id Customer ID for verification.
     * @return WC_Payment_Token_CC|null
     */
    public static function get_token( $token_id, $customer_id = 0 ) {
        $token = WC_Payment_Tokens::get( $token_id );

        if ( ! $token || 'windcave' !== $token->get_gateway_id() ) {
            return null;
        }

        if ( $customer_id && $token->get_user_id() !== $customer_id ) {
            return null;
        }

        return $token;
    }

    /**
     * Get a token by Windcave card ID
     *
     * @param int    $customer_id Customer ID.
     * @param string $card_id     Windcave card ID.
     * @return WC_Payment_Token_CC|null
     */
    public static function get_token_by_card_id( $customer_id, $card_id ) {
        $tokens = WC_Payment_Tokens::get_customer_tokens( $customer_id, 'windcave' );

        foreach ( $tokens as $token ) {
            if ( $token->get_token() === $card_id ) {
                return $token;
            }
        }

        return null;
    }

    /**
     * Delete a token
     *
     * @param int $token_id Token ID.
     * @param int $customer_id Customer ID for verification.
     * @return bool
     */
    public static function delete_token( $token_id, $customer_id = 0 ) {
        $token = self::get_token( $token_id, $customer_id );

        if ( ! $token ) {
            return false;
        }

        self::log( "Deleted token for customer {$customer_id}: " . self::format_token_display( $token ) );
        return $token->delete();
    }

    /**
     * Get all tokens for a customer
     *
     * @param int $customer_id Customer ID.
     * @return array
     */
    public static function get_customer_tokens( $customer_id ) {
        return WC_Payment_Tokens::get_customer_tokens( $customer_id, 'windcave' );
    }

    /**
     * Get valid (non-expired) tokens for a customer
     *
     * @param int $customer_id Customer ID.
     * @return array
     */
    public static function get_valid_customer_tokens( $customer_id ) {
        $tokens       = self::get_customer_tokens( $customer_id );
        $valid_tokens = array();

        foreach ( $tokens as $token ) {
            if ( ! self::is_token_expired( $token ) ) {
                $valid_tokens[] = $token;
            }
        }

        return $valid_tokens;
    }

    /**
     * Check if a token is expired
     *
     * @param WC_Payment_Token_CC $token Token object.
     * @return bool
     */
    public static function is_token_expired( $token ) {
        $expiry_month = intval( $token->get_expiry_month() );
        $expiry_year  = intval( $token->get_expiry_year() );

        $current_month = intval( date( 'm' ) );
        $current_year  = intval( date( 'Y' ) );

        // Expired if year is past, or same year but month is past
        if ( $expiry_year < $current_year ) {
            return true;
        }

        if ( $expiry_year === $current_year && $expiry_month < $current_month ) {
            return true;
        }

        return false;
    }

    /**
     * Check if token will expire soon (within X months)
     *
     * @param WC_Payment_Token_CC $token  Token object.
     * @param int                 $months Number of months to check.
     * @return bool
     */
    public static function is_token_expiring_soon( $token, $months = 2 ) {
        $expiry_month = intval( $token->get_expiry_month() );
        $expiry_year  = intval( $token->get_expiry_year() );

        $expiry_date  = new DateTime( "{$expiry_year}-{$expiry_month}-01" );
        $expiry_date->modify( 'last day of this month' );

        $check_date = new DateTime();
        $check_date->modify( "+{$months} months" );

        return $expiry_date <= $check_date;
    }

    /**
     * Get the appropriate storedCardIndicator for a payment
     *
     * @param bool   $is_initial    Whether this is the initial card storage.
     * @param string $payment_type  Type of payment (single, recurring, subscription).
     * @param bool   $is_mit        Whether this is merchant-initiated.
     * @return string
     */
    public static function get_stored_card_indicator( $is_initial, $payment_type = 'single', $is_mit = false ) {
        if ( $is_initial ) {
            switch ( $payment_type ) {
                case 'recurring':
                case 'subscription':
                    return Windcave_API::SCI_RECURRING_FIXED_INITIAL;

                case 'installment':
                    return Windcave_API::SCI_INSTALLMENT_INITIAL;

                case 'unscheduled':
                    return Windcave_API::SCI_UNSCHEDULED_COF_INITIAL;

                default:
                    return Windcave_API::SCI_CREDENTIAL_ON_FILE_INITIAL;
            }
        } else {
            switch ( $payment_type ) {
                case 'recurring':
                case 'subscription':
                    return Windcave_API::SCI_RECURRING_FIXED;

                case 'installment':
                    return Windcave_API::SCI_INSTALLMENT;

                case 'unscheduled':
                    return Windcave_API::SCI_UNSCHEDULED_COF;

                default:
                    return Windcave_API::SCI_CREDENTIAL_ON_FILE;
            }
        }
    }

    /**
     * Normalize card type to WooCommerce format
     *
     * @param string $card_scheme Card scheme from Windcave.
     * @return string
     */
    public static function normalize_card_type( $card_scheme ) {
        $card_scheme = strtolower( trim( $card_scheme ) );

        $map = array(
            'visa'             => 'visa',
            'mastercard'       => 'mastercard',
            'master'           => 'mastercard',
            'mc'               => 'mastercard',
            'amex'             => 'amex',
            'american express' => 'amex',
            'americanexpress'  => 'amex',
            'diners'           => 'diners',
            'diners club'      => 'diners',
            'dinersclub'       => 'diners',
            'discover'         => 'discover',
            'jcb'              => 'jcb',
            'unionpay'         => 'unionpay',
            'union pay'        => 'unionpay',
        );

        return isset( $map[ $card_scheme ] ) ? $map[ $card_scheme ] : 'card';
    }

    /**
     * Extract last 4 digits from masked card number
     *
     * @param string $card_number Masked card number.
     * @return string
     */
    public static function extract_last4( $card_number ) {
        // Windcave returns masked format like "411111......1111" or "4111********1111"
        $card_number = preg_replace( '/[^0-9]/', '', $card_number );

        if ( strlen( $card_number ) >= 4 ) {
            return substr( $card_number, -4 );
        }

        return $card_number;
    }

    /**
     * Normalize expiry year to 4-digit format
     *
     * @param string $year Year (2 or 4 digit).
     * @return string
     */
    public static function normalize_expiry_year( $year ) {
        $year = preg_replace( '/[^0-9]/', '', $year );

        if ( strlen( $year ) === 2 ) {
            $current_century = substr( date( 'Y' ), 0, 2 );
            return $current_century . $year;
        }

        return $year;
    }

    /**
     * Get card brand icon URL
     *
     * @param string $card_type Card type.
     * @return string
     */
    public static function get_card_icon_url( $card_type ) {
        $icons = array(
            'visa'       => 'visa.svg',
            'mastercard' => 'mastercard.svg',
            'amex'       => 'amex.svg',
            'diners'     => 'diners.svg',
            'discover'   => 'discover.svg',
            'jcb'        => 'jcb.svg',
            'unionpay'   => 'unionpay.svg',
        );

        if ( isset( $icons[ $card_type ] ) ) {
            return WINDCAVE_PLUGIN_URL . 'assets/images/' . $icons[ $card_type ];
        }

        return '';
    }

    /**
     * Format token for display
     *
     * @param WC_Payment_Token_CC $token Token object.
     * @return string
     */
    public static function format_token_display( $token ) {
        $expired = self::is_token_expired( $token ) ? ' ' . __( '(Expired)', 'windcave-woocommerce' ) : '';

        return sprintf(
            /* translators: 1: Card brand 2: Last 4 digits 3: Expiry date */
            __( '%1$s ending in %2$s (expires %3$s)', 'windcave-woocommerce' ),
            ucfirst( $token->get_card_type() ),
            $token->get_last4(),
            $token->get_expiry_month() . '/' . substr( $token->get_expiry_year(), -2 )
        ) . $expired;
    }

    /**
     * Format token for HTML display with icon
     *
     * @param WC_Payment_Token_CC $token Token object.
     * @return string
     */
    public static function format_token_html( $token ) {
        $icon_url = self::get_card_icon_url( $token->get_card_type() );
        $expired  = self::is_token_expired( $token );

        $html = '<span class="windcave-saved-card' . ( $expired ? ' windcave-card-expired' : '' ) . '">';

        if ( $icon_url ) {
            $html .= '<img src="' . esc_url( $icon_url ) . '" alt="' . esc_attr( ucfirst( $token->get_card_type() ) ) . '" class="windcave-card-icon" />';
        }

        $html .= '<span class="windcave-card-info">';
        $html .= esc_html( ucfirst( $token->get_card_type() ) ) . ' ';
        $html .= esc_html__( 'ending in', 'windcave-woocommerce' ) . ' ';
        $html .= '<strong>' . esc_html( $token->get_last4() ) . '</strong> ';
        $html .= '(' . esc_html( $token->get_expiry_month() . '/' . substr( $token->get_expiry_year(), -2 ) ) . ')';

        if ( $expired ) {
            $html .= ' <span class="windcave-expired-label">' . esc_html__( 'Expired', 'windcave-woocommerce' ) . '</span>';
        }

        $html .= '</span></span>';

        return $html;
    }

    /**
     * Log a message
     *
     * @param string $message Message to log.
     */
    private static function log( $message ) {
        if ( function_exists( 'wc_get_logger' ) ) {
            $logger = wc_get_logger();
            $logger->debug( $message, array( 'source' => 'windcave-tokens' ) );
        }
    }
}
