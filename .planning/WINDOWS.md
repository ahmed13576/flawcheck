---
schema_version: 1
open_count: 6
waived_count: 0
fixed_count: 0
total_count: 6
last_updated: 2026-09-28T05:56:01.497Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 2 | lint-warning | tests/ingest/group.test.ts | 2 | unused import buildCells (pre-existing from 02-03 Task 1; lint exits 0 — warnings only) | open |  | 2026-09-27T12:00:06.974Z |  |
| 2 | 2 | lint-warning | tests/ingest/group.test.ts | 9 | unused const HEADERS (pre-existing from 02-03 Task 1; lint exits 0 — warnings only) | open |  | 2026-09-27T12:00:07.986Z |  |
| 3 | 2 | unrun-verify | components/wizard/screen-ingest.tsx |  | browser GUI human-check approximated by SSR markup checks + reducer tests (browser MCP unavailable in executor); interactive walkthrough deferred to end-of-phase UI gate | open |  | 2026-09-27T12:00:09.121Z |  |
| 4 | 03 | stub | components/wizard/screen-ingest.tsx |  | Screen 1 'Continue to review' click is a no-op when rows are loaded via back-nav (reducer set-screen forward guard; forward nav stays parse/demo-driven) | open |  | 2026-09-27T17:50:12.267Z |  |
| 5 | 03 | stub | components/report/report-document.tsx | 71 | Clause-cited conclusions are a Phase-3 deterministic placeholder list; Phase 4 replaces with narrative-driven conclusions | open |  | 2026-09-28T05:56:00.586Z |  |
| 6 | 03 | stub | components/wizard/screen-results.tsx | 298 | Open report preview / Download PDF / Print report disabled per locked decision; Phase 4 owns generation | open |  | 2026-09-28T05:56:01.497Z |  |

````json
[
  {
    "id": 1,
    "kind": "lint-warning",
    "phase": "2",
    "file": "tests/ingest/group.test.ts",
    "line": 2,
    "description": "unused import buildCells (pre-existing from 02-03 Task 1; lint exits 0 — warnings only)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T12:00:06.974Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 2,
    "kind": "lint-warning",
    "phase": "2",
    "file": "tests/ingest/group.test.ts",
    "line": 9,
    "description": "unused const HEADERS (pre-existing from 02-03 Task 1; lint exits 0 — warnings only)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T12:00:07.986Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "2",
    "file": "components/wizard/screen-ingest.tsx",
    "line": null,
    "description": "browser GUI human-check approximated by SSR markup checks + reducer tests (browser MCP unavailable in executor); interactive walkthrough deferred to end-of-phase UI gate",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T12:00:09.121Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 4,
    "kind": "stub",
    "phase": "03",
    "file": "components/wizard/screen-ingest.tsx",
    "line": null,
    "description": "Screen 1 'Continue to review' click is a no-op when rows are loaded via back-nav (reducer set-screen forward guard; forward nav stays parse/demo-driven)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-27T17:50:12.267Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 5,
    "kind": "stub",
    "phase": "03",
    "file": "components/report/report-document.tsx",
    "line": 71,
    "description": "Clause-cited conclusions are a Phase-3 deterministic placeholder list; Phase 4 replaces with narrative-driven conclusions",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-28T05:56:00.586Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 6,
    "kind": "stub",
    "phase": "03",
    "file": "components/wizard/screen-results.tsx",
    "line": 298,
    "description": "Open report preview / Download PDF / Print report disabled per locked decision; Phase 4 owns generation",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-28T05:56:01.497Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
