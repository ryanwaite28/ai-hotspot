# HotSpot Changelog

## 2026-11-22 — Cluster update: `optiplex` storage-dedicated node

### Completed

- Labeled k3s agent node `optiplex` with `node-role.kubernetes.io/storage=true` and `dedicated=storage`, and tainted it `dedicated=storage:NoSchedule`, so it hosts only data stores (databases, Redis, object storage).
- Updated `docs/KUBERNETES_GITLAB_CONTEXT.md`: two-node topology, new §1.1 on node roles and scheduling (toleration + nodeSelector stanza, the first-deploy PVC-binding warning), and revised capacity, storage, HA, and onboarding-checklist text.
- Updated `PROJECT.md`, which the user explicitly requested. Rationale: the cluster gained a second node set aside for stateful storage, and the spec's single-node assumptions no longer hold. Changed: the §1.5 cluster row, NFR-12 per-node capacity, the §4.3 placement diagram and compute row, §5.1 cluster facts, the new §5.6.1 Node Placement, the §5.9.2 CDN rationale, the §9.7 deploy checklist, and the Phase 13 release item.
- Updated `CLAUDE.md` environment notes and K3s deployment rules with the node-placement rule.

### Verification evidence

- `kubectl get node optiplex -o jsonpath='{.spec.taints}'` → `[{"effect":"NoSchedule","key":"dedicated","value":"storage"}]`
- `optiplex` capacity: 4 vCPU / 15728652Ki memory. `elitedesk-800`: 4 vCPU / 23957108Ki.
- The existing pods on `optiplex` were all DaemonSet pods (node-exporter, OpenObserve collector, svclb for Infisical ingress) and kept running. The taint is NoSchedule, not NoExecute.

### Unresolved

- The `svclb-infisical-ingress-nginx-controller` DaemonSet does not tolerate `dedicated`. Its existing pod on `optiplex` stays, but if that pod is recreated it won't come back on that node. Accept this, or add a toleration to the svclb if the Infisical LoadBalancer has to answer on `optiplex`'s IP.
- No HotSpot data-store manifests exist in `k8s/` yet. Phase 13 must add the `optiplex` nodeSelector/toleration (`PROJECT.md` §5.6.1) when PostgreSQL/MongoDB/Redis/MinIO releases are created.
- Existing infrastructure data stores (Infisical PostgreSQL/Redis, GitLab data) remain on `elitedesk-800`. Migrating them is optional and out of scope.

### Next

- No phase change. Resume at the previously recorded next phase.

## 2026-11-20 — Copilot session steering mechanism

### Completed

- Added a reusable `session-steering` skill to keep implementation sessions aligned with `PROJECT.md`, architecture boundaries, and active skills.
- Added a steering checklist reference for start/in-session/exit gates.
- Updated `.github/copilot-instructions.md` to require session steering gates for all implementation sessions.
- Updated `PROJECT.md` with a mandatory Session Steering Protocol under the implementation plan.

### Verification evidence

- VS Code diagnostics check passed with no errors in:
	- `.github/skills/session-steering/SKILL.md`
	- `.github/skills/session-steering/references/session-steering-checklist.md`
	- `.github/copilot-instructions.md`
	- `.github/skills/README.md`
	- `PROJECT.md`

### Deferred

- Add optional automation (pre-commit or CI doc checks) to enforce changelog evidence formatting and phase lock metadata.

## 2026-11-20 — Gateway auth microservice boundary split

### Completed

- Replaced gateway auth traffic dependency on `SocialServiceClient` with a dedicated `AuthServiceClient` and provider token wiring.
- Added `AUTH_SERVICE_URL` as canonical gateway auth downstream setting, with transitional fallback to `SOCIAL_SERVICE_URL`.
- Updated gateway auth controller wiring to use the dedicated auth client.
- Updated architecture spec to enforce domain-scoped microservices and one typed gateway client per downstream microservice domain.

### Verification evidence

- VS Code diagnostics check passed with no errors in:
	- `gateway/nest-http/src/clients/auth-service.client.ts`
	- `gateway/nest-http/src/app.module.ts`
	- `gateway/nest-http/src/main.ts`
	- `gateway/nest-http/src/handlers/auth/auth.controller.ts`
	- `PROJECT.md`

### Deferred

- Runtime extraction of auth domain from social service into an independent auth deployment.
- Dedicated gateway clients and protected-header forwarding adapters for all remaining downstream domains (social, entitlement, media, identity).

## 2026-11-20 — Posts vertical-slice NestJS simplification

### Completed

- Added social service internal posts dispatch controller at `/internal/v1/posts/**` with transport-only request mapping.
- Converted posts domain wiring to idiomatic NestJS provider injection:
	- `PostsService` is now an injectable service.
	- `PostgresPostsRepository` is now an injectable repository.
	- Added explicit provider tokens for query executor and posts repository.
- Wired posts controller/providers into the social service `AppModule` while keeping all domain decisions in `PostsService`.

### Verification evidence

- VS Code diagnostics check passed with no errors in:
	- `services/social-nest/src/handlers/posts/posts.controller.ts`
	- `services/social-nest/src/service/posts/posts.service.ts`
	- `services/social-nest/src/service/posts/postgres-posts.repository.ts`
	- `services/social-nest/src/app.module.ts`

### Deferred

- Gateway-to-social posts client routing and gateway dispatch endpoints for posts remain to be wired.
- Remaining domains (`social`, `media`, `stories`, `campaigns`, `live`, `creator-subscriptions`) still need the same DI/module migration pattern.

## 2026-11-20 — Architecture reconciliation and NestJS DI simplification

### Completed

- Reconciled implementation-plan semantics in `PROJECT.md` with an explicit architecture baseline that distinguishes implemented/scaffolded/deferred work.
- Added reconciliation controls requiring FR-level runtime evidence before marking delivery complete.
- Simplified social auth dispatch wiring by replacing custom `AUTH_HANDLER` token object mapping with direct `AuthService` injection in the social service Nest module/controller.
- Simplified gateway client wiring by replacing manual object construction with idiomatic NestJS provider/token injection for `SocialServiceClient`.

### Verification evidence

- VS Code diagnostics check passed with no errors in:
	- `services/social-nest/src/app.module.ts`
	- `services/social-nest/src/handlers/auth/auth.controller.ts`
	- `gateway/nest-http/src/app.module.ts`
	- `gateway/nest-http/src/clients/social-service.client.ts`

### Deferred

- Convert remaining social domain composition factories to explicit NestJS modules/providers (`services/social-nest/src/service/**`).
- Build a phase-by-phase implemented/scaffolded/deferred evidence matrix in the changelog.

## 2026-11-20 — Phase 12 frontend MVP foundation

### Completed

- Scaffolded Next.js/React/TypeScript web workspace under `apps/web`.
- Added typed API client and frontend domain view contracts.
- Added authentication, verification, login, compose, feed, media, stories, subscriptions, campaigns, live, and settings route shells.
- Added skip navigation, semantic form labels, navigation labeling, visible focus guidance, and accessibility/E2E specification foundation.
- Wired root npm scripts for web development, build, and typecheck.

### Verification evidence

- Source/VS Code diagnostics: no errors found in added web, package, or documentation files.
- Browser build/E2E execution remains pending dependency installation and Next.js package availability.
- Upgraded Next.js to patched 16.4.6.
- Browser build verified: Next.js 16.4.6 production build passed with 13 static routes.
- Strict TypeScript check passed; npm audit reported 0 vulnerabilities.

## 2026-11-20 — Phase 11 notification preference and moderation foundation

### Completed

