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
