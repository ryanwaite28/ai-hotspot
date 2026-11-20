package com.hotspot.entitlement;

import java.net.URI;

public record CheckoutSession(
    String sessionId,
    URI checkoutUrl,
    String tierKey,
    int tierVersion
) {
}
