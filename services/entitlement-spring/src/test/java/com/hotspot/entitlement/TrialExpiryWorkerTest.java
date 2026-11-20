package com.hotspot.entitlement;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TrialExpiryWorkerTest {
    @Test
    void expiresTrialKeysExactlyAtExpiryBoundary() {
        UUID userId = UUID.randomUUID();
        Instant endedAt = Instant.parse("2026-11-20T00:00:00Z");

        CapturingMutationPort mutations = new CapturingMutationPort();
        TrialExpiryRepository repository = new TrialExpiryRepository() {
            @Override
            public List<TrialExpiryRecord> findExpiredTrials(Instant now, int limit) {
                if (!now.equals(endedAt)) {
                    return List.of();
                }
                return List.of(new TrialExpiryRecord(userId, endedAt));
            }
        };

        TrialExpiryWorker worker = new TrialExpiryWorker(repository, mutations);

        assertEquals(4, worker.expireTrials(endedAt, 100));
        assertEquals(4, mutations.revokeCount);
        assertEquals(4, worker.expireTrials(endedAt.minusSeconds(1), 100));
    }

    @Test
    void rejectsNonPositiveExpiryLimit() {
        TrialExpiryRepository repository = (now, limit) -> List.of();
        TrialExpiryWorker worker = new TrialExpiryWorker(repository, new CapturingMutationPort());

        assertThrows(IllegalArgumentException.class,
            () -> worker.expireTrials(Instant.parse("2026-11-20T00:00:00Z"), 0));
    }

    private static class CapturingMutationPort implements EntitlementMutationPort {
        private int revokeCount;

        @Override
        public boolean grantOnce(EntitlementGrant grant, UUID eventId) {
            return true;
        }

        @Override
        public boolean revoke(EntitlementGrant grant, String reason, UUID eventId) {
            revokeCount++;
            return true;
        }
    }
}
