package com.hotspot.entitlement;

import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@EnableScheduling
public class TrialExpiryScheduler {
    private final TrialExpiryWorker worker;

    public TrialExpiryScheduler(TrialExpiryWorker worker) {
        this.worker = worker;
    }

    @Scheduled(fixedDelayString = "${trial.expiry.poll-ms:300000}")
    public void expireTrials() {
        worker.expireTrials(Instant.now(), 200);
    }
}
