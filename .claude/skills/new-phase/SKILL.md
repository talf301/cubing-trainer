---
name: new-phase
description: Use when drafting a new phase brief for the phasewise project, or when the user wants to plan a new feature, workstream, or area of work that doesn't fit existing phases.
---

**Before anything else:** Check which model you are. If you are not claude-opus-4-6,
say: "⚠️ Planning command — you're on [model name]. Consider switching to Opus for this:
`claude --model claude-opus-4-6`. Continue anyway? (y/n)"
Only proceed if I confirm.

Draft a new phase brief for: $ARGUMENTS

Before writing anything:
1. Read `docs/PRD.md` to understand project scope
2. Read `docs/invariants.md`
3. Read existing phase briefs in `docs/phases/` to understand what's already planned
   and avoid scope overlap

Then ask me clarifying questions until you understand:
- What this phase delivers that isn't already covered
- What it depends on
- Where the scope boundary is — what's explicitly NOT in this phase

Once I've answered, draft a phase brief using the template at `docs/phases/TEMPLATE.md`.
Show me the draft before saving it. Save to `docs/phases/backlog/` with a filename like
`NN-short-name.md` where NN follows the existing numbering.

Do not save the file until I approve the draft.