- Added notification preference contracts and default-enabled delivery gate.
- Added transactional email template routing for subscription, billing, campaign, moderation, and live events.
- Extended notification RabbitMQ routing keys for Phase 11 event types.
- Added report/case lifecycle contracts and open/triaged/escalated/resolved/appealed states.
- Added appeal and append-only moderation audit foundations.
- Added notification/moderation unit coverage, including idempotent retry behavior.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/moderation/moderation.service.test.ts workers/notification-node/subscribers/subscribers.test.ts workers/notification-node/subscribers/transactional-template.subscriber.test.ts`
- Result: 11 passed, 0 failed.

### Pending

- Moderation dashboard UI
- Durable fake/bot escalation automation
- RabbitMQ runtime/DLQ infrastructure verification

## 2026-11-20 — Phase 10 live streaming foundation

### Completed

- Added live stream, credential, and live chat contracts.
- Added scheduled/start/live/paused/ended/canceled lifecycle state transitions.
- Added paid/trial entitlement gates and public/followers/subscribers visibility checks.
- Added short-lived publish/viewer credential port with in-memory local adapter.
- Added live chat length, visibility, and moderation-state scaffolding.
- Added opt-in recording fields and live-stream migration foundations.
- Added lifecycle unit coverage.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/live/live.service.test.ts`
- Result: 2 passed, 0 failed.

### Pending

- LiveKit SDK and isolated K3s deployment
- Durable live chat persistence/worker integration
- Real room credential/signaling transport
- VOD processing and visibility integration

## 2026-11-20 — Phase 9 campaign foundation

### Completed

- Added typed campaign model, objective, placement, status, and aggregate metrics contracts.
- Added campaign draft/review/status lifecycle service and outbox-backed SQL repository foundation.
- Added paid-platform/trial entitlement gate for paid campaign creation.
- Added budget, schedule, currency, HTTPS creative/destination, and category validation.
- Added clearly labeled sponsor placement metadata and prohibited sensitive/PII targeting by contract scope.
- Added unit coverage for entitlement denial and campaign validation lifecycle.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/campaigns/campaigns.service.test.ts`
- Result: 2 passed, 0 failed.

### Pending

- External ad billing/payment integration
- Real aggregate metric ingestion/reporting persistence
- Ad policy/moderation operator review workflow

## 2026-11-20 — Phase 8 creator-tier CRUD foundation

### Completed

- Added shared creator-tier contracts and exports.
- Added create/update/archive service operations with creator-owner enforcement and validation.
- Added PostgreSQL creator-tier query/repository and outbox-backed mutation SQL.
- Added migration foundation for recurring interval, subscriber limits, and updated timestamps.
- Added unit coverage for owner-only updates and archive behavior.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/creator-subscriptions/creator-tiers.service.test.ts`
- Result: 2 passed, 0 failed.

### Pending

- Stripe Connect account setup and payout adapter
- Creator subscription checkout
- Tier-specific featured-content access
- Subscriber lifecycle/cancellation/refunds/disputes/renewals

## 2026-11-20 — Phase 7 platform Checkout foundation

### Completed

- Added typed platform Checkout session request, result, and Stripe checkout port contracts.
- Added catalog-authoritative Checkout service that resolves active tier and configured Stripe price server-side.
- Added authenticated-actor HTTP Checkout endpoint under `/v1/billing/platform/checkout`.
- Added local/test checkout adapter and JUnit checkout coverage.
- Configured default Creator and Marketing tiers with explicit test price IDs.

### Verification evidence

- Source/VS Code diagnostics: no errors found in added Java, JUnit, Maven, migration, or documentation files.
- Runtime Maven verification remains unavailable because Java/Maven executables are not present in the current shell.

### Pending

- Real Stripe SDK Checkout transport
- HTTP webhook payload mapping
- Persistent JDBC Stripe event ledger
- Trial expiry worker
- Billing integration tests and deployment evidence

## 2026-11-19 — Phase 7 entitlement foundation started

### Completed

- Scaffolded Java 21/Maven/Spring Boot entitlement service under `services/entitlement-spring`.
- Added typed entitlement keys, sources, grants, effective-entitlement records, service orchestration, and repository port.
- Added one-time grant/revoke behavior with event-ID dedupe contract and active-time evaluation.
- Added versioned platform-tier catalog records and active-tier HTTP read endpoint.
- Added effective-entitlement HTTP read endpoint.
- Added PostgreSQL migration foundations for tier catalog, entitlement lifecycle fields, and audit events.
- Added JUnit unit coverage for entitlement grant/revoke and platform tier catalog behavior.

### Verification evidence

- Source/VS Code diagnostics: no errors found in added Java, Maven, migration, or test files.
- Runtime Maven verification was unavailable because Java/Maven executables are not present in the current shell.

### Pending

- Persistent JPA/PostgreSQL repository implementation
- Stripe Checkout and signed webhook verification/deduplication
- Transactional grant/revoke/audit/outbox publication
- Trial expiry worker
- Billing API integration coverage and Kubernetes deployment evidence

## 2026-11-19 — Phase 6 stitch/duet remix foundation

### Completed

- Added typed stitch/duet derivative contracts:
	- `MediaDerivativeType`
	- stitch timeline assembly
	- duet split-screen layout assembly
	- derivative relationship view and create input
	- file: `packages/contracts/src/media-contracts.ts`
- Added service-layer remix and derivative enforcement:
	- source and destination assets must be READY
	- both assets must allow remix
	- actor must own at least one source/destination asset
	- stitch timeline boundaries are validated
	- duet split layouts are validated
	- source/destination cannot be the same asset
	- file: `services/social-nest/src/service/media/media.service.ts`
- Added derivative relationship repository/SQL/outbox foundation:
	- explicit `media_asset_derivatives` table migration
	- `media.derivative.created` outbox event
	- duplicate relationship protection
	- files:
		- `services/social-nest/src/db/queries/media.queries.ts`
		- `services/social-nest/src/service/media/postgres-media.repository.ts`
		- `prisma/migrations/20261119_phase6_derivative_relationships/migration.sql`
		- `prisma/schema.prisma`
- Added media handler derivative entrypoint:
	- `gateway/nest-http/src/handlers/media/media.handler.ts`
- Added unit coverage for allowed stitch/duet creation and blocked/unready/invalid derivatives:
	- `services/social-nest/src/service/media/media.service.test.ts`

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/media/media.service.test.ts`
- Result: 6 passed, 0 failed.

### Pending

- Source author attribution propagation
- Takedown propagation
- Derivative processing lifecycle tests

## 2026-11-19 — Phase 5 checklist closure (cleanup + edge-case tests)

### Completed

- Marked Phase 5 "Implement MongoDB TTL or cleanup worker" complete via the already-implemented cleanup worker runtime.
- Added story edge-case test coverage for:
	- exact expiry boundary semantics (story is inaccessible at `expires_at` second)
	- hidden/blocked behavior for otherwise public stories
	- reply-delivery rejection for blocked viewers and expired stories
	- file: `services/social-nest/src/service/stories/stories.service.test.ts`
- Updated `PROJECT.md` to mark the remaining Phase 5 checklist items complete.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/stories/stories.service.test.ts`

## 2026-11-19 — Notification idempotency lifecycle reliability upgrade

### Completed

- Refactored notification subscriber idempotency from single-step consume markers to lifecycle state transitions:
	- `tryStartProcessing` claim
	- `markProcessed` on successful side-effect completion
	- `markFailed` on side-effect failure for retry eligibility
	- file: `workers/notification-node/subscribers/event-idempotency.store.ts`
- Updated notification subscribers to finalize idempotency only after successful email delivery and persist failure state on exceptions:
	- `workers/notification-node/subscribers/user-created-email-welcome.subscriber.ts`
	- `workers/notification-node/subscribers/user-email-reset-requested.subscriber.ts`
	- `workers/notification-node/subscribers/story-reply-created-notification.subscriber.ts`
- Reworked subscriber idempotency SQL/repository contracts for lifecycle semantics with lease-aware reclaims:
	- `services/social-nest/src/db/queries/subscriber-idempotency.queries.ts`
	- `services/social-nest/src/service/events/subscriber-idempotency.repository.ts`
