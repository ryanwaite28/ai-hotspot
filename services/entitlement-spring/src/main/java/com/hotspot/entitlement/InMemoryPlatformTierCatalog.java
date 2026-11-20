package com.hotspot.entitlement;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class InMemoryPlatformTierCatalog implements PlatformTierCatalog {
    private final List<PlatformTier> tiers;

    public InMemoryPlatformTierCatalog(List<PlatformTier> tiers) {
        this.tiers = List.copyOf(tiers);
    }

    @Override
    public List<PlatformTier> activeTiers() {
        return tiers.stream()
            .filter(tier -> tier.status() == PlatformTierStatus.ACTIVE)
            .toList();
    }

    @Override
    public PlatformTier requireActiveTier(String tierKey, int version) {
        return tiers.stream()
            .filter(tier -> tier.status() == PlatformTierStatus.ACTIVE)
            .filter(tier -> tier.tierKey().equals(tierKey) && tier.version() == version)
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Active platform tier not found"));
    }

    public static InMemoryPlatformTierCatalog defaultCatalog() {
        List<PlatformTier> tiers = List.of(
            new PlatformTier(
                UUID.nameUUIDFromBytes("hotspot_creator_v1".getBytes()),
                "creator",
                1,
                "Creator",
                null,
                "USD",
                999,
                List.of(EntitlementKey.CREATOR_MONETIZATION, EntitlementKey.LIVE_STREAMING),
                PlatformTierStatus.ACTIVE
            ),
            new PlatformTier(
                UUID.nameUUIDFromBytes("hotspot_marketing_v1".getBytes()),
                "marketing",
                1,
                "Marketing",
                null,
                "USD",
                499,
                List.of(EntitlementKey.MARKETING_ACCESS),
                PlatformTierStatus.ACTIVE
            )
        );
        return new InMemoryPlatformTierCatalog(tiers);
    }
}
