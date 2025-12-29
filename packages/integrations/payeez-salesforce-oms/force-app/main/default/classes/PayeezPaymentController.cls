/**
 * PayeezPaymentController
 * Apex controller for Payeez LWC components
 */
public with sharing class PayeezPaymentController {

    /**
     * Get Payeez configuration
     * @return Configuration map
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getConfig() {
        PayeezSettings__c settings = PayeezSettings__c.getOrgDefaults();

        return new Map<String, Object>{
            'publicKey' => settings.PublicKey__c,
            'isTestMode' => settings.TestMode__c,
            'merchantId' => settings.MerchantId__c,
            'isLoggedIn' => UserInfo.getUserType() != 'Guest'
        };
    }

    /**
     * Create payment session
     * @param recordId Order record ID
     * @param objectApiName Object API name
     * @param saveCard Whether to save card
     * @return Session result
     */
    @AuraEnabled
    public static Map<String, Object> createSession(Id recordId, String objectApiName, Boolean saveCard) {
        try {
            PayeezSessionRequest request = buildSessionRequest(recordId, objectApiName, saveCard);
            PayeezSessionResponse response = PayeezService.createSession(request);

            return new Map<String, Object>{
                'success' => true,
                'sessionId' => response.sessionId,
                'clientSecret' => response.clientSecret
            };
        } catch (Exception e) {
            return new Map<String, Object>{
                'success' => false,
                'errorMessage' => e.getMessage()
            };
        }
    }

    /**
     * Confirm payment after client-side completion
     * @param sessionId Session ID
     * @param recordId Order record ID
     * @return Confirmation result
     */
    @AuraEnabled
    public static Map<String, Object> confirmPayment(String sessionId, Id recordId) {
        try {
            PayeezSessionResponse session = PayeezService.getSession(sessionId);

            if (session.status == 'completed') {
                // Update order with payment info
                updateOrderPayment(recordId, session);

                return new Map<String, Object>{
                    'success' => true,
                    'transactionId' => session.transactionId
                };
            } else {
                return new Map<String, Object>{
                    'success' => false,
                    'errorMessage' => 'Payment not completed',
                    'status' => session.status
                };
            }
        } catch (Exception e) {
            return new Map<String, Object>{
                'success' => false,
                'errorMessage' => e.getMessage()
            };
        }
    }

    /**
     * Get saved cards for current user
     * @return List of saved cards
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getSavedCards() {
        List<Map<String, Object>> cards = new List<Map<String, Object>>();

        String userId = UserInfo.getUserId();

        List<PayeezSavedCard__c> savedCards = [
            SELECT Id, TokenId__c, CardBrand__c, Last4__c, ExpiryMonth__c, ExpiryYear__c
            FROM PayeezSavedCard__c
            WHERE OwnerId = :userId
            ORDER BY CreatedDate DESC
        ];

        for (PayeezSavedCard__c card : savedCards) {
            cards.add(new Map<String, Object>{
                'id' => card.TokenId__c,
                'brand' => card.CardBrand__c,
                'last4' => card.Last4__c,
                'expiryMonth' => card.ExpiryMonth__c,
                'expiryYear' => card.ExpiryYear__c
            });
        }

        return cards;
    }

    /**
     * Save a new card
     * @param cardData Card data
     * @return Success status
     */
    @AuraEnabled
    public static Boolean saveCard(Map<String, Object> cardData) {
        try {
            PayeezSavedCard__c card = new PayeezSavedCard__c(
                TokenId__c = (String) cardData.get('token'),
                CardBrand__c = (String) cardData.get('brand'),
                Last4__c = (String) cardData.get('last4'),
                ExpiryMonth__c = (String) cardData.get('expiryMonth'),
                ExpiryYear__c = (String) cardData.get('expiryYear')
            );
            insert card;
            return true;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Save card error: ' + e.getMessage());
            return false;
        }
    }

    /**
     * Delete a saved card
     * @param tokenId Token ID
     * @return Success status
     */
    @AuraEnabled
    public static Boolean deleteCard(String tokenId) {
        try {
            String userId = UserInfo.getUserId();

            List<PayeezSavedCard__c> cards = [
                SELECT Id
                FROM PayeezSavedCard__c
                WHERE TokenId__c = :tokenId AND OwnerId = :userId
                LIMIT 1
            ];

            if (!cards.isEmpty()) {
                delete cards;
            }
            return true;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Delete card error: ' + e.getMessage());
            return false;
        }
    }

    /**
     * Build session request from order
     */
    private static PayeezSessionRequest buildSessionRequest(Id recordId, String objectApiName, Boolean saveCard) {
        PayeezSessionRequest request = new PayeezSessionRequest();
        PayeezSettings__c settings = PayeezSettings__c.getOrgDefaults();

        if (objectApiName == 'OrderSummary') {
            OrderSummary orderSummary = [
                SELECT Id, OrderNumber, GrandTotalAmount, CurrencyIsoCode,
                       BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry,
                       BillingEmailAddress
                FROM OrderSummary
                WHERE Id = :recordId
                LIMIT 1
            ];

            request.amount = orderSummary.GrandTotalAmount;
            request.currency_x = orderSummary.CurrencyIsoCode;
            request.reference = 'OMS-' + orderSummary.OrderNumber;

            request.customer = new PayeezModels.CustomerInfo();
            request.customer.email = orderSummary.BillingEmailAddress;

            request.billingAddress = new PayeezModels.Address();
            request.billingAddress.line1 = orderSummary.BillingStreet;
            request.billingAddress.city = orderSummary.BillingCity;
            request.billingAddress.state = orderSummary.BillingState;
            request.billingAddress.postalCode = orderSummary.BillingPostalCode;
            request.billingAddress.country = orderSummary.BillingCountry;

        } else if (objectApiName == 'Order') {
            Order ord = [
                SELECT Id, OrderNumber, TotalAmount, CurrencyIsoCode,
                       BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry,
                       Account.PersonEmail
                FROM Order
                WHERE Id = :recordId
                LIMIT 1
            ];

            request.amount = ord.TotalAmount;
            request.currency_x = ord.CurrencyIsoCode;
            request.reference = 'ORD-' + ord.OrderNumber;

            request.customer = new PayeezModels.CustomerInfo();
            request.customer.email = ord.Account?.PersonEmail;

            request.billingAddress = new PayeezModels.Address();
            request.billingAddress.line1 = ord.BillingStreet;
            request.billingAddress.city = ord.BillingCity;
            request.billingAddress.state = ord.BillingState;
            request.billingAddress.postalCode = ord.BillingPostalCode;
            request.billingAddress.country = ord.BillingCountry;
        }

        request.merchantId = settings.MerchantId__c;
        request.metadata = new Map<String, Object>{
            'platform' => 'SalesforceOMS',
            'recordId' => recordId,
            'objectType' => objectApiName,
            'saveCard' => saveCard
        };

        return request;
    }

    /**
     * Update order with payment info
     */
    private static void updateOrderPayment(Id recordId, PayeezSessionResponse session) {
        PayeezOrderPayment__c payment = new PayeezOrderPayment__c(
            OrderSummaryId__c = recordId,
            SessionId__c = session.sessionId,
            TransactionId__c = session.transactionId,
            Status__c = 'authorized',
            CreatedDate__c = System.now()
        );
        insert payment;
    }
}
