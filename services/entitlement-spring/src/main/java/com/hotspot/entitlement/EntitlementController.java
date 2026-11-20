package com.hotspot.entitlement;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/entitlements")
public class EntitlementController {
    private final EntitlementService entitlementService;

    public EntitlementController(EntitlementService entitlementService) {
        this.entitlementService = entitlementService;
    }

    @GetMapping("/{userId}/effective")
    public ResponseEntity<List<EffectiveEntitlement>> effective(
        @PathVariable UUID userId,
        @RequestParam(required = false) Instant at
    ) {
        Instant now = at == null ? Instant.now() : at;
        return ResponseEntity.ok(entitlementService.effectiveEntitlements(userId, now));
    }
}
