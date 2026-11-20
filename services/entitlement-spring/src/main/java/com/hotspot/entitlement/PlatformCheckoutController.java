package com.hotspot.entitlement;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/v1/billing/platform")
public class PlatformCheckoutController {
    private final PlatformCheckoutService checkoutService;

    public PlatformCheckoutController(PlatformCheckoutService checkoutService) {
        this.checkoutService = checkoutService;
    }

    @PostMapping("/checkout")
    public ResponseEntity<CheckoutSession> createCheckout(
        @RequestHeader("X-HotSpot-Actor-User-Id") String actorUserIdHeader,
        @Valid @RequestBody PlatformCheckoutRequest request
    ) {
        UUID actorUserId;
        try {
            actorUserId = UUID.fromString(actorUserIdHeader);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid authenticated actor user ID");
        }
        CheckoutSession session = checkoutService.createSession(new CheckoutSessionRequest(
            actorUserId,
            request.tierKey(),
            request.tierVersion(),
            null,
            URI.create(request.successUrl()),
            URI.create(request.cancelUrl())
        ));
        return ResponseEntity.ok(session);
    }
}
