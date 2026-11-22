# CLAUDE.md

## Project Summary

HotSpot is an intentionally authentic, identity-verified social media platform that combines text threads, photo/video media, stories, stitches/duets, creator subscriptions, marketing, and live streams. The stack uses Next.js, NestJS, Java 21/Spring, Python workers, PostgreSQL, MongoDB, Redis, RabbitMQ, object storage, and LiveKit. It runs on the existing rmwhs.com k3s home cluster; `PROJECT.md` is the full specification and source of truth.

AI security context is anchored by `.github/skills/devsecops/SKILL.md` and must be applied during code, CI, and infrastructure changes.

## Quick Start

```bash
cd /home/ryanwaite28/Developer/ai/HotSpot
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Use Stripe CLI for local webhook testing:

```bash
npm run stripe:listen
```

## Architecture Rules

- ALL business logic lives in service modules. API/worker transport handlers only parse input, call a service, and map output.
- PostgreSQL access is limited to typed repository/query modules.
- MongoDB access is limited to media/chat repository implementations.
- Redis access is limited to cache/presence repository adapters.
- Worker applications must not open direct PostgreSQL/MongoDB/Redis connections; workers call service APIs/contracts only.
- RabbitMQ publishing and consumption is explicit, durable, typed, retryable, and routed through the event contracts.
- Use `rxjs-rabbitmq` for Node.js workers and consumers.
- Every paid feature is enforced by server-side entitlements; never trust browser or API-reported subscription state.
- Stripe entitlements are created only after signature verification and durable webhook deduplication.
- No ML ranking, engagement prediction, personal-data sales, fake accounts, or unrestricted public posting.

## Key Commands

- `npm run build` — build application packages and services
- `npm run test` — run unit tests
- `npm run test:integration` — run integration tests
- `npm run test:e2e` — run HTTP/browser journeys
- `npm run db:migrate` — apply pending migrations
- `npm run db:seed` — seed deterministic local data
- `npm run dev` — start local development
- `npm run deploy:dev` — deploy to `hotspot-dev`
- `npm run deploy:prod` — deploy to `hotspot`
- `npm run stripe:listen` — forward Stripe webhooks locally

## File Conventions

- Service layer: `src/service/{domain}.service.ts`
- PostgreSQL repositories: `src/db/queries/{domain}.queries.ts`
- MongoDB repositories: `src/db/mongo/{collection}.repository.ts`
- HTTP/BFF gateway: `gateway/nest-http/src/handlers/{domain}/{domain}.handler.ts`
- Gateway typed clients: `gateway/nest-http/src/clients/{domain}/{domain}.service-client.ts`
- Social Nest domain service: `services/social-nest/src/{service,db,handlers}/`
- Spring domains: `services/entitlement-spring/src/main/java/.../{domain}/`
- Python workers: `services/{worker-name}/app/`
- RabbitMQ Node workers: `workers/{domain-node}/src/`
- Email templates: `src/emails/templates/{name}.hbs`
- Tests: `{file}.test.ts`, `{file}.test.py`, or `{file}Test.java`
- Kubernetes manifests: `k8s/{namespace,rbac,deployments,services,ingress}/`

## Environment Notes

- Local: Docker Compose provides PostgreSQL, MongoDB, Redis, RabbitMQ, MinIO, Mailpit, and test services. Stripe uses test mode and the CLI.
- Dev: k3s namespace `hotspot-dev`; public hosts use `rmwhs-dev.space` single-label subdomains only (no deep subdomains).
- Production: k3s namespace `hotspot`; public web `hotspot.rmwhs.com`; public API `api.hotspot.rmwhs.com`.
- Existing cluster services: GitLab, Infisical, RabbitMQ, Prometheus, Grafana, OpenObserve, Mailpit, and the `nginx-external` ingress controller.
- Runtime values come from Kubernetes Secrets or Infisical references. Never copy secret values into files or logs.
- HotSpot is a single-node/limited-resource workload. Keep replicas at one unless a phase has demonstrated the need for more.

## K3s Deployment Rules

- Ingress class: `nginx-external`
- Ingress hosts: production uses subdomains of `rmwhs.com`; dev uses `rmwhs-dev.space`/`*.rmwhs-dev.space` with single-label subdomains only; never bind either apex domain
- Plain HTTP origin: `ssl-redirect: "false"`; Cloudflare terminates public TLS
- Storage: `local-path`, ReadWriteOnce only
- CI: GitLab plus kaniko/buildah
- Images: immutable `$CI_COMMIT_SHORT_SHA` tags, never `:latest`
- Every container: CPU/memory requests and limits plus readiness/liveness probes
- No privileged containers, Docker-in-Docker, cluster-admin deploy credentials, or shared application secrets

## Session Workflow

- Implement one checked phase from `PROJECT.md` at a time.
- Before coding, identify the phase, requirements, and affected files.
- Update `CHANGELOG.md` after the session with:
  - completed work
  - verification evidence
  - unresolved items
  - exact next phase and resume point
- Do not skip directly from foundation to later features.
- Never edit `PROJECT.md` silently; spec changes require an explicit update and rationale.

## DO NOT

- Do not add domain logic to API handlers or RabbitMQ consumers.
- Do not access PostgreSQL, MongoDB, or Redis outside repository/adaptor modules.
- Do not open database client connections inside worker runtimes; route worker writes/reads through service APIs.
- Do not hardcode secrets, Stripe keys, provider keys, JWT keys, connection strings, or cluster credentials.
- Do not add an ML/AI ranking or recommendation algorithm.
- Do not sell personal data or create advertising based on inferred sensitive traits.
- Do not allow fake/bot accounts to obtain public posting privileges.
- Do not store raw identity documents in HotSpot databases or object storage.
- Do not grant billing entitlements from browser state or unsigned Stripe data.
- Do not expose payment, moderation, identity, or verification data in logs.
- Do not edit migrations after they have been applied; create a new migration.
- Do not use `any` in TypeScript or unsafe dynamic dispatch for core domain contracts.
- Do not create new architectural patterns not documented in `PROJECT.md`.
- Do not deploy `:latest` production images or omit resource limits.
