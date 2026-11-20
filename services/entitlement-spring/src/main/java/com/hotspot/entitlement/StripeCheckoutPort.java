package com.hotspot.entitlement;

public interface StripeCheckoutPort {
    CheckoutSession createSession(CheckoutSessionRequest request);
}
