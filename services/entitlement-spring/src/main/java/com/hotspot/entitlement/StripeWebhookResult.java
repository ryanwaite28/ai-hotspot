package com.hotspot.entitlement;

public record StripeWebhookResult(
    boolean processed,
    String outcome
) {
}
