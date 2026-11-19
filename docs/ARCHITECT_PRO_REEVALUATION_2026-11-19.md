# Architect-Pro Re-Evaluation (2026-11-19)

## Scope

Re-evaluation of HotSpot architecture and implementation status using the architect-pro-system-design guardrails.

## Findings

### Critical

None.

### High

1. Reliability gap if mutation events are published inline without transactional coupling.
- Risk: state commit succeeds but event publish fails, creating invisible cross-service drift.
- Required correction: outbox-backed event publication as a mandatory architecture pattern.

2. Checklist completeness gap for event-driven architecture rollout.
- Event intent existed implicitly but not as explicit phase-tracked work for auth/user mutation events and subscriber integration tests.
- Required correction: add explicit plan checkboxes and implementation constraints.

### Medium

1. Event naming and subscriber contract consistency needed stronger standardization.
- Required correction: document domain-scoped event names and shared email service contract usage.

2. RabbitMQ connectivity scope needed clearer wording.
- Required correction: clarify that mutable backend services integrate through event-port abstractions and outbox publishers, while frontend does not connect directly.

### Low

1. Existing architecture already strongly aligned with dispatch/orchestration boundaries and idempotency direction.
- Incremental event-architecture upgrades are feasible without topology rewrite.

## Conformance Check

- Dispatch layer boundaries documented: PASS
- Orchestration in service modules: PASS
- Data access confined to repositories/query modules: PASS
- Event-driven mutation architecture explicitly documented: PASS (updated)
- Phase status realism for event work: PASS (updated)

## Corrective Actions Applied

1. Added explicit mutation-event NFR requirements including outbox and delivery guarantees.
2. Expanded architecture section with mutation eventing rules, naming examples, and subscriber flow examples.
3. Added outbox table blueprint to data model guidance.
4. Updated RabbitMQ topology guidance for domain routing keys and service integration scope.
5. Added Phase 1 checklist items for auth/user outbox events and event integration tests.
6. Extended project rules to require outbox-backed mutation emission and block handler-level direct publication.

## Event-Driven Mutation Architecture Evaluation (2026-11-19)

### Decision

Implement this pattern.

### Rationale

- Aligns with async/idempotency NFRs and service-layer orchestration principles.
- Enables independent reaction workflows (for example welcome email and email-reset verification flows) without synchronous coupling.
- Improves auditability, replay, and resilience under retries/failures.

### Constraints and Guardrails

- Use outbox-backed publication only; no direct handler-level RabbitMQ publish calls.
- Keep event contracts versioned and idempotent.
- Enforce stable event metadata (`event_id`, aggregate reference, occurrence time, version where applicable).
- Roll out incrementally by bounded context to control complexity and operational load.

### Implementation Options

1. Recommended now: incremental outbox per mutable service.
- Each mutable service writes domain state plus outbox event in one DB transaction.
- Shared publisher worker drains outbox and publishes to RabbitMQ.
- Pros: strongest correctness, replayability, and bounded-context ownership.
- Cons: migration and publisher worker complexity.

2. Fast start: direct service publish without outbox.
- Service commits DB, then publishes event immediately.
- Pros: fastest initial development.
- Cons: non-atomic failure window and weaker reliability.

3. Central event gateway service.
- Mutable services call one internal event gateway that owns RabbitMQ publishing.
- Pros: centralized policy and contract governance.
- Cons: extra network hop and potential bottleneck on constrained hardware.

### Recommended Rollout Sequence

1. Auth/User mutation events plus notification/email subscribers.
2. Billing/entitlement mutation events.
3. Post/media/story mutation events.
4. Moderation/live mutation events.

## Recommended Next Steps (Phase 1)

1. Implement auth/user outbox persistence and publisher worker.
2. Implement user mutation events: user.created, user.updated, user.suspended, user.flagged, user.email-reset-requested.
3. Implement notification/email subscribers that call shared email service contracts (templateId + templateParams + recipient).
4. Add integration tests for deduplication, retry, DLQ, and replay behavior.
