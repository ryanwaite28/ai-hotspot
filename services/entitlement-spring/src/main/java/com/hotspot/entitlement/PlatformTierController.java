package com.hotspot.entitlement;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/platform-tiers")
public class PlatformTierController {
    private final PlatformTierCatalog catalog;

    public PlatformTierController(PlatformTierCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping
    public ResponseEntity<List<PlatformTier>> activeTiers() {
        return ResponseEntity.ok(catalog.activeTiers());
    }
}
