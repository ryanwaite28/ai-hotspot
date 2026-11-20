package com.hotspot.entitlement;

import java.util.List;

public interface PlatformTierCatalog {
    List<PlatformTier> activeTiers();
    PlatformTier requireActiveTier(String tierKey, int version);
}
