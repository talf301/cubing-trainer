---
name: new-decision
description: Use when recording an architectural or technical decision for phasewise. Triggers when the user says "record a decision", "write an ADR", or when a significant technical choice needs to be documented.
---

**Before anything else:** Check which model you are. If you are not claude-opus-4-6,
say: "⚠️ Planning command — you're on [model name]. Consider switching to Opus for this:
`claude --model claude-opus-4-6`. Continue anyway? (y/n)"
Only proceed if I confirm.

Record an architectural decision about: $ARGUMENTS

Ask me:
1. What options were considered?
2. What was chosen?
3. Why — what were the deciding factors?
4. What are the consequences or tradeoffs accepted?

Then write an ADR to `docs/decisions/` with filename `NNN-short-title.md` where NNN
follows existing numbering (start at 001 if none exist).

Format:
```
# ADR NNN: [Title]

**Date:** YYYY-MM-DD
**Status:** accepted

## Context
[Why this decision needed to be made]

## Options considered
[What was evaluated]

## Decision
[What was chosen]

## Rationale
[Why]

## Consequences
[Tradeoffs accepted, things this constrains going forward]
```

Show me the draft before saving. Do not save until I approve.
