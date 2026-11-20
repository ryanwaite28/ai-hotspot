package com.hotspot.entitlement;

import java.time.Instant;
import java.util.UUID;

public record EffectiveEntitlement(
    UUID userId,
    EntitlementKey entitlementKey,
    EntitlementSource source,
    String sourceRef,
    Instant startsAt,
    Instant endsAt
) {
    public boolean isEffectiveAt(Instant now) {
        boolean started = !now.isBefore(startsAt);
        boolean notEnded = endsAt == null || now.isBefore(endsAt);
        return started && notEnded;
    }
}
