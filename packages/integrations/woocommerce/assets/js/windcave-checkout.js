/**
 * Windcave WooCommerce Checkout JavaScript
 *
 * Handles Drop-in and Hosted Fields integration on the checkout page.
 */

(function($) {
    'use strict';

    var WindcaveCheckout = {
        // State
        initialized: false,
        sessionData: null,
        controller: null,
        isProcessing: false,

        /**
         * Initialize
         */
        init: function() {
            if (this.initialized) {
                return;
            }

            this.initialized = true;

            // Bind events
            this.bindEvents();

            // Initialize payment form when Windcave is selected
            if ($('#payment_method_windcave').is(':checked')) {
                this.initializePaymentForm();
            }
        },

        /**
         * Bind event handlers
         */
        bindEvents: function() {
            var self = this;

            // Payment method selection
            $('form.checkout, form#order_review').on('change', 'input[name="payment_method"]', function() {
                if ($(this).val() === 'windcave') {
                    self.initializePaymentForm();
                }
            });

            // Checkout form submission
            $('form.checkout').on('checkout_place_order_windcave', function() {
                return self.handleCheckoutSubmit();
            });

            // Pay for order form
            $('form#order_review').on('submit', function(e) {
                if ($('#payment_method_windcave').is(':checked')) {
                    return self.handleCheckoutSubmit();
                }
            });

            // Saved card selection
            $('form.checkout, form#order_review').on('change', 'input[name="wc-windcave-payment-token"]', function() {
                if ($(this).val() === 'new') {
                    $('#windcave-payment-form').show();
                    self.initializePaymentForm();
                } else {
                    $('#windcave-payment-form').hide();
                }
            });

            // Re-init on checkout update
            $(document.body).on('updated_checkout', function() {
                if ($('#payment_method_windcave').is(':checked')) {
                    self.resetForm();
                    self.initializePaymentForm();
                }
            });
        },

        /**
         * Reset form state
         */
        resetForm: function() {
            this.sessionData = null;
            this.controller = null;
            $('#windcave-session-id').val('');
            $('#windcave-payment-complete').val('');
        },

        /**
         * Initialize the payment form
         */
        initializePaymentForm: function() {
            var self = this;

            // Check if already have session
            if (this.sessionData) {
                return;
            }

            // Check if using saved card
            var savedToken = $('input[name="wc-windcave-payment-token"]:checked').val();
            if (savedToken && savedToken !== 'new') {
                return;
            }

            // Create session
            this.createSession().then(function(data) {
                self.sessionData = data;
                $('#windcave-session-id').val(data.sessionId);

                if (windcave_params.integration_mode === 'dropin') {
                    self.initDropIn(data);
                } else {
                    self.initHostedFields(data);
                }
            }).catch(function(error) {
                self.showError(error.message || windcave_params.i18n.session_error);
            });
        },

        /**
         * Create a payment session
         */
        createSession: function() {
            var self = this;

            return new Promise(function(resolve, reject) {
                // Determine if customer wants to save the card
                var saveCard = $('#wc-windcave-new-payment-method').is(':checked');

                // Check if this is the add payment method page
                var isAddPaymentMethod = $('form#add_payment_method').length > 0;

                $.ajax({
                    url: windcave_params.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'windcave_create_session',
                        nonce: windcave_params.nonce,
                        order_id: self.getOrderId(),
                        amount: self.getCartTotal(),
                        currency: windcave_params.currency,
                        save_card: saveCard ? 'true' : 'false',
                        is_add_payment_method: isAddPaymentMethod ? 'true' : 'false'
                    },
                    success: function(response) {
                        if (response.success) {
                            resolve(response.data);
                        } else {
                            reject(new Error(response.data.message));
                        }
                    },
                    error: function(xhr, status, error) {
                        reject(new Error(error));
                    }
                });
            });
        },

        /**
         * Initialize Drop-in
         */
        initDropIn: function(sessionData) {
            var self = this;

            if (typeof WindcavePayments === 'undefined' || !WindcavePayments.DropIn) {
                console.error('Windcave Drop-in library not loaded');
                return;
            }

            var options = {
                container: 'windcave-dropin-container',
                links: sessionData.links,
                env: windcave_params.environment,
                totalValue: this.getCartTotal().toString(),
                onSuccess: function(status) {
                    console.log('Windcave Drop-in onSuccess:', status);
                    var statusLower = (status || '').toLowerCase();

                    // 3DSecure means the iframe is still processing - just return
                    if (statusLower === '3dsecure') {
                        console.log('Windcave Drop-in: 3DSecure in progress, waiting...');
                        return;
                    }

                    // Only submit on "done"
                    if (statusLower === 'done') {
                        console.log('Windcave Drop-in: Payment complete');
                        // Close the drop-in
                        if (window.windcaveDropIn) {
                            window.windcaveDropIn.close();
                            window.windcaveDropIn = null;
                        }
                        $('#windcave-payment-complete').val('true');
                        self.submitCheckoutForm();
                    }
                },
                onError: function(stage, error) {
                    console.error('Windcave Drop-in error:', stage, error);
                    // Close the drop-in on error
                    if (window.windcaveDropIn) {
                        window.windcaveDropIn.close();
                        window.windcaveDropIn = null;
                    }
                    self.showError(windcave_params.i18n.payment_error);
                    self.isProcessing = false;
                },
                card: {
                    supportedCards: windcave_params.supported_cards,
                    hideCardholderName: false,
                    enableCardValidation: true,
                    enableCardFormatting: true
                },
                security: {
                    enableAutoComplete: true,
                    enableSecureForm: true,
                    enableFormValidation: true
                }
            };

            // Add mobile payment options
            if (windcave_params.enable_apple_pay || windcave_params.enable_google_pay) {
                options.mobilePayments = {
                    merchantName: windcave_params.store_name,
                    countryCode: windcave_params.country,
                    currencyCode: windcave_params.currency,
                    supportedNetworks: windcave_params.supported_cards,
                    isTest: windcave_params.is_test_mode
                };

                if (windcave_params.enable_apple_pay && windcave_params.apple_pay_merchant_id) {
                    options.mobilePayments.applePay = {
                        merchantId: windcave_params.apple_pay_merchant_id
                    };
                }

                if (windcave_params.enable_google_pay && windcave_params.google_pay_merchant_id) {
                    options.mobilePayments.googlePay = {
                        merchantId: windcave_params.google_pay_merchant_id
                    };
                }
            }

            // Store the drop-in instance globally so we can close it later
            window.windcaveDropIn = WindcavePayments.DropIn.create(options);
            self.controller = window.windcaveDropIn;
            console.log('Windcave Drop-in initialized');
        },

        /**
         * Initialize Hosted Fields
         */
        initHostedFields: function(sessionData) {
            var self = this;

            if (typeof WindcavePayments === 'undefined' || !WindcavePayments.HostedFields) {
                console.error('Windcave Hosted Fields library not loaded');
                return;
            }

            var options = {
                sessionId: sessionData.sessionId,
                env: windcave_params.environment,
                fields: {
                    CardNumber: {
                        container: 'windcave-card-number',
                        placeholder: '1234 5678 9012 3456',
                        supportedCards: windcave_params.supported_cards,
                        cardSchemaImagePlacement: 'right',
                        tabOrder: 1,
                        length: {
                            jumpToNextField: true
                        }
                    },
                    ExpirationDate: {
                        container: 'windcave-expiry',
                        placeholder: 'MM/YY',
                        tabOrder: 2,
                        length: {
                            jumpToNextField: true
                        }
                    },
                    CVV: {
                        container: 'windcave-cvv',
                        placeholder: '123',
                        tabOrder: 3,
                        length: {
                            jumpToNextField: true
                        }
                    },
                    CardholderName: {
                        container: 'windcave-cardholder',
                        placeholder: windcave_params.i18n.cardholder_label,
                        tabOrder: 4
                    }
                },
                styles: {
                    input: {
                        'font-size': '16px',
                        'font-family': 'inherit',
                        'color': '#333',
                        'padding': '10px'
                    },
                    'input-valid': {
                        'color': '#333'
                    },
                    'input-invalid': {
                        'color': '#dc3545'
                    }
                },
                threeDsIFrame: {
                    overlayBgColor: 'rgba(0, 0, 0, 0.5)',
                    dimensions: {
                        width: '500px',
                        height: '600px'
                    }
                }
            };

            // Controller is returned directly from create(), not passed to callback
            var controller = WindcavePayments.HostedFields.create(
                options,
                30, // timeout in seconds
                function() {
                    console.log('Windcave Hosted Fields initialized and ready');
                },
                function(error) {
                    console.error('Windcave Hosted Fields creation error:', error);
                    self.showError(windcave_params.i18n.session_error);
                }
            );

            // Store controller and submit URL
            self.controller = controller;
            self.sessionData.ajaxSubmitUrl = sessionData.ajaxSubmitUrl;
            console.log('Windcave Hosted Fields controller stored:', controller);
        },

        /**
         * Handle checkout form submission
         */
        handleCheckoutSubmit: function() {
            var self = this;

            // Check if using saved card
            var savedToken = $('input[name="wc-windcave-payment-token"]:checked').val();
            if (savedToken && savedToken !== 'new') {
                return true; // Let form submit normally
            }

            // Check if already processing
            if (this.isProcessing) {
                return false;
            }

            // Drop-in handles its own submission
            if (windcave_params.integration_mode === 'dropin') {
                // If payment complete, allow form submission
                if ($('#windcave-payment-complete').val() === 'true') {
                    return true;
                }
                // Otherwise, prevent submission and let Drop-in handle it
                return false;
            }

            // Hosted Fields - need to submit to Windcave first
            if (!this.controller || !this.sessionData || !this.sessionData.ajaxSubmitUrl) {
                this.showError(windcave_params.i18n.session_error);
                return false;
            }

            this.isProcessing = true;
            this.blockForm();

            this.controller.submit(
                this.sessionData.ajaxSubmitUrl,
                30, // timeout
                function(status) {
                    var statusLower = (status || '').toLowerCase();

                    // 3DSecure means challenge is still in progress - wait for done
                    if (statusLower === '3dsecure') {
                        console.log('Windcave Hosted Fields: 3DSecure in progress, waiting...');
                        return;
                    }

                    // Only proceed when payment is done
                    if (statusLower === 'done') {
                        $('#windcave-payment-complete').val('true');
                        self.submitCheckoutForm();
                    }
                },
                function(error) {
                    console.error('Windcave submit error:', error);
                    self.showError(windcave_params.i18n.payment_error);
                    self.isProcessing = false;
                    self.unblockForm();
                }
            );

            return false;
        },

        /**
         * Submit the checkout form
         */
        submitCheckoutForm: function() {
            var self = this;
            this.isProcessing = false;

            // Small delay to ensure WooCommerce is ready
            setTimeout(function() {
                // Unblock form first
                self.unblockForm();

                // For classic checkout - use native submit to avoid event handler recursion
                var checkoutForm = document.querySelector('form.checkout');
                if (checkoutForm) {
                    console.log('Windcave: Auto-submitting checkout form (native)');
                    checkoutForm.submit();
                    return;
                }

                // For pay for order - use native submit
                var orderForm = document.querySelector('form#order_review');
                if (orderForm) {
                    console.log('Windcave: Auto-submitting order review form (native)');
                    orderForm.submit();
                }
            }, 100);
        },

        /**
         * Show error message
         */
        showError: function(message) {
            var $container = $('.woocommerce-notices-wrapper').first();
            if (!$container.length) {
                $container = $('form.checkout').parent();
            }

            // Remove existing errors
            $('.woocommerce-error').remove();

            // Add error
            $container.prepend(
                '<ul class="woocommerce-error" role="alert">' +
                '<li>' + message + '</li>' +
                '</ul>'
            );

            // Scroll to error
            $('html, body').animate({
                scrollTop: $container.offset().top - 100
            }, 500);
        },

        /**
         * Block checkout form
         */
        blockForm: function() {
            var $form = $('form.checkout, form#order_review');
            $form.addClass('processing').block({
                message: null,
                overlayCSS: {
                    background: '#fff',
                    opacity: 0.6
                }
            });
        },

        /**
         * Unblock checkout form
         */
        unblockForm: function() {
            var $form = $('form.checkout, form#order_review');
            $form.removeClass('processing').unblock();
        },

        /**
         * Get order ID (for pay for order page)
         */
        getOrderId: function() {
            // First try hidden input
            var orderId = $('input[name="order_id"]').val();
            if (orderId) {
                return parseInt(orderId, 10) || 0;
            }

            // Try to get from URL (order-pay parameter only, NOT key which is a string)
            var urlParams = new URLSearchParams(window.location.search);
            orderId = urlParams.get('order-pay');
            if (orderId) {
                return parseInt(orderId, 10) || 0;
            }

            return 0;
        },

        /**
         * Get cart total
         */
        getCartTotal: function() {
            // Use server-side cart total (most reliable)
            if (windcave_params.cart_total) {
                return parseFloat(windcave_params.cart_total) || 0;
            }

            // Fallback: try to get from checkout DOM (less reliable due to locale formatting)
            var total = $('.order-total .woocommerce-Price-amount').first().text();
            if (total) {
                // Remove currency symbol, handle both comma and period as decimal separators
                total = total.replace(/[^0-9.,]/g, '');
                // If both . and , present, last one is decimal separator
                var lastComma = total.lastIndexOf(',');
                var lastPeriod = total.lastIndexOf('.');
                if (lastComma > lastPeriod) {
                    // European format: 1.234,56
                    total = total.replace(/\./g, '').replace(',', '.');
                } else if (lastPeriod > lastComma) {
                    // US format: 1,234.56
                    total = total.replace(/,/g, '');
                }
                return parseFloat(total) || 0;
            }
            return 0;
        }
    };

    // Initialize when document is ready
    $(document).ready(function() {
        WindcaveCheckout.init();
    });

    // Also initialize on checkout updated (for AJAX updates)
    $(document.body).on('updated_checkout', function() {
        if (!WindcaveCheckout.initialized) {
            WindcaveCheckout.init();
        }
    });

})(jQuery);
