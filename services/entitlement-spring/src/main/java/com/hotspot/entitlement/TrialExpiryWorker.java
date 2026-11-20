package com.hotspot.entitlement;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class TrialExpiryWorker {
    private final TrialExpiryRepository trialRepository;
    private final EntitlementMutationPort mutations;

    public TrialExpiryWorker(
        TrialExpiryRepository trialRepository,
        EntitlementMutationPort mutations
    ) {
        this.trialRepository = trialRepository;
        this.mutations = mutations;
    }

    public int expireTrials(Instant now, int limit) {
        if (limit <= 0) {
            throw new IllegalArgumentException("Trial expiry limit must be positive");
        }

        List<TrialExpiryRecord> expired = trialRepository.findExpiredTrials(now, limit);
        int expiredCount = 0;

        for (TrialExpiryRecord trial : expired) {
            for (EntitlementKey key : List.of(
                EntitlementKey.MARKETING_ACCESS,
                EntitlementKey.CREATOR_MONETIZATION,
                EntitlementKey.LIVE_STREAMING,
                EntitlementKey.SUBSCRIBER_FEATURED_CONTENT
            )) {
                EntitlementGrant grant = new EntitlementGrant(
                    trial.userId(),
                    key,
                    EntitlementSource.TRIAL,
                    "trial:" + trial.userId(),
                    1,
                    trial.trialEndsAt().minusSeconds(7 * 24 * 60 * 60),
                    trial.trialEndsAt()
                );

                UUID eventId = UUID.nameUUIDFromBytes(
                    ("trial-expired:" + trial.userId() + ":" + trial.trialEndsAt()).getBytes()
                );
                boolean revoked = mutations.revoke(grant, "trial expired", eventId);
                if (revoked) {
                    expiredCount++;
                }
            }
        }

        return expiredCount;
    }
}
