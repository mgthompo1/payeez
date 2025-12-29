/**
 * PayeezModels
 * Data models for Payeez API requests and responses
 */
public class PayeezModels {

    /**
     * Payment session request
     */
    public class PayeezSessionRequest {
        public Decimal amount;
        public String currency_x; // currency is reserved
        public String reference;
        public String merchantId;
        public CustomerInfo customer;
        public Address billingAddress;
        public Address shippingAddress;
        public String returnUrl;
        public Map<String, Object> metadata;

        public PayeezSessionRequest() {
            this.metadata = new Map<String, Object>();
        }
    }

    /**
     * Payment session response
     */
    public class PayeezSessionResponse {
        public String sessionId;
        public String clientSecret;
        public String status;
        public String transactionId;
        public Boolean requiresAction;
        public String actionUrl;
    }

    /**
     * Payment response
     */
    public class PayeezPaymentResponse {
        public String id;
        public Boolean authorised;
        public String status;
        public String responseCode;
        public String responseText;
        public Boolean requiresAction;
        public String actionUrl;
        public CardInfo card;
    }

    /**
     * Capture response
     */
    public class PayeezCaptureResponse {
        public String id;
        public Boolean success;
        public String status;
        public Decimal amount;
    }

    /**
     * Refund response
     */
    public class PayeezRefundResponse {
        public String id;
        public Boolean success;
        public String status;
        public Decimal amount;
    }

    /**
     * Customer information
     */
    public class CustomerInfo {
        public String email;
        public String firstName;
        public String lastName;
        public String phone;
    }

    /**
     * Address
     */
    public class Address {
        public String line1;
        public String line2;
        public String city;
        public String state;
        public String postalCode;
        public String country;
    }

    /**
     * Card information
     */
    public class CardInfo {
        public String brand;
        public String last4;
        public String expiryMonth;
        public String expiryYear;
        public String token;
    }

    /**
     * Webhook event
     */
    public class WebhookEvent {
        public String id;
        public String type;
        public Datetime createdAt;
        public Map<String, Object> data;
    }
}

// Type aliases for convenience
public class PayeezSessionRequest extends PayeezModels.PayeezSessionRequest {}
public class PayeezSessionResponse extends PayeezModels.PayeezSessionResponse {}
public class PayeezPaymentResponse extends PayeezModels.PayeezPaymentResponse {}
public class PayeezCaptureResponse extends PayeezModels.PayeezCaptureResponse {}
public class PayeezRefundResponse extends PayeezModels.PayeezRefundResponse {}
