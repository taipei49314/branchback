# Deferred ideas (v2 expedition)

Closed for the v2 wrap-up: intentionally not in scope for this release.

| Idea | Status | Why |
|------|--------|-----|
| Binary attachments / blob evidence | **Deferred (closed)** | IndexedDB quota, backup size, and migration complexity outweigh value; text/URL/quote refs already cover then vs later. Revisit only with a dedicated storage/migration design. |
| Auto-semantic assumption merging | Deferred | Cannot prove sentence identity without LLM/heuristics; would risk silent history rewrite. |
| Heavy protocol / template marketplace | Deferred | Would push BranchBack toward generic forms and advice. |
| Causality claims / life scores | Rejected | Violates North Star. |
| Full graph database for lineage | Rejected | Typed links with recorded-at are enough. |
| Cloud sync / accounts | Rejected | Explicit non-goal. |
| Full virtual-scroll library | Softened | Decisions library now uses windowed “Show more” (100-row pages) for 1000+ lists without a virtualization dependency. True windowing virtualizers remain optional if measured pain appears. |
