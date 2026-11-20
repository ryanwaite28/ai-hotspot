package com.hotspot.entitlement;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class StripeWebhookProcessorTest {
    @Test
    void rejectsInvalidSignatureBeforeParsing() {
        StripeWebhookProcessor processor = processorWithSecret("whsec_test", new InMemoryMutations());

        assertThrows(IllegalArgumentException.class,
            () -> processor.process("{\"id\":\"evt_1\",\"type\":\"customer.created\",\"data\":{\"object\":{}}}",
                "t=1,v1=invalid", Instant.now()));
    }

    @Test
    void ignoresUnsupportedEventAfterValidSignature() throws Exception {
        String secret = "whsec_test";
        String payload = "{\"id\":\"evt_ignored\",\"type\":\"customer.created\",\"data\":{\"object\":{}}}";
        long timestamp = Instant.now().getEpochSecond();
        String signature = validSignature(secret, payload, timestamp);

        StripeWebhookProcessor processor = processorWithSecret(secret, new InMemoryMutations());
        assertFalse(processor.process(payload, signature, Instant.ofEpochSecond(timestamp)));
    }

    private StripeWebhookProcessor processorWithSecret(String secret, InMemoryMutations mutations) {
        StripeWebhookSignatureVerifier verifier = new StripeWebhookSignatureVerifier(secret);
        StripeWebhookPayloadParser parser = new StripeWebhookPayloadParser(new ObjectMapper());
        StripeEventRepository eventRepository = new InMemoryStripeEvents();
        StripeEntitlementProcessor entitlementProcessor = new StripeEntitlementProcessor(eventRepository, mutations);
        PlatformTierCatalog catalog = InMemoryPlatformTierCatalog.defaultCatalog();
        return new StripeWebhookProcessor(verifier, parser, entitlementProcessor, catalog);
    }

    private static String validSignature(String secret, String payload, long timestamp) throws Exception {
        javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
        mac.init(new javax.crypto.spec.SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] raw = mac.doFinal((timestamp + "." + payload).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return "t=" + timestamp + ",v1=" + java.util.HexFormat.of().formatHex(raw);
    }

    private static class InMemoryMutations implements EntitlementMutationPort {
        @Override
        public boolean grantOnce(EntitlementGrant grant, UUID eventId) {
            return true;
        }

        @Override
        public boolean revoke(EntitlementGrant grant, String reason, UUID eventId) {
            return true;
        }
    }

    private static class InMemoryStripeEvents implements StripeEventRepository {
        private final Map<String, StripeEventStatus> statuses = new HashMap<>();

        @Override
        public boolean tryStartEvent(String eventId, String eventType, String payloadHash, Instant receivedAt) {
            if (statuses.get(eventId) == StripeEventStatus.PROCESSED
                || statuses.get(eventId) == StripeEventStatus.PROCESSING) {
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
}
