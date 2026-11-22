# Workspace Skills

Canonical Copilot workspace skills live under `.github/skills/<skill-name>/SKILL.md`.

Current skills:
- `architect-pro`
- `devsecops`
- `session-steering`

Authoring rules:
- Folder name must match frontmatter `name`.
- Use keyword-rich `description` with a clear "Use when ..." trigger.
- Keep `user-invocable: true` when the skill should appear for slash invocation.
- Put large supporting docs under `references/` and link them from `SKILL.md`.
