# HotSpot

## Intentional, Authentic Social Media

### Project Master Document v1.0

> **Single source of truth** — This document is the authoritative specification for HotSpot. AI coding assistants must generate implementation tasks and code directly from this document. Architectural decisions, data contracts, infrastructure, business rules, and implementation phases belong here.

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [System Architecture](#4-system-architecture)
5. [K3s Infrastructure & Resources](#5-k3s-infrastructure--resources)
6. [Software Design](#6-software-design)
7. [Data Model](#7-data-model)
8. [API Documentation](#8-api-documentation)
9. [DevOps & Deployment](#9-devops--deployment)
10. [Local Development](#10-local-development)
11. [Implementation Plan](#11-implementation-plan)
12. [Project Rules & AI-IDE Guidelines](#12-project-rules--ai-ide-guidelines)
13. [Infrastructure Cost Estimates](#13-infrastructure-cost-estimates)
14. [Testing Plan](#14-testing-plan)

---

# 1. Project Overview

## 1.1 What Is HotSpot?

HotSpot is a long-term personal social platform project intended to demonstrate trustworthy social-network engineering on a resource-constrained home Kubernetes cluster.

It blends text-first conversation and short-form visual media. Users publish posts, replies, reposts, quotes, photos, videos, short stories, stitches, duets, and live streams. HotSpot intentionally does not use a machine-learning personalization algorithm or behavioral engagement ranking. Content discovery is chronological, followed-account based, explicitly categorized, locally/community organized, and optionally selected by user-controlled interests.

## 1.2 How It Works

```text
VERIFIED USER
  → Register and complete identity verification
  → Create an account with encrypted credentials
  → Receive seven days of complete paid-feature access
  → Browse chronological feeds, stories, communities, and subscriptions
  → Publish text, photo, video, or live content

CREATOR
  → Set a paid tier and publish subscriber-only featured content
  → Receive support revenue minus platform fees
  → Run live streams when live-tier access is active
  → Use paid marketing tools to create clearly labeled campaigns

VIEWER
  → Read/watch public or subscribed content
  → Reply, repost, quote, react, or report
  → Subscribe to creators
  → Buy or upgrade a platform tier

ADMIN / TRUST & SAFETY
  → Review verification, reports, impersonation, and policy flags
  → Suspend or restore accounts through auditable moderation actions
  → Disable fake, bot, abusive, or deceptive accounts

FREE-ACCOUNT USER
  → Use core social features
  → See clearly labeled sponsored ads
  → Never receive paid marketing boosts, creator monetization, or live access

STRIPE
  → Checkout for platform tiers and subscriptions
  → Verify webhook signatures
  → Emit payment and payout events
  → Publish entitlements only after durable processing
```

## 1.3 Key Entities

| Entity | Description |
|---|---|
| User | Human account holder with verified identity state and consented profile data |
| Verification | Identity and liveness proof result issued through a provider adapter |
| Profile | Public identity, bio, avatar, links, verification badge, and privacy settings |
| Post | Text, media, thread, repost, quote, or story content unit |
| Comment/Reply | A reply attached to a post, media item, or another reply |
| MediaAsset | Stored video/photo asset with processing and moderation states |
| Story | Ephemeral 24-hour photo/video update |
| Stitch/Duet | Derivative video referencing and arranging source media |
| Follow | Directed relationship between users |
| Subscription | Paid follower relationship to a creator feature tier |
| PlatformTier | Paid platform entitlement tier for marketing, creator, or live capabilities |
| CreatorTier | A creator-defined subscription tier granting featured-content access |
| Campaign | A user-created paid marketing campaign with budget and labeled placement |
| LiveStream | Scheduled or active live broadcast with chat and access rules |
| Ad | Sponsored placement explicitly identified as advertising |
| Report | User-submitted trust and safety complaint |
| ModerationCase | Auditable review state for a reported account or item |
| Entitlement | Effective, time-bounded platform capability held by an account |
| Notification | User-targeted event with delivery state |
| AuditEvent | Append-only administrative or security action |

## 1.4 Domain-Specific Logic

- **Chronological feeds** — no engagement prediction, affinity model, or ML ranking. Ranking is permitted only by explicit chronological order, followed account, pinned order, active story order, and user-selected category/tag filters.
- **No personal-data sale** — HotSpot never sells identity, profile, relationship, behavioral, or content data to advertisers or brokers.
- **Ads** — free accounts see clearly labeled sponsored placements. Paid accounts do not receive advertising unless the user explicitly opts in.
- **Identity verification** — an account cannot gain verified status from self-assertion. Verification requires an approved identity and liveness result from an external verifier. The platform stores a provider reference and verification outcome, not raw document images.
- **Bot/fake-account prevention** — automated creation is rate-limited, identity verification is required for public posting, and suspicious automation signals create moderation review rather than covert ranking penalties.
- **First-week trial** — an account activated for the first time receives every platform capability for 7×24 hours. Trial activation is recorded once and cannot be reset by account recreation or support action except for audited fraud recovery.
- **Pay wall** — marketing, creator subscriptions, and live streaming are independently gated, but a platform tier may bundle entitlements. API and UI enforce the same entitlement service.
- **Stripe authority** — Stripe confirmation plus a durable signed webhook event grants entitlements. Stripe invoice or subscription events are never exposed directly to grant capabilities.
- **Story expiration** — stories expire exactly 24 hours after successful publish and are excluded from feeds, API responses, and public deep links after expiration.
- **Stitch/Duet rights** — source media must allow remixing. Stitch/duet creation copies no data into the source asset and stores a directed derivative relationship.
- **Live archive** — live streams are ephemeral by default. Recording requires explicit creator opt-in and access rules inherited by the recording.

## 1.5 Project Identity

| Field | Value |
|---|---|
| Project name | HotSpot |
| Domain | Identity-verified social publishing and community media |
| API URL — local | `http://api.hotspot.local` |
| Web URL — local | `http://hotspot.local` |
| API URL — dev | `https://api.rmwhs-dev.space` |
| Web URL — dev | `https://hotspot.rmwhs-dev.space` |
| API URL — production | `https://api.hotspot.rmwhs.com` |
| Web URL — production | `https://hotspot.rmwhs.com` |
| AWS Account | Not applicable; this project is home-server first |
| AWS Region | Not applicable |
| Environments | `local`, `dev`, `production` |
| Resource prefix | `hotspot` |
| Email sender | `noreply@rmwhs.com` |
| Primary cluster | k3s single-node cluster at `elitedesk-800` |

## 1.6 Mission

HotSpot demonstrates an ethically scoped, verifiable, deployable social platform that is operated for personal use on limited hardware while remaining separable from a larger production environment.

---

# 2. Functional Requirements

## 2.1 Account, Authentication, and Identity

- **FR-AUTH-01**: Support email/password registration with email verification before a session is fully active.
- **FR-AUTH-02**: Support passkeys or WebAuthn after the account exists and can complete MFA setup.
- **FR-AUTH-03**: Issue short-lived access JWTs and rotating refresh tokens; refresh tokens are revoked on reuse or logout.
- **FR-AUTH-04**: Require MFA for monetization configuration, payout account changes, and moderation actions.
- **FR-AUTH-05**: Support account suspension, deactivation, export request, and irreversible deletion workflow.
- **FR-AUTH-06**: A public publishing account must complete identity verification before text, media, or live public visibility is allowed.
- **FR-AUTH-07**: Store provider verification references, status, country of record, and review timestamps; never store raw identity documents in application databases.
- **FR-AUTH-08**: Reject duplicate verification identities when the provider returns a stable subject identifier already attached to another active account.
- **FR-AUTH-09**: The platform must expose clear reasons for verification failure without revealing internal fraud model rules.
- **FR-AUTH-10**: Bots, automated agents, bulk-creation clients, and synthetic accounts are prohibited and never receive posting rights.

## 2.2 Profiles and Social Graph

- **FR-SOCIAL-01**: Users may edit display name, unique handle, biography, profile media, links, and visibility settings.
- **FR-SOCIAL-02**: Handle changes preserve redirect metadata and require uniqueness.
- **FR-SOCIAL-03**: Users may follow public accounts or send a follow request to protected accounts.
- **FR-SOCIAL-04**: The follow graph must support follow, unfollow, block, mute, remove follower, approve, and reject operations.
- **FR-SOCIAL-05**: Blocking removes outbound and inbound visibility and delivery of future notifications.
- **FR-SOCIAL-06**: Profiles expose mutual-follow and subscription state only when policy permits.
- **FR-SOCIAL-07**: Account lists use cursor pagination and deterministic ordering.

## 2.3 Text and Thread Posts

- **FR-POST-01**: Create text posts with a configurable maximum length in the `POST_TEXT_MAX_LENGTH` setting.
- **FR-POST-02**: Support drafts, scheduled publication, editing within policy, delete, pin, and unpin.
- **FR-POST-03**: Support threaded replies that preserve parent post, direct reply, and thread-root identifiers.
- **FR-POST-04**: Support repost, quote post, like, bookmark, and share actions; no action may be silently counted twice.
- **FR-POST-05**: Quote and repost behavior must obey source privacy, blocking, deletion, and takedown rules.
- **FR-POST-06**: Edited posts retain an immutable edit history visible through the post detail API.
- **FR-POST-07**: Post and reply deletion removes public references subject to moderation retention rules.
- **FR-POST-08**: Posts may be ordered only by chronological, pinned, thread, and explicitly selected topic/category rules.

## 2.4 Photos and Short Videos

- **FR-MEDIA-01**: Support photo and video upload via a resumable object-storage upload session.
- **FR-MEDIA-02**: Create a media processing job for transcoding, thumbnail generation, perceptual fingerprints, and metadata extraction.
- **FR-MEDIA-03**: Reject unsupported MIME types and files exceeding configured size/duration limits.
- **FR-MEDIA-04**: Publish media only after transcoding and safety checks reach `READY` or an authorized human-override state.
- **FR-MEDIA-05**: Support photo carousel, aspect ratios, captions, alt text, location opt-in, tags, and media visibility.
- **FR-MEDIA-06**: Support comments and replies on photo and video media posts.
- **FR-MEDIA-07**: Support stitching and duets only when both source and destination media permit remixing.
- **FR-MEDIA-08**: Stitch/duet media retain auditable source references and attribution.
- **FR-MEDIA-09**: Derivative media is published only after processing its own transcript, thumbnail, and policy checks.

## 2.5 Stories

- **FR-STORY-01**: Publish photo or short-video stories for 24 hours from successful processing completion.
- **FR-STORY-02**: Stories expire automatically through a worker and become inaccessible from public feeds and deep links.
- **FR-STORY-03**: Support view counts and explicit viewers only for story owners.
- **FR-STORY-04**: Support story replies delivered to the owner's inbox.
- **FR-STORY-05**: Story visibility uses public, followers, or selected-close-friends policy.
- **FR-STORY-06**: Screenshots/downloads are not prevented unless additional DRM/client controls are deployed; no false privacy claim is made.

## 2.6 Discovery and Feeds

- **FR-FEED-01**: Provide chronological following, recent public, category/tag, and bookmark feeds.
- **FR-FEED-02**: Discovery may filter or group by explicit user-selected interests, not inferred personality or engagement profiles.
- **FR-FEED-03**: Feed results contain no sponsored placement unless the account is free-tier or explicitly opted in.
- **FR-FEED-04**: Labeled sponsored posts may be inserted without ranking based on inferred personal behavior.
- **FR-FEED-05**: Search supports handles, display names, text, category tags, and media content metadata.
- **FR-FEED-06**: Feed and search services exclude blocked, muted, deleted, expired, suspended, and policy-hidden content.
- **FR-FEED-07**: The platform must provide a visible explanation of feed source: Following, Public, Topic, or Sponsored.

## 2.7 Marketing and Advertising

- **FR-MKT-01**: Marketing capabilities are blocked unless the account has a qualifying paid platform tier or the first-week trial entitlement.
- **FR-MKT-02**: Users may create sponsored campaigns with objective, placement, category, budget, start/end time, creative, and destination URL.
- **FR-MKT-03**: Campaigns require payment authorization, ad policy review, identity verification, and target-location validation.
- **FR-MKT-04**: Ads must be visibly labeled as sponsored and use the least data necessary for delivery and aggregate reporting.
- **FR-MKT-05**: Campaign reporting includes aggregate impressions, clicks, spend, and region-level metrics, not individual-person sales.
- **FR-MKT-06**: Users may pause or cancel campaigns and receive a refundable-amount estimate based on Stripe and delivery state.
- **FR-MKT-07**: HotSpot must not sell ad profiles or personally identifiable advertising data.
- **FR-MKT-08**: No sensitive-interest targeting is allowed. Initial targeting is country/region, category, and explicit following/creator affinity only.

## 2.8 Featured Creator Subscriptions

- **FR-CREATE-01**: Creators may create paid creator tiers with name, price, recurring interval, description, benefits, and subscriber limits.
- **FR-CREATE-02**: Creator tiers are independent of HotSpot platform tiers and require Stripe Connect-compatible payout setup.
- **FR-CREATE-03**: Creator content may be public, subscriber-only, or tier-specific.
- **FR-CREATE-04**: Subscription checkout and cancellation use signed Stripe webhook events as the entitlement source of truth.
- **FR-CREATE-05**: Subscriber access ends at the period end or immediately after refund/cancellation rules configured by policy.
- **FR-CREATE-06**: Creators may offer featured posts, featured media collections, supporter-only threads, and supporter chat.
- **FR-CREATE-07**: Trial accounts may preview or use the subscription management flow but paid subscriptions require Stripe confirmation.

## 2.9 Live Streaming

- **FR-LIVE-01**: Live streaming is blocked unless the account has a qualifying paid tier or the active first-week trial entitlement.
- **FR-LIVE-02**: Creators may schedule, start, pause, end, and moderate a live stream.
- **FR-LIVE-03**: Live audiences may view public streams or streams restricted to followers or subscribed tiers.
- **FR-LIVE-04**: Live chat supports messages, replies, moderation, blocked words, slow mode, and host removal.
- **FR-LIVE-05**: Stream authorization is issued as short-lived signed credentials and expires on stream end.
- **FR-LIVE-06**: VOD recording is opt-in, and recording access follows the original stream visibility plus any creator override.
- **FR-LIVE-07**: Stream health and viewer metrics are asynchronous, privacy-preserving aggregates.

## 2.10 Stripe, Trials, and Entitlements

- **FR-BILL-01**: Every paid capability has an entitlement key and a source such as trial, platform subscription, creator subscription, or admin grant.
- **FR-BILL-02**: All accounts receive a 7-day full-feature trial once, from verified account activation.
- **FR-BILL-03**: Trial expiry removes marketing, creator monetization, and live entitlements, retaining core social features.
- **FR-BILL-04**: Platform tiers must be explicitly versioned and contain entitlement bundles.
- **FR-BILL-05**: Stripe Checkout is used for one-time and recurring purchases.
- **FR-BILL-06**: Stripe webhook signatures are validated, events are deduplicated by event ID, and entitlements are updated transactionally.
- **FR-BILL-07**: Webhook processing is idempotent and independently retryable.
- **FR-BILL-08**: Billing disputes and refunds suspend or adjust entitlements according to recorded Stripe state.
- **FR-BILL-09**: Paid actions must never rely on a browser-reported tier or entitlement field.

## 2.11 Notifications and Email

- **FR-NOTIF-01**: Support in-app, push, and email notifications for follow, reply, mention, subscription, live, billing, and moderation events.
- **FR-NOTIF-02**: Users control channel and category notification settings.
- **FR-NOTIF-03**: Notification delivery is event-driven and retries with a bounded exponential backoff.
- **FR-NOTIF-04**: Email types: Verification, Password Reset, Welcome, Trial Expiring, Trial Expired, Subscription Purchased, Subscription Renewed, Subscription Canceled, Refund, Campaign Approved, Campaign Rejected, Report Received, Moderation Action, and Live Stream Started.
- **FR-NOTIF-05**: Notification preferences are enforced before queue publication and at delivery time.
- **FR-NOTIF-06**: Domain-event subscribers (for example `user.created` and `user.email-reset-requested`) invoke a shared email service contract with template id and template parameters rather than embedding SMTP logic in subscribers.

## 2.12 Trust, Safety, and Administration

- **FR-TRUST-01**: Users may report posts, media, accounts, comments, campaigns, live streams, and harassment.
- **FR-TRUST-02**: Reports require category, description, and evidence; duplicate reports aggregate.
- **FR-TRUST-03**: Moderation states include Open, Triaged, Escalated, Resolved, and Appealed.
- **FR-TRUST-04**: Moderators require MFA and receive least-privilege roles.
- **FR-TRUST-05**: Moderation actions are append-only audit events with actor, reason, target, and timestamp.
- **FR-TRUST-06**: Appeals pause account enforcement only according to defined policy; they do not silently restore account privileges.
- **FR-TRUST-07**: The moderation queue is operator-focused and never user-personalized.
- **FR-TRUST-08**: Account identity, ad activity, monetization, and public posting may be independently restricted.

## 2.13 Frontend Requirements

- **FR-FE-01**: The web app provides signup, login, verification, profile, feed, compose, media, story, subscription, marketing, live, moderation, and settings routes.
- **FR-FE-02**: Mobile-responsive layouts prioritize short video, text thread, photo, and live interactions.
- **FR-FE-03**: Every paid feature clearly identifies the entitlement required and the available action.
- **FR-FE-04**: The UI discloses sponsored content and the reason a feed source is displayed.
- **FR-FE-05**: Accessibility: semantic labels, keyboard operation, visible focus, reduced-motion mode, media alternatives, and WCAG 2.2 AA target.
- **FR-FE-06**: Upload UI supports progress, retry, cancellation, and an explicit processing state.
- **FR-FE-07**: The UI contains no engagement optimization or speculative recommendation UI.
- **FR-FE-08**: Account deletion and data export controls are visible and confirmation-driven.

---

# 3. Non-Functional Requirements

- **NFR-01** — Async processing: media, notifications, story cleanup, Stripe processing, live lifecycle, and verification processing run outside request handlers.
- **NFR-02** — Idempotency: writes use idempotency keys; Stripe webhook events and RabbitMQ deliveries are deduplicated.
- **NFR-03** — Cost efficiency: shared cluster services are preferred; pods remain one-replica unless scaling evidence exists; no cloud-managed database or CDN is required.
- **NFR-04** — Testability: core domain services are framework-independent and unit tested with mocked ports.
- **NFR-05** — Local development parity: local services implement the same contracts as Kubernetes, including RabbitMQ, PostgreSQL, Redis, object storage, and Stripe webhooks.
- **NFR-06** — Environment isolation: namespaces and names are prefixed `hotspot-{env}`; no HotSpot credentials are shared between environments.
- **NFR-07** — Observability: structured JSON logs, correlation IDs, metrics, traces, and security/audit events are emitted to the existing Prometheus/OpenObserve stack.
- **NFR-08** — Security: secrets come from Infisical or Kubernetes Secrets; no credentials are committed; least-privilege RBAC and network policies are required.
- **NFR-09** — Service-layer supremacy: all business decisions live in typed service modules. API/workers only parse input, call services, and map outputs.
- **NFR-10** — Privacy: data collection is purpose-limited, retention-bounded, and exportable/deletable.
- **NFR-11** — Availability: a pod restart must not lose durable work or grant entitlement twice.
- **NFR-12** — Capacity: workloads must respect the cluster's 4 vCPU/24 GiB ceiling and declare requests and limits.
- **NFR-13** — Immutable state: post edit history, payments, moderation actions, and entitlement grants append durable audit records.
- **NFR-14** — Data boundaries: raw identity evidence is not stored in HotSpot databases or object storage.
- **NFR-15** — Open APIs: HTTP APIs use versioned, documented, typed contracts and cursor pagination.
- **NFR-16** — No rank training: no engagement prediction model or opaque ML personalization ranking is implemented.
- **NFR-17** — Security of uploads: object keys are non-guessable, upload URLs are short-lived, and content types are revalidated after upload.
- **NFR-18** — Controlled rollout: each feature phase is independently deployable and toggled by feature flag where practical.
- **NFR-19** — Mutation eventing: every durable state mutation originating from create/update/delete commands emits a domain event through a service-level event port.
- **NFR-20** — Delivery guarantees: mutation events use at-least-once delivery with deduplication support (`event_id`, `aggregate_id`, `version`, `occurred_at`) and outbox-backed publication.
- **NFR-21** — Transactional consistency: database writes and outbox record creation occur in one transaction; asynchronous publisher workers deliver outbox records to RabbitMQ.
- **NFR-22** — Type completeness: TypeScript and Python source must use explicit, concrete types for contracts and data flow; do not use weak placeholder types (`any`, `unknown`, `object`, `Record<string, unknown>`, `dict`, `Dict[...]`, `Any`, `typing.Any`) in service/domain/repository/handler code.

---

# 4. System Architecture

## 4.1 Architecture Philosophy

HotSpot uses a dispatch/service split:

- **Dispatch Layer (Gateways/Adapters only)** — ingress/API gateways, controllers/handlers, webhook receivers, worker consumers, and schedulers parse transport input, call typed service contracts, and map outputs.
- **Orchestration Layer (Use-case coordinators in service modules)** — application workflow coordinators sequence multi-step business use cases across repositories, domain services, transactions, and event publication.
- **Service Layer (Microservices/Domain services only)** — domain services inside HotSpot microservices own validation, entitlement decisions, transactions, event publication, and side effects. Gateway/transport adapters are never part of this layer.

> ⚠ **Service Layer Supremacy — Core Architectural Rule**  
> No route, worker, Lambda-style handler, scheduled job, or GraphQL resolver may contain business rules or direct data access outside the architecture's service/query contracts. A transport layer is replaceable and intentionally thin.

> ⚠ **Worker Data Boundary Rule**  
> Worker applications are transport adapters and must not open direct PostgreSQL, MongoDB, or Redis connections. Workers consume events, call service APIs/contracts, and map outputs only. Database access is allowed exclusively inside service-layer applications and their repository/query modules.

Dispatch examples for this repository: `gateway/nest-http/src/handlers/**`, RabbitMQ consumer adapters, Stripe webhook endpoints, and scheduled-trigger adapters.

Orchestration examples for this repository: auth registration/session lifecycle coordination in auth-domain service modules and social/profile/post/media/story workflows in `services/social-nest/src/service/**` use-case services.

Service-layer examples for this repository: auth-domain services, `services/social-nest/src/**`, Java entitlement domain services, and Python identity/media domain services.

The Nest HTTP application is a **gateway/BFF only**. It must not own PostgreSQL repositories, domain mutations, or outbox orchestration. It parses transport input, validates request shape and identity context, invokes typed service clients, and maps service results/errors.

The social Nest service owns PostgreSQL repositories and social/profile/post/media/story domain orchestration. Auth must be an independent microservice with its own service contract and deployment boundary.

Gateway client boundary rule:

- The gateway must define one typed client per downstream microservice domain (for example: auth client, social client, entitlement client, media client).
- Controllers call domain-specific clients only; they must not multiplex multiple domains through one catch-all client.
- For protected downstream endpoints, gateway clients must forward required auth/context headers derived from gateway-authenticated request context (for example authorization token, actor id, role, correlation/request id).

## 4.2 Production Architecture

```text
CLOUDFLARE
  HTTPS
    → nginx-external ingress / hotspot.rmwhs.com

[Next.js Web] ──REST/GraphQL/WebSocket──┐
                                        ↓
                           NestJS API Gateway / BFF
                     auth | users | posts | media | feed
                                        ↓
        ┌───────────────────────────────┼─────────────────────────────┐
        ↓                               ↓                             ↓
PostgreSQL                         Redis cache                    RabbitMQ
accounts/content/payment             sessions/rate             durable jobs/events
MongoDB                         short-lived feeds                    .dlx/.dlq
media metadata/chats
        ┌───────────────────────────────┼─────────────────────────────┐
        ↓                               ↓                             ↓
 Java Spring                       Python Workers              Node Workers
identity/billing?                 verify/media/mod          rxjs-rabbitmq
entitlement/payment                image/video              notifications
        ↓                               ↓                             ↓
     Stripe                         Email provider
                               SMTP/Mailpit local

LiveKit / SFU
  → RTMP/WebRTC ingest
  → HLS/WebRTC delivery
  → live chat via Redis/RabbitMQ

Observability
  → Prometheus/Grafana metrics
  → OpenObserve logs/traces
  → Alertmanager
```

## 4.3 Portfolio/Home-Server Architecture

```text
Internet
  → Cloudflare DNS / edge
  → nginx-external ingress
  → one replica services
  → PostgreSQL pod/PVC
  → Redis pod
  → RabbitMQ pod
  → object storage pod/PVC (MinIO or Longhorn-backed)
  → MongoDB pod/PVC for media/chat hot metadata
  → LiveKit pod or external WebRTC relay
```

| Concern | Home Server | Larger Production |
|---|---|---|
| Compute | 4 vCPU single node | Multi-node Kubernetes |
| Database | Dedicated PostgreSQL single instance | Managed PostgreSQL Multi-AZ |
| Object storage | S3-compatible in-cluster storage | Managed object storage/CDN |
| Cache | Redis single instance | Redis cluster |
| Broker | Existing RabbitMQ | Managed or HA RabbitMQ |
| Live | LiveKit single or external relay | Multi-region SFU with TURN |
| Replicas | 1 | 2+ across zones |
| Backups | Scheduled dumps/PVC snapshots | Point-in-time backup/object replication |
| Cost | Existing hardware + power/domain | Variable managed-service cost |

## 4.4 Mutation Eventing and Async Event Flow

All state-changing service commands (create/update/delete) must emit domain events so downstream services can react without synchronous coupling.

Required rules:

- Dispatch adapters call service contracts only; they never publish RabbitMQ messages directly.
- Service-layer orchestration writes durable state and an outbox record in the same transaction.
- Publisher workers read pending outbox records and publish to RabbitMQ exchanges.
- Subscribers are idempotent and deduplicate using stable event identifiers.
- Event names are domain-scoped and action-scoped, for example: `user.created`, `user.updated`, `user.suspended`, `user.flagged`, `user.email-reset-requested`.
- Notification/email workers subscribe to these events and call a shared email service with `(templateId, templateParams, recipient)`.

```text
MEDIA_UPLOAD_COMPLETED
  → API validates upload session
  → [Media Service] creates processing record
  → RabbitMQ `hotspot.media.processing` publish
  → [Python Media Worker] transcodes/thumbnail/fingerprint
  → Store derived assets
  → [Media Service] updates status and publishes READY
  → Feed/notification adapters consume READY event

STRIPE_WEBHOOK_RECEIVED
  → [Stripe Adapter] verifies signature
  → [Billing Service] deduplicates Stripe event ID
  → DB transaction records event and effective entitlement
  → RabbitMQ `hotspot.billing.entitlement.changed`
  → Notification/email and subscription workers consume event

STORY_PUBLISHED
  → [Story Service] calculates expires_at = now + 24h
  → Worker schedule or delayed queue enqueues expiry job
  → Job checks current persisted state
  → Story becomes unavailable and cleanup job removes derived content

LIVE_STARTED
  → [Live Service] reserves/authorizes stream
  → LiveKit creates room
  → Chat worker subscribes/updates presence
  → RabbitMQ publishes `live.started`
  → Notification worker sends opt-in notifications

IDENTITY_VERIFICATION_REQUESTED
  → [Python Verification Worker] calls provider through adapter
  → Provider liveness/ID callback is signed and deduplicated
  → [Verification Service] records provider reference and outcome
  → Only APPROVED grants VERIFIED status

USER_CREATED
  → [User Service] writes user record + outbox event in one transaction
  → [Outbox Publisher] publishes `user.created` to RabbitMQ
  → [Notifications Worker] handles `user.created`
  → [Email Service Adapter] sends welcome template

USER_EMAIL_RESET_REQUESTED
  → [Auth/User Service] writes reset request + outbox event in one transaction
  → [Outbox Publisher] publishes `user.email-reset-requested`
  → [Notifications Worker] handles reset-requested event
  → [Email Service Adapter] sends verification template
```

## 4.5 Local Development Architecture

```text
Docker Compose
  postgres + redis + rabbitmq + mongodb
  → NestJS API
  → Java Spring entitlement/billing service
  → Python verification/media worker
  → Node worker (rxjs-rabbitmq)
  → Next.js web
  → Stripe CLI forwarding to webhook endpoint
```

---

# 5. K3s Infrastructure & Resources

## 5.1 Cluster Facts

| Item | Verified Value |
|---|---|
| Distro | k3s single control plane |
| Node | `elitedesk-800` |
| Capacity | 4 vCPU / approximately 24 GiB RAM |
| Storage | `local-path`, ReadWriteOnce, WaitForFirstConsumer |
| Ingress | standalone nginx, class `nginx-external` |
| DNS/TLS | Cloudflare proxied hostnames; ingress plain HTTP; `ssl-redirect: false` |
| RabbitMQ | namespace `rabbitmq`, service `rabbitmq.rabbitmq.svc.cluster.local:5672`, management `15672` |
| Redis | existing Infisical Redis is cluster infrastructure, not HotSpot application Redis |
| PostgreSQL | existing Infisical PostgreSQL is infrastructure-specific, not application data; HotSpot deploys its own PostgreSQL |
| Prometheus | namespace `monitoring`, service `kube-prometheus-stack-prometheus.monitoring:9090` |
| Grafana | `grafana.rmwhs.com` |
| OpenObserve | `openobserve.rmwhs.com`, service port `5080` |
| Infisical | `infisical.rmwhs.com` |
| GitLab | `gitlab.rmwhs.com`, registry `registry.rmwhs.com` |
| Mailpit | development SMTP `mailpit-smtp.mailpit.svc.cluster.local:25` |
| Storage capacity | only application-sized PVCs should be declared after local disk review |

No secret values were assumed or copied from existing services. Existing secrets are never read into source, logs, or documentation.

## 5.2 Namespace and Naming Convention

Use:

- namespace: `hotspot`
- `hotspot-{environment}-{descriptor}` names for Helm/Kubernetes resources
- local environment namespace may be `hotspot-dev`
- production namespace `hotspot`
- ingress hosts must use subdomains and never the apex domain
- dev public hosts must use `rmwhs-dev.space` or `*.rmwhs-dev.space` with a single label only (no deep subdomains)

## 5.3 Standard Tags and Labels

```yaml
metadata:
  labels:
    app.kubernetes.io/name: hotspot
    app.kubernetes.io/instance: <release>
    app.kubernetes.io/part-of: hotspot
    environment: <environment>
```

Application workloads also use Terraform-independent manifest annotations when Helm-generated resources apply.

## 5.4 Resource Inventory

| Service | Namespace | Purpose | Initial Deployment Shape |
|---|---|---|---|
| HotSpot HTTP Gateway | `hotspot` | NestJS gateway/BFF dispatch entrypoint | 1 replica |
| Social Domain Service | `hotspot` | NestJS auth/profile/posts/media/story domain service | 1 replica |
| Identity Service | `hotspot` | Python verification/identity adapter | 1 replica + worker |
| Entitlement Service | `hotspot` | Java Spring billing/entitlement domain | 1 replica |
| Media Worker | `hotspot` | Python asset processing | 1 replica |
| Event Workers | `hotspot` | NestJS/RxJS RabbitMQ workers | 1 replica |
| PostgreSQL | `hotspot` | canonical relational data | 1 pod, 10–20 Gi PVC |
| MongoDB | `hotspot` | media metadata/chat/live documents | 1 pod, 10 Gi PVC |
| Redis | `hotspot` | cache, sessions, presence, rate limits | 1 pod, 1–2 Gi PVC only if persistence needed |
| RabbitMQ | existing `rabbitmq` | shared broker; separate credentials/vhost | existing 5 Gi service |
| Object Storage | `hotspot` | media/S3-compatible object storage | 1 pod, 50–100 Gi PVC |
| LiveKit | `hotspot` | WebRTC signaling/SFU | 1 pod if cluster ingress supports WebRTC |
| Trivy Operator | `trivy-system` | runtime vulnerability and misconfiguration reports | 1 deployment, low-resource profile |
| GitLab | existing | source and container registry | reuse |
| Infisical | existing | secrets operator/source | reuse |
| Prometheus/Grafana | existing `monitoring` | metrics and dashboards | reuse |
| OpenObserve | existing `openobserve` | logs and collector pipeline | reuse |

## 5.5 RabbitMQ Topology

HotSpot uses a dedicated vhost and credentials. Use `hotspot.events` topic exchange and `hotspot.media`, `hotspot.notifications`, `hotspot.billing`, `hotspot.verification`, `hotspot.live`, and `hotspot.cleanup` durable queues. Every queue gets a corresponding `.retry` and `.dlq` topology.

All mutable backend services (NestJS API service modules, Java entitlement/billing service, Python identity/media services, and Node workers that own persistent state mutations) must integrate with RabbitMQ through a shared event-port abstraction and outbox publisher path. The web frontend must not connect directly to RabbitMQ.

Routing-key convention uses dotted domain events:

- `user.created`, `user.updated`, `user.suspended`, `user.flagged`, `user.email-reset-requested`
- `post.created`, `post.updated`, `post.deleted`
- `media.created`, `media.updated`, `media.deleted`
- `subscription.created`, `subscription.updated`, `subscription.canceled`

Node.js workers use `rxjs-rabbitmq`, explicit message types, durable publish options, ack-after-success, bounded retry helper usage, dead-letter setup, and metrics. Python/Java workers use supported AMQP clients unless the project has a verified language adapter.

## 5.6 Kubernetes Resources

Each workload declares:

- `Deployment` or `StatefulSet`
- `Service`
- `Ingress`/Gateway route
- `ServiceAccount`
- namespace `Role` and `RoleBinding`
- `ConfigMap`
- `Secret` reference only
- readiness/liveness probes
- CPU/memory requests and limits
- `PodDisruptionBudget` only after replica counts justify it

The application uses `nginx-external` and `ssl-redirect: false`. Cloudflare handles public TLS. The production hostnames are `hotspot.rmwhs.com` and `api.hotspot.rmwhs.com`. Dev hostnames use `rmwhs-dev.space` and must not use deep subdomains.

## 5.7 Secrets

Runtime secrets are stored in Infisical or namespace Kubernetes Secrets and mounted by reference. Required secret groups:

- `database/postgres`
- `database/mongodb`
- `redis/credentials`
- `rabbitmq/hotspot-vhost`
- `object-storage/minio`
- `stripe/api-secret`
- `stripe/webhook-secret`
- `stripe/connect-secret`
- `identity/provider`
- `jwt/signing`
- `livekit/live`
- `smtp/production`
- `gitlab/deploy-token`

## 5.8 IAM and Service Accounts

One namespace-scoped CI ServiceAccount and Role are required for HotSpot deploys. The deploy role can create/update Deployments, StatefulSets, Services, Ingresses, ConfigMaps, Secrets, and ServiceAccounts only in `hotspot`. It cannot read cluster-admin resources or other namespaces.

Runtime ServiceAccounts are workload-specific and never share credentials.

## 5.9 Media CDN and Edge Caching Strategy

### 5.9.1 Decision

HotSpot uses a dedicated caching gateway in front of its S3-compatible object storage for public media delivery. Cloudflare remains the internet edge cache and TLS boundary.

Decision summary:

- Primary approach: dedicated caching/proxy gateway in-cluster (Option 1 pattern).
- Deferred approach: image-optimization CDN layer with on-the-fly transforms (Option 2) until measured need exists.
- Rejected for current state: replacing object storage choice only to gain built-in static web serving (Option 3), because object-storage direction is already established.

### 5.9.2 Rationale

- Satisfies NFR-03 cost efficiency by adding minimal operational overhead and avoiding managed CDN dependencies.
- Respects NFR-12 capacity limits on the 4 vCPU single-node cluster by avoiding early CPU-heavy transform tiers.
- Preserves NFR-05 local parity: object storage plus caching gateway behavior can be reproduced in Docker Compose and k3s.
- Fits media architecture flow: derivatives are produced by media workers and then cached as immutable public assets.

### 5.9.3 Architecture Shape

```text
Client
  -> Cloudflare edge cache (public host)
  -> nginx-external ingress
  -> hotspot media cache gateway service
  -> object storage origin (MinIO/SeaweedFS-compatible)
```

Rules:

- Originals and derivatives remain in object storage as source of truth.
- Public derivative URLs use immutable object keys and strong cache headers.
- Private or entitlement-gated media uses short-lived signed URLs and bypass/non-cache policy as required.
- Media processing and policy status remain service/worker responsibilities; cache layer never performs business decisions.

### 5.9.4 Deferred Upgrade Trigger (Option 2)

Introduce an image-optimization CDN tier only when observed metrics justify it. Minimum trigger evidence:

- sustained origin read pressure that cache headers cannot mitigate,
- measurable latency/egress issues for media-heavy routes,
- CPU budget available for transform workloads without violating existing SLOs.

### 5.9.5 Delivery Plan Hook

Phase 4 and hardening work must include:

- media cache-control policy for derivative objects,
- immutable derivative key/versioning convention,
- one in-cluster media gateway deployment/service/ingress path with resource limits,
- cache-hit and origin-read observability metrics.

---

# 6. Software Design

## 6.1 Repository Structure

```text
HotSpot/
  PROJECT.md
  CLAUDE.md
  README.md
  CHANGELOG.md
  docker-compose.yml
  package.json
  gateway/
    nest-http/                 # NestJS HTTP/BFF dispatch gateway only
      src/
        handlers/              # transport adapters: parse, authorize, call service, map response
        clients/               # typed service clients/contracts
        middleware/            # auth, rate limit, correlation IDs, request validation
  apps/
    web/                       # Next.js user-facing client
  services/
    auth-nest/                 # authentication/session/passkey domain service
    social-nest/               # profile, posts, media, stories, social domain service
    entitlement-spring/        # billing, Stripe, trial, and entitlement domain service
    identity-python/           # identity/verification domain service
    media-python/              # media processing domain service
  workers/
    notification-node/
    cleanup-node/
  packages/
    contracts/
    auth/
    rabbitmq/
  prisma/
    schema.prisma
    migrations/
  mongo/
    indexes/
  k8s/
    namespace.yaml
    configmap.yaml
    secrets.example.yaml
    deployments/
    services/
    ingress/
    rbac/
  infra/
    terraform/
    values/
  ci/
    build.sh
    test.sh
    deploy.sh
  scripts/
    bootstrap.sh
    seed-local.sh
    stripe-listener.sh
  tests/
    integration/
    e2e/
```

## 6.2 Service Layer Actions

```typescript
type ServiceAction =
  | { action: 'registerUser'; payload: RegisterUserInput }
  | { action: 'verifyEmail'; payload: VerifyEmailInput }
  | { action: 'requestEmailReset'; payload: RequestEmailResetInput }
  | { action: 'startIdentityVerification'; payload: StartIdentityVerificationInput }
  | { action: 'completeIdentityVerification'; payload: CompleteIdentityVerificationInput }
  | { action: 'publishOutboxBatch'; payload: PublishOutboxBatchInput }
  | { action: 'handleUserCreated'; payload: UserCreatedEvent }
  | { action: 'handleUserEmailResetRequested'; payload: UserEmailResetRequestedEvent }
  | { action: 'createPost'; payload: CreatePostInput }
  | { action: 'createReply'; payload: CreateReplyInput }
  | { action: 'repostPost'; payload: RepostPostInput }
  | { action: 'quotePost'; payload: QuotePostInput }
  | { action: 'deletePost'; payload: DeletePostInput }
  | { action: 'uploadMedia'; payload: UploadMediaInput }
  | { action: 'publishMediaPost'; payload: PublishMediaPostInput }
  | { action: 'createStory'; payload: CreateStoryInput }
  | { action: 'expireStory'; payload: ExpireStoryInput }
  | { action: 'createStitch'; payload: CreateStitchInput }
  | { action: 'createDuet'; payload: CreateDuetInput }
  | { action: 'followAccount'; payload: FollowAccountInput }
  | { action: 'createCreatorTier'; payload: CreateCreatorTierInput }
  | { action: 'subscribeToCreator'; payload: SubscribeToCreatorInput }
  | { action: 'createPlatformCheckout'; payload: CreatePlatformCheckoutInput }
  | { action: 'processStripeEvent'; payload: ProcessStripeEventInput }
  | { action: 'createCampaign'; payload: CreateCampaignInput }
  | { action: 'submitModerationReport'; payload: SubmitModerationReportInput }
  | { action: 'resolveModerationCase'; payload: ResolveModerationCaseInput }
  | { action: 'createLiveStream'; payload: CreateLiveStreamInput }
  | { action: 'startLiveStream'; payload: StartLiveStreamInput }
  | { action: 'endLiveStream'; payload: EndLiveStreamInput };
```

## 6.3 Tech Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Web | Next.js, React, TypeScript | responsive web UI and SSR |
| State/API client | TanStack Query, typed OpenAPI client | server-state and API contracts |
| Public API/BFF | NestJS + TypeScript | transport parsing, auth context, typed service clients, response mapping, WebSocket gateway |
| Billing/entitlements | Java 21 Spring Boot | transactional billing, Stripe adapters, entitlement domain |
| Verification/media | Python 3.12 FastAPI workers | provider adapters, asset processing, moderation helpers |
| Relational DB | PostgreSQL + Prisma or typed SQL | canonical accounts, graph, posts, subscriptions, audits |
| Media/chat metadata | MongoDB | media derivatives, chat records, live metadata, short-lived documents |
| Cache/presence | Redis | cache, rate limiting, live presence, temporary sessions |
| Broker | RabbitMQ + `rxjs-rabbitmq` | durable async event delivery and Node workers |
| Object storage | SeaweedFS | original and transcoded media |
| Live | LiveKit | WebRTC ingest, room, chat support, VOD hooks |
| Payments | Stripe Checkout, Billing, Connect | platform tiers and creator subscriptions |
| Identity verification | Provider-adapter design; no provider hardcoded | verification and liveness outcome |
| Email | SMTP; Mailpit locally | transactional delivery |
| Metrics | Prometheus/Grafana | infrastructure and application metrics |
| Logs/traces | OpenObserve collector | structured logs and traces |
| Secrets | Infisical/Kubernetes Secrets | runtime credentials |
| IaC | Kubernetes manifests and optional Helm | repeatable deployment |
| CI/CD | GitLab CI, kaniko/buildah | build/push/deploy |

## 6.4 Data Access Rule

- PostgreSQL access is allowed only in `src/db/queries/**` or service repository implementations.
- MongoDB access is allowed only in media/chat repository implementations.
- Redis access is allowed only in cache/presence repository adapters.
- RabbitMQ publishing is allowed only through an event-port implementation and not directly in route handlers.
- Event publication for create/update/delete mutations must use outbox-backed service orchestration and not inline best-effort publish from transport handlers.
- HTTP dispatchers contain transport parsing and service invocation only.

## 6.5 Outbox Pattern Standard

### 6.5.1 Purpose

Guarantee that every durable create/update/delete mutation can be reacted to by downstream domains without losing events during process crash, network failure, or broker outage.

### 6.5.2 Event Envelope

All domain events published from outbox records use this canonical envelope:

```json
{
  "eventId": "uuid",
  "eventType": "user.created",
  "aggregateType": "user",
  "aggregateId": "uuid",
  "aggregateVersion": 1,
  "occurredAt": "2026-11-19T00:00:00.000Z",
  "payload": {},
  "headers": {
    "schemaVersion": 1,
    "producer": "hotspot-api"
  }
}
```

### 6.5.3 Outbox State Lifecycle

1. Service orchestration writes domain mutation and outbox row in one DB transaction.
2. Outbox row starts as `published_at IS NULL`, `publish_attempts = 0`.
3. Publisher worker reads oldest unpublished rows in bounded batches.
4. On successful RabbitMQ publish: set `published_at = NOW()`.
5. On failure: increment `publish_attempts`, leave row unpublished for retry.
6. When retry threshold is exceeded, publish to a `.dlq` route and mark outcome via alerting policy.

### 6.5.4 Publisher Worker Contract

- Poll interval is bounded and configurable.
- Batch size is bounded and configurable.
- Publisher acks only after broker confirms durable publish.
- Publisher is idempotent and safe for concurrent worker replicas.

### 6.5.5 Subscriber Contract

- Subscribers are idempotent and persist consumed `event_id` keys.
- Subscribers must treat event delivery as at-least-once.
- Subscriber handlers call domain services or shared adapters (for example email service), not transport utilities directly.

### 6.5.6 Notification and Email Use Case

- `user.created` subscriber calls shared email service with `templateId = welcome_email`.
- `user.email-reset-requested` subscriber calls shared email service with `templateId = email_reset_verification`.
- Template inputs are explicit structured fields (`templateParams`) and never freeform interpolated SQL/HTML from event payload.

### 6.5.7 Rollout Scope Rule

Start with auth/user events in Phase 1, then expand by bounded context in later phases. Do not require all services to migrate in one release.

## 6.6 Project Use Cases: Event-Driven Reactions

1. User registration creates account and outbox event `user.created`; notification worker sends welcome email.
2. User email reset request emits `user.email-reset-requested`; notification worker sends verification/reset email.
3. User suspension action emits `user.suspended`; downstream services revoke active sessions and notification channels.
4. Post deletion emits `post.deleted`; feed/cache subscribers remove stale references.
5. Subscription cancellation emits `subscription.canceled`; entitlement subscribers revoke capability access.

---

# 7. Data Model

## 7.1 PostgreSQL Tables

Representative production DDL. Exact migrations are generated during implementation.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  identity_verification_status TEXT NOT NULL DEFAULT 'pending',
  identity_verification_ref TEXT,
  first_week_trial_started_at TIMESTAMPTZ,
  first_week_trial_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX users_handle_unique ON users (lower(handle));
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE INDEX users_status_idx ON users (status);

CREATE TABLE verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  provider_subject TEXT,
  provider_session_ref TEXT,
  status TEXT NOT NULL,
  failure_code TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX verification_sessions_user_idx ON verification_sessions (user_id);
CREATE INDEX verification_sessions_status_idx ON verification_sessions (status);

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id),
  post_type TEXT NOT NULL,
  body TEXT,
  parent_post_id UUID REFERENCES posts(id),
  thread_root_id UUID REFERENCES posts(id),
  visibility TEXT NOT NULL DEFAULT 'public',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX posts_author_published_idx ON posts (author_id, published_at DESC);
CREATE INDEX posts_thread_root_idx ON posts (thread_root_id, published_at);

CREATE TABLE replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id),
  parent_reply_id UUID REFERENCES replies(id),
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX replies_post_idx ON replies (post_id, created_at);
CREATE INDEX replies_author_idx ON replies (author_id);

CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES users(id),
  following_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX follows_following_idx ON follows (following_id);

CREATE TABLE blocks (
  blocker_id UUID NOT NULL REFERENCES users(id),
  blocked_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE creator_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  stripe_price_id TEXT,
  monthly_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX creator_tiers_creator_idx ON creator_tiers (creator_id);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES users(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  creator_tier_id UUID REFERENCES creator_tiers(id),
  platform_tier_id UUID,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL,
  period_start_at TIMESTAMPTZ,
  period_end_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX subscriptions_stripe_unique ON subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX subscriptions_subscriber_idx ON subscriptions (subscriber_id, status);

CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  entitlement_key TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX entitlements_active_unique ON entitlements (user_id, entitlement_key, source_ref) WHERE revoked_at IS NULL;
CREATE INDEX entitlements_lookup_idx ON entitlements (user_id, entitlement_key, ends_at);

CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  processed_status TEXT NOT NULL,
  processed_at TIMESTAMPTZ,
  failure_reason TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE domain_event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  aggregate_version BIGINT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  publish_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX domain_event_outbox_unpublished_idx ON domain_event_outbox (published_at, created_at);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL,
  budget_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  stripe_payment_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX campaigns_advertiser_idx ON campaigns (advertiser_id, created_at DESC);

CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id),
  media_asset_id UUID NOT NULL,
  visibility TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX stories_author_expiry_idx ON stories (author_id, expires_at);

CREATE TABLE live_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id),
  room_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX live_streams_creator_status_idx ON live_streams (creator_id, status);

CREATE TABLE moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reporter_id UUID REFERENCES users(id),
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_moderator_id UUID REFERENCES users(id),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX moderation_cases_status_idx ON moderation_cases (status, created_at);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_events_target_idx ON audit_events (target_type, target_id, created_at DESC);
CREATE INDEX audit_events_actor_idx ON audit_events (actor_id, created_at DESC);
```

## 7.2 MongoDB Collections

- `media_assets`: object keys, MIME, dimensions, duration, derivatives, processing status, attribution, remix permissions.
- `media_comments`: comment/reply tree and moderation state.
- `live_chat_messages`: live stream chat, short TTL or retention policy.
- `story_views`: story view records, owner-only reporting and bounded retention.
- `campaign_metrics`: aggregate impression/click/spend rollups.
- `notification_log`: delivery attempts and provider references.

MongoDB indexes are created with each collection migration and enforce TTL policies for temporary records.

---

# 8. API Documentation

## 8.1 Base URLs

| Environment | API URL | Web URL |
|---|---|---|
| Local | `http://api.hotspot.local` | `http://hotspot.local` |
| Dev | `https://api.rmwhs-dev.space` | `https://hotspot.rmwhs-dev.space` |
| Production | `https://api.hotspot.rmwhs.com` | `https://hotspot.rmwhs.com` |

## 8.2 Response Envelope

```json
{
  "success": true,
  "data": {},
  "meta": { "cursor": null },
  "requestId": "uuid"
}
```

Errors:

```json
{
  "success": false,
  "error": {
    "code": "ENTITLEMENT_REQUIRED",
    "message": "A paid HotSpot tier or active trial is required.",
    "details": {}
  },
  "requestId": "uuid"
}
```

## 8.3 Endpoint Groups

| Method | Path | Description |
|---|---|---|
| POST | `/v1/auth/register` | Register account |
| POST | `/v1/auth/login` | Start session |
| POST | `/v1/auth/refresh` | Rotate refresh token |
| POST | `/v1/auth/logout` | Revoke session |
| POST | `/v1/identity-verification/sessions` | Start identity verification 🔒 |
| POST | `/v1/identity-verification/callback` | Signed provider result webhook |
| GET | `/v1/users/:handle` | Public profile |
| PATCH | `/v1/users/me` | Update own profile 🔒 |
| POST | `/v1/users/:id/follow` | Follow or request 🔒 |
| POST | `/v1/users/:id/block` | Block user 🔒 |
| POST | `/v1/posts` | Create text post 🔒 |
| GET | `/v1/posts/:id` | Retrieve post |
| PATCH | `/v1/posts/:id` | Edit post 🔒 |
| DELETE | `/v1/posts/:id` | Delete post 🔒 |
| POST | `/v1/posts/:id/replies` | Reply 🔒 |
| POST | `/v1/posts/:id/repost` | Repost 🔒 |
| POST | `/v1/posts/:id/quote` | Quote post 🔒 |
| POST | `/v1/media/upload-sessions` | Start resumable upload 🔒 |
| POST | `/v1/media/:id/publish` | Publish processed media 🔒 |
| POST | `/v1/media/:id/stitch` | Create stitch 🔒 |
| POST | `/v1/media/:id/duet` | Create duet 🔒 |
| POST | `/v1/stories` | Publish story 🔒 |
| GET | `/v1/feeds/following` | Chronological feed 🔒 |
| GET | `/v1/feeds/public` | Public chronological feed |
| GET | `/v1/feeds/topics/:topic` | Explicit topic feed |
| POST | `/v1/creator-tiers` | Create creator tier 🔒 |
| POST | `/v1/creator-subscriptions/checkout` | Start subscription checkout 🔒 |
| POST | `/v1/billing/platform/checkout` | Buy platform tier 🔒 |
| POST | `/v1/stripe/webhooks` | Process signed Stripe webhook |
| POST | `/v1/campaigns` | Create marketing campaign 🔒 |
| POST | `/v1/campaigns/:id/submit` | Submit campaign review 🔒 |
| POST | `/v1/live-streams` | Schedule/start stream 🔒 |
| POST | `/v1/live-streams/:id/end` | End stream 🔒 |
| GET | `/v1/live-streams/:id` | Live stream details |
| POST | `/v1/reports` | Submit report 🔒 |
| GET | `/v1/admin/moderation/cases` | Moderation queue 🔒 Admin |
| POST | `/v1/admin/moderation/cases/:id/resolve` | Resolve case 🔒 Admin |

JWT endpoints validate issuer, audience, expiry, revocation state, and account status. Entitlements are enforced server-side and are never trusted from the web client.

## 8.4 Error Codes

| Code | HTTP Status | Meaning |
|---|---:|---|
| UNAUTHORIZED | 401 | Missing or invalid session |
| FORBIDDEN | 403 | Role or account state forbids action |
| VALIDATION_ERROR | 422 | Invalid input |
| NOT_FOUND | 404 | Resource absent or hidden |
| IDENTITY_REQUIRED | 403 | Identity verification is incomplete |
| ENTITLEMENT_REQUIRED | 402 | Paid tier/trial required |
| TRIAL_EXPIRED | 402 | Seven-day trial expired |
| STRIPE_EVENT_DUPLICATE | 200 | Valid but already processed |
| STRIPE_SIGNATURE_INVALID | 400 | Signature verification failed |
| MEDIA_PROCESSING | 202 | Upload/derivative is processing |
| STORY_EXPIRED | 410 | Story expired |
| BLOCKED_INTERACTION | 403 | Blocking/privacy policy forbids action |
| REMIX_NOT_ALLOWED | 403 | Source media disallows stitch/duet |
| LIVE_NOT_AVAILABLE | 403 | Stream not allowed or entitlements absent |
| INTERNAL_ERROR | 500 | Unexpected server failure |

---

# 9. DevOps & Deployment

## 9.1 Environments

| Environment | Purpose | Compute |
|---|---|---|
| Local | Docker Compose developer environment | workstation |
| Dev | Feature validation on k3s with Cloudflare hostnames under `rmwhs-dev.space` (single-label subdomains only) | `hotspot-dev` namespace |
| Production | Public personal project | `hotspot` namespace |

## 9.2 CI/CD

```text
GitLab Push
  → Build stage
  → Kaniko/buildah image build
  → Tag: $CI_COMMIT_SHORT_SHA
  → Push: $CI_REGISTRY_IMAGE/$service:$CI_COMMIT_SHORT_SHA
  → Test stage
  → Unit tests
  → Contract tests
  → Integration tests
  → Deploy stage (protected branch/tag)
  → Scope GitLab deploy SA token
  → Render Kubernetes manifests
  → Apply namespace/RBAC/config resources
  → Set image digest/tag
  → Wait for rollout
  → Smoke test
```

SCM authority for this project is the in-cluster GitLab service (`gitlab.rmwhs.com`) and its registry (`registry.rmwhs.com`).

Frontend is built independently and deployed only after API contracts pass. Database migrations run before application rollout and must be backward-compatible for rolling deployments.

## 9.3 Local Deployment

```bash
cd /home/ryanwaite28/Developer/ai/HotSpot
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

## 9.4 Terraform and Manifests

Plain Kubernetes manifests are the default for application workloads. Helm is used only for infrastructure components or third-party stacks. A future Terraform layer may manage DNS, Cloudflare Tunnel configuration, and namespace resources, but it must not own application databases or live credentials.

## 9.5 GitOps Strategy (ArgoCD Compatibility)

GitOps is compatible with the HotSpot architecture and does not conflict with service-layer boundaries or runtime rules.

Current default model for this project is **GitLab CI-driven deployment** using `kubectl apply` from protected pipelines. ArgoCD is intentionally deferred during early phases to avoid operational overhead on a constrained home cluster.

If ArgoCD is introduced later, deployment authority must move to ArgoCD for application workloads:

- GitLab CI continues to build/test/scan/push images.
- CI updates manifest references (tag/digest) in Git.
- ArgoCD reconciles cluster state from Git and becomes the single runtime deploy authority.
- CI must stop direct `kubectl apply` for Argo-managed resources to avoid controller conflict/drift loops.

## 9.6 Build Scripts

The repository must expose:

- `npm run build`
- `npm run test`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run deploy:dev`
- `npm run deploy:prod`
- `npm run stripe:listen`

## 9.7 Deploy Checklist

- [ ] protected branch deployment
- [ ] image tagged by commit SHA
- [ ] no `:latest` image
- [ ] Secret references verified
- [ ] resource requests/limits present
- [ ] readiness/liveness probes present
- [ ] ingress class `nginx-external`
- [ ] Cloudflare proxied DNS configured
- [ ] migration is backward-compatible
- [ ] Stripe webhook endpoint and signing secret configured
- [ ] smoke test against public API
- [ ] GitLab security gates enabled (SAST, Secret, SCA, Container, IaC)
- [ ] If ArgoCD is enabled: CI direct apply disabled for Argo-managed resources

## 9.8 GitLab-K3s Integration Transition Plan

### 9.8.1 Goal

Introduce GitLab-to-k3s integrations in controlled phases that improve deploy security, environment visibility, and traceability without adding controller conflict or violating existing architecture rules.

### 9.8.2 Non-Goals

- No immediate switch to ArgoCD as deploy authority.
- No cluster-admin credentials in GitLab CI.
- No replacement of service-layer architecture boundaries.

### 9.8.3 Guardrails

- Keep one active deploy authority per workload set.
- Use namespace-scoped ServiceAccounts and RoleBindings only.
- Keep immutable image references (`$CI_COMMIT_SHORT_SHA` or digest).
- Use pull-safe patterns where possible for tunnel/NAT-constrained environments.

### 9.8.4 Phased Rollout

| Phase | Scope | Delivery | Exit Criteria |
|---|---|---|---|
| G0 | Baseline SCM and CI linkage | GitLab remote/registry/deploy scripts are active | push/pull works; pipeline can deploy to `hotspot-dev` |
| G1 | GitLab Agent visibility only | Install GitLab Kubernetes Agent with read-focused namespace scope | GitLab environments show cluster state without CI kubeconfig broadening |
| G2 | Secure deployment metadata | Publish deployment metadata and environment status in GitLab | commit-to-environment traceability and rollout evidence are visible |
| G3 | Optional pull-based app delivery | Move selected app workloads to Agent pull-based apply | protected branch change reconciles in-cluster with scoped permissions |
| G4 | Optional GitOps controller adoption | Introduce ArgoCD only when multi-service cadence justifies it | CI no longer applies Argo-managed resources directly |

### 9.8.5 Phase Controls

- **G1 controls**: Agent token storage in secret manager, namespace-scoped RBAC, read-only where practical.
- **G2 controls**: Deployment jobs must emit environment URL, commit SHA, and rollout status.
- **G3 controls**: CI image build/push remains in GitLab; cluster apply path is pull-based for migrated workloads.
- **G4 controls**: Explicit cutover checklist required to prevent dual-controller drift.

### 9.8.6 Operational Readiness Checklist

- [ ] GitLab Agent project and token bootstrap documented
- [ ] Namespace-scoped agent RBAC manifest reviewed
- [ ] Environment mapping (`dev`/`production`) verified in GitLab
- [ ] Deployment metadata emitted per rollout
- [ ] Rollback procedure validated for at least one failed rollout simulation
- [ ] Controller-authority matrix documented (CI apply vs Agent vs ArgoCD)

### 9.8.7 Success Metrics

- Mean deploy verification time reduced for `hotspot-dev`.
- Every production deployment linked to commit SHA and pipeline ID.
- No cluster-wide credentials required in CI jobs.
- Zero detected resource drift loops caused by dual deployment controllers.

---

# 10. Local Development

## 10.1 Prerequisites

- Docker Engine + Compose
- Node.js 22 LTS
- npm/pnpm
- Java 21
- Python 3.12
- PostgreSQL client
- MongoDB shell
- Stripe CLI
- `kubectl`
- GitLab credentials for registry access
- Infisical CLI only when using real secret sources

## 10.2 Docker Compose Services

A representative local stack:

- PostgreSQL
- MongoDB
- Redis
- RabbitMQ
- Mailpit
- LiveKit or local mock media relay
- NestJS API
- Java Entitlement service
- Python verification/media services
- Node workers
- Next.js web

## 10.3 Environment Variables

```dotenv
APP_ENV=local
APP_PUBLIC_URL=http://hotspot.local
API_PUBLIC_URL=http://api.hotspot.local
POSTGRES_URL=postgresql://hotspot:local-only@postgres:5432/hotspot
MONGODB_URL=mongodb://mongodb:27017/hotspot
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://hotspot:local-only@rabbitmq:5672/hotspot
OBJECT_STORAGE_ENDPOINT=http://minio:9000
OBJECT_STORAGE_BUCKET=hotspot-media
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
IDENTITY_PROVIDER_API_KEY=replace_me
LIVEKIT_API_KEY=replace_me
LIVEKIT_API_SECRET=replace_me
JWT_SIGNING_KEY=replace_with_local_test_key
```

Local values are test-only. Cloud environments use Infisical/Kubernetes Secrets. No example file contains a real credential.

## 10.4 Testing the Core Flow

```bash
curl -X POST http://api.hotspot.local/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"handle":"demo_user","email":"demo@example.com","password":"..."}'

curl -X POST http://api.hotspot.local/v1/posts \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{"body":"Hello HotSpot","visibility":"public"}'

curl http://api.hotspot.local/v1/feeds/following \
  -H 'Authorization: Bearer <access-token>'

stripe listen --forward-to http://api.hotspot.local/v1/stripe/webhooks
```

---

# 11. Implementation Plan

Implementation is divided into controlled, session-sized phases. No phase begins with its successor work unless explicitly required as a dependency.

## 11.1 Architecture Reconciliation Baseline (2026-11-20)

The implementation plan and current codebase have partial drift in completion semantics. To keep execution aligned with this document, use the following interpretation and controls:

- A phase-level `[x]` item in this section means **implemented or scaffolded at service/domain level**, not runtime-complete feature delivery.
- Runtime completion requires corresponding FR sub-items, deployment/runtime evidence, and the Runtime Completion Gate.
- When status is mixed, record it explicitly as **implemented**, **scaffolded**, or **deferred** in phase notes and `CHANGELOG.md`.

Current reconciliation snapshot:

| Area | Current state | Reconciled status |
|---|---|---|
| Gateway dispatch boundary (`gateway/nest-http`) | Transport-only controllers and typed service client calls | Implemented |
| Social domain business logic (`services/social-nest/src/service/**`) | Domain logic and repository orchestration exist for social/profile/post/media/story domains | Implemented |
| Auth domain boundary (`gateway auth client + auth service`) | Gateway now uses dedicated auth client; auth service extraction is in progress | Scaffolded |
| Phase 1-12 FR sub-item delivery | Many FR-specific route/runtime/deploy items remain unchecked | Deferred |
| Runtime evidence parity for all phase claims | Partial and uneven across domains | Deferred |
| NestJS idiomatic provider/module usage in social service | Present but mixed with composition factory patterns | Scaffolded |

Microservices simplification decision:

- Keep the dispatch/orchestration/service split as-is.
- Prefer idiomatic NestJS DI/module composition for maintainability: `@Injectable()` services and explicit providers/modules over custom handler token objects where no special abstraction is required.
- Allow deviation only when required for test isolation, cross-runtime portability, or measurable operational benefits, and document the rationale in phase notes.

Required reconciliation tasks:

- [x] Replace custom auth handler token wiring with direct NestJS injectable service injection in the social service.
- [x] Replace manual gateway service-client object construction with NestJS provider/token wiring.
- [x] Replace gateway auth-over-social client usage with a dedicated auth service client (`AUTH_SERVICE_URL`).
- [ ] Extract auth runtime from social service into an independent auth microservice deployment and contract package boundary.
- [ ] Add dedicated gateway clients for social, entitlement, media, and identity services and enforce header-forwarding adapters for protected downstream calls.
- [ ] Migrate remaining domain composition factories in `services/social-nest/src/service/**` into explicit NestJS modules/providers without moving business logic out of service modules.
- [ ] Add a phase-by-phase evidence matrix in `CHANGELOG.md` that labels each claim as implemented/scaffolded/deferred.
- [ ] Do not mark FR sub-items complete until route/runtime/deploy evidence exists.

## 11.2 Session Steering Protocol (Mandatory)

All implementation sessions must run a steering loop using:

- `.github/skills/session-steering/SKILL.md`
- `.github/skills/session-steering/references/session-steering-checklist.md`

Required checkpoints:

- **Start Gate**: phase lock + skill lock + boundary lock before edits.
- **In-Session Gate**: preserve dispatch/orchestration/service boundaries and reconcile drift as soon as detected.
- **Exit Gate**: classify outcomes as implemented/scaffolded/deferred and update `CHANGELOG.md` with verification evidence, unresolved work, and next resume point.

This protocol is required for all code, CI, and infrastructure sessions.

## Phase 0 — Workspace and Cluster Foundation

- [x] Confirm SCM platform is in-cluster GitLab (`gitlab.rmwhs.com`)
- [x] Define namespace, registry, ingress, and deploy SA
- [x] Add `.gitlab-ci.yml` skeleton and Kaniko/buildah scripts
- [x] Create local Docker Compose dependencies
- [x] Add environment variable templates
- [x] Add Infisical/Kubernetes Secret references
- [x] Add Prometheus/OpenObserve labels and dashboards
- [x] Add `CLAUDE.md`
- [x] Verify RabbitMQ vhost, credentials, and service DNS separately
- [x] Verify local-path storage and disk capacity

#### Phase 0 runtime evidence
- [x] Add PostgreSQL, MongoDB, Redis, RabbitMQ, and Mailpit healthchecks and restart policies.
- [x] Add repeatable `bootstrap:local`, `reset:local`, `reset:local:seed`, `db:migrate`, and `db:seed` root commands.
- [x] Implement a forward-only local migration ledger for the Phase 1 foundation migration set.
- [x] Implement deterministic local seed accounts for admin, creator, and viewer roles.
- [x] Verify `npm run reset:local:seed` from fresh disposable volumes: core services healthy, 8 migrations applied, and 3 seed accounts inserted.
- [ ] Verify MinIO startup once registry access provides a reachable object-storage image.

Phase 0 note: current application `Service` and `Deployment` manifests include baseline Prometheus/OpenObserve labels/annotations.
Phase 0 note: repository remote URL is configured and tracking `origin/master` at `gitlab.rmwhs.com/apps/hotspot.git`.
Phase 0 note: dev DNS now uses `rmwhs-dev.space` with wildcard `*.rmwhs-dev.space`; deep subdomains are not supported and all ingress host planning must remain single-label under that domain.

## Phase 1 — Identity and Security Foundation

- [x] Create PostgreSQL schema for users, sessions, and verification
- [x] Implement registration and email verification service scaffolding
- [x] Complete registration/email verification composition wiring
- [x] Complete registration/email verification runtime integration tests
- [x] Implement auth/user mutation outbox events (`user.created`, `user.updated`, `user.suspended`, `user.flagged`, `user.email-reset_requested`) at service scaffolding level
- [x] Complete auth/user mutation outbox runtime integration tests
- [x] Implement JWT/refresh service scaffolding

- [x] Complete JWT/refresh composition wiring
- [x] Complete JWT/refresh runtime integration tests
- [x] Implement passkey/WebAuthn service scaffolding
- [x] Complete passkey/WebAuthn composition wiring
- [x] Complete passkey/WebAuthn runtime integration tests
- [x] Implement account status and RBAC service scaffolding
- [x] Complete account status and RBAC composition wiring
- [x] Complete account status and RBAC runtime integration tests
- [x] Implement identity-verification provider adapter service scaffolding
- [x] Complete identity-verification provider adapter composition wiring
- [x] Complete identity-verification provider adapter runtime integration tests
- [x] Implement signed verification callback and deduplication service scaffolding
- [x] Complete signed verification callback runtime integration tests
- [x] Implement trial entitlement activation exactly once
- [x] Add account deactivation/export/delete workflow
- [x] Unit test every auth/identity service method
- [x] Implement notification subscribers for `user.created` and `user.email-reset_requested` using shared email service contract (scaffolding)
- [x] Complete notification subscriber runtime integration tests
- [x] Add outbox publisher + subscriber integration tests (dedup/retry/DLQ)
- [x] Enforce dispatch-vs-orchestration-vs-service boundaries for auth flows (gateway adapters call service contracts only)

#### FR-AUTH-01 — Registration and email verification
- [ ] Add users, verification, session, and audit migrations.
- [ ] Implement register/verify routes and duplicate/expired/verified states.
- [ ] Emit `user.created` and email-verification events transactionally.

#### FR-AUTH-02 / FR-AUTH-03 / FR-AUTH-04 — Sessions and MFA
- [ ] Add refresh-token, passkey, MFA, and revocation migrations.
- [ ] Implement JWT rotation, reuse detection, WebAuthn, and privileged MFA gates.
- [ ] Test expiry, logout, reuse, challenge replay, and MFA-denied outcomes.

#### FR-AUTH-05 — Account lifecycle
- [ ] Add suspension, deactivation, export, deletion, and retention migrations.
- [ ] Expose confirmation-driven lifecycle routes and append-only audit events.
- [ ] Test restore, export, irreversible deletion, and replay behavior.

#### FR-AUTH-06 / FR-AUTH-07 / FR-AUTH-08 / FR-AUTH-09 — Identity verification
- [ ] Add provider subject, callback, status, failure, and dedupe migrations.
- [ ] Implement signed callback, duplicate-identity detection, and safe failure contracts.
- [ ] Store only provider references/outcomes and gate public publishing.

#### FR-AUTH-10 — Bot prevention
- [ ] Add automation/bulk-account signals and review/escalation state.
- [ ] Reject posting rights for prohibited synthetic/automated accounts.
- [ ] Test bulk registration, duplicate identity, escalation, and restriction behavior.

#### Cross-cutting runtime exit for Phase 1
- [ ] Verify migrations, runnable routes, JWT/passkey, outbox, broker, and notification evidence.

## Phase 2 — Profiles and Social Graph

- [x] Implement profile CRUD and handle uniqueness
- [x] Implement follow, unfollow, request, approve, block, mute
- [x] Implement account privacy and follower list visibility
- [x] Implement cursor pagination
- [x] Implement relationship service unit/integration tests
- [x] Add profile and relationship API route contracts
- [x] Complete profile/social composition wiring
- [x] Complete profile/social runtime integration tests

Phase 2 note: service/repository/handler scaffolding for profile and social graph flows is implemented with outbox-backed mutation events (`profile.updated`, `follow.requested`, `follow.accepted`, `follow.removed`, `user.blocked`, `user.muted`), follower-list privacy enforcement, cursor pagination, and runtime PostgreSQL integration coverage for profile updates plus protected-follow lifecycle.

#### FR-SOCIAL-01 / FR-SOCIAL-02 — Profiles and handles
- [ ] Add profile, handle-history, redirect, visibility, and media migrations.
- [ ] Implement profile update and unique handle redirect behavior.
- [ ] Test conflicts, old handles, privacy, and profile deletion.

#### FR-SOCIAL-03 / FR-SOCIAL-04 — Relationship operations
- [ ] Add follow/request/approve/reject/remove/block/mute migrations.
- [ ] Expose relationship routes and actor/privacy authorization.
- [ ] Emit relationship mutation events transactionally and test duplicates/replays.

#### FR-SOCIAL-05 / FR-SOCIAL-06 — Blocking and profile visibility
- [ ] Implement bidirectional block visibility and muted notification behavior.
- [ ] Expose mutual-follow/subscription state only under policy.
- [ ] Test protected, blocked, muted, suspended, and deleted accounts.

#### FR-SOCIAL-07 — Cursor pagination
- [ ] Add deterministic ordering and opaque cursor contracts.
- [ ] Test first/last/empty/invalid/concurrent-pagination behavior.

#### Cross-cutting runtime exit for Phase 2
- [ ] Verify PostgreSQL migrations, profile/social routes, privacy decisions, and outbox evidence.

## Phase 3 — Text Posts and Threads

- [x] Implement post creation/draft/schedule/edit/delete/pin
- [x] Implement reply and thread-root relationships
- [x] Implement repost and quote operations
- [x] Implement like, bookmark, and share counters
- [x] Implement chronological following/public/topic feed
- [x] Implement post privacy and block checks
- [x] Add full text-post test suite

Phase 3 note: posts foundation scaffolding is implemented with typed contracts, PostgreSQL `posts` schema + interaction migrations/model, repository/service/handler composition, outbox-backed mutation events (`post.created`, `post.replied`, `post.reposted`, `post.quoted`, `post.updated`, `post.deleted`, `post.pinned`, `post.liked`, `post.unliked`, `post.bookmarked`, `post.unbookmarked`), reply/thread-root persistence (`parent_post_id`, `thread_root_post_id`), repost/quote persistence (`repost_of_post_id`, `quote_of_post_id`), interaction counters (`like_count`, `bookmark_count`, `share_count`), cursor-based chronological following/public/topic feed retrieval, service-layer post visibility and block checks for source interactions, and expanded text-post test coverage (service/handler plus runtime integration harness/tests).

#### FR-POST-01 / FR-POST-02 — Post lifecycle
- [ ] Add posts, edit-history, schedule, pin, and deletion migrations.
- [ ] Expose create/draft/schedule/edit/delete/pin/unpin routes.
- [ ] Test max length, scheduled publication, editing, pinning, and deletion.

#### FR-POST-03 — Replies and threads
- [ ] Add parent/direct/thread-root migrations and indexes.
- [ ] Expose nested reply routes and chronological thread retrieval.
- [ ] Test deep threads, deleted parents, and takedown behavior.

#### FR-POST-04 / FR-POST-05 — Reactions and repost/quote policy
- [ ] Add repost/quote/like/bookmark/share migrations with uniqueness rules.
- [ ] Enforce source privacy, blocking, deletion, and takedown rules.
- [ ] Test duplicate interactions and source-policy changes.

#### FR-POST-06 / FR-POST-07 — History and deletion
- [ ] Append post edits and moderation-retention events.
- [ ] Expose edit history and public deletion semantics.
- [ ] Test edit visibility, cache invalidation, and moderation retention.

#### FR-POST-08 — Chronological discovery
- [ ] Implement following/public/topic/bookmark feed pagination.
- [ ] Exclude blocked, muted, deleted, suspended, and hidden content.
- [ ] Test deterministic cursor ordering and prohibited ranking fields.

#### Cross-cutting runtime exit for Phase 3
- [ ] Verify PostgreSQL, API, feed/privacy services, outbox events, and pagination smoke evidence.

## Phase 4 — Media Foundation

- [x] Add object-storage upload session
- [x] Add MongoDB media metadata collection
- [x] Implement resumable upload/size/MIME validation
- [x] Implement Python media processor worker
- [x] Implement RabbitMQ processing queue with DLQ
- [x] Implement thumbnail/transcode/status contract
- [x] Implement alt text and photo carousels
- [x] Implement media comments/replies
- [x] Add media integration tests
- [x] Implement immutable derivative object-key and cache-control policy
- [x] Deploy in-cluster media caching gateway and ingress route

Phase 4 note: object-storage upload sessions, size/MIME validation, upload-complete callback flow (`uploading -> uploaded -> processing`), Mongo metadata repository wiring (with local fallback), RabbitMQ processing consumer/subscriber scaffolding, runnable media worker bootstrap, thumbnail/transcode status contract with immutable derivative key/cache headers, media comments/replies, photo carousel links, media unit/runtime-integration harness coverage, and an in-cluster media caching gateway + ingress deployment path are implemented. Full transcode execution internals remain pending.

#### FR-MEDIA-01 / FR-MEDIA-03 — Upload sessions and validation
- [ ] Add upload-session, object-key, MIME, size, duration, and expiry migrations.
- [ ] Expose resumable upload-session/callback routes with short-lived credentials.
- [ ] Reject unsupported MIME, oversized files, excessive duration, and unowned callbacks.

#### FR-MEDIA-02 / FR-MEDIA-04 — Processing and publication
- [ ] Add processing-status, derivative, fingerprint, and thumbnail migrations/collections.
- [ ] Implement worker processing contracts and READY/human-override publication gates.
- [ ] Test retry/DLQ, stale callbacks, processing failure, and duplicate completion.

#### FR-MEDIA-05 / FR-MEDIA-06 — Metadata, carousels, and comments
- [ ] Add carousel, caption, alt-text, location-opt-in, tag, and comment/reply migrations.
- [ ] Expose media publish/update/comment routes and ownership/moderation checks.
- [ ] Test ordering, location consent, alt text, and hidden/deleted comments.

#### FR-MEDIA-07 / FR-MEDIA-08 / FR-MEDIA-09 — Remix rights and derivatives
- [ ] Add remix permission, source/destination, attribution, and derivative-status migrations.
- [ ] Require both remix permissions and authorized ownership before derivative processing.
- [ ] Test takedown propagation and publication only after derivative safety/metadata processing.

#### Cross-cutting runtime exit for Phase 4
- [ ] Verify object storage, Mongo/PostgreSQL, RabbitMQ queue/DLQ, worker callback, cache gateway, and READY media smoke evidence.

## Phase 5 — Stories

- [x] Implement story creation and 24-hour expiry
- [x] Implement story visibility and viewer records
- [x] Implement delayed cleanup and story reply delivery
- [x] Implement MongoDB TTL or cleanup worker
- [x] Test exact expiry and hidden/deleted behavior

Phase 5 note: story publish scaffolding now requires a ready media asset owned by the actor, writes `story.created` outbox events, assigns a strict 24-hour expiry window, and includes an explicit expiry cleanup path that emits `story.expired` outbox events when expired records are removed. Active-story visibility checks now enforce `public`, `followers`, and owner-only `close_friends` access semantics, and story-viewer records are tracked (Mongo-backed with local in-memory fallback) with owner-only viewer summary access. Story replies now enqueue `story.reply.created` outbox events for notification delivery, a dedicated cleanup worker runtime calls the stories expiry API on a configurable interval, and test coverage now includes exact-expiry and hidden/blocked access behavior.

#### FR-STORY-01 / FR-STORY-02 — Publishing and expiry
- [ ] Add story and expiry migrations with exact 24-hour expiration from successful processing.
- [ ] Expose create/list/expire routes and cleanup worker startup/API callback contracts.
- [ ] Test exact expiry, replayed cleanup, deleted media, and public deep-link exclusion.

#### FR-STORY-03 / FR-STORY-04 — Viewers and replies
- [ ] Add bounded-retention story-view and story-reply migrations/collections.
- [ ] Expose owner-only viewer summary and owner inbox reply behavior.
- [ ] Test unauthorized viewer access, duplicate views, reply delivery, and retention.

#### FR-STORY-05 / FR-STORY-06 — Visibility and privacy disclosure
- [ ] Implement public/follower/close-friend visibility and block/privacy checks.
- [ ] Document screenshot/download non-prevention and avoid any false privacy or DRM claim.
- [ ] Test hidden, blocked, suspended, expired, and close-friend viewers.

#### Cross-cutting runtime exit for Phase 5
- [ ] Verify story migrations/TTL, cleanup worker startup, exact expiry, notification routing, and runtime evidence.

## Phase 6 — Stitch and Duet Media

- [x] Implement stitch and duet creation with remix rights validation
- [x] Implement derivative processing and publication
- [x] Add MongoDB collections for derivative metadata
- [x] Add integration tests for stitch/duet flows

Phase 6 note: media assets expose remix permission and source/destination derivative relationships. Stitch and duet creation validates READY assets, both remix permissions, actor ownership of at least one asset, timeline/split-layout assembly shape, duplicate relationship protection, and outbox-backed `media.derivative.created` mutation events. Derivative records preserve immutable source/destination/creator attribution, support created/processing/ready/rejected/takedown lifecycle transitions, propagate source takedowns to dependent relationships, and emit derivative status/takedown events. Unit coverage includes allowed stitch/duet creation, blocked/unready/invalid derivatives, attribution propagation, lifecycle transitions, and source takedown propagation.

#### FR-MEDIA-07 / FR-MEDIA-08 — Stitch and duet authorization
- [ ] Add derivative source/destination/owner/attribution/status migrations.
- [ ] Expose stitch/duet create/status routes and validate READY assets, remix rights, ownership, and duplicates.
- [ ] Test timeline/split assembly, attribution, blocked sources, takedowns, and rejected derivatives.

#### FR-MEDIA-09 — Derivative processing publication
- [ ] Implement derivative processing, transcript/thumbnail/policy, and READY publication contracts.
- [ ] Emit derivative created/status/takedown events transactionally through outbox/RabbitMQ.
- [ ] Verify source attribution, destination processing, takedown propagation, and runtime derivative evidence.

#### Cross-cutting runtime exit for Phase 6
- [ ] Attach derivative migrations, API routes, worker callback/status, outbox, RabbitMQ, and duplicate/takedown evidence.

## Phase 7 — Stripe and Entitlements

- [x] Implement Java Spring billing/entitlement service
- [x] Implement platform tier catalog
- [x] Implement Stripe Checkout for tiers
- [x] Implement Stripe webhook signature verification and deduplication
- [x] Implement entitlement grants/revokes and audit events
- [x] Implement trial expiry worker
- [x] Implement billing API and unit/integration tests
- [x] Add Stripe local CLI flow

Phase 7 note: the Spring entitlement service foundation includes typed entitlement keys/sources, grant/revoke orchestration, event-ID dedupe, versioned active tier catalog, effective-entitlement lookup, memory/JDBC repository adapters, transactional audit/outbox SQL foundations, retryable Stripe event lifecycle processing, HMAC-SHA256 signature verification, platform-tier Checkout domain/HTTP/local-adapter flow, signed HTTP webhook payload parsing/mapping, trial-expiry scheduling, billing lifecycle unit coverage, and local Stripe CLI forwarding configuration. Real Stripe SDK session transport, persistent JDBC Stripe event ledger integration, retry/DLQ worker wiring, and K3s deployment evidence remain pending until runtime infrastructure is available.

#### FR-BILL-01 — Entitlement keys and sources
- [ ] Add entitlement-key, source, source-reference, audit, and outbox migrations.
- [ ] Implement trial, platform subscription, creator subscription, and admin-grant source adapters.
- [ ] Test effective-entitlement resolution and source precedence.

#### FR-BILL-02 / FR-BILL-03 — Trial activation and expiry
- [ ] Add exactly-once trial activation migration and verified-account activation guard.
- [ ] Implement 7×24-hour expiry scheduling and entitlement removal.
- [ ] Retain core social capabilities after trial expiry and append an audit event.
- [ ] Test first activation, recreation, support retry, expiry, and reactivation attempts.

#### FR-BILL-04 — Versioned platform tiers
- [ ] Add tier catalog and entitlement-bundle migrations/JPA mappings.
- [ ] Implement tier version lookup and bundle precedence.
- [ ] Test upgrade, downgrade, expired tier, and bundle overlap behavior.

#### FR-BILL-05 — Stripe Checkout
- [ ] Add server-created platform-tier Checkout session and return/cancel routes.
- [ ] Integrate the Stripe SDK through an adapter and fail-fast secret validation.
- [ ] Reject browser-reported payment/tier state and test success/cancel/return flows.

#### FR-BILL-06 / FR-BILL-07 — Webhook authority and idempotency
- [ ] Add signed webhook, event-ID dedupe, replay, retry, and failure migrations.
- [ ] Verify signatures before entitlement mutation and process events independently/retryably.
- [ ] Transactionally write entitlement/audit state and the domain outbox record.
- [ ] Test duplicate, replay, out-of-order, malformed, and retryable webhook events.

#### FR-BILL-08 — Refunds and disputes
- [ ] Map refund, dispute, chargeback, renewal, cancellation, and invoice states to entitlement policy.
- [ ] Implement period-end or immediate suspension according to durable Stripe state.
- [ ] Test reconciliation, retry, duplicate-event, and audit behavior.

#### FR-BILL-09 — Server-authoritative paid actions
- [ ] Add effective-entitlement authorization guards to every paid route.
- [ ] Expose entitlement audit lookup but never accept browser tier claims.
- [ ] Test denied, active, trial, expired, revoked, and suspended outcomes.

#### Cross-cutting runtime exit for Phase 7
- [ ] Add Spring datasource/startup/health/controller/scheduler configuration.
- [ ] Publish `entitlement.granted` and `entitlement.revoked` through outbox/RabbitMQ.
- [ ] Attach Java/Maven, PostgreSQL, Spring, Stripe CLI, webhook, scheduler, and RabbitMQ evidence.

## Phase 8 — Creator Subscriptions

- [x] Implement creator tier CRUD
- [x] Implement Stripe Connect account setup and payout adapter
- [x] Implement creator subscription checkout
- [x] Implement tier-specific featured content
- [x] Implement subscription access checks
- [x] Implement subscriber management and cancellation
- [x] Test refunds/disputes/renewals

Phase 8 note: creator-tier CRUD, Connect onboarding/payout status foundation, creator subscription checkout/lifecycle, tier access checks, renewal/past-due/refund/cancellation handling, and unit coverage are implemented. Featured creator content can be guarded by an active, unexpired creator-tier subscription; real Stripe Connect/SDK transport, provider payout webhooks, subscriber administration UI, and external Stripe integration evidence remain pending.

#### FR-CREATE-01 — Creator tier configuration
- [ ] Add creator-tier, benefit, limit, period, and status migrations.
- [ ] Expose create/read/update/archive/restore tier routes.
- [ ] Validate name, price, interval, description, benefits, currency, and subscriber limits.

#### FR-CREATE-02 — Stripe Connect payouts
- [ ] Add payout-account/status migrations and Connect onboarding state.
- [ ] Implement account-link, account-status, payout, and webhook adapters.
- [ ] Gate paid tier creation and payouts on MFA and payout readiness.

#### FR-CREATE-03 — Featured creator content
- [ ] Add public/subscriber/tier-specific featured-content visibility fields.
- [ ] Expose featured-post/media collection create/read/update/delete routes.
- [ ] Test public, active, wrong-tier, expired, canceled, and blocked access.

#### FR-CREATE-04 / FR-CREATE-05 — Subscription lifecycle
- [ ] Add subscription, period, cancellation, refund, and dispute migrations.
- [ ] Implement signed Checkout, renewal, period-end, past-due, refund, and dispute flows.
- [ ] Derive access only from durable Stripe-confirmed state.

#### FR-CREATE-06 — Supporter features
- [ ] Implement supporter-only thread and chat visibility contracts.
- [ ] Enforce membership changes across featured content and communication services.
- [ ] Test active, expired, refunded, canceled, and creator-blocked subscribers.

#### FR-CREATE-07 — Trial preview versus paid confirmation
- [ ] Permit trial-account preview and subscription-management navigation.
- [ ] Require completed Checkout and durable provider confirmation for paid access.
- [ ] Test expired-trial, canceled-checkout, duplicate-checkout, and confirmed outcomes.

#### Cross-cutting runtime exit for Phase 8
- [ ] Transactionally publish subscription and entitlement events through outbox/RabbitMQ.
- [ ] Attach PostgreSQL, Stripe SDK/CLI, Connect, webhook, entitlement, and subscription evidence.

## Phase 9 — Marketing and Ads

- [x] Implement campaign model and policy states
- [x] Implement entitlement gate and paid-feature trial gate
- [x] Implement campaign budget and placement validation
- [x] Implement aggregate metrics and reporting
- [x] Implement clearly labeled sponsor placement metadata
- [x] Prohibit sensitive and PII targeting
- [x] Add campaign tests

Phase 9 note: campaign contracts, draft/review/approval/status lifecycle, paid/trial entitlement gates, budget/schedule/HTTPS placement validation, aggregate metrics contracts, clearly labeled sponsored placement metadata, and sensitive/PII targeting prohibition are implemented. External ad billing, real aggregate ingestion/reporting persistence, and moderation-review operator workflow remain pending.

#### FR-MKT-01 — Entitlement gate
- [ ] Require paid/trial entitlement and verified identity on campaign create/submit/report routes.
- [ ] Reject free, expired, revoked, suspended-account outcomes.
- [ ] Never trust browser-reported entitlement state.

#### FR-MKT-02 — Campaign configuration
- [ ] Add objective, placement, category, budget, schedule, creative, and destination migrations.
- [ ] Expose create/read/update/archive/submit/pause/cancel routes.
- [ ] Validate budget, currency, time range, HTTPS destination, creative, placement, and category.

#### FR-MKT-03 — Authorization and campaign review
- [ ] Require payment authorization, ad-policy review, identity verification, and location validation.
- [ ] Implement draft/submit/review/approved/rejected/paused/canceled state transitions.
- [ ] Test invalid identity, payment, destination, creative, and transition behavior.

#### FR-MKT-04 — Sponsored disclosure
- [ ] Add immutable placement/disclosure metadata.
- [ ] Render clearly labeled sponsored placement in web/mobile payload consumers.
- [ ] Test disclosure presence and absence of inferred-personalization fields.

#### FR-MKT-05 — Aggregate reporting
- [ ] Add aggregate impression/click/spend/region metrics migrations or collections.
- [ ] Implement least-data metric ingestion and campaign reporting.
- [ ] Reject individual-person sales and PII-bearing ad metrics.

#### FR-MKT-06 — Pause, cancellation, and refunds
- [ ] Implement pause/resume/cancel and delivered-versus-undelivered spend calculation.
- [ ] Integrate durable payment/refund state into refundable estimates.
- [ ] Test cancellation before start, during delivery, after delivery, and provider retries.

#### FR-MKT-07 / FR-MKT-08 — Privacy and targeting restrictions
- [ ] Reject sensitive-interest, behavioral-profile, personal-demographic, and PII targeting.
- [ ] Permit country/region, explicit category, and explicit following/creator affinity only.
- [ ] Add prohibited-targeting audit events and privacy tests.

#### Cross-cutting runtime exit for Phase 9
- [ ] Implement real payment, aggregate-ingestion, audit, and moderation-review adapters.
- [ ] Transactionally emit campaign events through outbox/RabbitMQ.
- [ ] Attach billing, reporting, moderation, UI, and privacy runtime evidence.

## Phase 10 — Live Streaming

- [x] Implement live-stream scheduling/start/end lifecycle foundation
- [x] Implement short-lived publishing credential contracts
- [x] Implement entitlement and audience visibility gates
- [x] Implement live lifecycle unit coverage
- [ ] Deploy and isolate LiveKit
- [ ] Implement real LiveKit provider SDK room transport
- [ ] Implement durable chat/moderation persistence

Phase 10 note: live-stream scheduling, lifecycle transitions, paid entitlement gates, public/follower/subscriber visibility, chat lifecycle, and opt-in recording contracts are implemented. Real LiveKit/K3s deployment, provider SDK transport, chat persistence, and runtime evidence remain pending.

#### FR-LIVE-01 — Live entitlement gate
- [ ] Require paid trial/tier entitlement and verified identity before schedule/start routes.
- [ ] Reject free, expired, revoked, suspended, and unverified creators.
- [ ] Test browser-reported entitlement claims cannot bypass server enforcement.

#### FR-LIVE-02 — Stream lifecycle
- [ ] Add schedule, start, pause, end, room, and recording migrations.
- [ ] Expose schedule/start/pause/end/moderation routes with owner authorization.
- [ ] Test invalid transitions, duplicate starts, stale end, and account suspension.

#### FR-LIVE-03 — Audience visibility
- [ ] Implement public/follower/subscriber room authorization.
- [ ] Enforce entitlement and blocking changes while a room is active.
- [ ] Test public, follower, subscriber, blocked, canceled, expired, and suspended viewers.

#### FR-LIVE-04 — Live chat and moderation
- [ ] Add durable chat, blocked-word, slow-mode, removal, and moderation migrations.
- [ ] Implement bounded chat event/replay and idempotent moderation subscribers.
- [ ] Test blocked words, host removal, rate limits, replay, and late delivery.

#### FR-LIVE-05 — Short-lived credentials
- [ ] Issue LiveKit publish/viewer credentials bound to stream, actor, role, entitlement, and end state.
- [ ] Test credential expiry, unauthorized joins, end-time revocation, and replay.

#### FR-LIVE-06 — Recording and VOD
- [ ] Add opt-in recording, object-key, retention, and VOD visibility migrations.
- [ ] Inherit original stream visibility unless an explicit creator override is recorded.
- [ ] Test takedown, expiry, owner deletion, private recording, and archive access.

#### FR-LIVE-07 — Privacy-preserving metrics
- [ ] Collect asynchronous aggregate stream health/viewer metrics only.
- [ ] Reject viewer-level PII exports and test duplicate/failed ingestion.

#### Cross-cutting runtime exit for Phase 10
- [ ] Deploy LiveKit namespace/service/ingress/secrets and verify provider SDK transport.
- [ ] Attach room, credential, chat, recording, entitlement, and failover runtime evidence.

## Phase 11 — Notifications and Moderation

- [x] Implement notification preference model
- [x] Implement RabbitMQ notification routing foundation
- [x] Implement transactional email template routing
- [x] Implement report/case lifecycle foundation
- [x] Implement fake/bot escalation and append-only audit foundations
- [ ] Verify RabbitMQ runtime/DLQ infrastructure
- [ ] Deploy the production moderation operator UI

Phase 11 note: preference, email-template, report/case, escalation, appeal/audit, and subscriber lifecycle foundations exist. Running broker/DLQ verification and production operator UI remain pending.

#### FR-NOTIF-01 / FR-NOTIF-02 — Notification channels and preferences
- [ ] Add preference, subscription, delivery-log, and push-token migrations.
- [ ] Implement in-app, push, and email routing with category/channel opt-outs.
- [ ] Test preference enforcement before publication and at delivery time.

#### FR-NOTIF-03 / FR-NOTIF-05 — Delivery retries and policy
- [ ] Configure bounded backoff, retry, DLQ, dedupe, and lifecycle idempotency.
- [ ] Add consumed-event storage and recheck policy during delivery.
- [ ] Attach RabbitMQ retry/DLQ and duplicate delivery evidence.

#### FR-NOTIF-04 / FR-NOTIF-06 — Transactional email templates
- [ ] Add template registry and structured parameter contracts for every required email type.
- [ ] Route domain-event subscribers through the shared email service contract.
- [ ] Test template parameters, blocked channels, delivery failure, and replay.

#### FR-TRUST-01 / FR-TRUST-02 — Reports
- [ ] Add report, evidence, duplicate-aggregation, and case migrations.
- [ ] Validate category/description/evidence and target authorization.
- [ ] Test duplicate reports, hidden targets, invalid targets, and append-only audit.

#### FR-TRUST-03 / FR-TRUST-04 / FR-TRUST-05 — Case lifecycle and authorization
- [ ] Implement Open/Triaged/Escalated/Resolved/Appealed states and moderator MFA/RBAC.
- [ ] Expose moderator queue and resolution routes.
- [ ] Test unauthorized resolution, invalid transitions, and append-only actor/reason/target events.

#### FR-TRUST-06 / FR-TRUST-07 / FR-TRUST-08 — Appeals and restrictions
- [ ] Implement appeal pause/restoration policy and independent restrictions.
- [ ] Keep moderation queue operator-focused and prohibit user-personalized ordering.
- [ ] Test appeal, restoration, repeated enforcement, and cross-feature restrictions.

#### Cross-cutting runtime exit for Phase 11
- [ ] Verify RabbitMQ exchanges/queues/retry/DLQ, SMTP/Mailpit, preference, moderation, dashboard, and worker evidence.

## Phase 12 — Frontend MVP

- [x] Build Next.js route shells and typed API contracts
- [x] Add Next 16.4.6 dependencies and strict TypeScript/build foundation
- [ ] Bind real authenticated API operations to route screens
- [ ] Implement real auth/session, live room, account export/delete, and E2E flows

Phase 12 note: route shells, typed contracts, accessibility structure, and a successful production build exist. Real API bindings, live provider UI, account lifecycle confirmations, browser automation, and runtime smoke remain pending.

#### FR-FE-01 — Web application routes
- [ ] Bind auth, verification, profile, feed, compose, media, story, subscription, campaign, live, moderation, and settings routes to real API clients.
- [ ] Add loading/error/empty/auth guards and correlation-ID propagation.
- [ ] Test routes against a runnable API entrypoint.

#### FR-FE-02 — Responsive content layout
- [ ] Implement responsive short-video, thread, photo, and live layouts.
- [ ] Test mobile/tablet/desktop breakpoints and content priority.

#### FR-FE-03 / FR-FE-04 — Entitlements and sponsored disclosure
- [ ] Render server-authoritative entitlement/paywall state and sponsored/disclosure markers.
- [ ] Bind Stripe return/cancel and entitlement refresh flows.
- [ ] Test denied/expired/active/trial paid actions and feed-source explanations.

#### FR-FE-05 — Accessibility
- [ ] Implement semantic labels, keyboard/focus, reduced motion, media alternatives, contrast, and WCAG 2.2 AA targets.
- [ ] Add automated accessibility checks and browser evidence.

#### FR-FE-06 — Upload progress
- [ ] Implement resumable progress, retry, cancel, processing, thumbnail, caption, and alt-text UX.
- [ ] Test interrupted upload, duplicate completion, processing failure, and READY publication.

#### FR-FE-07 — No engagement optimization
- [ ] Remove speculative ranking/recommendation UI and expose only permitted feed sources.
- [ ] Test chronological/following/topic/sponsored source labels.

#### FR-FE-08 — Data export and deletion
- [ ] Implement export/request and irreversible-delete confirmation flows.
- [ ] Bind confirmations to server lifecycle states and audit outcomes.
- [ ] Test cancellation, confirmation, suspension, and completed-deletion behavior.

#### Cross-cutting runtime exit for Phase 12
- [ ] Run Next.js strict typecheck/build/start, Playwright/Cypress E2E, accessibility, and API smoke evidence.

## Phase 13 — Startup, DevOps, IaC, Secrets, and Production Hardening

- [ ] Add runnable NestJS, Spring, worker, web, and migration entrypoints with dependency health waits and graceful shutdown.
- [ ] Add forward-only migration preflight jobs that block incompatible schema rollout.
- [ ] Add Terraform or equivalent IaC for DNS, namespaces, PVC claims, service accounts, network policies, ingress, and secret references.
- [ ] Add Helm/plain-manifest releases for API, Spring, web, workers, databases, broker, cache, storage, LiveKit, observability, and secrets.
- [ ] Add environment overlays for local/dev/production with no duplicate credentials.
- [ ] Add Infisical/Kubernetes secret references and startup fail-fast secret validation.
- [ ] Add immutable image build/digest, image signing, SBOM, SAST/secret/SCA/container/IaC/license gates.
- [ ] Add namespace RBAC, workload service accounts, network policies, non-root limits, and read-only runtime controls.
- [ ] Add liveness/readiness/startup probes, resources, PDB, rolling update, and rollout wait/rollback.
- [ ] Add PostgreSQL/MongoDB/object-storage backup, restore, integrity, lifecycle, orphan cleanup, and retention procedures.
- [ ] Add outbox replay, RabbitMQ DLQ replay, Redis recovery, and migration rollback runbooks.
- [ ] Add Prometheus/Grafana/OpenObserve metrics, dashboards, alerts, structured logs, traces, PII redaction, and correlation IDs.
- [ ] Add load/failure tests for API, media, stories, notifications, outbox, live, and data recovery.
- [ ] Add protected GitLab deployment smoke, public-route smoke, Stripe smoke, broker/worker smoke, and mobile build hooks.

#### Cross-cutting runtime exit for Phase 13
- [ ] Verify API, Spring, workers, web, databases, broker, cache, storage, LiveKit, and observability start locally and on k3s.
- [ ] Attach migration, health, secret, deployment, security scan, backup/restore, rollback, smoke, and recovery evidence.
- [ ] Add commit SHA, environment, date, commands, logs, and artifact links to `CHANGELOG.md`.

## Phase 14 — Expo and NativeWind Mobile App

- [ ] Scaffold Expo TypeScript workspace in `apps/mobile` with Expo Router.
- [ ] Configure EAS, app identifiers, schemes, deep links, Android/iOS variants, icons, splash, status bar, and safe areas.
- [ ] Configure NativeWind design tokens and accessibility defaults.
- [ ] Implement typed API client, secure session storage, refresh rotation, logout, and route guards.
- [ ] Implement authentication, verification, profile/social, feed, compose, media, stories, subscriptions, campaigns, live, notifications, moderation, export, and deletion flows.
- [ ] Implement offline-safe cache and noncritical action queue only; never queue entitlement/billing decisions.
- [ ] Add Android/iOS unit/component/E2E/accessibility/build evidence.

#### Cross-cutting runtime exit for Phase 14
- [ ] Attach strict TypeScript, lint, Expo prebuild, Android/iOS build, API contract, auth, media, billing, live, push, deep-link, offline, and E2E evidence.

## Runtime Completion Gate

No implementation checkbox is runtime-complete until source, migrations, runnable entrypoints, real dependency startup, HTTP/API, event/outbox, security, operations, frontend/mobile, and attached evidence all exist. Unit/build success alone is not runtime verification.

## Final Definition of Done

No phase is complete until code, migrations, typed contracts, runnable entrypoints, tests, RBAC, resource limits, docs, and deployment evidence exist. Every AI session must implement only the current approved phase and append verification evidence to `CHANGELOG.md`.

Cross-phase type gate:

- TypeScript and Python deltas must satisfy strict typing rules from NFR-22.
- Java phases require successful Maven/test/type evidence when a Java runtime is available.
- Expo mobile phases require Android/iOS build evidence and no unresolved runtime dependencies.
