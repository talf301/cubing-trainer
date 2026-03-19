---
name: status-review
description: Use when reviewing overall project status, checking what's in progress, or deciding what to work on next. Triggers on "status review", "what's the status", "what should I work on", or similar.
---

Review the current project state:

1. Read `docs/status.md`
2. Read all phase briefs in `docs/phases/active/`
3. Read all phase briefs in `docs/phases/backlog/`

Then report:
- **Active phases**: what's in progress, any blockers noted
- **Parallelism opportunities**: which backlog phases have no dependency on active work
  and could be started in a separate worktree right now
- **Scope overlap**: flag any two phases whose out-of-scope / in-scope boundaries conflict
- **Backlog order**: confirm the dependency ordering is correct, flag if anything is out of order
- **Suggested next**: what should move from backlog → active based on current state

Keep it concise — this is a status check, not a report.
