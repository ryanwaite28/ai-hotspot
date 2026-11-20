package com.hotspot.entitlement;

import java.time.Instant;
import java.util.UUID;

public class StripeEntitlementProcessor {
    private final StripeEventRepository stripeEvents;
    private final EntitlementMutationPort entitlementMutations;

    public StripeEntitlementProcessor(
        StripeEventRepository stripeEvents,
        EntitlementMutationPort entitlementMutations
    ) {
        this.stripeEvents = stripeEvents;
        this.entitlementMutations = entitlementMutations;
    }

    public boolean processGrant(
        String eventId,
        String eventType,
        String payloadHash,
        EntitlementGrant grant,
        Instant receivedAt
    ) {
        if (!stripeEvents.tryStartEvent(eventId, eventType, payloadHash, receivedAt)) {
            return false;
        }

        try {
            boolean applied = entitlementMutations.grantOnce(grant, UUID.fromString(eventId));
            if (!applied) {
                throw new IllegalStateException("Entitlement grant did not apply");
            }
            stripeEvents.markProcessed(eventId, Instant.now());
            return true;
        } catch (RuntimeException exception) {
            stripeEvents.markFailed(eventId, exception.getMessage(), Instant.now());
            throw exception;
        }
    }

    public boolean processRevoke(
        String eventId,
        String eventType,
        String payloadHash,
        EntitlementGrant grant,
        String reason,
        Instant receivedAt
    ) {
        if (!stripeEvents.tryStartEvent(eventId, eventType, payloadHash, receivedAt)) {
            return false;
        }

        try {
            boolean applied = entitlementMutations.revoke(grant, reason, UUID.fromString(eventId));
            if (!applied) {
                throw new IllegalStateException("Entitlement revoke did not apply");
            }
            stripeEvents.markProcessed(eventId, Instant.now());
            return true;
        } catch (RuntimeException exception) {
            stripeEvents.markFailed(eventId, exception.getMessage(), Instant.now());
            throw exception;
        }
    }
}
