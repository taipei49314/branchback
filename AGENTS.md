# Agent notes (BranchBack)

## Goal

Local-first decision replay laboratory. Preserve belief-at-the-time vs knowledge-now.

## Current release

**v2.0.0** — accumulated-history layer on the v1 integrity baseline.

Protected contracts (do not weaken):

- Immutable Known Then (`commitSnapshot`)
- Authentic append-only `revisions[]` + review history
- Single ordinary persistence authority: `DecisionRepository`
- Atomic historical write checks + stale writer protection
- Explicit destructive operations
- CalendarDay semantics
- Historical proposition registry + fingerprints
- Fabricated evaluation rejection
- Complete review-history resolution / fingerprint-true analytics
- Offline core / local-first / deterministic analytics
- **v2:** relation & evidence tombstones — ordinary writes cannot silently erase accepted lineage/evidence records
- **v2:** evidence claimed availability ≠ BranchBack recorded-at provenance

## Commands

```bash
npm ci
npm test
npm run build
npm run dev
npm run test:e2e
npm run test:e2e:offline
npm run verify:v2
npm run screenshots
```

## Non-goals

- LLMs / AI recommendations
- Auth, cloud sync, collaboration
- Backend services
- Binary attachment storage
- Life scores / causality claims

## Autonomy

Own implementation details inside `NORTH_STAR.md`. Ask only when a choice would change the product mission.
