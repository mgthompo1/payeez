/**
 * AtlasService
 * Main service class for Atlas API communication
 */
public with sharing class AtlasService {

    private static final String API_BASE_URL = 'https://yssswpqpwrrglgroxwok.supabase.co/functions/v1';

    /**
     * Create a payment session
     * @param request Payment session request
     * @return AtlasSessionResponse
     */
    public static AtlasSessionResponse createSession(AtlasSessionRequest request) {
        AtlasSettings__c settings = AtlasSettings__c.getOrgDefaults();

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
            return (AtlasSessionResponse) JSON.deserialize(res.getBody(), AtlasSessionResponse.class);
        } else {
            throw new AtlasException('Failed to create session: ' + res.getBody());
        }
    }

    /**
     * Confirm a payment
     * @param sessionId Session ID
     * @param paymentMethodId Payment method ID
     * @return AtlasPaymentResponse
     */
    public static AtlasPaymentResponse confirmPayment(String sessionId, String paymentMethodId) {
        AtlasSettings__c settings = AtlasSettings__c.getOrgDefaults();

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
            return (AtlasPaymentResponse) JSON.deserialize(res.getBody(), AtlasPaymentResponse.class);
        } else {
            throw new AtlasException('Payment failed: ' + res.getBody());
        }
    }

    /**
     * Capture an authorized payment
     * @param transactionId Transaction ID
     * @param amount Amount to capture
     * @param currency Currency code
     * @return AtlasCaptureResponse
     */
    public static AtlasCaptureResponse capturePayment(String transactionId, Decimal amount, String currency) {
        AtlasSettings__c settings = AtlasSettings__c.getOrgDefaults();

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
            return (AtlasCaptureResponse) JSON.deserialize(res.getBody(), AtlasCaptureResponse.class);
        } else {
            throw new AtlasException('Capture failed: ' + res.getBody());
        }
    }

    /**
     * Refund a payment
     * @param transactionId Transaction ID
     * @param amount Amount to refund
     * @param currency Currency code
     * @param reason Refund reason
     * @return AtlasRefundResponse
     */
    public static AtlasRefundResponse refundPayment(String transactionId, Decimal amount, String currency, String reason) {
        AtlasSettings__c settings = AtlasSettings__c.getOrgDefaults();

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
            return (AtlasRefundResponse) JSON.deserialize(res.getBody(), AtlasRefundResponse.class);
        } else {
            throw new AtlasException('Refund failed: ' + res.getBody());
        }
    }

    /**
     * Charge a saved token
     * @param token Payment token
     * @param amount Amount to charge
     * @param currency Currency code
     * @param reference Order reference
     * @return AtlasPaymentResponse
     */
    public static AtlasPaymentResponse chargeToken(String token, Decimal amount, String currency, String reference) {
        AtlasSettings__c settings = AtlasSettings__c.getOrgDefaults();

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
            return (AtlasPaymentResponse) JSON.deserialize(res.getBody(), AtlasPaymentResponse.class);
        } else {
            throw new AtlasException('Token charge failed: ' + res.getBody());
        }
    }

    /**
     * Get session status
     * @param sessionId Session ID
     * @return AtlasSessionResponse
     */
    public static AtlasSessionResponse getSession(String sessionId) {
        AtlasSettings__c settings = AtlasSettings__c.getOrgDefaults();

        HttpRequest req = new HttpRequest();
        req.setEndpoint(API_BASE_URL + '/get-session?sessionId=' + EncodingUtil.urlEncode(sessionId, 'UTF-8'));
        req.setMethod('GET');
        req.setHeader('Authorization', 'Bearer ' + settings.SecretKey__c);
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() == 200) {
            return (AtlasSessionResponse) JSON.deserialize(res.getBody(), AtlasSessionResponse.class);
        } else {
            throw new AtlasException('Failed to get session: ' + res.getBody());
        }
    }
}
