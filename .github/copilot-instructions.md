# Copilot Instructions for HotSpot

Always apply the local DevSecOps skill as first-class guidance:
- Skill path: `.copilot/skills/devsecops/SKILL.md`
- Deep reference: `.copilot/skills/devsecops/docs/devsecops-categories-and-tools.md`

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
