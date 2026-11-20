package com.hotspot.entitlement;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Configuration
public class EntitlementConfiguration {
    @Bean
    public PlatformTierCatalog platformTierCatalog() {
        return InMemoryPlatformTierCatalog.defaultCatalog();
    }

    @Bean
    public EntitlementRepository entitlementRepository(org.springframework.jdbc.core.JdbcTemplate jdbcTemplate,
                                                        org.springframework.core.env.Environment environment) {
        if ("jdbc".equalsIgnoreCase(environment.getProperty("entitlement.repository", "memory"))) {
            return new JdbcEntitlementRepository(jdbcTemplate);
        }
        return new InMemoryEntitlementRepository();
    }

    @Bean
    public EntitlementService entitlementService(EntitlementRepository repository) {
        return new EntitlementService(repository);
    }

    @Bean
    public StripeEventRepository stripeEventRepository() {
        return new InMemoryStripeEventRepository();
    }

    @Bean
    public EntitlementMutationPort entitlementMutationPort(EntitlementRepository repository) {
        return new EntitlementMutationPort() {
            @Override
            public boolean grantOnce(EntitlementGrant grant, UUID eventId) {
                return repository.grantOnce(grant, eventId);
            }

            @Override
            public boolean revoke(EntitlementGrant grant, String reason, UUID eventId) {
                return repository.revoke(grant, reason, eventId);
            }
        };
    }

    @Bean
    public StripeEntitlementProcessor stripeEntitlementProcessor(
        StripeEventRepository stripeEvents,
        EntitlementMutationPort entitlementMutations
    ) {
        return new StripeEntitlementProcessor(stripeEvents, entitlementMutations);
    }

    @Bean
    public StripeCheckoutPort stripeCheckoutPort() {
        return new LocalStripeCheckoutPort();
    }

    @Bean
    public PlatformCheckoutService platformCheckoutService(
        PlatformTierCatalog catalog,
        StripeCheckoutPort checkoutPort
    ) {
        return new PlatformCheckoutService(catalog, checkoutPort);
    }

    @Bean
    public StripeWebhookSignatureVerifier stripeWebhookSignatureVerifier(
        org.springframework.core.env.Environment environment
    ) {
        String secret = environment.getProperty("STRIPE_WEBHOOK_SECRET", "whsec_replace_me");
        return new StripeWebhookSignatureVerifier(secret);
    }

    @Bean
    public StripeWebhookPayloadParser stripeWebhookPayloadParser(
        com.fasterxml.jackson.databind.ObjectMapper objectMapper
    ) {
        return new StripeWebhookPayloadParser(objectMapper);
    }

    @Bean
    public StripeWebhookProcessor stripeWebhookProcessor(
        StripeWebhookSignatureVerifier signatureVerifier,
        StripeWebhookPayloadParser payloadParser,
        StripeEntitlementProcessor entitlementProcessor,
        PlatformTierCatalog tierCatalog
    ) {
        return new StripeWebhookProcessor(signatureVerifier, payloadParser, entitlementProcessor, tierCatalog);
    }

    @Bean
    public TrialExpiryRepository trialExpiryRepository(org.springframework.jdbc.core.JdbcTemplate jdbcTemplate,
                                                        org.springframework.core.env.Environment environment) {
        if ("jdbc".equalsIgnoreCase(environment.getProperty("entitlement.repository", "memory"))) {
            return (now, limit) -> jdbcTemplate.query("""
                SELECT u.id AS user_id, u.trial_ends_at
                FROM users u
                WHERE u.trial_activated_once = TRUE
                  AND u.trial_ends_at IS NOT NULL
                  AND u.trial_ends_at <= ?
                ORDER BY u.trial_ends_at ASC
                LIMIT ?
                """,
                (row, rowNumber) -> new TrialExpiryRecord(
                    java.util.UUID.fromString(row.getString("user_id")),
                    row.getTimestamp("trial_ends_at").toInstant()
                ),
                java.sql.Timestamp.from(now), limit
            );
        }

        return (now, limit) -> java.util.List.of();
    }

    @Bean
    public TrialExpiryWorker trialExpiryWorker(
        TrialExpiryRepository trialRepository,
        EntitlementMutationPort entitlementMutations
    ) {
        return new TrialExpiryWorker(trialRepository, entitlementMutations);
    }

    static class InMemoryEntitlementRepository implements EntitlementRepository {
        private final List<EffectiveEntitlement> active = new ArrayList<>();
        private final List<UUID> seenEvents = new ArrayList<>();

        @Override
        public synchronized boolean grantOnce(EntitlementGrant grant, UUID eventId) {
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
        public synchronized boolean revoke(EntitlementGrant grant, String reason, UUID eventId) {
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
        public synchronized List<EffectiveEntitlement> findEffective(UUID userId, java.time.Instant now) {
            return active.stream()
                .filter(entitlement -> entitlement.userId().equals(userId))
                .filter(entitlement -> entitlement.isEffectiveAt(now))
                .toList();
        }
    }

    static class InMemoryStripeEventRepository implements StripeEventRepository {
        private final java.util.Map<String, StripeEventStatus> statuses = new java.util.HashMap<>();

        @Override
        public synchronized boolean tryStartEvent(String eventId, String eventType, String payloadHash, java.time.Instant receivedAt) {
            StripeEventStatus status = statuses.get(eventId);
            if (status == StripeEventStatus.PROCESSING || status == StripeEventStatus.PROCESSED) {
                return false;
            }
            statuses.put(eventId, StripeEventStatus.PROCESSING);
            return true;
        }

        @Override
        public synchronized void markProcessed(String eventId, java.time.Instant processedAt) {
            statuses.put(eventId, StripeEventStatus.PROCESSED);
        }

        @Override
        public synchronized void markFailed(String eventId, String failureReason, java.time.Instant processedAt) {
            statuses.put(eventId, StripeEventStatus.FAILED);
        }
    }
}
