package com.hotspot.entitlement;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class EntitlementServiceTest {
    @Test
    void grantsAndDetectsEffectiveEntitlementOnce() {
        InMemoryRepository repository = new InMemoryRepository();
        EntitlementService service = new EntitlementService(repository);
        UUID userId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        Instant now = Instant.parse("2026-11-19T00:00:00Z");

        EntitlementGrant grant = new EntitlementGrant(
            userId,
            EntitlementKey.LIVE_STREAMING,
            EntitlementSource.PLATFORM_SUBSCRIPTION,
            "sub_test_123",
            1,
            now,
            now.plusSeconds(86400)
        );

        assertTrue(service.grantOnce(grant, eventId));
        assertFalse(service.grantOnce(grant, eventId));
        assertTrue(service.hasEntitlement(userId, EntitlementKey.LIVE_STREAMING, now.plusSeconds(3600)));
        assertFalse(service.hasEntitlement(userId, EntitlementKey.LIVE_STREAMING, now.plusSeconds(86400)));
    }

    @Test
    void revokeRemovesEntitlementAndRequiresReason() {
        InMemoryRepository repository = new InMemoryRepository();
        EntitlementService service = new EntitlementService(repository);
        UUID userId = UUID.randomUUID();
        Instant now = Instant.parse("2026-11-19T00:00:00Z");

        EntitlementGrant grant = new EntitlementGrant(
            userId,
            EntitlementKey.MARKETING_ACCESS,
            EntitlementSource.PLATFORM_SUBSCRIPTION,
            "sub_cancel_123",
            1,
            now,
            null
        );

        assertTrue(service.grantOnce(grant, UUID.randomUUID()));
        assertTrue(service.revoke(grant, "subscription canceled", UUID.randomUUID()));
        assertFalse(service.hasEntitlement(userId, EntitlementKey.MARKETING_ACCESS, now.plusSeconds(1)));

        assertThrows(IllegalArgumentException.class,
            () -> service.revoke(grant, "  ", UUID.randomUUID()));
    }

    private static class InMemoryRepository implements EntitlementRepository {
        private final List<EffectiveEntitlement> active = new ArrayList<>();
        private final List<UUID> seenEvents = new ArrayList<>();

        @Override
        public boolean grantOnce(EntitlementGrant grant, UUID eventId) {
            if (seenEvents.contains(eventId)) {
                return false;
            }
            seenEvents.add(eventId);
            active.add(new EffectiveEntitlement(
                grant.userId(), grant.entitlementKey(), grant.source(), grant.sourceRef(),
                grant.startsAt(), grant.endsAt()
            ));
            return true;
        }

        @Override
        public boolean revoke(EntitlementGrant grant, String reason, UUID eventId) {
            if (seenEvents.contains(eventId)) {
                return false;
            }
            seenEvents.add(eventId);
            return active.removeIf(entitlement ->
                entitlement.userId().equals(grant.userId())
                    && entitlement.entitlementKey() == grant.entitlementKey()
                    && grant.sourceRef().equals(entitlement.sourceRef())
            );
        }

        @Override
        public List<EffectiveEntitlement> findEffective(UUID userId, Instant now) {
            return active.stream()
                .filter(entitlement -> entitlement.userId().equals(userId))
                .toList();
        }
    }
}
