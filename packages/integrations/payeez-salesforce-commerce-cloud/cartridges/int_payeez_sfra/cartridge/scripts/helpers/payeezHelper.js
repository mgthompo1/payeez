'use strict';

/**
 * Payeez Helper Module
 * Utility functions for Payeez integration
 */

var Site = require('dw/system/Site');

/**
 * Build session parameters from basket
 * @param {dw.order.Basket} basket - Current basket
 * @returns {Object} Session parameters
 */
function buildSessionParams(basket) {
    var Money = require('dw/value/Money');

    var billingAddress = basket.billingAddress;
    var shippingAddress = basket.defaultShipment.shippingAddress;

    return {
        amount: basket.totalGrossPrice.value,
        currency: basket.currencyCode,
        reference: basket.UUID,
        merchantId: Site.current.getCustomPreferenceValue('payeezMerchantId'),
        customer: {
            email: basket.customerEmail,
            firstName: billingAddress ? billingAddress.firstName : '',
            lastName: billingAddress ? billingAddress.lastName : '',
            phone: billingAddress ? billingAddress.phone : ''
        },
        billingAddress: billingAddress ? {
            line1: billingAddress.address1,
            line2: billingAddress.address2 || '',
            city: billingAddress.city,
            state: billingAddress.stateCode,
            postalCode: billingAddress.postalCode,
            country: billingAddress.countryCode.value
        } : null,
        shippingAddress: shippingAddress ? {
            line1: shippingAddress.address1,
            line2: shippingAddress.address2 || '',
            city: shippingAddress.city,
            state: shippingAddress.stateCode,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.countryCode.value
        } : null,
        returnUrl: require('dw/web/URLUtils').abs('Payeez-ThreeDSReturn').toString(),
        metadata: {
            platform: 'SFCC',
            basketId: basket.UUID
        }
    };
}

/**
 * Get saved cards for customer
 * @param {string} customerNo - Customer number
 * @returns {Array} Array of saved cards
 */
function getSavedCards(customerNo) {
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var cards = [];

    var savedCardsIterator = CustomObjectMgr.queryCustomObjects(
        'PayeezSavedCard',
        'custom.customerNo = {0}',
        'custom.createdAt desc',
        customerNo
    );

    while (savedCardsIterator.hasNext()) {
        var cardObj = savedCardsIterator.next();
        cards.push({
            id: cardObj.custom.tokenId,
            brand: cardObj.custom.cardBrand,
            last4: cardObj.custom.last4,
            expiryMonth: cardObj.custom.expiryMonth,
            expiryYear: cardObj.custom.expiryYear,
            isDefault: cardObj.custom.isDefault
        });
    }

    savedCardsIterator.close();

    return cards;
}

/**
 * Save a card for customer
 * @param {string} customerNo - Customer number
 * @param {Object} cardData - Card data from Payeez
 * @returns {boolean} Success status
 */
function saveCard(customerNo, cardData) {
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var Transaction = require('dw/system/Transaction');
    var UUIDUtils = require('dw/util/UUIDUtils');

    try {
        Transaction.wrap(function () {
            var cardObj = CustomObjectMgr.createCustomObject('PayeezSavedCard', UUIDUtils.createUUID());
            cardObj.custom.customerNo = customerNo;
            cardObj.custom.tokenId = cardData.token;
            cardObj.custom.cardBrand = cardData.brand;
            cardObj.custom.last4 = cardData.last4;
            cardObj.custom.expiryMonth = cardData.expiryMonth;
            cardObj.custom.expiryYear = cardData.expiryYear;
            cardObj.custom.isDefault = cardData.setDefault || false;
            cardObj.custom.createdAt = new Date();
        });

        return true;
    } catch (e) {
        var Logger = require('dw/system/Logger');
        Logger.error('Save card error: ' + e.message);
        return false;
    }
}

/**
 * Delete a saved card
 * @param {string} customerNo - Customer number
 * @param {string} tokenId - Token ID
 * @returns {boolean} Success status
 */
function deleteCard(customerNo, tokenId) {
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var Transaction = require('dw/system/Transaction');

    try {
        var cardsIterator = CustomObjectMgr.queryCustomObjects(
            'PayeezSavedCard',
            'custom.customerNo = {0} AND custom.tokenId = {1}',
            null,
            customerNo,
            tokenId
        );

        if (cardsIterator.hasNext()) {
            var cardObj = cardsIterator.next();
            Transaction.wrap(function () {
                CustomObjectMgr.remove(cardObj);
            });
        }

        cardsIterator.close();
        return true;
    } catch (e) {
        var Logger = require('dw/system/Logger');
        Logger.error('Delete card error: ' + e.message);
        return false;
    }
}

/**
 * Check if card is expired
 * @param {Object} card - Card object
 * @returns {boolean} True if expired
 */
function isCardExpired(card) {
    var now = new Date();
    var currentYear = now.getFullYear();
    var currentMonth = now.getMonth() + 1;

    var expiryYear = parseInt(card.expiryYear, 10);
    var expiryMonth = parseInt(card.expiryMonth, 10);

    // Handle 2-digit year
    if (expiryYear < 100) {
        expiryYear += 2000;
    }

    if (expiryYear < currentYear) {
        return true;
    }

    if (expiryYear === currentYear && expiryMonth < currentMonth) {
        return true;
    }

    return false;
}

/**
 * Get configuration
 * @returns {Object} Configuration object
 */
function getConfig() {
    return {
        publicKey: Site.current.getCustomPreferenceValue('payeezPublicKey'),
        isTestMode: Site.current.getCustomPreferenceValue('payeezTestMode'),
        applePayEnabled: Site.current.getCustomPreferenceValue('payeezApplePayEnabled'),
        googlePayEnabled: Site.current.getCustomPreferenceValue('payeezGooglePayEnabled'),
        merchantId: Site.current.getCustomPreferenceValue('payeezMerchantId')
    };
}

module.exports = {
    buildSessionParams: buildSessionParams,
    getSavedCards: getSavedCards,
    saveCard: saveCard,
    deleteCard: deleteCard,
    isCardExpired: isCardExpired,
    getConfig: getConfig
};