- Added schema migration and Prisma model updates for lifecycle fields (`attempt_count`, `first_seen_at`, `last_attempt_at`, `lease_expires_at`, `completed_at`, `last_error`) plus status/lease index:
	- `prisma/migrations/20261119_phase1_subscriber_idempotency_lifecycle/migration.sql`
	- `prisma/schema.prisma`
- Updated tests/mocks to new interface and added retry-after-failure coverage:
	- `workers/notification-node/subscribers/subscribers.test.ts`
	- `workers/notification-node/rabbitmq/notification.runtime.integration.test.ts`

### Verification evidence

- `node -r ts-node/register/transpile-only --test workers/notification-node/subscribers/subscribers.test.ts`

## 2026-11-19 — Phase 5 delayed cleanup and story reply delivery

### Completed

- Added story reply delivery contracts and service flow:
	- added `createStoryReply` input/result contracts
	- added stories service/handler reply flow with visibility checks and trimmed reply body validation
	- added outbox enqueue path for `story.reply.created`
	- files:
		- `packages/contracts/src/story-contracts.ts`
		- `gateway/nest-http/src/handlers/stories/stories.handler.ts`
		- `services/social-nest/src/service/stories/stories.service.ts`
		- `services/social-nest/src/service/stories/postgres-stories.repository.ts`
		- `services/social-nest/src/db/queries/stories.queries.ts`
- Added notification-worker support for story reply events:
	- `story.reply.created` contract in domain events
	- new `StoryReplyCreatedNotificationSubscriber`
	- default notification routing key now includes `story.reply.created`
	- files:
		- `packages/contracts/src/domain-events.ts`
		- `workers/notification-node/subscribers/story-reply-created-notification.subscriber.ts`
		- `workers/notification-node/bootstrap.ts`
		- `workers/notification-node/rabbitmq/notification-consumer.ts`
		- `workers/notification-node/subscribers/subscribers.test.ts`
- Added delayed cleanup worker runtime with API-only boundary:
	- stories service API client for periodic `expireStories` calls
	- cleanup worker bootstrap and executable main with interval loop and graceful shutdown
	- new npm script and env variables
	- files:
		- `workers/cleanup-node/stories-service-api.client.ts`
		- `workers/cleanup-node/bootstrap.ts`
		- `workers/cleanup-node/main.ts`
		- `workers/cleanup-node/stories-service-api.client.test.ts`
		- `workers/cleanup-node/bootstrap.test.ts`
		- `package.json`
		- `.env.example`
- Updated `PROJECT.md` Phase 5 checklist to mark delayed cleanup + story reply delivery complete.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/stories/stories.service.test.ts workers/notification-node/subscribers/subscribers.test.ts workers/cleanup-node/bootstrap.test.ts workers/cleanup-node/stories-service-api.client.test.ts`

## 2026-11-19 — Phase 5 stories visibility and viewer records

### Completed

- Added story visibility and viewer-tracking contracts:
	- `packages/contracts/src/story-contracts.ts`
- Extended stories query/repository paths with:
	- active-story lookup
	- viewer/author relationship state checks (`follows` + `blocks`)
	- files:
		- `services/social-nest/src/db/queries/stories.queries.ts`
		- `services/social-nest/src/service/stories/postgres-stories.repository.ts`
- Implemented story-view and viewer-summary service operations:
	- visibility enforcement for `public`, `followers`, and owner-only `close_friends`
	- owner-only viewer summary access
	- files:
		- `services/social-nest/src/service/stories/stories.service.ts`
		- `gateway/nest-http/src/handlers/stories/stories.handler.ts`
- Added story-view tracking port implementations:
	- Mongo-backed `story_views` repository
	- in-memory fallback for local/test contexts
	- files:
		- `services/social-nest/src/db/mongo/story-views.repository.ts`
		- `services/social-nest/src/service/stories/stories.composition.ts`
- Expanded stories service tests to cover visibility gates and owner-only viewer summaries.
- Updated `PROJECT.md` Phase 5 checklist to mark “Implement story visibility and viewer records” complete.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/stories/stories.service.test.ts`
- result: 5 passed, 0 failed.

## 2026-11-19 — Phase 5 stories started (creation + expiry)

### Completed

- Added typed story contracts and exports:
	- `packages/contracts/src/story-contracts.ts`
	- `packages/contracts/src/index.ts`
- Added stories data-access/query layer with outbox-backed mutation SQL:
	- ready-media eligibility check for story publish
	- story publish insert with `story.created` outbox event
	- active-story query by author
	- expiry cleanup delete with `story.expired` outbox event
	- file: `services/social-nest/src/db/queries/stories.queries.ts`
- Added stories service/repository/handler composition for Phase 5 foundations:
	- `services/social-nest/src/service/stories/postgres-stories.repository.ts`
	- `services/social-nest/src/service/stories/stories.service.ts`
	- `gateway/nest-http/src/handlers/stories/stories.handler.ts`
	- `services/social-nest/src/service/stories/stories.composition.ts`
- Added unit tests covering:
	- strict 24-hour expiry assignment at publish time
	- publish rejection when media is not ready/eligible
	- expiry cleanup behavior and expired story IDs
	- file: `services/social-nest/src/service/stories/stories.service.test.ts`
- Updated `PROJECT.md` Phase 5 checklist to mark “Implement story creation and 24-hour expiry” complete.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/stories/stories.service.test.ts`
- result: 3 passed, 0 failed.

## 2026-11-19 — Dev domain planning context update

### Completed

- Updated project planning context to include the new Cloudflare dev domain:
	- dev domain: `rmwhs-dev.space`
	- wildcard support: `*.rmwhs-dev.space`
	- constraint: no deep subdomain support.
- Updated `PROJECT.md` dev identity/base URLs and ingress/domain planning notes to require single-label dev hostnames.
- Updated `CLAUDE.md` ingress/domain guidance so coding sessions apply the same hostname constraint.

## 2026-11-19 — Phase 4 in-cluster media caching gateway rollout

### Completed

- Added Kubernetes manifests for an in-cluster media caching gateway in `hotspot-dev`:
	- NGINX deployment with non-root runtime, probes, resource limits, and read-only filesystem controls.
	- Service exposing the gateway internally.
	- Ingress route on `media.dev.hotspot.rmwhs.com` via `nginx-external`.
	- ConfigMap-backed NGINX cache configuration (`X-Cache-Status`, proxy cache, and object-storage upstream).
- Wired all media gateway resources into `k8s/kustomization.yaml`.
- Marked Phase 4 checklist item complete in `PROJECT.md`.

### Operator note

- `k8s/services/hotspot-media-gateway-configmap.yaml` contains `replace-with-object-storage-origin:9000` and must be set to the active object-storage origin host before apply.

## 2026-11-19 — Worker DB-boundary enforcement refactor

### Completed

- Refactored media worker runtime to remove direct PostgreSQL connections from worker code.
- Replaced worker-side DB composition usage with an API client boundary:
	- added `MediaServiceApiClient` for worker-to-service API calls
	- worker now posts processing status to service API endpoints instead of opening DB clients.
- Updated worker bootstrap dependency model from service composition/runtime wiring to API-client wiring.
- Added tests for media service API client request mapping and error behavior.
- Added explicit worker boundary guidance to docs:
	- `PROJECT.md` now states worker apps cannot open database connections and must call service APIs/contracts.
	- `CLAUDE.md` now mirrors the same non-negotiable runtime rule.
- Added worker env variables for API endpoint integration in `.env.example`.

### Verification evidence

- `node -r ts-node/register/transpile-only --test workers/media-node/bootstrap.test.ts workers/media-node/media-service-api.client.test.ts workers/media-node/rabbitmq/media-processing-consumer.test.ts workers/media-node/subscribers/media-processing.subscriber.test.ts`

## 2026-11-19 — Phase 4 media worker runtime and derivative contract

### Completed

- Added immutable derivative processing contract fields in shared media contracts.
- Implemented derivative key and cache-control policy generation in media service for READY assets:
	- immutable key version `v1`
	- derivative cache header `public, max-age=31536000, immutable`
	- derivative variants emitted by media kind (`thumbnail` and `transcode` policy entries).
- Extended metadata persistence contract and adapters to store derivative processing contract data:
	- in-memory metadata adapter
	- Mongo metadata repository (`media_derivatives` collection).
- Added runnable media worker bootstrap/runtime path:
	- media subscriber router
	- worker bootstrap composition
	- worker main entrypoint with Postgres/RabbitMQ env checks and graceful shutdown.
- Added media worker script and queue env defaults:
	- `package.json` (`worker:media`)
	- `.env.example` (`MEDIA_PROCESSING_EXCHANGE`, `MEDIA_PROCESSING_QUEUE`).

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/media/media.service.test.ts workers/media-node/subscribers/media-processing.subscriber.test.ts workers/media-node/rabbitmq/media-processing-consumer.test.ts workers/media-node/bootstrap.test.ts`
- result: 9 passed, 0 failed.

