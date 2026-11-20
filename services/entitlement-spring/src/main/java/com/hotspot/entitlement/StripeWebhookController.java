package com.hotspot.entitlement;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/v1/stripe")
public class StripeWebhookController {
    private final StripeWebhookProcessor webhookProcessor;

    public StripeWebhookController(StripeWebhookProcessor webhookProcessor) {
        this.webhookProcessor = webhookProcessor;
    }

    @PostMapping("/webhooks")
    public ResponseEntity<StripeWebhookResult> receiveWebhook(
        @RequestBody String payload,
        @RequestHeader("Stripe-Signature") String signatureHeader
    ) {
        try {
            boolean processed = webhookProcessor.process(payload, signatureHeader, Instant.now());
            return ResponseEntity.ok(new StripeWebhookResult(processed, processed
                ? "PROCESSED"
                : "DUPLICATE_OR_IGNORED"));
        } catch (IllegalArgumentException exception) {
            if ("STRIPE_SIGNATURE_INVALID".equals(exception.getMessage())) {
                return ResponseEntity.badRequest().body(
                    new StripeWebhookResult(false, "STRIPE_SIGNATURE_INVALID")
                );
            }
            throw exception;
        }
    }
}
