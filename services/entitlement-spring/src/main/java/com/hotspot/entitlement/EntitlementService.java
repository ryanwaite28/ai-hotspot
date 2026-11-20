package com.hotspot.entitlement;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class EntitlementService {
    private final EntitlementRepository repository;

    public EntitlementService(EntitlementRepository repository) {
        this.repository = repository;
    }

    public boolean grantOnce(EntitlementGrant grant, UUID eventId) {
        if (grant.userId() == null || grant.entitlementKey() == null || grant.source() == null) {
            throw new IllegalArgumentException("Entitlement grant identity fields are required");
        }
        if (grant.startsAt() == null) {
            throw new IllegalArgumentException("Entitlement startsAt is required");
        }
        if (grant.endsAt() != null && grant.endsAt().isBefore(grant.startsAt())) {
            throw new IllegalArgumentException("Entitlement endsAt cannot precede startsAt");
        }
        return repository.grantOnce(grant, eventId);
    }

    public boolean revoke(EntitlementGrant grant, String reason, UUID eventId) {
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Entitlement revoke reason is required");
        }
        return repository.revoke(grant, reason.trim(), eventId);
    }

    public boolean hasEntitlement(UUID userId, EntitlementKey key, Instant now) {
        return repository.findEffective(userId, now).stream()
            .anyMatch(entitlement -> entitlement.entitlementKey() == key && entitlement.isEffectiveAt(now));
    }

    public List<EffectiveEntitlement> effectiveEntitlements(UUID userId, Instant now) {
        return repository.findEffective(userId, now);
    }
}
