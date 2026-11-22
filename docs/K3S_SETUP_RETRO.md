# K3s + GitLab Homelab: Setup Retro

A retrospective on how this cluster got from bare metal to a working
self-hosted GitLab + CI/CD + Container Registry stack, written as both a
record of what happened and a teaching document for next time — whether
"next time" is rebuilding this cluster from scratch, or just understanding
why it's shaped the way it is.

**Scope note on accuracy:** the cluster (k3s, ingress-nginx, GitLab CE,
Headlamp) already existed when this session started. Steps 0–5 below are
reconstructed from what the cluster's current state implies (Helm release
history, manifests on disk, resource configuration) — the exact original
commands weren't captured live. Steps 6 onward (GitLab Runner, Container
Registry) were done and verified step-by-step in this session, including
every mistake and fix, and are described in full fidelity.

---

## 1. The Journey: Bare Metal → Current State

### Step 0 — Bare metal prerequisites
A single physical machine (`elitedesk-800`, Ubuntu 26.04 LTS, 4 vCPU, ~24GiB
RAM) — no VM layer, no cloud provider. This matters for everything after:
**this cluster's entire capacity is one machine's capacity.** There is no
"add a node" escape hatch without buying another machine.

### Step 1 — Install k3s
k3s is Rancher's lightweight single-binary Kubernetes distribution —
API server, scheduler, controller-manager, kubelet, containerd, and a
bundled SQLite-or-etcd datastore all in one process, versus stock
Kubernetes' many separate components. For a single-node homelab box, this
is the right call: full Kubernetes API compatibility with a fraction of
the operational overhead of `kubeadm`.

Standard install is a single command:
```bash
curl -sfL https://get.k3s.io | sh -
```
This also installs a bundled `local-path` StorageClass and a Traefik
ingress controller by default — **this cluster does not use the bundled
Traefik**; a standalone `ingress-nginx` was installed instead (Step 4).

### Step 2 — kubectl access
k3s installs its own `kubectl` (actually a symlink to the `k3s` binary,
invoked as `k3s kubectl`) which defaults to reading
`/etc/rancher/k3s/k3s.yaml` — a **root-only** file. This is a real gotcha,
hit directly in this session (see §4). The practical fix: copy that file
out to `~/.kube/config` for the operating user, and either export
`KUBECONFIG=~/.kube/config` in the shell profile, or pass it explicitly per
command.

### Step 3 — Install Helm
Helm is the de-facto package manager for Kubernetes (full explanation in
§9). Installed once, used to install every Helm-packaged component below.

### Step 4 — Standalone `ingress-nginx`
Installed via Helm as the `external-nginx` release in the `ingress-nginx`
namespace, registered as the **default** IngressClass under the name
`nginx-external`. This is the single entry point for all HTTP traffic into
the cluster — every app's Ingress resource references
`ingressClassName: nginx-external`.

### Step 5 — Cloudflare Tunnel + DNS
`rmwhs.com` is proxied through Cloudflare (free tier). A `cloudflared`
tunnel exposes the cluster's ingress to the internet without opening any
inbound firewall ports on the homelab — Cloudflare's edge terminates TLS
and forwards plain HTTP to the tunnel, which is why every Ingress in this
cluster serves HTTP only (`ssl-redirect: "false"`) rather than doing its
own TLS. Each app gets its own subdomain (`gitlab.rmwhs.com`,
`headlamp.rmwhs.com`, etc.), proxied ("orange-clouded") in Cloudflare DNS.

### Step 6 — Deploy GitLab CE
Deployed as a **raw Kubernetes manifest**
([manifest/gitlab-omni-ce.yaml](k8s-infrastructure/manifest/gitlab-omni-ce.yaml)) —
a single `gitlab/gitlab-ce:latest` omnibus container (GitLab's
all-in-one image bundling Rails, PostgreSQL, Redis, Gitaly, Sidekiq,
Registry, and its own internal nginx) with two PVCs (`/etc/gitlab` config,
`/var/opt/gitlab` data) on `local-path` storage, tuned down for a
resource-constrained box (`postgresql['shared_buffers'] = '256MB'`,
`sidekiq['max_concurrency'] = 10'`, `puma['worker_processes'] = 2`), and an
Ingress at `gitlab.rmwhs.com`.

