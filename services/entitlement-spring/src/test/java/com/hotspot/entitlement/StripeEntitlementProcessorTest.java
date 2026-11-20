package com.hotspot.entitlement;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class StripeEntitlementProcessorTest {
    @Test
    void duplicateStripeEventIsNotAppliedTwice() {
        InMemoryStripeEvents stripeEvents = new InMemoryStripeEvents();
        InMemoryMutations mutations = new InMemoryMutations();
        StripeEntitlementProcessor processor = new StripeEntitlementProcessor(stripeEvents, mutations);

        UUID userId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        EntitlementGrant grant = new EntitlementGrant(
            userId,
            EntitlementKey.LIVE_STREAMING,
            EntitlementSource.PLATFORM_SUBSCRIPTION,
            "sub_123",
            1,
            Instant.parse("2026-11-19T00:00:00Z"),
            Instant.parse("2026-11-20T00:00:00Z")
        );

        assertTrue(processor.processGrant(
            eventId.toString(), "checkout.session.completed", "hash-1", grant,
            Instant.parse("2026-11-19T00:00:01Z")
        ));
        assertFalse(processor.processGrant(
            eventId.toString(), "checkout.session.completed", "hash-1", grant,
            Instant.parse("2026-11-19T00:00:02Z")
        ));
        assertEquals(1, mutations.grantCount);
    }

    @Test
    void failedStripeEventCanBeRetried() {
        InMemoryStripeEvents stripeEvents = new InMemoryStripeEvents();
        InMemoryMutations mutations = new InMemoryMutations();
        StripeEntitlementProcessor processor = new StripeEntitlementProcessor(stripeEvents, mutations);

        UUID eventId = UUID.randomUUID();
        EntitlementGrant grant = new EntitlementGrant(
            UUID.randomUUID(),
            EntitlementKey.MARKETING_ACCESS,
            EntitlementSource.PLATFORM_SUBSCRIPTION,
            "sub_retry",
            1,
            Instant.parse("2026-11-19T00:00:00Z"),
            null
        );

        mutations.failNextGrant = true;
        assertThrows(IllegalStateException.class, () -> processor.processGrant(
            eventId.toString(), "invoice.paid", "hash-2", grant,
            Instant.parse("2026-11-19T00:00:01Z")
        ));

        assertEquals(StripeEventStatus.FAILED, stripeEvents.statuses.get(eventId.toString()));

        mutations.failNextGrant = false;
        assertTrue(processor.processGrant(
            eventId.toString(), "invoice.paid", "hash-2", grant,
            Instant.parse("2026-11-19T00:00:02Z")
        ));
    }

    private static class InMemoryStripeEvents implements StripeEventRepository {
        private final Map<String, StripeEventStatus> statuses = new HashMap<>();

        @Override
        public boolean tryStartEvent(String eventId, String eventType, String payloadHash, Instant receivedAt) {
            StripeEventStatus status = statuses.get(eventId);
            if (status == StripeEventStatus.PROCESSED || status == StripeEventStatus.PROCESSING) {
                return false;
            }
            statuses.put(eventId, StripeEventStatus.PROCESSING);
            return true;
        }

        @Override
        public void markProcessed(String eventId, Instant processedAt) {
            statuses.put(eventId, StripeEventStatus.PROCESSED);
        }

        @Override
        public void markFailed(String eventId, String failureReason, Instant processedAt) {
            statuses.put(eventId, StripeEventStatus.FAILED);
        }
    }

    private static class InMemoryMutations implements EntitlementMutationPort {
        private int grantCount;
        private boolean failNextGrant;

        @Override
        public boolean grantOnce(EntitlementGrant grant, UUID eventId) {
            if (failNextGrant) {
                failNextGrant = false;
                throw new IllegalStateException("database unavailable");
            }
            grantCount++;
            return true;
        }

        @Override
        public boolean revoke(EntitlementGrant grant, String reason, UUID eventId) {
            return true;
        }
    }
}
