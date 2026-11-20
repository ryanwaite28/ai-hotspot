# HotSpot Entitlement Spring Service

## Scope

This service owns versioned platform tiers and effective entitlement decisions. It currently provides:

- typed entitlement keys and sources
- deterministic grant/revoke domain operations
- event-ID dedupe in the repository contract
- memory and JDBC repository adapters
- transactional grant/revoke audit and outbox SQL foundations
- retryable Stripe event lifecycle processor
- HMAC-SHA256 Stripe webhook signature verification
- active tier and effective entitlement HTTP read endpoints
- PostgreSQL migrations for tier, entitlement, and Stripe event foundations
- platform-tier checkout session service and HTTP endpoint
- local/test Stripe checkout adapter seam

## Not implemented yet

- real Stripe SDK Checkout session transport
- persistent JDBC Stripe event ledger implementation
- retry/DLQ worker integration
- trial expiry worker
- full transactional persistence test environment

## Build prerequisites

Java 21 and Maven 3.9+ are required.

```bash
cd services/entitlement-spring
mvn test
mvn spring-boot:run
```

No Stripe secret or tier state should be accepted from browser/API-reported data.
