/**
 * PayeezService
 * Main service class for Payeez API communication
 */
public with sharing class PayeezService {

    private static final String API_BASE_URL = 'https://yssswpqpwrrglgroxwok.supabase.co/functions/v1';

    /**
     * Create a payment session
     * @param request Payment session request
     * @return PayeezSessionResponse
     */
    public static PayeezSessionResponse createSession(PayeezSessionRequest request) {
        PayeezSettings__c settings = PayeezSettings__c.getOrgDefaults();

        HttpRequest req = new HttpRequest();
        req.setEndpoint(API_BASE_URL + '/create-payment-session');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + settings.SecretKey__c);
        req.setBody(JSON.serialize(request));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() == 200) {
            return (PayeezSessionResponse) JSON.deserialize(res.getBody(), PayeezSessionResponse.class);
        } else {
            throw new PayeezException('Failed to create session: ' + res.getBody());
        }
    }

    /**
     * Confirm a payment
     * @param sessionId Session ID
     * @param paymentMethodId Payment method ID
     * @return PayeezPaymentResponse
     */
    public static PayeezPaymentResponse confirmPayment(String sessionId, String paymentMethodId) {
        PayeezSettings__c settings = PayeezSettings__c.getOrgDefaults();

        Map<String, Object> body = new Map<String, Object>{
            'sessionId' => sessionId,
            'paymentMethodId' => paymentMethodId
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint(API_BASE_URL + '/confirm-payment');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + settings.SecretKey__c);
        req.setBody(JSON.serialize(body));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() == 200) {
            return (PayeezPaymentResponse) JSON.deserialize(res.getBody(), PayeezPaymentResponse.class);
        } else {
            throw new PayeezException('Payment failed: ' + res.getBody());
        }
    }

    /**
     * Capture an authorized payment
     * @param transactionId Transaction ID
     * @param amount Amount to capture
     * @param currency Currency code
     * @return PayeezCaptureResponse
     */
    public static PayeezCaptureResponse capturePayment(String transactionId, Decimal amount, String currency) {
        PayeezSettings__c settings = PayeezSettings__c.getOrgDefaults();

        Map<String, Object> body = new Map<String, Object>{
            'transactionId' => transactionId,
            'amount' => amount,
            'currency' => currency
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint(API_BASE_URL + '/capture-payment');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + settings.SecretKey__c);
        req.setBody(JSON.serialize(body));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() == 200) {
            return (PayeezCaptureResponse) JSON.deserialize(res.getBody(), PayeezCaptureResponse.class);
        } else {
            throw new PayeezException('Capture failed: ' + res.getBody());
        }
    }

    /**
     * Refund a payment
     * @param transactionId Transaction ID
     * @param amount Amount to refund
     * @param currency Currency code
     * @param reason Refund reason
     * @return PayeezRefundResponse
     */
    public static PayeezRefundResponse refundPayment(String transactionId, Decimal amount, String currency, String reason) {
        PayeezSettings__c settings = PayeezSettings__c.getOrgDefaults();

        Map<String, Object> body = new Map<String, Object>{
            'transactionId' => transactionId,
            'amount' => amount,
            'currency' => currency,
            'reason' => reason
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint(API_BASE_URL + '/refund-payment');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + settings.SecretKey__c);
        req.setBody(JSON.serialize(body));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() == 200) {
            return (PayeezRefundResponse) JSON.deserialize(res.getBody(), PayeezRefundResponse.class);
        } else {
            throw new PayeezException('Refund failed: ' + res.getBody());
        }
    }

    /**
     * Charge a saved token
     * @param token Payment token
     * @param amount Amount to charge
     * @param currency Currency code
     * @param reference Order reference
     * @return PayeezPaymentResponse
     */
    public static PayeezPaymentResponse chargeToken(String token, Decimal amount, String currency, String reference) {
        PayeezSettings__c settings = PayeezSettings__c.getOrgDefaults();

        Map<String, Object> body = new Map<String, Object>{
            'token' => token,
            'amount' => amount,
            'currency' => currency,
            'reference' => reference
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint(API_BASE_URL + '/charge-token');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + settings.SecretKey__c);
        req.setBody(JSON.serialize(body));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() == 200) {
            return (PayeezPaymentResponse) JSON.deserialize(res.getBody(), PayeezPaymentResponse.class);
        } else {
            throw new PayeezException('Token charge failed: ' + res.getBody());
        }
    }

    /**
     * Get session status
     * @param sessionId Session ID
     * @return PayeezSessionResponse
     */
    public static PayeezSessionResponse getSession(String sessionId) {
        PayeezSettings__c settings = PayeezSettings__c.getOrgDefaults();

        HttpRequest req = new HttpRequest();
        req.setEndpoint(API_BASE_URL + '/get-session?sessionId=' + EncodingUtil.urlEncode(sessionId, 'UTF-8'));
        req.setMethod('GET');
        req.setHeader('Authorization', 'Bearer ' + settings.SecretKey__c);
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() == 200) {
            return (PayeezSessionResponse) JSON.deserialize(res.getBody(), PayeezSessionResponse.class);
        } else {
            throw new PayeezException('Failed to get session: ' + res.getBody());
        }
    }
}
