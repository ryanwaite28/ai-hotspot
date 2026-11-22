# Session Steering Checklist

Use this checklist at session start and before ending a session.

## Start Gate

- [ ] Phase and FR/NFR scope identified from `PROJECT.md`.
- [ ] Applicable skills confirmed (`architect-pro`, `devsecops`, plus task-specific skills).
- [ ] Dispatch/orchestration/service boundaries validated for planned files.
- [ ] Planned changes mapped to minimal corrective actions.

## In-Session Gate

- [ ] New code keeps gateway/dispatch layer transport-only.
- [ ] Domain decisions stay in service-layer modules.
- [ ] Data access remains in repository/query modules only.
- [ ] Security defaults from DevSecOps skill are preserved.
- [ ] Any drift between docs and implementation is documented and reconciled.

## Exit Gate

- [ ] Status labels applied per deliverable: implemented/scaffolded/deferred.
- [ ] FR checkboxes are updated only when runtime evidence exists.
- [ ] `CHANGELOG.md` updated with evidence and unresolved items.
- [ ] Next exact phase/resume point is recorded.
