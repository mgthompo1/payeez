'use strict';

/**
 * Atlas Controller
 * Handles payment session creation, confirmation, and webhooks
 */

var server = require('server');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

var AtlasService = require('*/cartridge/scripts/services/atlasService');
var AtlasHelper = require('*/cartridge/scripts/helpers/atlasHelper');

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
            error: Resource.msg('error.basket.empty', 'atlas', null)
        });
        return next();
    }

    try {
        var sessionParams = AtlasHelper.buildSessionParams(currentBasket);
        var result = AtlasService.createSession(sessionParams);

        if (result.success) {
            res.json({
                success: true,
                sessionId: result.sessionId,
                clientSecret: result.clientSecret
            });
        } else {
            res.json({
                success: false,
                error: result.errorMessage || Resource.msg('error.session.create', 'atlas', null)
            });
        }
    } catch (e) {
        var Logger = require('dw/system/Logger');
        Logger.error('Atlas CreateSession error: ' + e.message);

        res.json({
            success: false,
            error: Resource.msg('error.technical', 'atlas', null)
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
            error: Resource.msg('error.missing.params', 'atlas', null)
        });
        return next();
    }

    try {
        var result = AtlasService.getSession(sessionId);

        if (result.success && result.status === 'completed') {
            var order = OrderMgr.getOrder(orderNo);

            if (order) {
                Transaction.wrap(function () {
                    order.custom.atlasSessionId = sessionId;
                    order.custom.atlasTransactionId = result.transactionId;
                    order.custom.atlasPaymentStatus = result.status;
                });

                res.json({
                    success: true,
                    transactionId: result.transactionId
                });
            } else {
                res.json({
                    success: false,
                    error: Resource.msg('error.order.notfound', 'atlas', null)
                });
            }
        } else {
            res.json({
                success: false,
                error: result.errorMessage || Resource.msg('error.payment.failed', 'atlas', null),
                requiresAction: result.requiresAction,
                actionUrl: result.actionUrl
            });
        }
    } catch (e) {
        var Logger = require('dw/system/Logger');
        Logger.error('Atlas ConfirmPayment error: ' + e.message);

        res.json({
            success: false,
            error: Resource.msg('error.technical', 'atlas', null)
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

    var result = AtlasService.getSession(sessionId);

    if (result.success && result.status === 'completed') {
        res.redirect(URLUtils.url('CheckoutServices-PlaceOrder'));
    } else {
        res.redirect(URLUtils.url('Checkout-Begin', 'stage', 'payment', 'atlasError', 'true'));
    }

    return next();
});

/**
 * Webhook endpoint for async notifications
 */
server.post('Webhook', function (req, res, next) {
    var AtlasWebhook = require('*/cartridge/scripts/helpers/atlasWebhook');

    try {
        var signature = req.httpHeaders.get('x-atlas-signature');
        var payload = req.body;

        if (!AtlasWebhook.verifySignature(payload, signature)) {
            res.setStatusCode(401);
            res.json({ error: 'Invalid signature' });
            return next();
        }

        var event = JSON.parse(payload);
        AtlasWebhook.handleEvent(event);

        res.json({ received: true });
    } catch (e) {
        var Logger = require('dw/system/Logger');
        Logger.error('Atlas Webhook error: ' + e.message);

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

    var savedCards = AtlasHelper.getSavedCards(req.currentCustomer.profile.customerNo);

    res.json({
        cards: savedCards
    });

    return next();
});

module.exports = server.exports();
