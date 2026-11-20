package com.hotspot.entitlement;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.UUID;

public class StripeWebhookPayloadParser {
    private final ObjectMapper objectMapper;

    public StripeWebhookPayloadParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public StripeWebhookEvent parse(String payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            String eventId = text(root, "id");
            String eventType = text(root, "type");

            if (eventId == null || eventType == null) {
                throw new IllegalArgumentException("Stripe event id and type are required");
            }

            JsonNode data = root.path("data").path("object");
            String customerId = text(data, "customer");
            String subscriptionId = text(data, "subscription");
            if (subscriptionId == null) {
                subscriptionId = text(data, "id");
            }

            String invoiceId = text(data, "invoice");
            if (invoiceId == null) {
                invoiceId = text(data, "id");
            }

            String checkoutSessionId = text(data, "id");
            String priceId = extractPriceId(data);

            JsonNode metadata = data.path("metadata");
            UUID userId = null;
            String userIdText = text(metadata, "hotspot_user_id");
            if (userIdText != null) {
                try {
                    userId = UUID.fromString(userIdText);
                } catch (IllegalArgumentException exception) {
                    throw new IllegalArgumentException("Stripe metadata hotspot_user_id must be a UUID");
                }
            }

            StripeWebhookAction action = switch (eventType) {
                case "checkout.session.completed", "invoice.paid" ->
                    StripeWebhookAction.GRANT_PLATFORM_ACCESS;
                case "customer.subscription.deleted", "invoice.payment_failed",
                     "charge.refunded", "charge.dispute.created" ->
                    StripeWebhookAction.REVOKE_PLATFORM_ACCESS;
                default -> StripeWebhookAction.IGNORED;
            };

            return new StripeWebhookEvent(
                eventId,
                eventType,
                customerId,
                subscriptionId,
                invoiceId,
                checkoutSessionId,
                priceId,
                userId,
                action
            );
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid Stripe webhook JSON", exception);
        }
    }

    private String extractPriceId(JsonNode data) {
        JsonNode lineItems = data.path("lines").path("data");
        if (lineItems.isArray() && !lineItems.isEmpty()) {
            JsonNode price = lineItems.path(0).path("price");
            String priceId = text(price, "id");
            if (priceId != null) {
                return priceId;
            }
        }

        JsonNode items = data.path("items").path("data");
        if (items.isArray() && !items.isEmpty()) {
            String priceId = text(items.path(0).path("price"), "id");
            if (priceId != null) {
                return priceId;
            }
        }

        JsonNode metadata = data.path("metadata");
        return text(metadata, "hotspot_tier_price_id");
    }

    private static String text(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        String text = value.asText();
        return text == null || text.isBlank() ? null : text;
    }
}
