# Expedition report — BranchBack v1.0 → v2.0

## Outcome

Shipped **v2.0.0**: a coherent accumulated-history product layer on top of the
v1 integrity contracts. Version chosen by semantic scope (new history surfaces
+ schema 4), not by prompt ambition alone.

## Major product decisions

1. **Lineage as typed links with `createdAt`**, not a graph DB — answers “which earlier decisions led here?” without inventing causality.
2. **Assumption families require explicit user confirmation** — text reuse remains a separate hint; fingerprints stay distinct inside a family.
3. **Dossiers over generic export polish** — Markdown/print preserve Known Then vs later layers.
4. **History explorer + provenance search** instead of Git-for-decisions.
5. **Lightweight protocols** (capture prompts only) — rejected template marketplace.
6. **Evidence as note/url/quote with then|later** — deferred binary blobs.
7. **Schema 4 + fail-closed unknown schemas** for durability.

## Issues discovered during the expedition

- Incomplete mid-stream SCHEMA_VERSION=4 types without schema/migrate wiring would have broken create/import; finished end-to-end migration defaults for nested assumptions.
- `addAssumption` typing required optional family fields so demos and forms stay ergonomic.
- Dossier rewrite initially dropped the “Immutable commit snapshot” phrase expected by existing export tests — restored for contract continuity.
- Persistence tests for unsupported schema need `fake-indexeddb` (domain unit tests alone lack IndexedDB).

## Features deliberately rejected / deferred

| Idea | Why deferred |
|------|----------------|
| Binary attachments | Quota, backup size, migration complexity disproportionate to North Star |
| Auto-semantic belief merge | Cannot prove sentence identity without LLM/heuristic false merges |
| Protocol marketplace / advice | Dilutes decision replay into templates + guidance |
| Life scores / causality claims | Violates North Star and honesty about sample size |
| Full graph DB lineage | Novelty over clarity for personal history |

## Architecture changes

- Domain modules: `lineage`, `assumptionFamilies`, `dossier`, `historySearch`, `historyExplorer`, `learningSurfaces`, `protocols`, `syntheticScale`, `backupHealth`
- Schema 4 fields on `Decision` / `Assumption`; repository import asserts supported schema before migrate
- UI: Search, History explorer route, detail lineage/evidence/dossier, Insights expansions, Settings health

## Verification

Evidence in `verification/v2.0/summary.json` (`failedSteps: 0`):

- `npm ci` (clean install after releasing locked preview ports)
- lint
- unit/domain/integrity suite (55 tests)
- production build
- lifecycle Playwright E2E (5)
- offline Playwright E2E (1)

Node: v24.16.0

## Remaining risks

- Binary attachments remain deferred (`docs/DEFERRED.md`) — intentional for v2.
- Decisions library uses 100-row windowing; full virtualizers optional if measured pain appears.
- `verify:v2` frees Vite/preview ports, retries corrupted `npm ci`, warms Vitest module cache, and retries the unit suite once on Windows cold-start flake.
- Screenshot capture kills the preview process tree and exits cleanly (`npm run screenshots`).
- Lineage to deleted targets leaves dangling ids (fail-visible, not silent rewrite).
