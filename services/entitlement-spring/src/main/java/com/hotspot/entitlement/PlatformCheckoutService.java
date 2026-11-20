package com.hotspot.entitlement;

public class PlatformCheckoutService {
    private final PlatformTierCatalog catalog;
    private final StripeCheckoutPort checkoutPort;

    public PlatformCheckoutService(PlatformTierCatalog catalog, StripeCheckoutPort checkoutPort) {
        this.catalog = catalog;
        this.checkoutPort = checkoutPort;
    }

    public CheckoutSession createSession(CheckoutSessionRequest request) {
        if (request.userId() == null) {
            throw new IllegalArgumentException("Authenticated userId is required");
        }
        if (request.successUrl() == null || request.cancelUrl() == null) {
            throw new IllegalArgumentException("Checkout success and cancel URLs are required");
        }

        PlatformTier tier = catalog.requireActiveTier(request.tierKey(), request.tierVersion());
        if (tier.stripePriceId() == null || tier.stripePriceId().isBlank()) {
            throw new IllegalStateException("Active platform tier has no configured Stripe price");
        }

        return checkoutPort.createSession(new CheckoutSessionRequest(
            request.userId(),
            tier.tierKey(),
            tier.version(),
            tier.stripePriceId(),
            request.successUrl(),
            request.cancelUrl()
        ));
    }
}