## 2026-11-19 — Phase 4 media pipeline continuation

### Completed

- Added upload-session completion orchestration in media service/handler:
	- `completeUploadSession(...)` transitions callback-confirmed assets from `uploading` to `uploaded` and then requests processing (`processing`) with outbox-backed events.
- Extended Postgres media repository/query support for upload-session completion and asset lookup by upload session.
- Added concrete Mongo metadata repository adapter and composition wiring:
	- when `MONGODB_URL` is set, metadata writes use Mongo collections (`media_assets`, `media_comments`)
	- when unavailable, composition falls back to in-memory metadata adapter for local testability.
- Added media processing worker scaffolding in Node worker path:
	- RabbitMQ consumer for `media.processing.requested`
	- subscriber that maps processing-requested events into media service `ready` transition updates.
- Added unit tests for:
	- upload-complete callback flow
	- media processing consumer ack/nack behavior
	- media processing subscriber event handling.
- Added MongoDB package dependency required for the concrete metadata adapter.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/media/media.service.test.ts workers/media-node/subscribers/media-processing.subscriber.test.ts workers/media-node/rabbitmq/media-processing-consumer.test.ts`
- result: 8 passed, 0 failed.

## 2026-11-19 — CDN strategy approved for k3s homelab

### Completed

- Documented approved media delivery decision in the master spec:
	- in-cluster caching gateway in front of S3-compatible object storage (Option 1)
	- Cloudflare remains internet edge cache and TLS boundary
	- deferred image-optimization CDN layer (Option 2) pending measured need
	- rejected object-store replacement for static serving only (Option 3) at current phase
- Added delivery guardrails and rollout hooks under infrastructure strategy:
	- immutable derivative key/cache-control policy requirement
	- in-cluster media gateway deployment/service/ingress requirement
	- cache-hit/origin-read observability requirement
- Added architect-pro addendum to capture rationale and constraints.

### Files updated

- `PROJECT.md`
- `docs/ARCHITECT_PRO_REEVALUATION_2026-11-19.md`

## 2026-11-19 — Phase 4 media foundation started

### Completed

- Added Phase 4 media contracts for upload sessions, media assets, processing states, and media comments:
	- `packages/contracts/src/media-contracts.ts`
	- updated exports in `packages/contracts/src/index.ts`
- Implemented API-side media service scaffolding with strict typed service/repository boundaries:
	- `services/social-nest/src/db/queries/media.queries.ts`
	- `services/social-nest/src/service/media/postgres-media.repository.ts`
	- `services/social-nest/src/service/media/media.service.ts`
	- `gateway/nest-http/src/handlers/media/media.handler.ts`
	- `services/social-nest/src/service/media/media.composition.ts`
- Added media lifecycle logic for:
	- resumable upload session creation
	- MIME/size validation
	- media processing status transitions (`uploading -> uploaded -> processing -> ready`)
	- ready-gated media comments/replies
	- outbox-backed mutation events (`media.created`, `media.uploaded`, `media.processing.requested`, `media.ready`, `media.comment.created`)
- Added PostgreSQL schema migration and Prisma model updates for media foundation:
	- `prisma/migrations/20261119_phase4_media_foundation/migration.sql`
	- `prisma/schema.prisma`
- Added RabbitMQ media queue topology constants with retry/DLQ queue definitions:
	- `packages/rabbitmq/src/media-topology.ts`
	- `packages/rabbitmq/src/index.ts`
- Added Mongo index spec scaffold for media assets and media comments:
	- `mongo/indexes/media_assets.indexes.js`
- Added Python media worker scaffold entrypoint for processing-event handling:
	- `services/media-python/worker.py`
- Added media unit tests and runtime-integration harness/tests:
	- `services/social-nest/src/service/media/media.service.test.ts`
	- `services/social-nest/src/service/media/media.runtime.integration.harness.ts`
	- `services/social-nest/src/service/media/media.runtime.integration.test.ts`
- Added script for Phase 4 runtime integration runs:
	- `package.json` (`test:phase4:runtime`)

### Verification evidence

- Unit tests executed and passing:
	- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/media/media.service.test.ts`
	- result: 3 passed, 0 failed
- Runtime integration command executed:
	- `npm run -s test:phase4:runtime`
	- result: tests skipped because `POSTGRES_URL` was not provided in this environment
- Added runtime test guard so Phase 4 runtime tests only execute when both:
	- `PHASE4_RUNTIME_INTEGRATION=1` (or `PHASE3_RUNTIME_INTEGRATION=1`)
	- `POSTGRES_URL` is present

### Next resume point

1. Wire concrete Mongo repository adapter for media metadata persistence (replace in-memory metadata adapter in composition).
2. Add upload-session completion endpoint/flow that transitions from `uploading` to `uploaded` on object-store callback confirmation.
3. Implement Node or Python media processing consumer for `hotspot.media.processing` queue and connect status updates back into the media service.
4. Add integration coverage that validates migration-applied Postgres schema plus outbox publication behavior against a running Postgres instance.

## 2026-11-18 — Initial project specification

### Completed

- Reviewed `docs/PROJECT_TEMPLATE_GUIDE.md` and filled `PROJECT.md` with the full 14-section master specification.
- Added the HotSpot identity, product intent, functional requirements, NFRs, architecture, data model, API contracts, implementation phases, cost estimates, and testing plan.
- Added `CLAUDE.md` as the session primer and architecture guardrail document.
- Scanned the live k3s cluster for namespaces, workloads, ingresses, services, secrets names, and persistent volumes.
- Documented reuse of GitLab, Infisical, RabbitMQ, Prometheus/Grafana, OpenObserve, Mailpit, the `nginx-external` ingress, and `local-path` storage.
- Defined a session-sized Phase 0–13 implementation plan.
- Validated and removed malformed SQL constraint text from `PROJECT.md`.

### Cluster facts captured

- Cluster: k3s single node `elitedesk-800`
- Capacity: 4 vCPU / approximately 24 GiB RAM
- Storage: `local-path`, RWO, `WaitForFirstConsumer`
- Shared ingress: `nginx-external`
- Public hosts already deployed: `gitlab.rmwhs.com`, `registry.rmwhs.com`, `headlamp.rmwhs.com`, `infisical.rmwhs.com`, `mailpit.rmwhs.com`, Grafana/Prometheus/Alertmanager hosts, `openobserve.rmwhs.com`, `openobserve-admin.rmwhs.com`, and `rabbitmq.rmwhs.com`
- RabbitMQ in-cluster service: `rabbitmq.rabbitmq.svc.cluster.local:5672`
- Existing RabbitMQ management port: `15672`
- Development SMTP: `mailpit-smtp.mailpit.svc.cluster.local:25`
- OpenObserve HTTP service: `openobserve-openobserve-standalone.openobserve.svc.cluster.local:5080`