**Note:** there's also a [helm/gitlab-ce-values.helm.yaml](k8s-infrastructure/helm/gitlab-ce-values.helm.yaml)
in the repo for GitLab's official Helm chart — that's an alternate path
that isn't actually deployed. The raw manifest is what's live. Worth
cleaning up or clearly labeling as unused so a future you doesn't get
confused about which is authoritative.

### Step 7 — Deploy Headlamp (cluster dashboard)
Installed via Helm (`my-headlamp` release), with OIDC login wired to
GitLab itself (`issuerURL` pointing at `gitlab.rmwhs.com`) so cluster
access uses the same identity as everything else, backed by a
`ClusterRoleBinding` granting `cluster-admin` to the operator's GitLab
email. Ingress at `headlamp.rmwhs.com`.

### Step 8 — Deploy GitLab Runner *(this session, full detail in §4)*
Installed via the official `gitlab-runner` Helm chart into a dedicated
`gitlab-runner` namespace, configured with the `kubernetes` executor so
CI jobs run as ephemeral pods on this same cluster rather than needing a
separate build machine. This took several iterations to get right — see
§4 for the actual bugs hit and fixed.

### Step 9 — Enable Container Registry + Package Registry *(this session)*
GitLab's Container Registry and Package Registry were not enabled on the
initial install. Enabled by extending the same omnibus manifest with
`registry_external_url`, a second Ingress for `registry.rmwhs.com` routed
to the *same* GitLab pod (differentiated by HTTP `Host` header inside
GitLab's own bundled nginx — no second container needed), and
`gitlab_rails['packages_enabled'] = true`. Also required raising
`client_max_body_size` at two separate nginx layers before it actually
worked end-to-end — see §4.

### Step 10 — Verify end-to-end
A real project (`demo/gitlab-runner-demo`) exercised the whole chain: push
→ GitLab Runner picks up the job → kaniko builds a Docker image inside an
ephemeral pod (no Docker-in-Docker) → pushes to
`registry.rmwhs.com/demo/gitlab-runner-demo` → visible in the GitLab
Container Registry UI. This is the point the cluster is considered "done"
for this retro — a real GitLab-hosted CI/CD pipeline building and shipping
container images, entirely self-hosted on one machine.

---

## 2. What Went Right

- k3s + standalone ingress-nginx + Cloudflare Tunnel is a genuinely solid,
  low-maintenance combo for a single-node homelab — no inbound firewall
  rules needed, TLS handled entirely at the edge, one `IngressClass` for
  everything.
- The GitLab Runner registered and picked up jobs correctly on the very
  first attempt where the config was actually valid — the Helm chart's
  defaults are sane once you get past its handful of sharp edges (below).
- Enabling Container Registry on an omnibus GitLab install didn't require
  a second container/pod — GitLab's bundled nginx can virtual-host a second
  external URL on the same port, keyed off the `Host` header. One pod,
  two public hostnames.
- Every fix in this session was verified **inside** the cluster before
  being declared done (internal `curl -H "Host: ..."` tests, `gitlab-ctl
  status`, grepping the actual rendered config file) rather than trusting
  that `helm upgrade`/`kubectl apply` succeeding meant the fix worked. This
  caught nothing extra this time, but it's the habit that would have.

---

## 3. What Went Wrong (and had to be re-iterated)

This is the part worth actually reading closely — every one of these was a
real, live mistake made and fixed in this session, not a hypothetical.

### 3.1 Stale placeholder value in the runner's `values.yaml`
The first `gitlab-runner-values.helm.yaml` was drafted with
`gitlabUrl: https://gitlab.example.com/` as an illustrative placeholder,
and `helm install` ran against it before the placeholder was swapped for
the real `gitlab.rmwhs.com`. Result: the runner pod registered against a
hostname that doesn't exist, failing DNS resolution
(`dial tcp: lookup gitlab.example.com ... no such host`) in a crash loop.
**Lesson:** never `helm install` off a values file with an unverified
placeholder still in it — read the file back before applying, every time.

### 3.2 `helm install` vs. `helm upgrade`
After fixing the URL, re-running `helm install` with the same release name
failed outright: `cannot reuse a name that is still in use`. The first
(broken) install had still *succeeded* from Helm's point of view — a
release existed, just misconfigured. The fix is `helm upgrade`, not a
repeated `install`. **Lesson:** once a release exists, every subsequent
change is an `upgrade`; `install` is a one-time operation per release name.

### 3.3 The TOML nesting bug — the most instructive failure of the session
The runner's `[[runners]]` TOML config had:
```toml
[runners.kubernetes]
  namespace = "gitlab-runner"
  image = "alpine:latest"
  ...
  [runners.kubernetes.node_selector]
  cpu_request = "200m"
  memory_request = "128Mi"
  cpu_limit = "1"
  memory_limit = "2Gi"
```
The intent was to set **resource requests/limits** for job pods. What
actually happened: in TOML, once you open a sub-table header
(`[runners.kubernetes.node_selector]`), every following key belongs to
*that* table until the next header appears. Since nothing closed it, all
four resource keys became entries in `node_selector` — which Kubernetes
interprets as **required node labels**, not resource sizing. The generated
Pod spec ended up with:
```
Node-Selectors: cpu_limit=1, cpu_request=200m, memory_limit=2Gi, memory_request=128Mi
```
No real node has labels like that, so every job pod sat `Pending` forever
with `didn't match Pod's node affinity/selector` — a message that gives
almost no hint that the real bug is a config *authoring* mistake, not a
cluster capacity problem. **This was caught by `kubectl describe pod` and
reading the `Node-Selectors:` line closely** — the fix was simply removing
the stray `[runners.kubernetes.node_selector]` header so the four keys
landed back under `[runners.kubernetes]` directly.
**Lesson:** TOML table scoping is easy to get wrong when hand-nesting keys
under a chart's `runners.config` block, and the failure mode it produces
(`Pending`, node affinity mismatch) looks nothing like a syntax error —
always `kubectl describe pod` on anything stuck `Pending`, don't guess.

### 3.4 Orphaned job pod after the fix
Fixing §3.3 required a `helm upgrade`, which rolled the runner **manager**
pod. But the already-stuck job pod it had created wasn't owned by any
controller (the kubernetes executor creates bare Pods, not
Deployment-managed ones) — so when the old manager pod terminated, that
Pending pod was simply abandoned, not cleaned up. It had to be deleted by
hand (`kubectl delete pod`). **Lesson:** ephemeral CI job pods aren't
self-cleaning if the runner manager that created them disappears mid-job —
check for orphans after any runner manager restart during an active job.

### 3.5 `413 Request Entity Too Large` on the first registry push
Enabling the registry (§Step 9) wasn't enough on its own — the first real
`docker push` (via kaniko) failed with a 413 from nginx. Root cause: nginx
has a default `client_max_body_size` of 1MB, and Docker registry pushes
upload blobs via **chunked PATCH requests**, which trip that default even
for genuinely small payloads. The nasty part: this limit exists at **two
independent layers** in this cluster's traffic path — the k3s
`ingress-nginx` controller in front, *and* GitLab's own bundled registry
nginx behind it — and both needed the same fix
(`proxy-body-size: "0"` annotation on the Ingress; `registry_nginx['client_max_body_size'] = '0'`
in the omnibus config). Fixing only one still failed. **Lesson:** when
multiple reverse-proxy layers sit in a request's path, a body-size (or
timeout, or buffering) fix usually needs applying at *every* layer, not
just the one closest to the error message.

