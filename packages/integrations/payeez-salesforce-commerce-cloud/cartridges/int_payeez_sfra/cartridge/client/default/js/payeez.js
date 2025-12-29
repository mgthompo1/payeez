'use strict';

/**
 * Payeez Client-Side Module
 * Handles card element mounting and payment flow
 */

var PayeezClient = {
    payeez: null,
    elements: null,
    cardElement: null,
    config: null,

    /**
     * Initialize Payeez
     * @param {Object} config - Configuration from server
     */
    init: function (config) {
        this.config = config;

        if (typeof Payeez === 'undefined') {
            console.error('Payeez SDK not loaded');
            return;
        }

        this.payeez = Payeez(config.publicKey, {
            environment: config.isTestMode ? 'sandbox' : 'production'
        });

        this.elements = this.payeez.elements();
        this.mountCardElement();
        this.setupWalletButtons();
    },

    /**
     * Mount the card element
     */
    mountCardElement: function () {
        var container = document.getElementById('payeez-card-element');
        if (!container) return;

        this.cardElement = this.elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#32325d',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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

        this.cardElement.on('change', function (event) {
            var errorElement = document.getElementById('payeez-card-errors');
            if (errorElement) {
                errorElement.textContent = event.error ? event.error.message : '';
            }
        });
    },

    /**
     * Setup wallet buttons (Apple Pay, Google Pay)
     */
    setupWalletButtons: function () {
        var self = this;

        // Apple Pay
        if (this.config.applePayEnabled && window.ApplePaySession) {
            var applePayBtn = document.getElementById('payeez-apple-pay-button');
            if (applePayBtn) {
                applePayBtn.style.display = 'block';
                applePayBtn.addEventListener('click', function () {
                    self.initiateApplePay();
                });
            }
        }

        // Google Pay
        if (this.config.googlePayEnabled) {
            var googlePayBtn = document.getElementById('payeez-google-pay-button');
            if (googlePayBtn) {
                self.checkGooglePayAvailability().then(function (available) {
                    if (available) {
                        googlePayBtn.style.display = 'block';
                        googlePayBtn.addEventListener('click', function () {
                            self.initiateGooglePay();
                        });
                    }
                });
            }
        }
    },

    /**
     * Create payment session
     * @returns {Promise} Session result
     */
    createSession: function () {
        return new Promise(function (resolve, reject) {
            $.ajax({
                url: window.payeezConfig.createSessionUrl,
                method: 'POST',
                data: {
                    csrf_token: $('[name="csrf_token"]').val()
                },
                success: function (response) {
                    if (response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error || 'Failed to create session'));
                    }
                },
                error: function (xhr, status, error) {
                    reject(new Error(error || 'Network error'));
                }
            });
        });
    },

    /**
     * Process card payment
     * @returns {Promise} Payment result
     */
    processCardPayment: function () {
        var self = this;

        return this.createSession().then(function (sessionData) {
            return self.payeez.confirmPayment(sessionData.sessionId, {
                payment_method: {
                    card: self.cardElement
                }
            });
        }).then(function (result) {
            if (result.error) {
                throw new Error(result.error.message);
            }

            if (result.requiresAction) {
                // Handle 3DS
                return self.handle3DS(result);
            }

            return result;
        });
    },

    /**
     * Handle 3DS authentication
     * @param {Object} result - Payment result requiring action
     * @returns {Promise} 3DS result
     */
    handle3DS: function (result) {
        var self = this;

        return new Promise(function (resolve, reject) {
            self.payeez.handleNextAction(result).then(function (actionResult) {
                if (actionResult.error) {
                    reject(new Error(actionResult.error.message));
                } else {
                    resolve(actionResult);
                }
            });
        });
    },

    /**
     * Process saved card payment
     * @param {string} tokenId - Saved card token ID
     * @returns {Promise} Payment result
     */
    processSavedCardPayment: function (tokenId) {
        var self = this;

        return this.createSession().then(function (sessionData) {
            return self.payeez.confirmPayment(sessionData.sessionId, {
                payment_method: tokenId
            });
        });
    },

    /**
     * Check Google Pay availability
     * @returns {Promise<boolean>}
     */
    checkGooglePayAvailability: function () {
        if (!this.payeez) return Promise.resolve(false);

        return this.payeez.isGooglePayAvailable().catch(function () {
            return false;
        });
    },

    /**
     * Initiate Apple Pay
     */
    initiateApplePay: function () {
        var self = this;

        this.createSession().then(function (sessionData) {
            return self.payeez.confirmPayment(sessionData.sessionId, {
                payment_method: 'apple_pay'
            });
        }).then(function (result) {
            if (result.error) {
                self.showError(result.error.message);
            } else {
                self.onPaymentSuccess(result);
            }
        }).catch(function (error) {
            self.showError(error.message);
        });
    },

    /**
     * Initiate Google Pay
     */
    initiateGooglePay: function () {
        var self = this;

        this.createSession().then(function (sessionData) {
            return self.payeez.confirmPayment(sessionData.sessionId, {
                payment_method: 'google_pay'
            });
        }).then(function (result) {
            if (result.error) {
                self.showError(result.error.message);
            } else {
                self.onPaymentSuccess(result);
            }
        }).catch(function (error) {
            self.showError(error.message);
        });
    },

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError: function (message) {
        var errorContainer = document.getElementById('payeez-payment-errors');
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
        }
    },

    /**
     * Clear error message
     */
    clearError: function () {
        var errorContainer = document.getElementById('payeez-payment-errors');
        if (errorContainer) {
            errorContainer.textContent = '';
            errorContainer.style.display = 'none';
        }
    },

    /**
     * Handle successful payment
     * @param {Object} result - Payment result
     */
    onPaymentSuccess: function (result) {
        // Trigger form submission with payment data
        var form = document.querySelector('.submit-payment');
        if (form) {
            var sessionInput = document.createElement('input');
            sessionInput.type = 'hidden';
            sessionInput.name = 'payeezSessionId';
            sessionInput.value = result.sessionId;
            form.appendChild(sessionInput);

            var transactionInput = document.createElement('input');
            transactionInput.type = 'hidden';
            transactionInput.name = 'payeezTransactionId';
            transactionInput.value = result.transactionId;
            form.appendChild(transactionInput);

            // Submit the form
            form.submit();
        }
    }
};

// Export for module bundlers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PayeezClient;
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', function () {
    if (window.payeezConfig) {
        PayeezClient.init(window.payeezConfig);
    }
});
