# Historical analytics policy

BranchBack analytics must not treat later edits as if they were belief-at-commit,
and must not treat an id as proof that the proposition is unchanged.

## Historical Proposition Registry

Every distinct prediction/assumption proposition is reconstructed from:

1. `commitSnapshot`
2. each entry in `revisions[]` (prior working states)
3. current working state

Deduplication key: `(objectId, semanticFingerprint)`.

Semantic fingerprint excludes later evaluation/status fields.

Provenance labels:

| Label | Meaning |
|-------|---------|
| At commit | Exact fingerprint present in the commit snapshot |
| Revised later | Same id existed at commit; this fingerprint appeared afterward |
| Added later | Id never present at commit |
| Removed from working state | Commit fingerprint no longer in working state |

Intermediate revision fingerprints (e.g. June → September → December) remain
historically evaluable even when not in the current working array.

## Evaluation authenticity

`recordReview` requires a non-empty fingerprint **and** that `(id, fingerprint)`
exists in the registry for this Decision. Fabricated pairs are rejected
(`EVALUATION_UNKNOWN_PROPOSITION`).

## Review history resolution

**Rule: latest-evaluation-wins** across the complete ordered history:

`priorReviews` (oldest → newest) then current `review`.

Scanning from newest to oldest, the first fingerprint-matched non-`UNKNOWN`
evaluation is authoritative.

A later review that omits a proposition does **not** erase an earlier valid
fingerprint-bound evaluation.

## Metrics

| Metric | Object | Belief/confidence | Evaluation | If changed/removed |
|--------|--------|-------------------|------------|--------------------|
| Calibration | Each registry prediction proposition | That proposition's confidence | Latest fingerprint match in review history | Scores only that fingerprint |
| High-confidence failed assumptions | Each registry assumption proposition | That proposition's confidence | Latest fingerprint-matched status | Same |
| Assumption reuse | Normalized statement text | N/A | Counts across registry | Discovery only |
| Outcome × decision matrix | Latest review ratings | N/A | Current review | Separate from propositions |

## Calendar days

Date-only fields validate as local `YYYY-MM-DD` at schema/import boundaries.