### 3.6 A related, permanent, non-fixable constraint discovered along the way
While debugging §3.5, a **separate, unrelated** limit came up: Cloudflare's
free/Pro tier caps proxied request bodies at 100MB, enforced at their edge,
before traffic even reaches the tunnel — this cannot be configured away
from this side at all. It wasn't the cause of the 413 (the test image was
a few KB), but it's a real ceiling for the future: any single Docker image
layer, or any single git/LFS push, over 100MB will hit it. **Lesson:**
don't stop debugging once *a* plausible cause is found — confirm the
actual cause, because a similarly-shaped but unrelated constraint can be
sitting right behind it waiting for a much later, more confusing failure.

### 3.7 `kubectl` silently reading the wrong kubeconfig
Every `kubectl` invocation in this session needed
`KUBECONFIG=~/.kube/config` prefixed, because plain `kubectl` (symlinked to
the k3s binary) defaults to a root-owned file the operating user can't
read. This isn't a bug introduced this session, but it's worth calling out
because it silently produces a *permission denied*, not a helpful "wrong
config" message — easy to misdiagnose as a cluster access problem.

---

## 4. Troubleshooting Playbook

Techniques that actually resolved something in this session, worth
reaching for first next time something's broken:

| Symptom | First move |
|---|---|
| Pod stuck `Pending` | `kubectl describe pod <name>` → read the `Events:` section and `Node-Selectors:`/`Tolerations:` — the scheduler always states *why* it can't place a pod |
| Pod `CrashLoopBackOff` / restarting | `kubectl logs <pod> --previous` (the *previous* crashed instance, not the fresh restart) |
| "It should be fixed but isn't" | Don't trust the apply succeeded — exec into the pod and check the *actual rendered config file* (`grep` for the setting you just set). A Helm/kubectl success message only means the API accepted your object, not that the workload picked it up correctly |
| Ambiguous error from a chain of proxies | Look for identifying details in the error body (server name, injected scripts/branding) to figure out *which* hop actually generated it, rather than assuming the outermost or innermost layer |
| `helm install` fails post-hoc | Check `helm list -A` first — if the release already exists, you want `helm upgrade`, not another `install` |
| Config change seems to not take effect | Check whether the workload actually restarted (`kubectl get pods`, compare `AGE`) — some controllers don't restart pods on a ConfigMap/env change without a rollout trigger |
| Need to test a Host-header-routed service without DNS in place yet | `kubectl exec` into a pod on the same network and `curl -H "Host: real.domain.com" http://localhost:<port>/path` — proves the routing logic works independent of external DNS |
| `kubectl` permission denied reading kubeconfig | Check what `kubectl` actually resolves to (`type kubectl`) — on k3s it may be a symlink defaulting to a root-only file, not your user's `~/.kube/config` |

