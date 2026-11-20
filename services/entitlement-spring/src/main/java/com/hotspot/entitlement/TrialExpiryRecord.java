package com.hotspot.entitlement;

import java.time.Instant;
import java.util.UUID;

public record TrialExpiryRecord(
    UUID userId,
    Instant trialEndsAt
) {
}
