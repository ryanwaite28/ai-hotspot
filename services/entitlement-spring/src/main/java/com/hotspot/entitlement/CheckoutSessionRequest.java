package com.hotspot.entitlement;

import java.net.URI;
import java.util.UUID;

public record CheckoutSessionRequest(
    UUID userId,
    String tierKey,
    int tierVersion,
    String stripePriceId,
    URI successUrl,
    URI cancelUrl
) {
}
