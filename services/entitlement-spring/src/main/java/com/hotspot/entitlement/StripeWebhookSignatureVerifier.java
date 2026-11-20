package com.hotspot.entitlement;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

public class StripeWebhookSignatureVerifier {
    private final String signingSecret;

    public StripeWebhookSignatureVerifier(String signingSecret) {
        if (signingSecret == null || signingSecret.trim().isEmpty()) {
            throw new IllegalArgumentException("Stripe webhook signing secret is required");
        }
        this.signingSecret = signingSecret.trim();
    }

    public boolean verify(String payload, String signatureHeader, Instant now) {
        if (payload == null || signatureHeader == null) {
            return false;
        }

        String timestamp = null;
        java.util.List<String> signatures = new java.util.ArrayList<>();
        for (String item : signatureHeader.split(",")) {
            String[] pair = item.trim().split("=", 2);
            if (pair.length != 2) {
                continue;
            }
            if (pair[0].equals("t")) {
                timestamp = pair[1];
            } else if (pair[0].equals("v1")) {
                signatures.add(pair[1]);
            }
        }

        if (timestamp == null || signatures.isEmpty()) {
            return false;
        }

        final long timestampSeconds;
        try {
            timestampSeconds = Long.parseLong(timestamp);
        } catch (NumberFormatException exception) {
            return false;
        }

        long ageSeconds = Math.abs(now.getEpochSecond() - timestampSeconds);
        if (ageSeconds > 300) {
            return false;
        }

        String signedPayload = timestamp + "." + payload;
        String expected;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(signingSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8));
            expected = toHex(raw);
        } catch (Exception exception) {
            return false;
        }

        for (String signature : signatures) {
            if (MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), signature.getBytes(StandardCharsets.US_ASCII))) {
                return true;
            }
        }
        return false;
    }

    private static String toHex(byte[] bytes) {
        StringBuilder value = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) {
            value.append(Character.forDigit((item >> 4) & 0xf, 16));
            value.append(Character.forDigit(item & 0xf, 16));
        }
        return value.toString();
    }
}
