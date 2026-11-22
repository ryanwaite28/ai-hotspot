# Kubernetes + GitLab Deployment Guide

This is the canonical reference for deploying any application onto this k3s
cluster. It exists so that every project — regardless of language or
framework — ships to production the same predictable way, using the same
CI/CD system, the same ingress conventions, and the same secrets model.

If you are setting up deployment for a new app, read this document fully
before writing your `.gitlab-ci.yml` or Kubernetes manifests.

---

## 1. Cluster Overview

| | |
|---|---|
| Distro | k3s (single control-plane node, `elitedesk-800`) |
| Capacity | 4 vCPU / ~24 GiB RAM — **this is the entire cluster**, not per-node |
| Ingress controller | standalone `ingress-nginx`, class name **`nginx-external`** (default) |
| Storage class | `local-path` (Rancher local-path-provisioner, default, `WaitForFirstConsumer`, **ReadWriteOnce only**) |
| DNS / domain | `rmwhs.com`, proxied through Cloudflare |
| TLS termination | at Cloudflare edge — origin ingress serves **plain HTTP**, not HTTPS (`ssl-redirect: "false"`) |
| CI/CD | self-hosted GitLab CE at `https://gitlab.rmwhs.com/` |
| Runners | GitLab Runner (Helm chart, `kubernetes` executor) in the `gitlab-runner` namespace, deployed via [helm/gitlab-runner-values.helm.yaml](k8s-infrastructure/helm/gitlab-runner-values.helm.yaml) |
| Cluster admin UI | Headlamp at `https://headlamp.rmwhs.com/`, OIDC via GitLab |

Because this is a **single node with fixed, small capacity**, every
requirement and best practice below exists to keep the cluster stable under
that ceiling, not because of arbitrary policy.

---

## 2. Hard Requirements

These are non-negotiable. A deployment that violates any of these should be
treated as broken, not "good enough."

### 2.1 Ingress must use a subdomain — never the apex domain
- Every app is reachable at `<app>.rmwhs.com`.
- **No app may bind to the apex `rmwhs.com` domain.** The apex is reserved.
- Pick a short, unambiguous subdomain that matches the project name (e.g.
  `inventory-api.rmwhs.com`, not `api.rmwhs.com` — the latter doesn't scale
  once a second API shows up).
- `ingressClassName` must always be `nginx-external`. There is no other
  ingress controller on this cluster.
- Ingress serves plain HTTP (`nginx.ingress.kubernetes.io/ssl-redirect:
  "false"`) — TLS is handled by Cloudflare in front, not by the ingress
  itself. Don't add cert-manager annotations; there is no cert-manager
  installed on this cluster currently.

### 2.2 CI/CD is GitLab, exclusively
- Every deployable project lives in this GitLab instance and ships a
  `.gitlab-ci.yml` at its root. No other CI system (GitHub Actions, Jenkins,
  etc.) is used to build or deploy to this cluster.
- Pipelines run on the shared k3s-backed runner (tags: `default`,
  `generic`) registered in the `gitlab-runner` namespace.

### 2.3 Every app produces a Docker image pushed to the GitLab Container Registry
- Every deployable project must have a `Dockerfile` and a CI stage that
  builds an image and pushes it to that project's GitLab Container
  Registry path (`$CI_REGISTRY_IMAGE`).
- Deployments pull that image by tag/digest — never `:latest` in a
  production Deployment manifest. Tag images with `$CI_COMMIT_SHORT_SHA` (or
  a semver tag on release) so rollbacks are just "redeploy the previous
  tag."
- Container Registry is enabled instance-wide at `registry.rmwhs.com`
  (see [manifest/gitlab-omni-ce.yaml](k8s-infrastructure/manifest/gitlab-omni-ce.yaml)).
  `$CI_REGISTRY_IMAGE` should now be populated in job environments.

### 2.4 Namespace per app
- Each app gets its own Kubernetes namespace, named after the app
  (`kubectl create namespace <app>`). Don't deploy multiple unrelated apps
  into `default` or into each other's namespaces.

