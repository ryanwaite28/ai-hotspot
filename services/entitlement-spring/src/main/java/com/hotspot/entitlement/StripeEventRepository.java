package com.hotspot.entitlement;

import java.time.Instant;

public interface StripeEventRepository {
    boolean tryStartEvent(String eventId, String eventType, String payloadHash, Instant receivedAt);
    void markProcessed(String eventId, Instant processedAt);
    void markFailed(String eventId, String failureReason, Instant processedAt);
}
