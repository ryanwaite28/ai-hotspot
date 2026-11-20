package com.hotspot.entitlement;

import java.time.Instant;

public record StripeEventRecord(
    String eventId,
    String eventType,
    String payloadHash,
    StripeEventStatus status,
    Instant receivedAt,
    Instant processedAt,
    String failureReason
) {
}
