/**
 * PayeezWebhookResource
 * REST resource for handling Payeez webhooks
 */
@RestResource(urlMapping='/payeez/webhook/*')
global with sharing class PayeezWebhookResource {

    /**
     * Handle webhook POST
     */
    @HttpPost
    global static void handleWebhook() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;

        try {
            // Verify signature
            String signature = req.headers.get('X-Payeez-Signature');
            String payload = req.requestBody.toString();

            if (!verifySignature(payload, signature)) {
                res.statusCode = 401;
                res.responseBody = Blob.valueOf('{"error": "Invalid signature"}');
                return;
            }

            // Parse event
            Map<String, Object> eventMap = (Map<String, Object>) JSON.deserializeUntyped(payload);
            PayeezModels.WebhookEvent event = new PayeezModels.WebhookEvent();
            event.id = (String) eventMap.get('id');
            event.type = (String) eventMap.get('type');
            event.data = (Map<String, Object>) eventMap.get('data');

            // Handle event
            PayeezOMSAdapter.handleWebhookEvent(event);

            res.statusCode = 200;
            res.responseBody = Blob.valueOf('{"received": true}');

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Payeez webhook error: ' + e.getMessage());
            res.statusCode = 500;
            res.responseBody = Blob.valueOf('{"error": "' + e.getMessage() + '"}');
        }
    }

    /**
     * Verify webhook signature
     */
    private static Boolean verifySignature(String payload, String signature) {
        if (String.isBlank(signature)) {
            return false;
        }

        PayeezSettings__c settings = PayeezSettings__c.getOrgDefaults();
        String webhookSecret = settings.WebhookSecret__c;

        if (String.isBlank(webhookSecret)) {
            // If no secret configured, skip verification (not recommended for production)
            return true;
        }

        // Compute HMAC-SHA256
        Blob key = Blob.valueOf(webhookSecret);
        Blob data = Blob.valueOf(payload);
        Blob mac = Crypto.generateMac('HmacSHA256', data, key);
        String computedSignature = EncodingUtil.convertToHex(mac);

        return computedSignature.equalsIgnoreCase(signature);
    }
}