---

## 5. Best Practices Distilled

- **Read config files back before applying them.** Every real bug this
  session (§3.1, §3.3) was a mistake sitting in a YAML/TOML file that a
  careful re-read would have caught before `helm upgrade` ever ran.
- **`kubectl describe`, not just `kubectl get`, is the actual debugging
  tool.** `get` tells you state; `describe`'s `Events:` section tells you
  *why* that state is what it is.
- **Verify inside the cluster, not just at the API layer.** A successful
  `kubectl apply`/`helm upgrade` only confirms the API server accepted your
  object — confirm the running process actually picked up the change.
- **Namespace and resource-limit everything**, especially on a
  single-node, fixed-capacity cluster where one unbounded pod can starve
  the whole box (this is codified as a hard requirement in
  [KUBERNETES_GITLAB_CONTEXT.md](KUBERNETES_GITLAB_CONTEXT.md)).
- **No Docker-in-Docker / `privileged: true`** for image builds — kaniko
  ran cleanly the entire session with zero privilege escalation.
- **Treat multi-hop reverse-proxy chains as N independent places a limit
  can be enforced**, not one. Fix the whole chain, verify the whole chain.
- **Keep a living document** (this file, and
  [KUBERNETES_GITLAB_CONTEXT.md](KUBERNETES_GITLAB_CONTEXT.md)) that
  reflects the cluster's *actual, verified* state — not the aspirational
  state. The stale "registry not enabled" note that had to be corrected
  mid-session is a small example of docs drifting from reality the moment
  they're not actively kept in sync.

---

## 6. How to Think in Kubernetes

Kubernetes is fundamentally a **declarative, reconciling control system**,
not a script runner. The mental model that makes everything else make
sense:

1. **You declare desired state** — a YAML manifest saying "there should be
   a Deployment named `myapp` running 2 replicas of image `X`."
