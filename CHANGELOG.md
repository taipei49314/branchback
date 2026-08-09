# Changelog

## 2.0.0 — Accumulated-history GitHub release

### Historical integrity (closure)
- Relation and evidence records are append + tombstone (`removedAt`); ordinary writes cannot silently erase accepted history
- Evidence UI/dossier distinguish claimed availability vs BranchBack recorded-at
- History explorer includes lineage/evidence assertion events
- Backup health: Healthy / Warning / Invalid / Unsupported; preview agrees with importability
- Schema version **5** (migrates 1–4)

### Product (v2 layer)
- Decision lineage, assumption families, dossiers, history explorer/search
- Capture protocols, text/URL/quote evidence
- Insights learning surfaces; scale harness 100/500 (1000 optional)
- Windows-hardened `verify:v2`; v2 browser E2E workflows

## 1.0.0 — First stable release

### Historical truth
- Historical Proposition Registry; fingerprint-bound evaluations
- Latest-evaluation-wins across priorReviews + current review
- Node ≥24; `npm ci` verify

## 0.8.0-rc / 0.5.0-beta / 0.2.0-alpha / 0.1.x
- Earlier milestones — see git history
