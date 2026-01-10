'use strict';

/**
 * Atlas Webhook Handler
 * Processes async webhook notifications from Atlas
 */

var Logger = require('dw/system/Logger').getLogger('atlas', 'AtlasWebhook');
var Site = require('dw/system/Site');

/**
 * Verify webhook signature
 * @param {string} payload - Raw payload
 * @param {string} signature - Signature header
 * @returns {boolean} True if valid
 */
function verifySignature(payload, signature) {
    if (!signature) {
        return false;
    }

    var Mac = require('dw/crypto/Mac');
    var Encoding = require('dw/crypto/Encoding');

    var webhookSecret = Site.current.getCustomPreferenceValue('atlasWebhookSecret');
    var mac = new Mac(Mac.HMAC_SHA_256);
    var computedSignature = Encoding.toHex(mac.digest(payload, webhookSecret));

    return computedSignature === signature;
}

/**
 * Handle webhook event
 * @param {Object} event - Event object
 */
function handleEvent(event) {
    Logger.info('Processing webhook event: ' + event.type);

    switch (event.type) {
        case 'payment.completed':
            handlePaymentCompleted(event.data);
            break;
        case 'payment.failed':
            handlePaymentFailed(event.data);
            break;
        case 'payment.captured':
            handlePaymentCaptured(event.data);
            break;
        case 'payment.refunded':
            handlePaymentRefunded(event.data);
            break;
        case 'payment.voided':
            handlePaymentVoided(event.data);
            break;
        case '3ds.completed':
            handle3DSCompleted(event.data);
            break;
        default:
            Logger.info('Unhandled event type: ' + event.type);
    }
}

/**
 * Handle payment completed
 * @param {Object} data - Event data
 */
function handlePaymentCompleted(data) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');

    var order = findOrderBySessionId(data.sessionId);

    if (order) {
        Transaction.wrap(function () {
            order.custom.atlasPaymentStatus = 'completed';
            order.custom.atlasTransactionId = data.transactionId;

            if (order.status.value === require('dw/order/Order').ORDER_STATUS_CREATED) {
                OrderMgr.placeOrder(order);
            }
        });

        Logger.info('Payment completed for order: ' + order.orderNo);
    }
}

/**
 * Handle payment failed
 * @param {Object} data - Event data
 */
function handlePaymentFailed(data) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');

    var order = findOrderBySessionId(data.sessionId);

    if (order) {
        Transaction.wrap(function () {
            order.custom.atlasPaymentStatus = 'failed';
            order.custom.atlasErrorMessage = data.errorMessage || 'Payment declined';

            if (order.status.value === require('dw/order/Order').ORDER_STATUS_CREATED) {
                OrderMgr.failOrder(order, true);
            }
        });

        Logger.info('Payment failed for order: ' + order.orderNo);
    }
}

/**
 * Handle payment captured
 * @param {Object} data - Event data
 */
function handlePaymentCaptured(data) {
    var Transaction = require('dw/system/Transaction');

    var order = findOrderByTransactionId(data.transactionId);

    if (order) {
        Transaction.wrap(function () {
            order.custom.atlasCaptureId = data.captureId;
            order.custom.atlasCapturedAmount = data.amount;
            order.setPaymentStatus(require('dw/order/Order').PAYMENT_STATUS_PAID);
        });

        Logger.info('Payment captured for order: ' + order.orderNo);
    }
}

/**
 * Handle payment refunded
 * @param {Object} data - Event data
 */
function handlePaymentRefunded(data) {
    var Transaction = require('dw/system/Transaction');

    var order = findOrderByTransactionId(data.transactionId);

    if (order) {
        Transaction.wrap(function () {
            order.custom.atlasRefundId = data.refundId;
            order.custom.atlasRefundedAmount = (order.custom.atlasRefundedAmount || 0) + data.amount;

            // Check if fully refunded
            if (order.custom.atlasRefundedAmount >= order.totalGrossPrice.value) {
                order.custom.atlasPaymentStatus = 'refunded';
            } else {
                order.custom.atlasPaymentStatus = 'partially_refunded';
            }
        });

        Logger.info('Payment refunded for order: ' + order.orderNo);
    }
}

/**
 * Handle payment voided
 * @param {Object} data - Event data
 */
function handlePaymentVoided(data) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');

    var order = findOrderByTransactionId(data.transactionId);

    if (order) {
        Transaction.wrap(function () {
            order.custom.atlasPaymentStatus = 'voided';
            OrderMgr.cancelOrder(order);
        });

        Logger.info('Payment voided for order: ' + order.orderNo);
    }
}

/**
 * Handle 3DS completed
 * @param {Object} data - Event data
 */
function handle3DSCompleted(data) {
    Logger.info('3DS completed for session: ' + data.sessionId + ', result: ' + data.result);
}

/**
 * Find order by session ID
 * @param {string} sessionId - Atlas session ID
 * @returns {dw.order.Order|null} Order or null
 */
function findOrderBySessionId(sessionId) {
    var OrderMgr = require('dw/order/OrderMgr');

    var ordersIterator = OrderMgr.searchOrders(
        'custom.atlasSessionId = {0}',
        'creationDate desc',
        sessionId
    );

    var order = null;
    if (ordersIterator.hasNext()) {
        order = ordersIterator.next();
    }
    ordersIterator.close();

    return order;
}

/**
 * Find order by transaction ID
 * @param {string} transactionId - Atlas transaction ID
 * @returns {dw.order.Order|null} Order or null
 */
function findOrderByTransactionId(transactionId) {
    var OrderMgr = require('dw/order/OrderMgr');

    var ordersIterator = OrderMgr.searchOrders(
        'custom.atlasTransactionId = {0}',
        'creationDate desc',
        transactionId
    );

    var order = null;
    if (ordersIterator.hasNext()) {
        order = ordersIterator.next();
    }
    ordersIterator.close();

    return order;
}

module.exports = {
    verifySignature: verifySignature,
    handleEvent: handleEvent
};
