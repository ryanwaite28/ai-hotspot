# Copilot Instructions for HotSpot

Always apply the local DevSecOps skill as first-class guidance:
- Skill path: `.github/skills/devsecops/SKILL.md`
- Deep reference: `.github/skills/devsecops/references/devsecops-categories-and-tools.md`

Always apply the local Session Steering skill for implementation sessions:
- Skill path: `.github/skills/session-steering/SKILL.md`
- Checklist: `.github/skills/session-steering/references/session-steering-checklist.md`

## Required defaults

- Never hardcode credentials, secrets, or tokens.
- Use least-privilege RBAC and minimal infrastructure permissions.
- Use pinned versions for dependencies, CI images, and base images.
- Add or maintain CI security gates for SAST, dependency scanning, secrets scanning, container scanning, and IaC scanning.
- Prefer immutable image tags in Kubernetes manifests and deployment scripts.
- Keep secret examples out of default deployment manifests.

## Pipeline and IaC expectations

- New CI jobs must fail on high/critical security findings unless explicitly exempted in writing.
- New Kubernetes workloads must include resource requests/limits and hardened securityContext settings.
- Use the existing ingress class conventions from project docs (`nginx-external`).

## Session Steering Mechanism (Mandatory)

For every implementation session:

1. Run a **Start Gate** before editing:
	- lock to current phase and FR/NFR scope in `PROJECT.md`
	- confirm active skills and constraints (`architect-pro`, `devsecops`, `session-steering`)
	- confirm architecture boundaries for planned files
2. Run an **In-Session Gate** while editing:
	- keep gateway/dispatch transport-only
	- keep domain logic and data access in service/repository modules
	- reconcile any plan/implementation drift immediately
3. Run an **Exit Gate** before completion:
	- classify work as implemented/scaffolded/deferred
	- update `CHANGELOG.md` with verification evidence and unresolved items
	- record exact next phase and resume point

Do not mark FR checklist items complete unless runtime evidence exists.
