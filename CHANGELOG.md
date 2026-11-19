# HotSpot Changelog

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
3. Add first `apps/api-nest` scaffold and health endpoint.
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
2. Add first runnable `apps/api-nest` scaffold with `/health` endpoint and request validation.
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

1. Implement registration and email-verification flow in `apps/api-nest`.
2. Add JWT access/refresh token issue/rotation and session revocation path.
3. Add auth unit tests for service-layer behavior.

## 2026-11-19 — Phase 1 auth scaffolding continued

### Completed

- Added shared auth utilities in `packages/auth/src`:
	- password hashing and verification helpers (`scrypt`)
	- signed email-verification token create/verify helpers
- Added initial API service-layer auth scaffolding:
	- `apps/api-nest/src/service/auth/auth.service.ts`
	- `apps/api-nest/src/handlers/auth/auth.handler.ts`
- Added first unit test for registration normalization and verification-token creation:
	- `apps/api-nest/src/service/auth/auth.service.test.ts`

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
