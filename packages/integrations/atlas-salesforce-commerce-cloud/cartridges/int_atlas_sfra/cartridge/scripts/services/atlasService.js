'use strict';

/**
 * Atlas Service Module
 * Handles all API communication with Atlas payment orchestration
 */

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Logger = require('dw/system/Logger').getLogger('atlas', 'AtlasService');

var ATLAS_API_URL = 'https://yssswpqpwrrglgroxwok.supabase.co/functions/v1';

/**
 * Get Atlas HTTP Service
 * @returns {dw.svc.HTTPService} The configured HTTP service
 */
function getService() {
    return LocalServiceRegistry.createService('atlas.http', {
        createRequest: function (svc, args) {
            var Site = require('dw/system/Site');
            var secretKey = Site.current.getCustomPreferenceValue('atlasSecretKey');

            svc.setRequestMethod(args.method || 'POST');
            svc.addHeader('Content-Type', 'application/json');
            svc.addHeader('Authorization', 'Bearer ' + secretKey);

            if (args.body) {
                return JSON.stringify(args.body);
            }
            return null;
        },
        parseResponse: function (svc, client) {
            return JSON.parse(client.text);
        },
        filterLogMessage: function (msg) {
            // Mask sensitive data in logs
            return msg.replace(/"card_number":\s*"[^"]+"/g, '"card_number": "****"')
                      .replace(/"cvv":\s*"[^"]+"/g, '"cvv": "***"');
        }
    });
}

/**
 * Create a payment session
 * @param {Object} params - Session parameters
 * @returns {Object} Result with sessionId and clientSecret
 */
function createSession(params) {
    var service = getService();
    service.setURL(ATLAS_API_URL + '/create-payment-session');

    try {
        var response = service.call({
            method: 'POST',
            body: params
        });

        if (response.ok) {
            var data = response.object;
            return {
                success: true,
                sessionId: data.sessionId,
                clientSecret: data.clientSecret
            };
        } else {
            Logger.error('Create session failed: ' + response.errorMessage);
            return {
                success: false,
                errorMessage: response.errorMessage
            };
        }
    } catch (e) {
        Logger.error('Create session exception: ' + e.message);
        return {
            success: false,
            errorMessage: e.message
        };
    }
}

/**
 * Confirm a payment
 * @param {string} sessionId - Session ID
 * @param {Object} paymentMethod - Payment method details
 * @returns {Object} Result with transaction details
 */
function confirmPayment(sessionId, paymentMethod) {
    var service = getService();
    service.setURL(ATLAS_API_URL + '/confirm-payment');

    try {
        var response = service.call({
            method: 'POST',
            body: {
                sessionId: sessionId,
                paymentMethod: paymentMethod
            }
        });

        if (response.ok) {
            var data = response.object;
            return {
                success: data.authorised,
                transactionId: data.id,
                status: data.status,
                requiresAction: data.requires_action,
                actionUrl: data.action_url
            };
        } else {
            return {
                success: false,
                errorMessage: response.errorMessage
            };
        }
    } catch (e) {
        Logger.error('Confirm payment exception: ' + e.message);
        return {
            success: false,
            errorMessage: e.message
        };
    }
}

/**
 * Get session status
 * @param {string} sessionId - Session ID
 * @returns {Object} Session details
 */
function getSession(sessionId) {
    var service = getService();
    service.setURL(ATLAS_API_URL + '/get-session?sessionId=' + sessionId);

    try {
        var response = service.call({
            method: 'GET'
        });

        if (response.ok) {
            var data = response.object;
            return {
                success: true,
                status: data.status,
                transactionId: data.transactionId
            };
        } else {
            return {
                success: false,
                errorMessage: response.errorMessage
            };
        }
    } catch (e) {
        Logger.error('Get session exception: ' + e.message);
        return {
            success: false,
            errorMessage: e.message
        };
    }
}

/**
 * Capture a payment
 * @param {string} transactionId - Transaction ID
 * @param {number} amount - Amount to capture
 * @param {string} currency - Currency code
 * @returns {Object} Capture result
 */
function capture(transactionId, amount, currency) {
    var service = getService();
    service.setURL(ATLAS_API_URL + '/capture-payment');

    try {
        var response = service.call({
            method: 'POST',
            body: {
                transactionId: transactionId,
                amount: amount,
                currency: currency
            }
        });

        if (response.ok) {
            return {
                success: true,
                captureId: response.object.id
            };
        } else {
            return {
                success: false,
                errorMessage: response.errorMessage
            };
        }
    } catch (e) {
        Logger.error('Capture exception: ' + e.message);
        return {
            success: false,
            errorMessage: e.message
        };
    }
}

/**
 * Refund a payment
 * @param {string} transactionId - Transaction ID
 * @param {number} amount - Amount to refund
 * @param {string} currency - Currency code
 * @param {string} reason - Refund reason
 * @returns {Object} Refund result
 */
function refund(transactionId, amount, currency, reason) {
    var service = getService();
    service.setURL(ATLAS_API_URL + '/refund-payment');

    try {
        var response = service.call({
            method: 'POST',
            body: {
                transactionId: transactionId,
                amount: amount,
                currency: currency,
                reason: reason
            }
        });

        if (response.ok) {
            return {
                success: true,
                refundId: response.object.id
            };
        } else {
            return {
                success: false,
                errorMessage: response.errorMessage
            };
        }
    } catch (e) {
        Logger.error('Refund exception: ' + e.message);
        return {
            success: false,
            errorMessage: e.message
        };
    }
}

/**
 * Charge a saved token
 * @param {string} token - Payment token
 * @param {number} amount - Amount to charge
 * @param {string} currency - Currency code
 * @param {string} reference - Order reference
 * @returns {Object} Charge result
 */
function chargeToken(token, amount, currency, reference) {
    var service = getService();
    service.setURL(ATLAS_API_URL + '/charge-token');

    try {
        var response = service.call({
            method: 'POST',
            body: {
                token: token,
                amount: amount,
                currency: currency,
                reference: reference
            }
        });

        if (response.ok) {
            var data = response.object;
            return {
                success: data.authorised,
                transactionId: data.id
            };
        } else {
            return {
                success: false,
                errorMessage: response.errorMessage
            };
        }
    } catch (e) {
        Logger.error('Charge token exception: ' + e.message);
        return {
            success: false,
            errorMessage: e.message
        };
    }
}

module.exports = {
    createSession: createSession,
    confirmPayment: confirmPayment,
    getSession: getSession,
    capture: capture,
    refund: refund,
    chargeToken: chargeToken
};
