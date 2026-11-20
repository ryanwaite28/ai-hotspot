package com.hotspot.entitlement;

import java.net.URI;

public class LocalStripeCheckoutPort implements StripeCheckoutPort {
    @Override
    public CheckoutSession createSession(CheckoutSessionRequest request) {
        String sessionId = "cs_test_" + request.userId() + "_" + request.tierKey();
        URI checkoutUrl = URI.create("https://checkout.stripe.test/c/pay/" + sessionId);
        return new CheckoutSession(sessionId, checkoutUrl, request.tierKey(), request.tierVersion());
    }
}
