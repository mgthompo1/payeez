# Payeez Integrations

Starter kits and scaffolds for commerce platforms and SDKs live here.

- `woocommerce/` - WooCommerce plugin source (ported from the Windcave plugin as a baseline).
- `shopware/` - Shopware 6 plugin scaffold (placeholder until the source is added).

Notes:
- The WooCommerce plugin still contains Windcave-specific classes and endpoints; it is staged here to accelerate the Payeez port.
- Replace Windcave API calls with Payeez `create-session`, `confirm-payment`, `capture-payment`, and `refund-payment` flows.