### Next resume point

Begin **Phase 0 — Workspace and Cluster Foundation** from `PROJECT.md`.

The next implementation session should confirm:

1. GitLab repository origin and registry path.
2. HotSpot namespace naming (`hotspot` production and `hotspot-dev` development).
3. Deployment ServiceAccount and namespace-scoped RBAC.
4. Dedicated HotSpot PostgreSQL, MongoDB, Redis, RabbitMQ vhost, and object-storage configuration.
5. Infisical or Kubernetes Secret layout.
6. Docker Compose and initial repository scaffold.

## 2026-11-19 — Phase 0 foundation scaffolded

### Completed

- Created initial monorepo directory structure for apps, services, workers, shared packages, database folders, k8s manifests, CI, scripts, and tests.
- Added baseline repository files: `.gitignore`, `.env.example`, `package.json`, and `docker-compose.yml` with local dependencies.
- Added GitLab pipeline skeleton in `.gitlab-ci.yml` with validate, test, security, build, and deploy stages.
- Added GitLab-native security gates in `ci/security-gates.gitlab-ci.yml` (SAST, secret detection, dependency/container scanning, IaC SAST).
- Added CI helper scripts: `ci/build.sh`, `ci/test.sh`, and `ci/deploy.sh`.
- Added developer bootstrap scripts: `scripts/bootstrap.sh`, `scripts/seed-local.sh`, and `scripts/stripe-listener.sh`.
- Added RabbitMQ verification helper: `scripts/check-rabbitmq-vhost.sh`.
- Added Kubernetes Phase 0 manifests for namespace, deployer RBAC, config/secret examples, API deployment/service, and ingress.
- Added `k8s/kustomization.yaml` to enable simple manifest rendering/validation.

### Notes

- CI build expects a root `Dockerfile`, which is not created yet and should be added in the next phase when the first deployable service image is defined.
- The Kubernetes secret manifest is intentionally an example file and should be replaced by Infisical-driven or encrypted secret delivery before real deployment.

### Next resume point

Continue Phase 0 by wiring real service bootstraps and first runnable app slices:

1. Add root and service-level `Dockerfile` assets for build pipeline parity.
2. Replace placeholder npm scripts with real workspace tooling (pnpm/npm workspaces, Nx, or Turborepo).
3. Add first `gateway/nest-http` scaffold and health endpoint.
4. Add first database migration workflow (Prisma/Flyway) and local deterministic seed data.
5. Add namespace-specific overlays (`dev`/`prod`) for image tags and hostnames.

## 2026-11-19 — DevSecOps skill context integration and hardening pass

### Completed

- Reorganized AI security references by moving `docs/devsecops-categories-and-tools.md` into `.copilot/skills/devsecops/docs/`.
- Added `.copilot/README.md` and `.github/copilot-instructions.md` to keep the DevSecOps skill continuously in coding context.
- Added `.dockerignore` with secret-sensitive patterns excluded from image build context.
- Hardened `docker-compose.yml` to require env-provided sensitive values instead of hardcoded password defaults.
- Reduced deployer RBAC by making Kubernetes secret permissions read-only.
- Hardened API deployment manifest with non-root runtime, dropped Linux capabilities, read-only root filesystem, and health probes.
- Aligned ingress to `nginx-external` and disabled origin SSL redirect for Cloudflare-terminated TLS.
- Removed example secret manifest from default kustomize apply path.
- Added explicit CI security jobs for Checkov and Trivy config scanning with high/critical fail behavior.
- Improved deploy script trust model to prefer CA-pinned Kubernetes API TLS via `K8S_CA_PEM_B64`.

### Next resume point

1. Add root `Dockerfile` and service-specific Dockerfiles with non-root users and pinned base image digests.
2. Add first runnable `gateway/nest-http` scaffold with `/health` endpoint and request validation.
3. Add lockfile and workspace package manager strategy (`npm` workspaces or `pnpm`) with dependency pinning.
4. Add pre-commit secret scanning hook and CI artifact/SBOM generation.

## 2026-11-19 — GitOps decision, Phase 0 verification, and Phase 1 kickoff

### Completed

- Documented GitOps guidance in `PROJECT.md`: ArgoCD is architecture-compatible but intentionally deferred for now to avoid early operational overhead; if adopted later, it must become the sole runtime reconciler for app workloads.
- Updated implementation-plan checkboxes with current verified status.
- Verified cluster storage and capacity evidence for Phase 0 (`local-path` plus allocatable CPU/memory summary).
- Verified RabbitMQ service DNS and added/validated the `hotspot` RabbitMQ vhost.
- Added `scripts/provision-rabbitmq-vhost.sh` for idempotent vhost provisioning and optional app-user setup.
- Added baseline observability labels/annotations to API Deployment and Service manifests.
- Started Phase 1 by adding identity schema artifacts:
	- `prisma/schema.prisma`
	- `prisma/migrations/20261119_phase1_identity_init/migration.sql`
	- `packages/contracts/src/auth-contracts.ts`

### Open items

- GitLab remote is still not configured for this repository.
- Prometheus/OpenObserve dashboard pack is still pending (labels/annotations are in place).

### Next resume point

1. Implement registration and email-verification flow in `gateway/nest-http`.
2. Add JWT access/refresh token issue/rotation and session revocation path.
3. Add auth unit tests for service-layer behavior.

## 2026-11-19 — Phase 1 auth scaffolding continued

### Completed

- Added shared auth utilities in `packages/auth/src`:
	- password hashing and verification helpers (`scrypt`)
	- signed email-verification token create/verify helpers
- Added initial API service-layer auth scaffolding:
	- `services/social-nest/src/service/auth/auth.service.ts`
	- `gateway/nest-http/src/handlers/auth/auth.handler.ts`
- Added first unit test for registration normalization and verification-token creation:
	- `services/social-nest/src/service/auth/auth.service.test.ts`

### Notes

- This is scaffolding for Phase 1 and intentionally repository-port based.
- JWT issue/refresh flow, persistence wiring, and verification callback handling remain pending.

### Next resume point

1. Implement persistent `AuthRepository` against PostgreSQL tables from `prisma/migrations/20261119_phase1_identity_init/migration.sql`.
2. Add JWT issue/refresh/revoke service methods and tests.
3. Add email verification callback flow and state transition from `pending_verification` to `active`.

## 2026-11-19 — Phase 0 checklist closure updates

### Completed

- Updated `PROJECT.md` to explicitly set SCM authority to in-cluster GitLab (`gitlab.rmwhs.com`) and registry (`registry.rmwhs.com`).
- Marked the SCM platform decision and Prometheus/OpenObserve labeling checklist items as complete in Phase 0.
- Verified current application service manifest label coverage:
	- `k8s/services/hotspot-api-svc.yaml` includes `observability.openobserve/enabled` and Prometheus scrape annotations.

### Note

- Git remote URL wiring remains a repo bootstrap action and can be finalized once the exact GitLab project path is selected.

## 2026-11-19 — GitLab-k3s transition spec and Phase 1 JWT/session foundation

### Completed

- Added a formal phased GitLab-k3s integration transition plan to `PROJECT.md` section `9.8`, including:
	- goals/non-goals
	- guardrails
	- phased rollout (G0-G4)
	- phase controls
	- readiness checklist
	- success metrics
- Implemented JWT session scaffolding for Phase 1:
	- `packages/auth/src/jwt.js`
	- `services/social-nest/src/service/auth/auth.service.ts` token issue + refresh rotation
	- `services/social-nest/src/service/auth/auth.service.test.ts` coverage for token issuance, rotation, and replay rejection
- Updated contracts for session token response shape in `packages/contracts/src/auth-contracts.ts`.
- Marked Phase 1 JWT/refresh foundation checklist item complete with a passkey-pending note.

