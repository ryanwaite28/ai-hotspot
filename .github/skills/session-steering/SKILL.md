---
name: session-steering
description: "Steer implementation sessions to stay consistent with PROJECT.md, active skills, architecture boundaries, and phase evidence. Use at the start of coding sessions and before marking plan progress."
argument-hint: "Provide target phase, planned files, and scope of change"
user-invocable: true
---

# Session Steering

Use this skill to enforce a repeatable implementation steering loop so session output remains consistent with project plan, architecture boundaries, and active skills.

## When to Use

- Starting any implementation session that changes code, CI, or infrastructure.
- Before claiming phase progress or completion.
- When drift appears between PROJECT.md, current code, and skill guidance.

## Steering Loop

1. **Phase Lock**
   - Identify the exact current phase and FR/NFR scope in `PROJECT.md`.
   - Reject unrelated scope unless explicitly approved.

2. **Skill Lock**
   - Confirm applicable skills and constraints:
     - `architect-pro`
     - `devsecops`
   - Reconcile scope with skill directives before coding.

3. **Boundary Lock**
   - Verify dispatch/orchestration/service boundaries.
   - Ensure gateway adapters remain transport-only.
   - Ensure domain logic and data access stay in service/repository layers.

4. **Evidence Lock**
   - Distinguish and report status as:
     - implemented
     - scaffolded
     - deferred
   - Do not mark FR checklist items complete without runtime evidence.

5. **Exit Lock**
   - Update `CHANGELOG.md` with completed work, verification evidence, unresolved items, and exact next resume point.

## Required Outputs Per Session

- Scope statement: phase + FR/NFR IDs.
- Drift findings in severity order.
- Minimal corrective actions mapped to phase.
- Completion labels: implemented/scaffolded/deferred.
- Changelog evidence entry.

## References

- [Session steering checklist](./references/session-steering-checklist.md)
