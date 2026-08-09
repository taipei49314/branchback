# Historical model (M0.3)

## Persistence authority

Ordinary application code has exactly one normal write authority:

`DecisionRepository` (`src/storage/repository.ts`)

- Application / pages / components / demo import `@/storage` or `@/storage/repository` only.
- `src/storage/db.ts` is internal; only the repository (and test teardown) may import it.
- Public barrel does not export `getDb` or raw put/clear primitives.
- Product history erasure requires `confirmEraseExistingHistory: true`.
- `src/storage/testing.ts` resets IndexedDB for tests only — not a product API.

## Append-only historical structures

| Structure | Rule |
|-----------|------|
| `commitSnapshot` | Immutable once set |
| `revisions[]` | Prefix-stable append-only |
| `priorReviews` + current `review` | Prior review records cannot be dropped/altered |

## Revision-tracked working fields

When these change after commit, persistence requires **exactly one** newly appended revision whose tracked payload equals the **previously persisted** working state:

- title, description, context
- options, assumptions, predictions
- selectedOptionId, decisionDate, reviewDate

### Not revision-tracked

- `status` (derived / archival)
- `updatedAt`, `createdAt`, `id`
- `commitSnapshot` (separate immutability rule)
- `review` / `priorReviews` (separate review-history rule)
- `protocolId` (capture guidance only)
- `relations[]` / `evidence[]` identity fields after acceptance (append + tombstone only; ordinary removal sets `removedAt`)

Schema version **5** adds tombstones (`removedAt`) on relations and evidence.
Older backups migrate on read. Unknown future schemas are rejected (fail closed).

## Revision authenticity

A fabricated revision that claims the wrong prior state is rejected (`REVISION_INAUTHENTIC`).

Multiple newly appended revisions in one write are rejected (`REVISION_CHAIN_AMBIGUOUS`).

## Review-driven mutations

Recording a review:

1. Previous `review` (if any) moves into `priorReviews` (immutable review history).
2. If the review applies assumption statuses or prediction evaluations to the working copy, **one** revision is appended first capturing the prior working state, then the working copy is updated.

Thus working-copy evaluation changes remain reconstructable from revisions; the review record itself is the temporal judgment artifact (outcome vs decision quality, memory drift, etc.).
