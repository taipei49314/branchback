# Expedition plan (internal) — BranchBack v1 → v2

## Chosen scope (v2.0.0)

Ship a coherent “accumulated history” layer:

1. **Decision lineage** — lightweight typed links (follows-from, revisits, supersedes, related-to) with createdAt notes; no graph DB.
2. **Assumption families** — explicit user-confirmed family labels; never silent merge.
3. **Decision dossiers** — rich Markdown + print view preserving temporal layers.
4. **History explorer** — navigable commit → revisions → reviews with comparisons.
5. **History search** — search across layers with provenance in results.
6. **Scale harness** — deterministic synthetic N=100/500 generators for tests (not default demo).
7. **Learning surfaces** — Insights: drift, revision intensity, unresolved propositions, lineage counts.
8. **Durability** — schema 4 migration; unknown future schema fail-closed; backup health summary.

## Deliberately deferred

- Binary attachments / blob evidence (IndexedDB quota + backup complexity)
- Heavy decision-protocol template marketplace
- Auto-semantic assumption merging
- Causality claims / life scores

## North Star gate

Every feature must preserve Known Then vs Known Now and fingerprint truth.
