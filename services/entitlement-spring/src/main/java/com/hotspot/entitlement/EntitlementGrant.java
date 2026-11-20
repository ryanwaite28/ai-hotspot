package com.hotspot.entitlement;

import java.time.Instant;
import java.util.UUID;

public record EntitlementGrant(
    UUID userId,
    EntitlementKey entitlementKey,
    EntitlementSource source,
    String sourceRef,
    int sourceVersion,
    Instant startsAt,
    Instant endsAt
) {
}
