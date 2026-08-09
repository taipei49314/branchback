# Known limitations (v2.0.0)

- Offline: service worker caches shell after first online load; Google Fonts may need network (system font fallback).
- Memory Drift uses mechanical text overlap only — not psychological conclusions.
- Latest-evaluation-wins: newer fingerprint-matched evaluation replaces older for the same proposition; omitting a proposition later does not clear an earlier match.
- Legacy empty-fingerprint review rows only resolve when a single historical version exists for that id.
- Assumption families are never inferred from text similarity — only user-confirmed `familyId`.
- Lineage to deleted targets leaves dangling ids (fail-visible).
- Evidence refs are text/URL/quote only — no binary attachments (see `docs/DEFERRED.md`).
- Capture protocols prompt fields only; they never recommend an option.
- Decisions library renders in windows of 100 rows (“Show more”).
- Scale 1000 remains optional (`SCALE_HEAVY=1`); not part of default verify gate.
- Accessibility-focused implementation targeting WCAG 2.2 AA practices — not a certification claim.
- Synthetic scale datasets are for tests only.
- No cloud sync (intentional).