2. **The API server stores that desired state** — durably, in **etcd**
   (more on this below).
3. **Controllers continuously watch** the gap between desired state (what
   you declared) and actual state (what's really running), and act to
   close that gap — create a missing pod, restart a crashed one, delete an
   extra one.
4. **This loop never stops.** It's not "run this once" — it's "keep this
   true, forever, until I declare something different." This is why
   deleting a Pod that belongs to a Deployment doesn't actually remove it
   for long: the ReplicaSet controller notices the gap and creates a
   replacement within moments.

Everything in Kubernetes is an **object** with two parts: a `spec` (what
you want) and a `status` (what's currently observed). Reading a manifest
is reading an intention, not a command.

**Where etcd fits in:** etcd is **not** something you create manifests
for — it's the cluster's own backing datastore, the single source of
truth for every object's state. The API server is the only thing that
talks to it directly; you never touch it yourself. In stock Kubernetes,
etcd is its own clustered service (and the thing that makes multi-master
HA hard to get right); in k3s, by default it's swapped for embedded
SQLite on a single-node setup like this one — same role, lighter weight,
same important fact: **if it's lost, the cluster's entire memory of what
should exist is lost with it.** Backing it up matters more than backing up
any individual manifest, because the manifests you `kubectl apply` are
reproducible from source control — etcd's actual current state (including
anything that changed via `kubectl edit`, autoscaling, etc.) is not.

---

## 7. Kubernetes Kinds Cheatsheet

| Kind | What it is | Use it when |
|---|---|---|
| **Namespace** | A logical partition of the cluster — its own scope for names, RBAC, resource quotas | Always — one per app/tenant, per this cluster's own hard rule |
| **Pod** | The smallest deployable unit: one or more containers sharing network + storage | Rarely created directly — almost always managed by a Deployment/Job/etc. instead |
| **Deployment** | Manages a ReplicaSet, which manages Pods; gives you declarative rollout, rollback, and self-healing | The default choice for any stateless, long-running app |
| **ReplicaSet** | Ensures N identical Pod replicas exist | Almost never created directly — it's what a Deployment manages underneath |
| **StatefulSet** | Like a Deployment, but each replica gets a stable identity/name and its own persistent volume | Databases, queues, anything where pod identity or per-instance storage matters |
| **DaemonSet** | Runs exactly one pod per (matching) node | Node-level agents — log shippers, monitoring agents, CNI components. Not used much on a 1-node cluster, matters more as nodes are added |
| **Job** | Runs a pod to completion, once (or N times) | One-off or batch tasks — migrations, backups, data processing |
| **CronJob** | Runs a Job on a schedule | Recurring batch tasks — nightly backups, scheduled reports |
| **Service** | A stable virtual IP/DNS name that load-balances across a set of Pods (which have ephemeral IPs) | Any time one thing needs to reliably reach another — internal service discovery |
| **Ingress** | L7 HTTP(S) routing rules from the outside world into Services, by hostname/path | The front door for any web-facing app — requires an Ingress *controller* (like `ingress-nginx`) actually installed to do anything |
| **ConfigMap** | Non-secret key/value configuration, injected as env vars or mounted files | App configuration that isn't sensitive — feature flags, URLs, tuning params |
| **Secret** | Same shape as a ConfigMap, but for sensitive values (base64-encoded at rest, access-controlled via RBAC) | Passwords, tokens, API keys the *running pod* needs |
| **PersistentVolumeClaim (PVC)** | A request for storage, satisfied by a PersistentVolume via a StorageClass | Anything that needs to persist data across pod restarts |
| **PersistentVolume (PV)** | The actual provisioned storage backing a PVC | Rarely created directly on a cluster with dynamic provisioning (`local-path` auto-creates these per PVC) |
| **StorageClass** | Defines *how* storage gets dynamically provisioned when a PVC asks for it | Set once per storage backend; apps just reference it by name |
| **ServiceAccount** | An identity that Pods (or CI pipelines) authenticate to the API server as | Any workload/pipeline that needs to talk to the Kubernetes API itself, scoped narrowly per §3.5 of the deployment guide |
| **Role / RoleBinding** | Grants a set of permissions, scoped to one namespace, to a subject (ServiceAccount/User) | Least-privilege access within a single app's namespace |
| **ClusterRole / ClusterRoleBinding** | Same as above, but cluster-wide | Cluster-admin-style access (used for Headlamp's OIDC binding), or genuinely cluster-scoped resources |
| **HorizontalPodAutoscaler** | Automatically scales replica count based on observed metrics (CPU, memory, custom) | Variable-load apps on a cluster with room to scale into — not particularly useful on this fixed single-node box today |

**etcd** deliberately isn't in this table — it's not a manifest kind you
author, it's the cluster's own datastore underneath everything above (see
§6).

---

## 8. What Is Helm, and When to Use It

Helm is Kubernetes' package manager. A **chart** is a versioned, templated
bundle of Kubernetes manifests plus a `values.yaml` of parameters —
`helm install` renders the templates with your values and applies the
result as a tracked **release**, which Helm can then upgrade, roll back,
or uninstall as a unit.

**What it actually buys you over plain manifests:**
- Parameterization — one chart, many environments, via different
  `values.yaml` files (exactly what `gitlab-runner-values.helm.yaml` is)
- A tracked release history — `helm upgrade`/`helm rollback` know what
  changed between versions
- Reuse of complex, already-solved deployment logic for third-party
  software (GitLab, ingress-nginx, GitLab Runner, Headlamp all shipped as
  Helm charts by their maintainers — nobody hand-wrote their manifests
  from scratch)

**When to reach for it vs. plain manifests** — this cluster already draws
the line correctly and it's worth keeping:
- **Helm** for anything third-party/complex that already ships an
  official chart: `ingress-nginx`, `gitlab-runner`, `headlamp`. Don't
  reinvent what the maintainer already solved.
- **Plain manifests** for anything you own and fully understand, where
  the manifest count is small and templating buys you nothing: the GitLab
  CE deployment itself, and — per
  [KUBERNETES_GITLAB_CONTEXT.md](KUBERNETES_GITLAB_CONTEXT.md) — every
  future app deployed onto this cluster. A future app should only reach
  for Helm if it genuinely needs multi-environment templating; most
  single-app deployments don't.

---

## 9. Conclusion: What Kubernetes Is — and Isn't

**What it is:** a declarative reconciliation engine for running
containerized workloads — it watches for drift between what you've said
should exist and what actually does, and continuously corrects it. That
gets you, for free: self-healing (crashed pods come back), rolling
updates and rollbacks, service discovery that survives pods moving
around, and — critically for this cluster's actual motivating use case —
**a single, consistent deployment vocabulary** that every future app can
speak, regardless of what language or framework it's written in. That
last point is the real payoff here: the value of this whole setup isn't
really "orchestration at scale," it's "every project that lands on this
GitLab instance gets the exact same, predictable path to production,"
which is precisely what
[KUBERNETES_GITLAB_CONTEXT.md](KUBERNETES_GITLAB_CONTEXT.md) codifies.

**What it isn't:** a source of high availability by itself (this cluster
is one machine — Kubernetes running on it doesn't change that a reboot
takes everything down), a performance optimization (it adds scheduling
and networking overhead, it doesn't remove it), or a substitute for
actually understanding the systems running on top of it. Nearly every
failure in this session (§3) came from Kubernetes/Helm/nginx configuration
subtlety, not from the applications themselves — that operational tax is
real and has to be budgeted for, not hand-waved away because "it's just
YAML."

**When it's worth that tax:** when you have — or expect to have — more
than one service that needs deploying, and you want them all deployed,
observed, and secured the same predictable way. A single static site or a
lone cron job doesn't need Kubernetes; a systemd unit or a plain Docker
container is less machinery for the same outcome. This cluster clears
that bar specifically *because* it's meant to host GitLab itself plus an
open-ended set of future apps through one shared CI/CD and ingress
convention — the standardization is the actual return on the complexity,
not raw scale, and definitely not high availability, which this
single-node setup explicitly doesn't have and was never trying to solve.
