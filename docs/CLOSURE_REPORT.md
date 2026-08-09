# Closure report — BranchBack GitHub release

## Recommended version

**v2.0.0** (schema 5) — coherent accumulated-history layer with integrity closure.

## Major fixes

- Relation/evidence historical integrity via tombstones + persistence checks
- Evidence claimed-availability vs recorded-at provenance in UI/dossier/explorer
- Backup health statuses aligned with importability
- v2 E2E workflows; scale 500 in default test gate
- AGENTS / VERIFICATION / docs hygiene

## Self-discovered issues

- Ordinary `remove*` previously erased lineage/evidence existence (fixed with `removedAt`)
- Backup preview could look “OK” while migration/invariants would fail (fixed with migrate+assert + status enum)
- Vitest worker cold-start after `npm ci` on Windows (verify warmup/retry already in place)

## Verification

`npm run verify:v2` → `failedSteps: 0` (2026-08-09T12:26:16.864Z).

Artifacts: `verification/v2.0/summary.json`, step logs, `VERIFICATION.md`.

## Deferred non-blockers

See `docs/DEFERRED.md` (binary attachments, auto-merge, 1000-scale optional, full virtual scroller).
