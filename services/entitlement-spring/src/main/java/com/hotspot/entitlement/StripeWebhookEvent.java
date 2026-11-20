package com.hotspot.entitlement;

import java.util.UUID;

public record StripeWebhookEvent(
    String eventId,
    String eventType,
    String customerId,
    String subscriptionId,
    String invoiceId,
    String checkoutSessionId,
    String priceId,
    UUID userId,
    StripeWebhookAction action
) {
}
