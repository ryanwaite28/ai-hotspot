# Copilot Workspace Context

This folder stores AI workspace guidance for HotSpot.

## Active Skills (Canonical)

- DevSecOps Security Enforcer: `.github/skills/devsecops/SKILL.md`
- Architect-Pro System Design: `.github/skills/architect-pro/SKILL.md`
- Tool/category reference: `.github/skills/devsecops/references/devsecops-categories-and-tools.md`

## Legacy Folder

The `.copilot/skills` folder is retained for compatibility and historical context. New skills should be added under `.github/skills` so they are discoverable and invokable by Copilot skill loading.

## Why this layout

- Keeps security behavior co-located with agent skill prompts.
- Reduces drift between implementation and security expectations.
- Makes security guidance discoverable for future coding sessions.