### 2.5 Every container declares resource requests and limits
- No container may run without explicit `resources.requests` and
  `resources.limits` for both `cpu` and `memory`. On a 4-core/24GiB
  single-node cluster, one unbounded pod can starve everything else,
  including GitLab itself.
- Start conservative (e.g. `100m`/`128Mi` requests) and raise only if you
  observe throttling/OOM for that specific workload.

### 2.6 No privileged containers
- `privileged: true` / Docker-in-Docker is not permitted for image builds.
  Use **kaniko** or **buildah** to build images inside CI instead. If a
  workload genuinely needs elevated privileges, that's an exception to
  discuss explicitly, not a default.

### 2.7 Secrets are never committed to a repo or hardcoded in a manifest
- No credentials, tokens, or connection strings in `Dockerfile`,
  `.gitlab-ci.yml`, or any committed YAML — see [Section 5](#5-secrets-management)
  for where they actually go.

---

## 3. Best Practices

### 3.1 Be resource-efficient by default
- Prefer `replicas: 1` unless you have a concrete reason for more — this
  cluster has one node, so extra replicas don't buy you failover, only
  more resource pressure.
- Prefer small base images (`alpine`, `distroless`, slim variants) to keep
  image pulls and disk usage down on `local-path` storage.
- Set `readinessProbe`/`livenessProbe` on anything long-running so a stuck
  pod doesn't silently eat capacity while reporting nothing.

### 3.2 Keep `.gitlab-ci.yml` declarative — push logic into scripts
- Don't write long multi-line shell logic directly inline in `script:`
  blocks. Put it in a tracked, executable script and call that:

  ```
  myproject/
    ci/
      build.sh
      deploy.sh
    .gitlab-ci.yml
  ```

  ```yaml
  build:
    stage: build
    script:
      - ./ci/build.sh
  ```

  This keeps the pipeline readable, lets you lint/shellcheck the scripts,
  and lets you run the exact same script locally to reproduce a failing
  build instead of guessing from CI output.

### 3.3 Deployment secrets are configured in GitLab *before* the pipeline needs them
- Registry credentials, deploy tokens, kubeconfig/service-account tokens,
  third-party API keys — all set up as **GitLab CI/CD variables**
  (Project/Group → Settings → CI/CD → Variables) ahead of time, marked
  **Protected** and **Masked**. A pipeline should never be the first place
  a secret value is typed in.

### 3.4 Runtime environment variables: GitLab CI/CD variables vs. Kubernetes Secrets
Two different jobs — use the right one:

| Use **GitLab CI/CD variables** for... | Use **Kubernetes Secrets** (etcd) for... |
|---|---|
| Values only the *pipeline* needs (registry auth, deploy-token, kubeconfig) | Values the *running pod* needs at container start |
| Build-time secrets baked via `--build-arg` | DB passwords, API keys the app reads from env at runtime |
| Values that differ per pipeline run | Values that persist independent of any given CI run |

In practice: CI reads a GitLab CI/CD variable and uses it to **create or
update a Kubernetes Secret** in the target namespace as a deploy step (or
that Secret is pre-created once by hand and just referenced by the
Deployment via `envFrom`/`secretKeyRef` — see the `headlamp-oidc` Secret in
the `headlamp` namespace for a working example of this pattern). The app's
Deployment manifest never contains a literal secret value — only a
`secretKeyRef`.

### 3.5 CI deploy steps use a scoped Service Account, not cluster-admin
- Don't reuse the GitLab Runner's own service account/kubeconfig for
  `kubectl apply`/`helm upgrade` deploy steps — the runner's RBAC is scoped
  narrowly to spawning job pods in the `gitlab-runner` namespace and
  shouldn't be widened.
- Each app's namespace should have its own least-privilege
  ServiceAccount + Role/RoleBinding (create/update Deployments, Services,
  Ingresses, ConfigMaps, Secrets — scoped to that one namespace only). Mint
  a token for that ServiceAccount, store it as a masked/protected GitLab
  CI/CD variable, and have the deploy script do:
  ```bash
  kubectl config set-cluster k3s --server="$K8S_API_SERVER" --insecure-skip-tls-verify=true
  kubectl config set-credentials ci --token="$DEPLOY_SA_TOKEN"
  kubectl config set-context ci --cluster=k3s --user=ci --namespace="$APP_NAMESPACE"
  kubectl config use-context ci
  ```

### 3.6 Storage caveats
- `local-path` is `ReadWriteOnce` and `WaitForFirstConsumer` only — no
  shared/multi-pod volumes, and a PVC binds to whatever node the first pod
  lands on (fine here since there's only one node, but don't assume this
  generalizes if the cluster ever grows).
- Don't request persistent storage for anything that can be stateless.
  Reach for a PVC only when the app genuinely needs to persist data across
  restarts.

---

## 4. Standard Project Layout

Every deployable app repo should look roughly like this:

```
myapp/
  Dockerfile
  .gitlab-ci.yml
  ci/
    build.sh
    deploy.sh
  k8s/
    namespace.yaml
    deployment.yaml
    service.yaml
    ingress.yaml
    (serviceaccount.yaml + role.yaml + rolebinding.yaml, if not pre-provisioned)
```

Plain manifests (not a Helm chart) are the default for application
workloads — reach for Helm only if the app genuinely needs
templating/parameterization across environments. Infrastructure components
(GitLab itself, the runner, Headlamp) use Helm; that doesn't mean your app
needs to.

---

## 5. Secrets Management

Two systems, two purposes — don't blur them:

1. **GitLab CI/CD Variables** — scoped to a project or group, used by the
   *pipeline*. Set them under Settings → CI/CD → Variables, mark
   Protected (only exposed on protected branches/tags) and Masked (hidden
   in job logs) by default.
2. **Kubernetes Secrets** — live in etcd, scoped to a namespace, used by
   the *running pod*. Create once with `kubectl create secret generic
   <name> -n <namespace> --from-literal=key=value`, then reference from the
   Deployment:
   ```yaml
   env:
     - name: DATABASE_PASSWORD
       valueFrom:
         secretKeyRef:
           name: myapp-secrets
           key: databasePassword
   ```

Rule of thumb: if a human or a CI job needs the value to talk to GitLab/the
cluster, it's a GitLab CI/CD variable. If the *application process* needs
the value once it's running, it's a Kubernetes Secret.

---

## 6. Standard Pipeline Shape

A typical `.gitlab-ci.yml` for an app on this cluster:

```yaml
stages:
  - build
  - deploy

build-image:
  stage: build
  image: gcr.io/kaniko-project/executor:debug
  script:
    - ./ci/build.sh
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'

deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - ./ci/deploy.sh
  environment:
    name: production
    url: https://myapp.rmwhs.com
  rules:
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
```

`ci/build.sh` builds with kaniko (no Docker-in-Docker, no `privileged`)
using `$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA` as the tag and pushes to the
registry. `ci/deploy.sh` sets up the scoped kubeconfig (§3.5) and runs
`kubectl apply -f k8s/` (substituting the new image tag first, e.g. via
`envsubst` or `kubectl set image`).

---

## 7. Reference: Current Cluster Inventory

| Namespace | What | Ingress host |
|---|---|---|
| `gitlab` | Self-hosted GitLab CE (raw manifest, not Helm) | `gitlab.rmwhs.com` |
| `gitlab-runner` | GitLab Runner, kubernetes executor | — (no ingress; polls outbound) |
| `headlamp` | Cluster dashboard (Helm) | `headlamp.rmwhs.com` |
| `ingress-nginx` | Standalone nginx ingress controller (`nginx-external`) | — |
| `monitoring` | kube-prometheus-stack (Prometheus, Alertmanager, Grafana) | `prometheus.rmwhs.com`, `alertmanager.rmwhs.com`, `grafana.rmwhs.com` |
| `openobserve` | log and trace backend | `openobserve.rmwhs.com` |
| `infisical` | secrets manager | `infisical.rmwhs.com` |
| `rabbitmq` | shared broker | — |
| `mailpit` | dev SMTP and mailbox UI | (cluster-local / optional ingress) |

Relevant files:
- [helm/gitlab-runner-values.helm.yaml](k8s-infrastructure/helm/gitlab-runner-values.helm.yaml)
- [helm/gitlab-ce-values.helm.yaml](k8s-infrastructure/helm/gitlab-ce-values.helm.yaml) (alternate Helm-based GitLab install — not the one currently deployed; the running instance uses [manifest/gitlab-omni-ce.yaml](k8s-infrastructure/manifest/gitlab-omni-ce.yaml))
- [helm/headlamp-values.helm.yaml](k8s-infrastructure/helm/headlamp-values.helm.yaml)
- [manifest/headlamp-ingress.yaml](k8s-infrastructure/manifest/headlamp-ingress.yaml)

---

## 8. Known Gaps / Open Items

Be aware of these when onboarding a new app — they're cluster-level
prerequisites, not something to work around per-project:

- **Cloudflare Tunnel (free tier) caps request bodies at 100MB.** This is
  enforced at Cloudflare's edge and is not configurable without upgrading
  the zone's plan. Docker registry pushes upload one layer per request, so
  in practice this means: **no single image layer may exceed 100MB.**
  Multi-stage builds and slim base images keep this a non-issue for most
  apps; a single large `COPY` of a dataset/model/bundle is what would
  actually hit it. Same 100MB cap applies to large git pushes / Git LFS
  objects through `gitlab.rmwhs.com`. This is separate from (and in
  addition to) `client_max_body_size` on nginx/ingress-nginx, which is
  already set to unlimited on the `gitlab`/registry stack — Cloudflare's
  limit is the one that can't be tuned away.
- **No cert-manager** — TLS is entirely dependent on Cloudflare's proxy
  staying in front of every hostname. If a subdomain's DNS record is ever
  set to "DNS only" (grey-clouded) in Cloudflare, it will serve unencrypted
  HTTP directly.
- **No shared/RWX storage** — anything needing multi-pod shared storage
  isn't currently supported.
- **Single node, no HA** — a node reboot/failure takes down everything,
  including GitLab and the registry. There is no failover.

---

## 9. DevSecOps Security Baseline (Lightweight)

For this cluster size, prioritize GitLab-native security analyzers and add
only lightweight in-cluster runtime scanning.

### 9.1 CI security gates (GitLab-native)

- Reuse GitLab templates for SAST, Secret Detection, Dependency Scanning,
  Container Scanning, and IaC SAST.
- Scaffold reusable config with:
  - `~/bash-scripts/scaffold-gitlab-devsecops-ci.sh`
- Output template path:
  - `~/kubernetes/k8s-infrastructure/gitlab-templates/devsecops-security.gitlab-ci.yml`

### 9.2 Runtime scanning (in-cluster)

- Install Trivy Operator with conservative resource limits:
  - `~/bash-scripts/install-trivy-operator.sh`
- Report queries:
  - `kubectl get vulnerabilityreports -A`
  - `kubectl get configauditreports -A`

This approach avoids introducing heavyweight extra platforms when GitLab
already covers most SDLC security controls.

---

## 10. Checklist for Onboarding a New App

- [ ] Repo has `Dockerfile`, `.gitlab-ci.yml`, `k8s/`, `ci/*.sh`
- [ ] Image build uses kaniko/buildah, pushes to `$CI_REGISTRY_IMAGE`,
      tagged with `$CI_COMMIT_SHORT_SHA` (not `:latest`)
- [ ] Dedicated namespace created for the app
- [ ] Dedicated least-privilege ServiceAccount + Role for CI deploys (not
      the runner's own SA, not cluster-admin)
- [ ] `resources.requests` and `resources.limits` set on every container
- [ ] `readinessProbe`/`livenessProbe` configured
- [ ] Ingress uses `ingressClassName: nginx-external`, a unique
      `<app>.rmwhs.com` subdomain, and `ssl-redirect: "false"`
- [ ] No apex-domain binding, no `privileged: true`, no secrets committed
      to the repo
- [ ] Runtime secrets live in a Kubernetes Secret in the app's namespace;
      pipeline secrets live in GitLab CI/CD variables (Protected + Masked)
