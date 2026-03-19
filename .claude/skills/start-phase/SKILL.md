---
name: start-phase
description: Use when starting work on a phase of the acubemy project, loading a phase brief, or when the user says "start phase", "begin phase", or names a phase to work on.
---

**Before anything else:** Check which model you are. If you are not claude-opus-4-6,
say: "⚠️ Planning command — you're on [model name]. Consider switching to Opus for this:
`claude --model claude-opus-4-6`. Continue anyway? (y/n)"
Only proceed if I confirm.

Load the phase brief for: $ARGUMENTS

1. Find the matching file in `docs/phases/active/` or `docs/phases/backlog/`
2. Read the brief fully
3. Read any ADRs in `docs/decisions/` that are referenced or relevant
4. Read `docs/invariants.md`
5. Summarize your understanding of:
   - What this phase delivers
   - The acceptance criteria you will hold yourself to
   - The explicit out-of-scope boundaries
   - Any technical approach decisions you need to make before coding
6. Flag anything ambiguous or under-specified before writing any code
7. Do not write code until I confirm your understanding is correct

If the phase file is in `backlog/`, move it to `active/` and update its status to `in-progress`.
