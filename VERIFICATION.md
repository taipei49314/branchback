# Verification — BranchBack v2.0.0 (GitHub release candidate)

Evidence lives under `verification/v2.0/` after `npm run verify:v2`.

Last full gate: `failedSteps: 0` at `2026-08-09T12:26:16.864Z` (`summary.json`).

## Environment

- Node.js ≥ 24 (locked dependency tree; see `package.json` engines, `.nvmrc`)
- Install: `npm ci`
- `npm audit`: **0 vulnerabilities** (2026-08-09)

## Matrix

| Step | Command | Expected |
|------|---------|----------|
| Clean install | `npm ci` (via verify:v2) | PASS |
| Lint | `npm run lint` | PASS |
| Unit / integrity / scale 100+500 | `npm test` | PASS (62 passed, 1 skipped = 1000-scale optional) |
| Production build | `npm run build` | PASS |
| Lifecycle + v2 E2E | `npm run test:e2e` | PASS (9 tests) |
| Offline E2E | `npm run test:e2e:offline` | PASS |

## Acceptance matrix (closure)

| Area | Status |
|------|--------|
| v1 Known Then / revision / proposition integrity | PASS |
| Relations cannot silently vanish | PASS |
| Stale writer cannot erase newer relation history | PASS |
| Evidence cannot silently vanish; recorded-at preserved | PASS |
| Available then ≠ recorded then (UI/dossier) | PASS |
| History Explorer includes relation/evidence events | PASS |
| History Search temporal provenance | PASS (E2E) |
| Dossier layers distinguishable | PASS (E2E) |
| Assumption families no auto-merge | PASS |
| Backup Health invalid/unsupported not healthy-for-import | PASS |
| Scale 100 / 500 | PASS |
| Scale 1000 | OPTIONAL (`SCALE_HEAVY=1`) |
| Lifecycle + offline E2E | PASS |
| v2 E2E lineage / evidence / search / dossier | PASS |
| Runtime Node ≥24 / npm ci / lint / build | PASS |
| Screenshots regenerated | PASS (`npm run screenshots`) |

## Scale

- **100** and **500**: default `npm test`
- **1000**: `SCALE_HEAVY=1 npm test`

## Screenshots

`npm run build && npm run screenshots`
