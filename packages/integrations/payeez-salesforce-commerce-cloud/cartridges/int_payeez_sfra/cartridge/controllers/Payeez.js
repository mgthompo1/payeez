'use strict';

/**
 * Payeez Controller
 * Handles payment session creation, confirmation, and webhooks
 */

var server = require('server');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

var PayeezService = require('*/cartridge/scripts/services/payeezService');
var PayeezHelper = require('*/cartridge/scripts/helpers/payeezHelper');

/**
 * Create payment session
 */
server.post('CreateSession', server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Resource = require('dw/web/Resource');

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.json({
            success: false,
            error: Resource.msg('error.basket.empty', 'payeez', null)
        });
        return next();
    }

    try {
        var sessionParams = PayeezHelper.buildSessionParams(currentBasket);
        var result = PayeezService.createSession(sessionParams);

        if (result.success) {
            res.json({
                success: true,
                sessionId: result.sessionId,
                clientSecret: result.clientSecret
            });
        } else {
            res.json({
                success: false,
                error: result.errorMessage || Resource.msg('error.session.create', 'payeez', null)
            });
        }
    } catch (e) {
        var Logger = require('dw/system/Logger');
        Logger.error('Payeez CreateSession error: ' + e.message);

        res.json({
            success: false,
            error: Resource.msg('error.technical', 'payeez', null)
        });
    }

    return next();
});

/**
 * Confirm payment after client-side card entry
 */
server.post('ConfirmPayment', server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');
    var Resource = require('dw/web/Resource');

    var sessionId = req.form.sessionId;
    var orderNo = req.form.orderNo;

    if (!sessionId || !orderNo) {
        res.json({
            success: false,
            error: Resource.msg('error.missing.params', 'payeez', null)
        });
        return next();
    }

    try {
        var result = PayeezService.getSession(sessionId);

        if (result.success && result.status === 'completed') {
            var order = OrderMgr.getOrder(orderNo);

            if (order) {
                Transaction.wrap(function () {
                    order.custom.payeezSessionId = sessionId;
                    order.custom.payeezTransactionId = result.transactionId;
                    order.custom.payeezPaymentStatus = result.status;
                });

                res.json({
                    success: true,
                    transactionId: result.transactionId
                });
            } else {
                res.json({
                    success: false,
                    error: Resource.msg('error.order.notfound', 'payeez', null)
                });
            }
        } else {
            res.json({
                success: false,
                error: result.errorMessage || Resource.msg('error.payment.failed', 'payeez', null),
                requiresAction: result.requiresAction,
                actionUrl: result.actionUrl
            });
        }
    } catch (e) {
        var Logger = require('dw/system/Logger');
        Logger.error('Payeez ConfirmPayment error: ' + e.message);

        res.json({
            success: false,
            error: Resource.msg('error.technical', 'payeez', null)
        });
    }

    return next();
});

/**
 * Handle 3DS redirect return
 */
server.get('ThreeDSReturn', server.middleware.https, function (req, res, next) {
    var URLUtils = require('dw/web/URLUtils');
    var sessionId = req.querystring.sessionId;

    if (!sessionId) {
        res.redirect(URLUtils.url('Cart-Show'));
        return next();
    }

    var result = PayeezService.getSession(sessionId);

    if (result.success && result.status === 'completed') {
        res.redirect(URLUtils.url('CheckoutServices-PlaceOrder'));
    } else {
        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'payeezError', 'true'));
    }

    return next();
});

/**
 * Webhook endpoint for async notifications
 */
server.post('Webhook', function (req, res, next) {
    var PayeezWebhook = require('*/cartridge/scripts/helpers/payeezWebhook');

    try {
        var signature = req.httpHeaders.get('x-payeez-signature');
        var payload = req.body;

        if (!PayeezWebhook.verifySignature(payload, signature)) {
            res.setStatusCode(401);
            res.json({ error: 'Invalid signature' });
            return next();
        }

        var event = JSON.parse(payload);
        PayeezWebhook.handleEvent(event);

        res.json({ received: true });
    } catch (e) {
        var Logger = require('dw/system/Logger');
        Logger.error('Payeez Webhook error: ' + e.message);

        res.setStatusCode(500);
        res.json({ error: 'Webhook processing failed' });
    }

    return next();
});

/**
 * Get saved payment methods for customer
 */
server.get('GetSavedCards', server.middleware.https, consentTracking.consent, function (req, res, next) {
    var CustomerMgr = require('dw/customer/CustomerMgr');

    if (!req.currentCustomer.profile) {
        res.json({ cards: [] });
        return next();
    }

    var savedCards = PayeezHelper.getSavedCards(req.currentCustomer.profile.customerNo);

    res.json({
        cards: savedCards
    });

    return next();
});

module.exports = server.exports();
