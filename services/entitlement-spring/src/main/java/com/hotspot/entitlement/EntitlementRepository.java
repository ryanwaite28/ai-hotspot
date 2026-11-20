package com.hotspot.entitlement;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface EntitlementRepository {
    boolean grantOnce(EntitlementGrant grant, UUID eventId);
    boolean revoke(EntitlementGrant grant, String reason, UUID eventId);
    List<EffectiveEntitlement> findEffective(UUID userId, Instant now);
}
