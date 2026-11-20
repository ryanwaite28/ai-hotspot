package com.hotspot.entitlement;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class StripeWebhookSignatureVerifierTest {
    @Test
    void verifiesValidV1SignatureAndRejectsStaleTimestamp() throws Exception {
        String secret = "whsec_test_secret";
        String payload = "{\"id\":\"evt_test\",\"type\":\"checkout.session.completed\"}";
        long timestamp = 1763510400L;

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] raw = mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8));
        String hex = java.util.HexFormat.of().formatHex(raw);

        StripeWebhookSignatureVerifier verifier = new StripeWebhookSignatureVerifier(secret);
        assertTrue(verifier.verify(payload, "t=" + timestamp + ",v1=" + hex,
            Instant.ofEpochSecond(timestamp + 30)));
        assertFalse(verifier.verify(payload, "t=" + timestamp + ",v1=" + hex,
            Instant.ofEpochSecond(timestamp + 301)));
    }
}