### Next resume point

1. Wire `AuthRepository` to PostgreSQL persistence for auth sessions.
2. Implement email verification callback and user state transition to `active`.
3. Add passkey registration/authentication flow for completion of the full auth foundation requirement.

## 2026-11-19 — Phase 1 persistence scaffolding for auth

### Completed

- Added PostgreSQL query module for auth user/session operations:
	- `services/social-nest/src/db/queries/auth.queries.ts`
- Added `AuthRepository` PostgreSQL implementation:
	- `services/social-nest/src/service/auth/postgres-auth.repository.ts`
- Kept service-layer boundaries intact by routing SQL access through the query module and repository implementation.

### Next resume point

1. Wire a concrete database client into `PostgresAuthRepository` construction path.
2. Implement email verification callback persistence and state transition.
3. Expand auth tests to include repository-backed session rotation behavior.

## 2026-11-19 — Architecture boundary clarification and architect-pro review

### Completed

- Updated architecture wording in `PROJECT.md` to explicitly define:
	- dispatch layer as gateways/adapters only
	- service layer as microservices/domain services only
- Updated `PROJECT.md` section 12 rules to include explicit dispatch-layer governance.
- Refactored Phase 1 plan checklist precision:
	- split JWT/refresh from passkey/WebAuthn
	- marked registration/email verification implemented at scaffolding level
- Implemented email verification callback transition path in auth flow:
	- `AuthService.verifyEmailToken(...)`
	- repository contract and PostgreSQL query support (`activateUserByVerification`)
	- handler delegation method and unit-test coverage updates
- Added architect skill:
	- `.copilot/skills/architect-pro/SKILL.md`
- Added architecture re-evaluation report:
	- `docs/ARCHITECT_PRO_REEVALUATION_2026-11-19.md`

### Next resume point

1. Wire concrete DB client composition for `PostgresAuthRepository` in API bootstrap.
2. Implement account-status/RBAC transition policies beyond verification activation.
3. Implement passkey/WebAuthn foundation to close remaining Phase 1 auth requirements.

## 2026-11-19 — Architect-pro dispatch/orchestration directive hardening

### Completed

- Ran architect-pro ambiguity review focused on dispatch/service directives and anti-patterns.
- Added explicit dispatch vs orchestration vs service distinctions in `PROJECT.md` architecture and rules.
- Added explicit orchestration constraints and corrected rule numbering in `docs/PROJECT_TEMPLATE_GUIDE.md`.
- Updated `docs/ARCHITECT_PRO_REEVALUATION_2026-11-19.md` with orchestration-layer ambiguity findings and corrective actions.

### Outcome

- Transport adapters are now explicitly constrained to boundary duties.
- Multi-step workflow sequencing is explicitly required to live in service-layer orchestrators.

## 2026-11-19 — Architect-pro plan alignment pass

### Completed

- Re-aligned `PROJECT.md` Phase 1 checklist to distinguish completed service scaffolding from pending runtime wiring/integration completion.
- Updated governance wording to keep handlers bound to service contracts only (no repository calls from transport adapters).
- Updated Phase 0 SCM note to reflect actual configured GitLab remote tracking state.

### Outcome

- Plan status now reflects implemented vs scaffolded vs deferred work with less ambiguity.

## 2026-11-19 — Type strictness conformance follow-up

### Completed

- Removed untyped runtime require usage from auth service and switched to typed imports for auth helpers.
- Added declaration files for JS auth helper modules:
	- `packages/auth/src/password.d.ts`
	- `packages/auth/src/jwt.d.ts`

### Outcome

- Auth implementation remains compatible with existing JS helper modules while honoring strict TypeScript intent in service-layer code.

## 2026-11-19 — Phase 1 account status and RBAC scaffolding

### Completed

- Added account-status gating in auth token issuance and refresh rotation paths:
	- `services/social-nest/src/service/auth/auth.service.ts`
- Added RBAC role propagation into access/refresh JWT claims:
	- `services/social-nest/src/service/auth/auth.service.ts`
- Extended auth repository/query support for user lookup and role mapping:
	- `services/social-nest/src/service/auth/postgres-auth.repository.ts`
	- `services/social-nest/src/db/queries/auth.queries.ts`
- Expanded auth unit test coverage for role claim presence and suspended-account issuance rejection:
	- `services/social-nest/src/service/auth/auth.service.test.js`
- Added concrete composition wiring entry point for auth runtime assembly:
	- `services/social-nest/src/service/auth/auth.composition.ts`

### Notes

- Runtime test execution is currently blocked in this environment because `node` is not installed.

### Next resume point

1. Connect `buildAuthComposition(...)` into the future API bootstrap (`main.ts`/module wiring) once Nest app scaffold is added.
2. Implement passkey/WebAuthn foundation.
3. Complete runtime wiring/integration tests for registration, JWT/refresh, and account-status/RBAC flows.

## 2026-11-19 — Phase 1 signed verification callback and dedup scaffolding

### Completed

- Added shared callback signing/verification and payload hashing helpers:
	- `packages/auth/src/verification-callback.ts`
- Exported callback helpers via shared auth package entrypoint:
	- `packages/auth/src/index.ts`
- Added shared contracts for callback input/result:
	- `packages/contracts/src/auth-contracts.ts`
- Added repository query paths and implementation for callback dedup and status application:
	- `services/social-nest/src/db/queries/auth.queries.ts`
	- `services/social-nest/src/service/auth/postgres-auth.repository.ts`
- Added auth service callback processing with signature validation:
	- `services/social-nest/src/service/auth/auth.service.ts`
- Added composition config support for callback secret:
	- `services/social-nest/src/service/auth/auth.composition.ts`
- Added unit-test coverage for valid signature processing, duplicate event handling, and invalid-signature rejection:
	- `services/social-nest/src/service/auth/auth.service.test.js`
- Added new migration for role consistency and callback dedup event tracking:
	- `prisma/migrations/20261119_phase1_identity_callbacks/migration.sql`
	- `prisma/schema.prisma`

### Notes

- Node.js runtime is not installed in this environment, so test execution remains blocked.

### Next resume point

1. Implement identity-verification provider adapter for session creation and provider reference persistence.
2. Implement passkey/WebAuthn foundation.
3. Execute migrations/tests in a Node-enabled environment and add integration coverage for callback persistence flow.

## 2026-11-19 — Phase 1 identity-verification provider adapter scaffolding

### Completed

- Added service-level adapter contract and orchestration for starting provider verification sessions:
	- `services/social-nest/src/service/auth/auth.service.ts`
- Added repository persistence path for provider session creation:
	- `services/social-nest/src/service/auth/postgres-auth.repository.ts`
	- `services/social-nest/src/db/queries/auth.queries.ts`
- Added unit-test coverage for verification start success and ineligible-user rejection:
	- `services/social-nest/src/service/auth/auth.service.test.js`

### Notes

- Runtime execution in this environment is still blocked by missing Node.js binary.

### Next resume point

1. Implement passkey/WebAuthn foundation.
2. Add runtime integration tests for verification session start + callback processing.
3. Wire `buildAuthComposition(...)` into API bootstrap when the Nest application entrypoint is created.

## 2026-11-19 — Phase 1 passkey/WebAuthn foundation scaffolding

### Completed

- Added passkey persistence migration assets:
	- `prisma/migrations/20261119_phase1_passkey_foundation/migration.sql`
- Updated Prisma schema with passkey challenge/credential models:
	- `prisma/schema.prisma`
- Added passkey query primitives and row types:
	- `services/social-nest/src/db/queries/auth.queries.ts`
- Added PostgreSQL passkey repository implementation:
	- `services/social-nest/src/service/auth/postgres-passkey.repository.ts`
- Added passkey service scaffolding for registration/authentication challenge lifecycle and session issuance:
	- `services/social-nest/src/service/auth/passkey.service.js`
