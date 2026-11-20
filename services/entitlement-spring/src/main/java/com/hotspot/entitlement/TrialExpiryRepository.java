package com.hotspot.entitlement;

import java.time.Instant;
import java.util.List;

public interface TrialExpiryRepository {
    List<TrialExpiryRecord> findExpiredTrials(Instant now, int limit);
}
