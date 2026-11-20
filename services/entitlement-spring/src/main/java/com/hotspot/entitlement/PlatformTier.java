package com.hotspot.entitlement;

import java.util.List;
import java.util.UUID;

public record PlatformTier(
    UUID id,
    String tierKey,
    int version,
    String name,
    String stripePriceId,
    String currency,
    int monthlyCents,
    List<EntitlementKey> entitlementKeys,
    PlatformTierStatus status
) {
}