- Added passkey service unit test coverage for challenge consumption, registration/authentication success path, and replay rejection:
	- `services/social-nest/src/service/auth/passkey.service.test.js`
- Added shared passkey contract types:
	- `packages/contracts/src/auth-contracts.ts`

### Notes

- Passkey service is implemented in JS to stay compatible with the current environment/toolchain constraints.
- Node.js runtime remains unavailable in this environment, so test execution still cannot be run locally.

### Next resume point

1. Add a concrete verification provider adapter implementation (Persona/etc.) behind existing service contracts.
2. Wire passkey and auth compositions into the Nest API bootstrap when app module entrypoint exists.
3. Execute migrations and run full auth/passkey tests in a Node-enabled environment.

## 2026-11-19 — Phase 1 dispatch/composition wiring for verification and passkey

### Completed

- Added concrete identity verification provider adapter implementation:
	- `services/social-nest/src/service/auth/identity-verification.provider.ts`
- Added passkey verifier adapter scaffold:
	- `services/social-nest/src/service/auth/passkey-verifier.adapter.js`
	- `services/social-nest/src/service/auth/passkey-verifier.adapter.d.ts`
- Added passkey service declaration surface for TS composition imports:
	- `services/social-nest/src/service/auth/passkey.service.d.ts`
- Expanded auth dispatch handler with identity verification and passkey endpoint methods:
	- `gateway/nest-http/src/handlers/auth/auth.handler.ts`
- Wired adapters and passkey stack into auth composition:
	- `services/social-nest/src/service/auth/auth.composition.ts`
- Added handler delegation unit coverage:
	- `gateway/nest-http/src/handlers/auth/auth.handler.test.js`

### Outcome

- Transport-layer methods now consistently delegate to service/adapters for newly added Phase 1 auth/passkey flows.

### Next resume point

1. Add Nest module/bootstrap integration (`main.ts` and route/controller bindings) for handler methods.
2. Replace in-memory/stub verifier/provider adapters with production provider SDK integrations.
3. Run migrations and JS tests in a Node-enabled environment.

## 2026-11-19 — Architect-pro event-driven mutation architecture update

### Completed

- Updated architecture plan to require domain-event emission for create/update/delete mutations through service-layer event ports.
- Added mutation eventing rules and concrete flows to system architecture (`user.created`, `user.updated`, `user.suspended`, `user.flagged`, `user.email-reset-requested`).
- Added outbox reliability requirements and outbox table blueprint (`domain_event_outbox`) to data model guidance.
- Added RabbitMQ topology guidance for domain routing keys and clarified that mutable backend services integrate through RabbitMQ event-port abstractions.
- Updated Phase 1 checklist with auth/user outbox event and event-integration test tasks.
- Extended project rules to explicitly require outbox-backed mutation event emission and prohibit direct handler-level event publication.

### Outcome

- PROJECT.md now formally supports event-driven reaction patterns such as welcome emails and password-reset emails via subscribers calling a shared email service contract.

## 2026-11-19 — Phase 1 outbox implementation kickoff (auth/user)

### Completed

- Added dedicated outbox migration and Prisma model:
	- `prisma/migrations/20261119_phase1_outbox_foundation/migration.sql`
	- `prisma/schema.prisma` (`DomainEventOutbox`)
- Implemented auth repository outbox-backed user creation (`user.created`):
	- `services/social-nest/src/db/queries/auth.queries.ts`
	- `services/social-nest/src/service/auth/postgres-auth.repository.ts`
	- `services/social-nest/src/service/auth/auth.service.ts`
- Implemented auth email reset request outbox enqueue (`user.email-reset-requested`):
	- `services/social-nest/src/service/auth/auth.service.ts`
	- `gateway/nest-http/src/handlers/auth/auth.handler.ts`
- Added outbox publisher service scaffolding and batch publish retry handling:
	- `services/social-nest/src/db/queries/outbox.queries.ts`
	- `services/social-nest/src/service/events/outbox-publisher.service.ts`
	- `workers/notification-node/outbox-publisher.js`
- Added unit tests for auth outbox behavior and outbox publisher batch behavior:
	- `services/social-nest/src/service/auth/auth.service.test.js`
	- `services/social-nest/src/service/events/outbox-publisher.service.test.js`
- Added shared domain event contracts:
	- `packages/contracts/src/domain-events.ts`

### Notes

- Runtime test execution remains blocked in this environment because `node` is not installed.

### Next resume point

1. Add an outbox-consumed-event ledger for subscriber idempotency.
2. Implement concrete notification/email subscribers for `user.created` and `user.email-reset_requested`.
3. Wire outbox publisher startup into the actual worker bootstrap and add integration tests for retry/DLQ paths.

## 2026-11-19 — Phase 1 subscriber idempotency and notification subscriber scaffolding

### Completed

- Added subscriber idempotency ledger migration and Prisma model:
	- `prisma/migrations/20261119_phase1_subscriber_idempotency/migration.sql`
	- `prisma/schema.prisma` (`ConsumedDomainEvent`)
- Added subscriber idempotency repository and SQL query contract:
	- `services/social-nest/src/db/queries/subscriber-idempotency.queries.ts`
	- `services/social-nest/src/service/events/subscriber-idempotency.repository.ts`
- Added shared email adapter contract scaffold:
	- `workers/notification-node/email/email-service.adapter.js`
- Added concrete notification subscribers:
	- `workers/notification-node/subscribers/user-created-email-welcome.subscriber.js`
	- `workers/notification-node/subscribers/user-email-reset-requested.subscriber.js`
- Added subscriber router and idempotency stores:
	- `workers/notification-node/subscribers/notification-subscriber-router.js`
	- `workers/notification-node/subscribers/event-idempotency.store.js`
- Added notification worker bootstrap composition:
	- `workers/notification-node/bootstrap.js`
- Added subscriber behavior tests:
	- `workers/notification-node/subscribers/subscribers.test.js`

### Outcome

- The project now includes end-to-end scaffolding for event-driven notification subscribers with deduplication hooks and shared template-based email dispatch contract.

### Notes

- Runtime test execution remains blocked in this environment due missing Node.js binary.

### Next resume point

1. Connect RabbitMQ consumer bindings to `NotificationSubscriberRouter` for live event ingestion.
2. Replace in-memory idempotency store with `SubscriberIdempotencyRepository` backed persistence in worker runtime composition.
3. Add integration tests for retry/DLQ and cross-process dedup behavior.

## 2026-11-19 — Phase 1 unfinished-spec review and checklist alignment

### Completed

- Re-reviewed Phase 1 implementation checklist against current code artifacts before any Phase 2 start.
- Corrected Phase 1 checklist status in `PROJECT.md` for auth mutation outbox coverage:
	- Marked the full mutation-item as incomplete because only `user.created` and `user.email_reset_requested` are currently scaffolded.
- Updated Phase 1 note text to explicitly state current event coverage and remaining gaps.

### Outcome

- Phase 1 remains open and should not advance to Phase 2 until unfinished items are completed or explicitly deferred with approval.

## 2026-11-19 — Phase 1 auth mutation-event completion and notification runtime wiring

### Completed

- Implemented missing auth mutation outbox event paths for full checklist coverage:
	- `user.updated`
	- `user.suspended`
	- `user.flagged`
- Added service/repository/query support for these mutations:
	- `services/social-nest/src/service/auth/auth.service.ts`
	- `services/social-nest/src/service/auth/postgres-auth.repository.ts`
	- `services/social-nest/src/db/queries/auth.queries.ts`
	- `gateway/nest-http/src/handlers/auth/auth.handler.ts`
- Added user flag persistence fields and migration support:
	- `prisma/migrations/20261119_phase1_user_mutation_event_fields/migration.sql`
	- `prisma/schema.prisma`
- Added/updated tests for auth mutation handling and handler delegation:
	- `services/social-nest/src/service/auth/auth.service.test.js`
	- `gateway/nest-http/src/handlers/auth/auth.handler.test.js`
