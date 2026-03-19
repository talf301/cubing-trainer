---
name: end-session
description: Use at the end of a work session to update project status, log what was done, and capture any new decisions. Triggers when the user says "end session", "wrap up", "done for today", or similar.
---

Wrap up the current session:

1. Identify which phase(s) were worked on this session
2. Update the status field in each phase file if it changed
3. Append a session log entry to each phase file worked on, in this format:
   `<!-- YYYY-MM-DD: [2-3 sentences: what was done, what's next, any blockers] -->`
4. Append a summary line to `docs/status.md` under the session logs section:
   `- YYYY-MM-DD [phase name]: [one sentence summary]`
5. If any architectural decisions were made that aren't yet captured, prompt me:
   "The following decisions should be recorded as ADRs: [list]. Run /new-decision for each?"
6. List any work that emerged as needed but wasn't planned — candidates for new phase briefs

Use the current date. Do not invent completion status — only mark things done if the
acceptance criteria were actually met.
