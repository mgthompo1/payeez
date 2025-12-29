/**
 * Windcave Google Pay Express
 *
 * Handles Google Pay Express checkout on cart and mini-cart.
 */

(function($) {
    'use strict';

    var WindcaveGooglePayExpress = {
        containerId: 'windcave-googlepay-express-container',
        controller: null,
        sessionData: null,
        isInitialized: false,

        /**
         * Initialize Google Pay Express
         */
        init: function() {
            var self = this;

            console.log('Google Pay Express: init() called');
            console.log('Google Pay Express: WindcavePayments available?', typeof WindcavePayments !== 'undefined');
            console.log('Google Pay Express: WindcavePayments.GooglePay available?', typeof WindcavePayments !== 'undefined' && typeof WindcavePayments.GooglePay !== 'undefined');
            console.log('Google Pay Express: windcaveGooglePayExpressData available?', typeof windcaveGooglePayExpressData !== 'undefined');

            // Wait for WindcavePayments to be available
            if (typeof WindcavePayments === 'undefined' || typeof WindcavePayments.GooglePay === 'undefined') {
                console.log('Google Pay Express: Waiting for WindcavePayments library...');
                setTimeout(function() {
                    self.init();
                }, 100);
                return;
            }

            // Check if container exists
            var container = document.getElementById(this.containerId);
            console.log('Google Pay Express: Looking for container #' + this.containerId);
            console.log('Google Pay Express: Container found?', !!container);

            if (!container) {
                console.log('Google Pay Express: No container found, exiting');
                return;
            }

            // Prevent double initialization
            if (this.isInitialized) {
                console.log('Google Pay Express: Already initialized, skipping');
                return;
            }

            console.log('Google Pay Express: Proceeding with setup');
            this.isInitialized = true;
            this.setupGooglePay();
        },

        /**
         * Setup Google Pay button
         */
        setupGooglePay: function() {
            var self = this;

            // First check if we have the required data
            if (typeof windcaveGooglePayExpressData === 'undefined') {
                console.error('Google Pay Express: Missing configuration data');
                return;
            }

            var options = {
                container: this.containerId,
                url: 'https://sec.windcave.com/mh', // Placeholder, updated on session create
                mid: windcaveGooglePayExpressData.merchantId,
                googleMid: windcaveGooglePayExpressData.googleMerchantId || '00000000',
                displayName: windcaveGooglePayExpressData.storeName,
                countryCode: windcaveGooglePayExpressData.countryCode,
                currencyCode: windcaveGooglePayExpressData.currencyCode,
                supportedNetworks: windcaveGooglePayExpressData.supportedNetworks || ['visa', 'masterCard', 'amex'],
                supportedAuthMethods: ['pan_only', 'cryptogram_3ds'],
                isTest: windcaveGooglePayExpressData.isTestMode,
                button: {
                    type: 'buy',
                    style: 'black',
                    locale: 'en'
                },
                total: {
                    amount: windcaveGooglePayExpressData.cartTotal,
                    label: windcaveGooglePayExpressData.storeName
                }
            };

            // Create Google Pay controller
            this.controller = WindcavePayments.GooglePay.create(
                options,
                // onSuccess
                function(state) {
                    console.log('Google Pay Express: onSuccess, state=' + state);
                    var stateLower = (state || '').toLowerCase();

                    if (stateLower === 'done') {
                        // Payment completed, process the order
                        self.processPayment();
                        return;
                    }

                    if (stateLower === '3dsecure') {
                        console.log('Google Pay Express: 3DSecure in progress');
                        return true; // Continue with 3DS
                    }
                },
                // onError
                function(stage, errorMessage) {
                    console.error('Google Pay Express: Error at stage=' + stage + ', message=' + errorMessage);
                    self.showError(errorMessage || 'Google Pay payment failed. Please try again.');
                },
                // onPaymentStart
                function(paymentMethod, next, cancel) {
                    console.log('Google Pay Express: Payment starting');
                    // Create session before proceeding
                    self.createSession(function(success) {
                        if (success) {
                            // Update the options with the real URL
                            options.url = self.sessionData.googlePayUrl;
                            next();
                        } else {
                            cancel();
                        }
                    });
                }
            );

            // Check if Google Pay is available
            this.controller.isAvailable(5000)
                .then(function() {
                    console.log('Google Pay Express: Available, attaching button');
                    self.controller.attach();
                })
                .catch(function() {
                    console.log('Google Pay Express: Not available');
                    var container = document.getElementById(self.containerId);
                    if (container) {
                        container.style.display = 'none';
                    }
                });
        },

        /**
         * Create Windcave session for Google Pay
         */
        createSession: function(callback) {
            var self = this;

            $.ajax({
                url: windcaveGooglePayExpressData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'windcave_create_googlepay_express_session',
                    nonce: windcaveGooglePayExpressData.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.sessionData = response.data;
                        console.log('Google Pay Express: Session created, ID=' + self.sessionData.sessionId);
                        callback(true);
                    } else {
                        console.error('Google Pay Express: Session creation failed', response.data);
                        self.showError(response.data.message || 'Failed to initialize payment.');
                        callback(false);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Google Pay Express: AJAX error', error);
                    self.showError('Failed to connect to payment server.');
                    callback(false);
                }
            });
        },

        /**
         * Process the payment after Google Pay completes
         */
        processPayment: function() {
            var self = this;

            if (!this.sessionData || !this.sessionData.sessionId) {
                console.error('Google Pay Express: No session data for processing');
                return;
            }

            $.ajax({
                url: windcaveGooglePayExpressData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'windcave_process_googlepay_express_payment',
                    nonce: windcaveGooglePayExpressData.nonce,
                    session_id: this.sessionData.sessionId
                },
                success: function(response) {
                    if (response.success && response.data.redirect) {
                        console.log('Google Pay Express: Payment successful, redirecting');
                        // Redirect to thank you page
                        window.location.href = response.data.redirect;
                    } else {
                        console.error('Google Pay Express: Payment processing failed', response.data);
                        self.showError(response.data.message || 'Payment processing failed.');
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Google Pay Express: AJAX error during processing', error);
                    self.showError('Failed to process payment.');
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
        WindcaveGooglePayExpress.init();
    });

    // Re-initialize when cart is updated (for mini-cart)
    $(document.body).on('wc_fragments_refreshed wc_fragments_loaded added_to_cart', function() {
        console.log('Google Pay Express: Cart fragments event fired, reinitializing...');
        WindcaveGooglePayExpress.isInitialized = false;
        WindcaveGooglePayExpress.controller = null;
        WindcaveGooglePayExpress.sessionData = null;
        WindcaveGooglePayExpress.init();
    });

    // Watch for mini-cart to appear and inject container if needed
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                // Check if our container already exists
                var container = document.getElementById('windcave-googlepay-express-container');
                if (container && !WindcaveGooglePayExpress.isInitialized) {
                    console.log('Google Pay Express: Container detected via MutationObserver');
                    WindcaveGooglePayExpress.init();
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
                if (blocksMiniCart && !document.getElementById('windcave-googlepay-express-container')) {
                    // Check if Apple Pay container exists, add after it
                    var applePayContainer = document.getElementById('windcave-applepay-express-container');
                    console.log('Google Pay Express: Injecting container into Blocks mini-cart via MutationObserver');
                    var newContainer = document.createElement('div');
                    newContainer.id = 'windcave-googlepay-express-container';
                    newContainer.className = 'windcave-googlepay-express';
                    newContainer.style.marginBottom = '10px';
                    newContainer.style.width = '100%';
                    if (applePayContainer) {
                        applePayContainer.parentNode.insertBefore(newContainer, applePayContainer.nextSibling);
                    } else {
                        blocksMiniCart.insertBefore(newContainer, blocksMiniCart.firstChild);
                    }
                    WindcaveGooglePayExpress.isInitialized = false;
                    WindcaveGooglePayExpress.init();
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
        var container = document.getElementById('windcave-googlepay-express-container');

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
            var applePayContainer = document.getElementById('windcave-applepay-express-container');
            console.log('Google Pay Express: Injecting container via interval check into:', blocksMiniCart.className);
            var newContainer = document.createElement('div');
            newContainer.id = 'windcave-googlepay-express-container';
            newContainer.className = 'windcave-googlepay-express';
            newContainer.style.marginBottom = '10px';
            newContainer.style.width = '100%';
            if (applePayContainer) {
                applePayContainer.parentNode.insertBefore(newContainer, applePayContainer.nextSibling);
            } else {
                blocksMiniCart.insertBefore(newContainer, blocksMiniCart.firstChild);
            }
            WindcaveGooglePayExpress.isInitialized = false;
            WindcaveGooglePayExpress.init();
        }

        // Also reinit if container exists but Google Pay not initialized
        if (container && !WindcaveGooglePayExpress.isInitialized && !WindcaveGooglePayExpress.controller) {
            console.log('Google Pay Express: Container exists, reinitializing...');
            WindcaveGooglePayExpress.init();
        }
    }, 500);

})(jQuery);
