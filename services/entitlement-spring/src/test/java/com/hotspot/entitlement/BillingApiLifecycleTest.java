package com.hotspot.entitlement;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class BillingApiLifecycleTest {
    @Test
    void effectiveEndpointDataReflectsGrantThenRevokeLifecycle() {
        UUID userId = UUID.randomUUID();
        UUID grantEventId = UUID.randomUUID();
        UUID revokeEventId = UUID.randomUUID();
        Instant now = Instant.parse("2026-11-20T00:00:00Z");

        InMemoryBillingRepository repository = new InMemoryBillingRepository();
        EntitlementService service = new EntitlementService(repository);

        EntitlementGrant grant = new EntitlementGrant(
            userId,
            EntitlementKey.MARKETING_ACCESS,
            EntitlementSource.PLATFORM_SUBSCRIPTION,
            "sub_billing_1",
            1,
            now,
            now.plusSeconds(30 * 24 * 60 * 60)
        );

        assertTrue(service.grantOnce(grant, grantEventId));
        assertTrue(service.hasEntitlement(userId, EntitlementKey.MARKETING_ACCESS, now.plusSeconds(1)));

        assertTrue(service.revoke(grant, "subscription canceled", revokeEventId));
        assertFalse(service.hasEntitlement(userId, EntitlementKey.MARKETING_ACCESS, now.plusSeconds(2)));
        assertEquals(0, service.effectiveEntitlements(userId, now.plusSeconds(2)).size());
    }

    private static class InMemoryBillingRepository implements EntitlementRepository {
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
                .filter(entitlement -> entitlement.isEffectiveAt(now))
                .toList();
        }
    }
}
