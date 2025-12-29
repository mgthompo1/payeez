/**
 * Windcave Apple Pay Express
 *
 * Handles Apple Pay Express checkout on cart and mini-cart.
 */

(function($) {
    'use strict';

    var WindcaveApplePayExpress = {
        containerId: 'windcave-applepay-express-container',
        controller: null,
        sessionData: null,
        isInitialized: false,
        debugMode: false,

        /**
         * Log message (only in debug mode or for errors)
         */
        log: function(message, data, isError) {
            if (isError) {
                console.error('[Windcave Apple Pay] ' + message, data !== undefined ? data : '');
                return;
            }
            if (this.debugMode) {
                console.log('[Windcave Apple Pay] ' + message, data !== undefined ? data : '');
            }
        },

        /**
         * Initialize Apple Pay Express
         */
        init: function() {
            var self = this;

            // Check for debug mode from settings
            if (typeof windcaveApplePayExpressData !== 'undefined') {
                this.debugMode = windcaveApplePayExpressData.debugMode || false;
            }

            this.log('Initializing...');
            this.log('WindcavePayments library available', typeof WindcavePayments !== 'undefined');
            this.log('ApplePay module available', typeof WindcavePayments !== 'undefined' && typeof WindcavePayments.ApplePay !== 'undefined');
            this.log('Configuration data available', typeof windcaveApplePayExpressData !== 'undefined');

            // Wait for WindcavePayments to be available
            if (typeof WindcavePayments === 'undefined' || typeof WindcavePayments.ApplePay === 'undefined') {
                this.log('Waiting for WindcavePayments library...');
                setTimeout(function() {
                    self.init();
                }, 100);
                return;
            }

            // Check if container exists
            var container = document.getElementById(this.containerId);
            this.log('Looking for container #' + this.containerId);
            this.log('Container found', !!container);

            if (!container) {
                this.log('No container found - checking mini-cart selectors...');
                // Log available elements for debugging
                var miniCartElements = document.querySelectorAll('[class*="mini-cart"]');
                this.log('Elements with "mini-cart" in class', miniCartElements.length);
                return;
            }

            // Prevent double initialization
            if (this.isInitialized) {
                this.log('Already initialized, skipping');
                return;
            }

            this.log('Proceeding with setup');
            this.isInitialized = true;
            this.setupApplePay();
        },

        /**
         * Setup Apple Pay button
         */
        setupApplePay: function() {
            var self = this;

            // First check if we have the required data
            if (typeof windcaveApplePayExpressData === 'undefined') {
                this.log('Missing configuration data - ensure Apple Pay Express is enabled in settings', null, true);
                return;
            }

            this.log('Configuration:', {
                merchantId: windcaveApplePayExpressData.merchantId ? '***configured***' : 'MISSING',
                storeName: windcaveApplePayExpressData.storeName,
                countryCode: windcaveApplePayExpressData.countryCode,
                currencyCode: windcaveApplePayExpressData.currencyCode,
                cartTotal: windcaveApplePayExpressData.cartTotal,
                isTestMode: windcaveApplePayExpressData.isTestMode
            });

            var options = {
                container: this.containerId,
                url: 'https://sec.windcave.com/mh', // Placeholder, updated on validate merchant
                mid: windcaveApplePayExpressData.merchantId,
                displayName: windcaveApplePayExpressData.storeName,
                countryCode: windcaveApplePayExpressData.countryCode,
                currencyCode: windcaveApplePayExpressData.currencyCode,
                supportedNetworks: windcaveApplePayExpressData.supportedNetworks || ['visa', 'masterCard', 'amex'],
                requiredContactDetails: ['billing'],
                button: {
                    type: 'buy',
                    style: 'black',
                    locale: 'en-US'
                },
                total: {
                    amount: windcaveApplePayExpressData.cartTotal,
                    label: windcaveApplePayExpressData.storeName
                }
            };

            // Create Apple Pay controller
            this.controller = WindcavePayments.ApplePay.create(
                options,
                // onSuccess
                function(state, finalUrl, outcomeNotificationFunction) {
                    self.log('onSuccess callback, state=' + state);
                    var stateLower = (state || '').toLowerCase();

                    if (stateLower === 'done') {
                        self.log('Payment completed, processing order...');
                        self.processPayment(outcomeNotificationFunction);
                        return;
                    }

                    if (stateLower === '3dsecure') {
                        self.log('3DSecure verification in progress');
                        return true;
                    }
                },
                // onError
                function(stage, errorMessage) {
                    self.log('Error at stage: ' + stage, errorMessage, true);
                    self.showError(self.getErrorMessage(stage, errorMessage));
                },
                // onPaymentStart
                function(paymentMethod, next, cancel) {
                    self.log('Payment starting with method: ' + paymentMethod);
                    next();
                },
                // onValidateMerchant
                function(next, cancel) {
                    self.log('Validating merchant with Windcave...');
                    self.createSession(function(success) {
                        if (success) {
                            self.log('Session created, Apple Pay URL obtained');
                            options.url = self.sessionData.applePayUrl;
                            next();
                        } else {
                            self.log('Session creation failed', null, true);
                            cancel();
                        }
                    });
                }
            );

            // Check if Apple Pay is available
            this.log('Checking Apple Pay availability...');
            this.controller.isAvailable(5000)
                .then(function() {
                    self.log('Apple Pay is available on this device');
                    self.controller.attach();
                    self.log('Button attached to container');
                })
                .catch(function(error) {
                    self.log('Apple Pay not available', {
                        reason: error || 'Unknown',
                        possibleCauses: [
                            'Device/browser does not support Apple Pay',
                            'No cards configured in Apple Wallet',
                            'Domain not verified with Apple',
                            'Merchant ID not configured correctly'
                        ]
                    }, true);
                    var container = document.getElementById(self.containerId);
                    if (container) {
                        container.style.display = 'none';
                    }
                });
        },

        /**
         * Get user-friendly error message
         */
        getErrorMessage: function(stage, errorMessage) {
            var messages = {
                'setup': 'Apple Pay could not be initialized. Please try again.',
                'validateMerchant': 'Could not verify merchant. Please contact support.',
                'payment': 'Payment could not be processed. Please try again.',
                'network': 'Network error. Please check your connection and try again.'
            };
            return messages[stage] || errorMessage || 'Apple Pay payment failed. Please try again.';
        },

        /**
         * Create Windcave session for Apple Pay
         */
        createSession: function(callback) {
            var self = this;

            this.log('Creating session via AJAX...');

            $.ajax({
                url: windcaveApplePayExpressData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'windcave_create_express_session',
                    nonce: windcaveApplePayExpressData.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.sessionData = response.data;
                        self.log('Session created successfully', {
                            sessionId: self.sessionData.sessionId,
                            hasApplePayUrl: !!self.sessionData.applePayUrl
                        });
                        callback(true);
                    } else {
                        self.log('Session creation failed', response.data, true);
                        self.showError(response.data.message || 'Failed to initialize payment.');
                        callback(false);
                    }
                },
                error: function(xhr, status, error) {
                    self.log('AJAX error during session creation', {
                        status: status,
                        error: error,
                        responseText: xhr.responseText
                    }, true);
                    self.showError('Failed to connect to payment server. Please try again.');
                    callback(false);
                }
            });
        },

        /**
         * Process the payment after Apple Pay completes
         */
        processPayment: function(outcomeNotificationFunction) {
            var self = this;

            if (!this.sessionData || !this.sessionData.sessionId) {
                this.log('No session data available for processing', null, true);
                if (outcomeNotificationFunction) {
                    outcomeNotificationFunction(false);
                }
                return;
            }

            this.log('Processing payment for session: ' + this.sessionData.sessionId);

            $.ajax({
                url: windcaveApplePayExpressData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'windcave_process_express_payment',
                    nonce: windcaveApplePayExpressData.nonce,
                    session_id: this.sessionData.sessionId
                },
                success: function(response) {
                    if (response.success && response.data.redirect) {
                        self.log('Payment successful! Redirecting to order confirmation...');
                        if (outcomeNotificationFunction) {
                            outcomeNotificationFunction(true);
                        }
                        setTimeout(function() {
                            window.location.href = response.data.redirect;
                        }, 500);
                    } else {
                        self.log('Payment processing failed', response.data, true);
                        if (outcomeNotificationFunction) {
                            outcomeNotificationFunction(false);
                        }
                        self.showError(response.data.message || 'Payment processing failed.');
                    }
                },
                error: function(xhr, status, error) {
                    self.log('AJAX error during payment processing', {
                        status: status,
                        error: error
                    }, true);
                    if (outcomeNotificationFunction) {
                        outcomeNotificationFunction(false);
                    }
                    self.showError('Failed to process payment. Please try again.');
                }
            });
        },

        /**
         * Show error message
         */
        showError: function(message) {
            // Try to use WooCommerce notices if available
            if (typeof wc_add_to_cart_params !== 'undefined' && $('.woocommerce-notices-wrapper').length) {
                $('.woocommerce-notices-wrapper').html(
                    '<div class="woocommerce-error">' + message + '</div>'
                );
                $('html, body').animate({
                    scrollTop: $('.woocommerce-notices-wrapper').offset().top - 100
                }, 500);
            } else {
                alert(message);
            }
        }
    };

    // Initialize when DOM is ready
    $(document).ready(function() {
        WindcaveApplePayExpress.init();
    });

    // Re-initialize when cart is updated (for mini-cart)
    $(document.body).on('wc_fragments_refreshed wc_fragments_loaded added_to_cart', function() {
        console.log('Apple Pay Express: Cart fragments event fired, reinitializing...');
        WindcaveApplePayExpress.isInitialized = false;
        WindcaveApplePayExpress.controller = null;
        WindcaveApplePayExpress.sessionData = null;
        WindcaveApplePayExpress.init();
    });

    // Watch for mini-cart to appear and inject container if needed
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                // Check if our container already exists
                var container = document.getElementById('windcave-applepay-express-container');
                if (container && !WindcaveApplePayExpress.isInitialized) {
                    console.log('Apple Pay Express: Container detected via MutationObserver');
                    WindcaveApplePayExpress.init();
                    return;
                }

                // For WooCommerce Blocks mini-cart, inject container if not present
                var blocksMiniCart = document.querySelector(
                    '.wc-block-mini-cart__footer-actions, ' +
                    '.wp-block-woocommerce-mini-cart-footer-block, ' +
                    '.wc-block-mini-cart__footer, ' +
                    '.wc-block-mini-cart-footer-block, ' +
                    '.wc-block-components-drawer__screen-primary .wc-block-mini-cart__footer, ' +
                    '.wc-block-mini-cart-contents .wc-block-mini-cart__footer'
                );
                if (blocksMiniCart && !document.getElementById('windcave-applepay-express-container')) {
                    console.log('Apple Pay Express: Injecting container into Blocks mini-cart via MutationObserver');
                    var newContainer = document.createElement('div');
                    newContainer.id = 'windcave-applepay-express-container';
                    newContainer.className = 'windcave-applepay-express';
                    newContainer.style.marginBottom = '10px';
                    newContainer.style.width = '100%';
                    blocksMiniCart.insertBefore(newContainer, blocksMiniCart.firstChild);
                    WindcaveApplePayExpress.isInitialized = false;
                    WindcaveApplePayExpress.init();
                }
            }
        });
    });

    // Start observing the document body for added nodes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Also check periodically for Blocks mini-cart (backup for complex DOM updates)
    setInterval(function() {
        var container = document.getElementById('windcave-applepay-express-container');

        // Extended selectors for different WooCommerce Blocks versions and mobile
        var blocksMiniCart = document.querySelector(
            '.wc-block-mini-cart__footer-actions, ' +
            '.wp-block-woocommerce-mini-cart-footer-block, ' +
            '.wc-block-mini-cart__footer, ' +
            '.wc-block-mini-cart-footer-block, ' +
            '.wc-block-components-drawer__screen-primary .wc-block-mini-cart__footer, ' +
            '.wc-block-mini-cart-contents .wc-block-mini-cart__footer'
        );

        if (blocksMiniCart && !container) {
            console.log('Apple Pay Express: Injecting container via interval check into:', blocksMiniCart.className);
            var newContainer = document.createElement('div');
            newContainer.id = 'windcave-applepay-express-container';
            newContainer.className = 'windcave-applepay-express';
            newContainer.style.marginBottom = '10px';
            newContainer.style.width = '100%';
            blocksMiniCart.insertBefore(newContainer, blocksMiniCart.firstChild);
            WindcaveApplePayExpress.isInitialized = false;
            WindcaveApplePayExpress.init();
        }

        // Also reinit if container exists but Apple Pay not initialized
        if (container && !WindcaveApplePayExpress.isInitialized && !WindcaveApplePayExpress.controller) {
            console.log('Apple Pay Express: Container exists, reinitializing...');
            WindcaveApplePayExpress.init();
        }
    }, 500);

})(jQuery);