- Added notification RabbitMQ consumer adapter and bootstrap runtime wiring:
	- `workers/notification-node/rabbitmq/notification-consumer.js`
	- `workers/notification-node/bootstrap.js`
- Added consumer and bootstrap idempotency wiring tests:
	- `workers/notification-node/rabbitmq/notification-consumer.test.js`
	- `workers/notification-node/subscribers/subscribers.test.js`

### Outcome

- Auth mutation outbox scaffolding now covers the full required Phase 1 mutation set.
- Notification worker bootstrap now supports live RabbitMQ consumer binding with router dispatch and repository-backed idempotency store wiring when repository dependency is provided.

### Notes

- Runtime execution remains blocked in this environment due missing Node.js binary, so runtime integration checklist items are still pending.

## 2026-11-19 — Phase 1 trial activation-once and account lifecycle workflow scaffolding

### Completed

- Added trial activation-once persistence fields and migration:
	- `prisma/migrations/20261119_phase1_trial_and_account_lifecycle/migration.sql`
	- `prisma/schema.prisma`
- Added user lifecycle support fields for moderation flag persistence:
	- `prisma/migrations/20261119_phase1_user_mutation_event_fields/migration.sql`
	- `prisma/schema.prisma`
- Implemented trial activation-once orchestration in auth verification flow (`verifyEmailToken` now triggers one-time trial activation mutation):
	- `services/social-nest/src/service/auth/auth.service.ts`
	- `services/social-nest/src/service/auth/postgres-auth.repository.ts`
	- `services/social-nest/src/db/queries/auth.queries.ts`
- Implemented account export/deactivate/delete workflow scaffolding:
	- `services/social-nest/src/service/auth/auth.service.ts`
	- `services/social-nest/src/service/auth/postgres-auth.repository.ts`
	- `services/social-nest/src/db/queries/auth.queries.ts`
	- `gateway/nest-http/src/handlers/auth/auth.handler.ts`
- Added outbox-backed lifecycle mutation events:
	- `user.trial-activated`
	- `user.export-requested`
	- `user.deactivated`
	- `user.deleted`
- Expanded auth/handler tests to cover all auth service methods currently implemented:
	- `services/social-nest/src/service/auth/auth.service.test.js`
	- `gateway/nest-http/src/handlers/auth/auth.handler.test.js`

### Outcome

- Phase 1 functional scaffolding for trial-once and account lifecycle workflows is now implemented, with event-driven mutation emission aligned to outbox constraints.

### Notes

- Runtime integration tests remain pending due missing Node.js runtime in this environment.

## 2026-11-19 — Phase 1 outbox/subscriber integration test expansion (dedup/retry/DLQ)

### Completed

- Added integration-style test for outbox publish flow into notification subscribers with dedup and retry accounting:
	- `services/social-nest/src/service/events/outbox-subscriber.integration.test.js`
	- verifies publish success/failure counters, outbox publish-attempt increment on failure, and duplicate-delivery dedup behavior.
- Expanded RabbitMQ consumer tests to explicitly validate dead-letter path semantics:
	- `workers/notification-node/rabbitmq/notification-consumer.test.js`
	- verifies `nack(message, false, false)` behavior on subscriber handling failures.

### Outcome

- Phase 1 test scaffolding now includes explicit dedup/retry/DLQ-oriented integration coverage for the outbox → subscriber pipeline.

### Notes

- Runtime test execution in this workspace remains blocked by missing Node.js binary.

## 2026-11-19 — Phase 1 runtime-integration harness scaffolding

### Completed

- Added runtime-gated auth integration test suite:
	- `services/social-nest/src/service/auth/auth.runtime.integration.test.js`
	- `services/social-nest/src/service/auth/auth.runtime.integration.harness.js`
- Added runtime-gated notification consumer integration test suite:
	- `workers/notification-node/rabbitmq/notification.runtime.integration.test.js`
- Added package script entrypoint for execution once runtime deps exist:
	- `npm run test:phase1:runtime`
- Tests are gated by `PHASE1_RUNTIME_INTEGRATION=1` and intended to run only in a Node-enabled environment with live backing services.

### Outcome

- Remaining Phase 1 runtime integration checklist items now have concrete harness entry points, reducing execution work once runtime dependencies are available.

### Notes

- This environment still lacks Node.js binary/runtime execution support, so these tests are prepared but not executed here.

## 2026-11-19 — Phase 1 runtime execution completed and checklist closure

### Completed

- Installed local portable Node.js runtime (`v22.13.1`) for this workspace session.
- Installed required runtime test dependencies:
	- `ts-node`
	- `pg`
	- `amqplib`
- Brought up local integration infrastructure via Docker Compose:
	- `postgres`
	- `rabbitmq`
- Applied required Phase 1 migrations in explicit dependency order.
- Executed full Phase 1 test matrix (unit + integration + runtime integration) with live Postgres/RabbitMQ and TS runtime support:
	- command used `node -r ts-node/register/transpile-only --test ...`
- Fixed two discovered test issues during execution:
	- auth service unit-test state setup before verification start assertion
	- runtime integration uniqueness collisions via per-test unique identifiers
- Achieved all-green results:
	- `tests: 17`
	- `pass: 17`
	- `fail: 0`

### Outcome

- Updated `PROJECT.md` Phase 1 checklist runtime items to complete.
- Phase 1 is now complete and Phase 2 can begin.

## 2026-11-20 — Phase 11 dashboard and bot escalation completed

### Completed

- Added moderator-role-gated moderation queue dashboard API.
- Added queue filtering by moderation status and bounded result limits.
- Added fake/bot escalation workflow with append-only moderation case/audit records.
- Added handler and service coverage for operator authorization and escalation state.
- Closed remaining Phase 11 source checklist items for dashboard and bot escalation.

### Verification evidence

- `node -r ts-node/register/transpile-only --test services/social-nest/src/service/moderation/moderation.service.test.ts workers/notification-node/subscribers/subscribers.test.ts workers/notification-node/subscribers/transactional-template.subscriber.test.ts`
- Result: 13 passed, 0 failed.

### Pending

- RabbitMQ runtime/DLQ infrastructure verification
- Production moderation dashboard UI and deployment evidence

## 2026-11-20 — Comprehensive runtime, hardening, and Expo specification

- Reviewed source against executable entrypoints, HTTP routes, migrations, RabbitMQ/outbox, frontend bindings, and mobile runtime.
- Added a Runtime Completion Gate covering API, Spring, workers, migrations, RabbitMQ, frontend, mobile, health, shutdown, and evidence.
- Expanded Phase 13 with Kubernetes, backup, observability, security, network, load/failure, recovery, and release-hardening tasks.
- Added Phase 14 for Expo/NativeWind Android/iOS implementation and verification.
- Added an implementation status ledger separating unit, runtime, scaffolded, and pending states.
- Corrected LiveKit deployment status to remain pending actual infrastructure.
- Expanded the implementation plan with a dedicated startup, DevOps, IaC, secrets, migration, security, observability, backup, and rollout phase.
- Added explicit Phase 13 exit evidence and a formal Runtime Completion Gate with a source/scaffold/runtime/pending status ledger.
- Added executable startup and health acceptance requirements for Nest, Spring, workers, Next.js, Expo, infrastructure, and migrations.

## 2026-11-19 — Gateway/social microservice separation

- Refactored Nest code into `gateway/nest-http` and `services/social-nest` runtimes.
- The gateway now contains HTTP controllers, health routes, and typed HTTP service clients only.
- The social microservice owns PostgreSQL/MongoDB repositories, domain services, compositions, and internal auth routes.
- Added `gateway:start` and `social-service:start` scripts.
- Verified live gateway forwarding: HTTP `/v1/auth/register` returned 201 for a fresh account and 409 for a duplicate account.
