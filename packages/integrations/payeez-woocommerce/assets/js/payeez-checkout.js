/**
 * Payeez WooCommerce Checkout
 */
(function($) {
    'use strict';

    const PayeezCheckout = {
        payeez: null,
        elements: null,
        cardElement: null,
        sessionId: null,

        init: function() {
            if (typeof Payeez === 'undefined') {
                console.error('Payeez SDK not loaded');
                return;
            }

            // Initialize Payeez with public key
            this.payeez = Payeez(payeez_params.public_key, {
                environment: payeez_params.is_test_mode ? 'sandbox' : 'production'
            });

            // Create Elements instance
            this.elements = this.payeez.elements();

            // Mount card element
            this.mountCardElement();

            // Bind form submission
            this.bindFormSubmission();
        },

        mountCardElement: function() {
            const container = document.getElementById('payeez-card-element');
            if (!container) return;

            // Create and mount card element
            this.cardElement = this.elements.create('card', {
                style: {
                    base: {
                        fontSize: '16px',
                        color: '#32325d',
                        '::placeholder': {
                            color: '#aab7c4'
                        }
                    },
                    invalid: {
                        color: '#dc3545',
                        iconColor: '#dc3545'
                    }
                }
            });

            this.cardElement.mount('#payeez-card-element');

            // Handle validation errors
            this.cardElement.on('change', function(event) {
                const errorElement = document.getElementById('payeez-card-errors');
                if (event.error) {
                    errorElement.textContent = event.error.message;
                } else {
                    errorElement.textContent = '';
                }
            });
        },

        bindFormSubmission: function() {
            const self = this;
            const form = $('form.checkout, form#order_review');

            form.on('checkout_place_order_payeez', function() {
                // Check if using saved card
                const savedToken = $('input[name="wc-payeez-payment-token"]:checked').val();
                if (savedToken && savedToken !== 'new') {
                    return true; // Let WooCommerce handle saved card
                }

                // Check if session already created
                if ($('#payeez-session-id').val()) {
                    return true;
                }

                // Create session and tokenize
                self.createSessionAndPay();
                return false;
            });
        },

        createSessionAndPay: async function() {
            const self = this;

            try {
                // Show loading
                this.blockForm();

                // Create session
                const sessionResponse = await $.ajax({
                    url: payeez_params.ajax_url,
                    method: 'POST',
                    data: {
                        action: 'payeez_create_session',
                        nonce: payeez_params.nonce,
                        save_card: $('#wc-payeez-new-payment-method').is(':checked') ? 'true' : 'false'
                    }
                });

                if (!sessionResponse.success) {
                    throw new Error(sessionResponse.data.message || payeez_params.i18n.payment_error);
                }

                this.sessionId = sessionResponse.data.sessionId;

                // Confirm payment with card element
                const result = await this.payeez.confirmPayment(this.sessionId, {
                    payment_method: {
                        card: this.cardElement
                    }
                });

                if (result.error) {
                    throw new Error(result.error.message || payeez_params.i18n.card_error);
                }

                // Set session ID and submit form
                $('#payeez-session-id').val(this.sessionId);
                if (result.paymentMethod) {
                    $('#payeez-payment-method-id').val(result.paymentMethod.id);
                }

                // Submit the form
                this.unblockForm();
                $('form.checkout, form#order_review').submit();

            } catch (error) {
                this.unblockForm();
                this.showError(error.message);
            }
        },

        blockForm: function() {
            $('form.checkout, form#order_review').block({
                message: null,
                overlayCSS: {
                    background: '#fff',
                    opacity: 0.6
                }
            });
        },

        unblockForm: function() {
            $('form.checkout, form#order_review').unblock();
        },

        showError: function(message) {
            const errorHtml = '<div class="woocommerce-error">' + message + '</div>';
            $('.woocommerce-notices-wrapper').first().html(errorHtml);
            $('html, body').animate({ scrollTop: 0 }, 300);
        }
    };

    $(document).ready(function() {
        // Initialize when payment method is selected
        $(document.body).on('updated_checkout payment_method_selected', function() {
            if ($('#payment_method_payeez').is(':checked')) {
                PayeezCheckout.init();
            }
        });

        // Initialize on page load if Payeez is selected
        if ($('#payment_method_payeez').is(':checked')) {
            PayeezCheckout.init();
        }
    });

})(jQuery);
