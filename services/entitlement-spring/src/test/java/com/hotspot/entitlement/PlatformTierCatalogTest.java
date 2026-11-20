package com.hotspot.entitlement;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class PlatformTierCatalogTest {
    @Test
    void returnsOnlyActiveVersionedTiers() {
        InMemoryPlatformTierCatalog catalog = InMemoryPlatformTierCatalog.defaultCatalog();

        assertEquals(2, catalog.activeTiers().size());
        PlatformTier creator = catalog.requireActiveTier("creator", 1);

        assertEquals("Creator", creator.name());
        assertTrue(creator.entitlementKeys().contains(EntitlementKey.CREATOR_MONETIZATION));
        assertTrue(creator.entitlementKeys().contains(EntitlementKey.LIVE_STREAMING));
        assertThrows(IllegalArgumentException.class,
            () -> catalog.requireActiveTier("creator", 999));
    }
}
