package com.hotspot.entitlement;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class StripeWebhookPayloadParserTest {
    @Test
    void parsesCheckoutCompletionAndMapsGrantAction() {
        String payload = """
            {
              "id":"evt_checkout_1",
              "type":"checkout.session.completed",
              "data":{"object":{"id":"cs_test_1","customer":"cus_1","subscription":"sub_1","metadata":{"hotspot_user_id":"00000000-0000-0000-0000-000000000123","hotspot_tier_price_id":"price_hotspot_creator_v1"}}}
            }
            """;

        StripeWebhookPayloadParser parser = new StripeWebhookPayloadParser(new ObjectMapper());
        StripeWebhookEvent event = parser.parse(payload);

        assertEquals("evt_checkout_1", event.eventId());
        assertEquals(StripeWebhookAction.GRANT_PLATFORM_ACCESS, event.action());
        assertEquals("price_hotspot_creator_v1", event.priceId());
        assertNotNull(event.userId());
    }

    @Test
    void mapsCancellationToRevokeAndUnknownToIgnored() {
        StripeWebhookPayloadParser parser = new StripeWebhookPayloadParser(new ObjectMapper());

        StripeWebhookEvent canceled = parser.parse("""
            {"id":"evt_cancel","type":"customer.subscription.deleted","data":{"object":{"id":"sub_cancel","metadata":{"hotspot_user_id":"00000000-0000-0000-0000-000000000123","hotspot_tier_price_id":"price_hotspot_creator_v1"}}}}
            """);
        assertEquals(StripeWebhookAction.REVOKE_PLATFORM_ACCESS, canceled.action());

        StripeWebhookEvent unknown = parser.parse("""
            {"id":"evt_unknown","type":"customer.created","data":{"object":{"id":"cus_1"}}}
            """);
        assertEquals(StripeWebhookAction.IGNORED, unknown.action());
    }

    @Test
    void rejectsMissingEventIdentityAndInvalidUserMetadata() {
        StripeWebhookPayloadParser parser = new StripeWebhookPayloadParser(new ObjectMapper());

        assertThrows(IllegalArgumentException.class,
            () -> parser.parse("{\"type\":\"checkout.session.completed\",\"data\":{\"object\":{}}}"));

        assertThrows(IllegalArgumentException.class,
            () -> parser.parse("{\"id\":\"evt_bad\",\"type\":\"checkout.session.completed\",\"data\":{\"object\":{\"metadata\":{\"hotspot_user_id\":\"not-a-uuid\"}}}}}"));
    }
}
