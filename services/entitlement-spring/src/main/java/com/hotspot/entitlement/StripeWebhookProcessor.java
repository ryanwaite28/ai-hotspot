package com.hotspot.entitlement;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.UUID;

public class StripeWebhookProcessor {
    private final StripeWebhookSignatureVerifier signatureVerifier;
    private final StripeWebhookPayloadParser payloadParser;
    private final StripeEntitlementProcessor entitlementProcessor;
    private final PlatformTierCatalog tierCatalog;

    public StripeWebhookProcessor(
        StripeWebhookSignatureVerifier signatureVerifier,
        StripeWebhookPayloadParser payloadParser,
        StripeEntitlementProcessor entitlementProcessor,
        PlatformTierCatalog tierCatalog
    ) {
        this.signatureVerifier = signatureVerifier;
        this.payloadParser = payloadParser;
        this.entitlementProcessor = entitlementProcessor;
        this.tierCatalog = tierCatalog;
    }

    public boolean process(String payload, String signatureHeader, Instant receivedAt) {
        if (!signatureVerifier.verify(payload, signatureHeader, receivedAt)) {
            throw new IllegalArgumentException("STRIPE_SIGNATURE_INVALID");
        }

        StripeWebhookEvent event = payloadParser.parse(payload);
        String payloadHash = sha256(payload);

        if (event.action() == StripeWebhookAction.IGNORED) {
            return false;
        }

        if (event.userId() == null) {
            throw new IllegalArgumentException("Stripe event metadata hotspot_user_id is required");
        }

        PlatformTier tier = resolveTier(event);

        if (event.action() == StripeWebhookAction.GRANT_PLATFORM_ACCESS) {
            EntitlementGrant grant = new EntitlementGrant(
                event.userId(),
                tier.entitlementKeys().size() == 1
                    ? tier.entitlementKeys().get(0)
                    : EntitlementKey.CREATOR_MONETIZATION,
                EntitlementSource.PLATFORM_SUBSCRIPTION,
                event.subscriptionId() != null ? event.subscriptionId()
                    : event.checkoutSessionId() != null ? event.checkoutSessionId()
                    : event.invoiceId(),
                tier.version(),
                receivedAt,
                null
            );

            for (EntitlementKey key : tier.entitlementKeys()) {
                EntitlementGrant tierGrant = new EntitlementGrant(
                    grant.userId(), key, grant.source(), grant.sourceRef(), grant.sourceVersion(),
                    grant.startsAt(), grant.endsAt()
                );
                entitlementProcessor.processGrant(
                    event.eventId(), event.eventType(), payloadHash, tierGrant, receivedAt
                );
            }
            return true;
        }

        for (EntitlementKey key : tier.entitlementKeys()) {
            EntitlementGrant revoke = new EntitlementGrant(
                event.userId(), key, EntitlementSource.PLATFORM_SUBSCRIPTION,
                event.subscriptionId() != null ? event.subscriptionId()
                    : event.checkoutSessionId() != null ? event.checkoutSessionId()
                    : event.invoiceId(),
                tier.version(), receivedAt, null
            );
            entitlementProcessor.processRevoke(
                event.eventId(), event.eventType(), payloadHash, revoke,
                event.eventType(), receivedAt
            );
        }
        return true;
    }

    private PlatformTier resolveTier(StripeWebhookEvent event) {
        if (event.priceId() == null) {
            throw new IllegalArgumentException("Stripe event price ID is required");
        }

        return tierCatalog.activeTiers().stream()
            .filter(tier -> event.priceId().equals(tier.stripePriceId()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Stripe price is not mapped to an active platform tier"));
    }

    private static String sha256(String payload) {
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
                .digest(payload.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
