/**
 * AtlasOMSAdapter
 * Adapter for Salesforce Order Management integration
 */
public with sharing class AtlasOMSAdapter {

    /**
     * Process payment for an order summary
     * @param orderSummaryId Order Summary ID
     * @return AtlasPaymentResponse
     */
    public static AtlasPaymentResponse processOrderPayment(Id orderSummaryId) {
        OrderSummary orderSummary = [
            SELECT Id, OrderNumber, GrandTotalAmount, CurrencyIsoCode,
                   BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry,
                   BillingEmailAddress, BillingPhoneNumber,
                   Account.Name, Account.PersonEmail
            FROM OrderSummary
            WHERE Id = :orderSummaryId
            LIMIT 1
        ];

        // Build session request
        AtlasSessionRequest request = new AtlasSessionRequest();
        request.amount = orderSummary.GrandTotalAmount;
        request.currency_x = orderSummary.CurrencyIsoCode;
        request.reference = 'OMS-' + orderSummary.OrderNumber;
        request.merchantId = AtlasSettings__c.getOrgDefaults().MerchantId__c;

        // Customer info
        request.customer = new AtlasModels.CustomerInfo();
        request.customer.email = orderSummary.BillingEmailAddress ?? orderSummary.Account?.PersonEmail;
        request.customer.phone = orderSummary.BillingPhoneNumber;

        // Parse name from account
        if (orderSummary.Account != null && String.isNotBlank(orderSummary.Account.Name)) {
            List<String> nameParts = orderSummary.Account.Name.split(' ', 2);
            request.customer.firstName = nameParts[0];
            if (nameParts.size() > 1) {
                request.customer.lastName = nameParts[1];
            }
        }

        // Billing address
        request.billingAddress = new AtlasModels.Address();
        request.billingAddress.line1 = orderSummary.BillingStreet;
        request.billingAddress.city = orderSummary.BillingCity;
        request.billingAddress.state = orderSummary.BillingState;
        request.billingAddress.postalCode = orderSummary.BillingPostalCode;
        request.billingAddress.country = orderSummary.BillingCountry;

        // Metadata
        request.metadata = new Map<String, Object>{
            'platform' => 'SalesforceOMS',
            'orderSummaryId' => orderSummaryId
        };

        // Create session
        AtlasSessionResponse sessionResponse = AtlasService.createSession(request);

        // Store session ID on order
        updateOrderWithSession(orderSummaryId, sessionResponse.sessionId);

        // Note: In real implementation, payment confirmation would be handled
        // via a separate flow after customer completes payment on frontend
        return new AtlasPaymentResponse();
    }

    /**
     * Capture payment for fulfilled order items
     * @param orderSummaryId Order Summary ID
     * @param fulfillmentOrderId Fulfillment Order ID
     * @param amount Amount to capture
     * @return AtlasCaptureResponse
     */
    public static AtlasCaptureResponse captureForFulfillment(Id orderSummaryId, Id fulfillmentOrderId, Decimal amount) {
        // Get stored transaction ID
        AtlasOrderPayment__c payment = [
            SELECT TransactionId__c, CurrencyIsoCode__c
            FROM AtlasOrderPayment__c
            WHERE OrderSummaryId__c = :orderSummaryId
            AND Status__c = 'authorized'
            LIMIT 1
        ];

        if (payment == null || String.isBlank(payment.TransactionId__c)) {
            throw new AtlasException('No authorized payment found for order');
        }

        // Capture payment
        AtlasCaptureResponse response = AtlasService.capturePayment(
            payment.TransactionId__c,
            amount,
            payment.CurrencyIsoCode__c
        );

        if (response.success) {
            // Update payment record
            payment.Status__c = 'captured';
            payment.CaptureId__c = response.id;
            payment.CapturedAmount__c = (payment.CapturedAmount__c ?? 0) + amount;
            update payment;

            // Log capture
            createPaymentLog(orderSummaryId, 'Capture', amount, response.id);
        }

        return response;
    }

    /**
     * Process refund for returned items
     * @param orderSummaryId Order Summary ID
     * @param amount Amount to refund
     * @param reason Refund reason
     * @return AtlasRefundResponse
     */
    public static AtlasRefundResponse processRefund(Id orderSummaryId, Decimal amount, String reason) {
        // Get stored transaction ID
        AtlasOrderPayment__c payment = [
            SELECT TransactionId__c, CurrencyIsoCode__c
            FROM AtlasOrderPayment__c
            WHERE OrderSummaryId__c = :orderSummaryId
            AND Status__c IN ('captured', 'partially_refunded')
            LIMIT 1
        ];

        if (payment == null || String.isBlank(payment.TransactionId__c)) {
            throw new AtlasException('No captured payment found for order');
        }

        // Process refund
        AtlasRefundResponse response = AtlasService.refundPayment(
            payment.TransactionId__c,
            amount,
            payment.CurrencyIsoCode__c,
            reason
        );

        if (response.success) {
            // Update payment record
            payment.RefundedAmount__c = (payment.RefundedAmount__c ?? 0) + amount;
            if (payment.RefundedAmount__c >= payment.CapturedAmount__c) {
                payment.Status__c = 'refunded';
            } else {
                payment.Status__c = 'partially_refunded';
            }
            update payment;

            // Log refund
            createPaymentLog(orderSummaryId, 'Refund', amount, response.id);
        }

        return response;
    }

    /**
     * Update order with payment session
     */
    private static void updateOrderWithSession(Id orderSummaryId, String sessionId) {
        AtlasOrderPayment__c payment = new AtlasOrderPayment__c(
            OrderSummaryId__c = orderSummaryId,
            SessionId__c = sessionId,
            Status__c = 'pending',
            CreatedDate__c = System.now()
        );
        insert payment;
    }

    /**
     * Create payment log entry
     */
    private static void createPaymentLog(Id orderSummaryId, String action, Decimal amount, String referenceId) {
        AtlasPaymentLog__c log = new AtlasPaymentLog__c(
            OrderSummaryId__c = orderSummaryId,
            Action__c = action,
            Amount__c = amount,
            ReferenceId__c = referenceId,
            CreatedDate__c = System.now()
        );
        insert log;
    }

    /**
     * Handle webhook callback for payment status updates
     * @param event Webhook event
     */
    public static void handleWebhookEvent(AtlasModels.WebhookEvent event) {
        switch on event.type {
            when 'payment.completed' {
                handlePaymentCompleted(event.data);
            }
            when 'payment.failed' {
                handlePaymentFailed(event.data);
            }
            when 'payment.captured' {
                handlePaymentCaptured(event.data);
            }
            when 'payment.refunded' {
                handlePaymentRefunded(event.data);
            }
        }
    }

    private static void handlePaymentCompleted(Map<String, Object> data) {
        String sessionId = (String) data.get('sessionId');
        String transactionId = (String) data.get('transactionId');

        List<AtlasOrderPayment__c> payments = [
            SELECT Id, OrderSummaryId__c
            FROM AtlasOrderPayment__c
            WHERE SessionId__c = :sessionId
            LIMIT 1
        ];

        if (!payments.isEmpty()) {
            AtlasOrderPayment__c payment = payments[0];
            payment.TransactionId__c = transactionId;
            payment.Status__c = 'authorized';
            update payment;
        }
    }

    private static void handlePaymentFailed(Map<String, Object> data) {
        String sessionId = (String) data.get('sessionId');

        List<AtlasOrderPayment__c> payments = [
            SELECT Id
            FROM AtlasOrderPayment__c
            WHERE SessionId__c = :sessionId
            LIMIT 1
        ];

        if (!payments.isEmpty()) {
            payments[0].Status__c = 'failed';
            payments[0].ErrorMessage__c = (String) data.get('errorMessage');
            update payments;
        }
    }

    private static void handlePaymentCaptured(Map<String, Object> data) {
        String transactionId = (String) data.get('transactionId');
        Decimal amount = (Decimal) data.get('amount');

        List<AtlasOrderPayment__c> payments = [
            SELECT Id, CapturedAmount__c
            FROM AtlasOrderPayment__c
            WHERE TransactionId__c = :transactionId
            LIMIT 1
        ];

        if (!payments.isEmpty()) {
            payments[0].Status__c = 'captured';
            payments[0].CapturedAmount__c = (payments[0].CapturedAmount__c ?? 0) + amount;
            update payments;
        }
    }

    private static void handlePaymentRefunded(Map<String, Object> data) {
        String transactionId = (String) data.get('transactionId');
        Decimal amount = (Decimal) data.get('amount');

        List<AtlasOrderPayment__c> payments = [
            SELECT Id, RefundedAmount__c, CapturedAmount__c
            FROM AtlasOrderPayment__c
            WHERE TransactionId__c = :transactionId
            LIMIT 1
        ];

        if (!payments.isEmpty()) {
            AtlasOrderPayment__c payment = payments[0];
            payment.RefundedAmount__c = (payment.RefundedAmount__c ?? 0) + amount;
            if (payment.RefundedAmount__c >= payment.CapturedAmount__c) {
                payment.Status__c = 'refunded';
            } else {
                payment.Status__c = 'partially_refunded';
            }
            update payments;
        }
    }
}
