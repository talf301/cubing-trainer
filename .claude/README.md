# acubemy Claude Skills

Project-level skills for the acubemy codebase. These work alongside
[Superpowers](https://github.com/obra/superpowers) to enforce a consistent
planning and execution workflow across sessions.

## Setup

Install Superpowers once in the repo (if not already done):

```bash
claude
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
# quit and restart claude
```

The project skills in this directory are discovered automatically — no installation needed.

## Skills

### `start-phase`
Loads a phase brief and orients Claude before any implementation begins.
Reads the phase file, relevant ADRs, and `docs/invariants.md`, then
summarizes scope and acceptance criteria for confirmation before coding starts.

**When it fires:** Automatically when you mention starting a phase by name.
Explicitly with `/start-phase <phase-name-or-number>`.

**Model:** Prompts you to switch to Opus if you're not already on it.

---

### `end-session`
Wraps up a session by updating phase status, appending a session log entry
to the phase file, and summarizing what changed in `docs/status.md`.
Also flags any decisions made during the session that should become ADRs.

**When it fires:** Automatically on "done for today", "wrap up", "end session".
Explicitly with `/end-session`.

**Model:** Sonnet is fine.

---

### `new-phase`
Drafts a new phase brief for work that doesn't fit existing phases.
Reads the PRD and existing phases to avoid scope overlap, asks clarifying
questions, then drafts using the template at `docs/phases/TEMPLATE.md`.
Does not save until you approve.

**When it fires:** Automatically when you describe wanting to plan new work.
Explicitly with `/new-phase <description>`.

**Model:** Prompts you to switch to Opus if you're not already on it.

---

### `status-review`
Gives a concise project health check: what's active, what's blocked,
parallelism opportunities, dependency ordering, and what should move
from backlog to active.

**When it fires:** Automatically on "what's the status", "what should I work on".
Explicitly with `/status-review`.

**Model:** Sonnet is fine.

---

### `new-decision`
Records an architectural decision as an ADR in `docs/decisions/`.
Interviews you about options considered, what was chosen, and why,
then drafts the ADR for approval before saving.

**When it fires:** Automatically when you describe needing to record a decision.
Explicitly with `/new-decision <topic>`.

**Model:** Prompts you to switch to Opus if you're not already on it.

---

## Model guidance

Planning-heavy skills (`start-phase`, `new-phase`, `new-decision`) will warn
you if you're not on Opus and ask before proceeding. Quick rule:

| Task | Model |
|------|-------|
| Starting a phase, writing ADRs, drafting phase briefs | `claude --model claude-opus-4-6` |
| Implementation, debugging, end-session, status-review | `claude --model claude-sonnet-4-6` |

Shell aliases that help:
```bash
alias claude-plan='claude --model claude-opus-4-6'
alias claude-code='claude --model claude-sonnet-4-6'
```

## Typical session

```bash
# Planning session
claude --model claude-opus-4-6
/start-phase 01-bluetooth-cube-state

# ... work ...

# Implementation session (later or same day)
claude --model claude-sonnet-4-6
/start-phase 01-bluetooth-cube-state   # will warn if Opus would be better here

# ... implement ...

/end-session
```

## Key docs

| File | Purpose |
|------|---------|
| `docs/PRD.md` | What the project is and what done looks like |
| `docs/invariants.md` | Constraints that must never be violated |
| `docs/status.md` | Current project state and session log |
| `docs/phases/backlog/` | Planned phases not yet started |
| `docs/phases/active/` | Phases currently in progress |
| `docs/phases/done/` | Completed phases |
| `docs/decisions/` | ADRs for architectural decisions |
| `docs/phases/TEMPLATE.md` | Template for new phase briefs |
