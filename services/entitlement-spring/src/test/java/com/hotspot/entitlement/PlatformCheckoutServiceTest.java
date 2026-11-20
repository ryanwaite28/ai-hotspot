package com.hotspot.entitlement;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class PlatformCheckoutServiceTest {
    @Test
    void createsCheckoutFromServerSideActiveTierCatalog() {
        UUID userId = UUID.randomUUID();
        PlatformTier tier = new PlatformTier(
            UUID.randomUUID(), "creator", 1, "Creator", "price_creator_test",
            "USD", 999,
            List.of(EntitlementKey.CREATOR_MONETIZATION, EntitlementKey.LIVE_STREAMING),
            PlatformTierStatus.ACTIVE
        );
        CapturingCheckoutPort checkoutPort = new CapturingCheckoutPort();
        PlatformCheckoutService service = new PlatformCheckoutService(
            new InMemoryPlatformTierCatalog(List.of(tier)), checkoutPort
        );

        CheckoutSession session = service.createSession(new CheckoutSessionRequest(
            userId,
            "creator",
            1,
            null,
            URI.create("https://hotspot.rmwhs.com/checkout/success"),
            URI.create("https://hotspot.rmwhs.com/checkout/cancel")
        ));

        assertEquals("cs_test_creator", session.sessionId());
        assertEquals("creator", checkoutPort.lastRequest.tierKey());
        assertEquals("price_creator_test", checkoutPort.lastRequest.stripePriceId());
        assertEquals(userId, checkoutPort.lastRequest.userId());
    }

    @Test
    void rejectsInactiveTierAndMissingCheckoutUrls() {
        PlatformTier tier = new PlatformTier(
            UUID.randomUUID(), "marketing", 1, "Marketing", "price_marketing_test",
            "USD", 499, List.of(EntitlementKey.MARKETING_ACCESS),
            PlatformTierStatus.ARCHIVED
        );
        PlatformCheckoutService service = new PlatformCheckoutService(
            new InMemoryPlatformTierCatalog(List.of(tier)), new CapturingCheckoutPort()
        );

        assertThrows(IllegalArgumentException.class, () -> service.createSession(new CheckoutSessionRequest(
            UUID.randomUUID(), "marketing", 1, null,
            URI.create("https://hotspot.rmwhs.com/success"),
            URI.create("https://hotspot.rmwhs.com/cancel")
        )));

        assertThrows(IllegalArgumentException.class, () -> service.createSession(new CheckoutSessionRequest(
            UUID.randomUUID(), "marketing", 1, null, null,
            URI.create("https://hotspot.rmwhs.com/cancel")
        )));
    }

    private static class CapturingCheckoutPort implements StripeCheckoutPort {
        private CheckoutSessionRequest lastRequest;

        @Override
        public CheckoutSession createSession(CheckoutSessionRequest request) {
            lastRequest = request;
            return new CheckoutSession(
                "cs_test_creator",
                URI.create("https://checkout.stripe.com/cs/test"),
                request.tierKey(),
                request.tierVersion()
            );
        }
    }
}
