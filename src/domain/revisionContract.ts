import type {
  Assumption,
  Decision,
  DecisionContext,
  DecisionRevision,
  Option,
  Prediction,
} from './types'
import { DomainError } from './errors'
import { canonicalJson } from './canonical'

/**
 * Post-commit working fields that require truthful revision history when changed.
 *
 * NOT revision-tracked (may change without a new revision):
 * - status (derived / archival flag)
 * - updatedAt / createdAt
 * - id
 * - commitSnapshot (immutable; separate integrity rule)
 * - review / priorReviews (separate review-history integrity)
 */
export interface RevisionTrackedState {
  title: string
  description: string
  context: DecisionContext
  options: Option[]
  assumptions: Assumption[]
  predictions: Prediction[]
  selectedOptionId: string | null
  decisionDate: string | null
  reviewDate: string | null
}

export function extractRevisionTrackedState(
  decision: Pick<
    Decision,
    | 'title'
    | 'description'
    | 'context'
    | 'options'
    | 'assumptions'
    | 'predictions'
    | 'selectedOptionId'
    | 'decisionDate'
    | 'reviewDate'
  >,
): RevisionTrackedState {
  return {
    title: decision.title,
    description: decision.description,
    context: decision.context,
    options: decision.options,
    assumptions: decision.assumptions,
    predictions: decision.predictions,
    selectedOptionId: decision.selectedOptionId,
    decisionDate: decision.decisionDate,
    reviewDate: decision.reviewDate,
  }
}

export function extractRevisionTrackedStateFromRevision(
  revision: DecisionRevision,
): RevisionTrackedState {
  return {
    title: revision.title,
    description: revision.description,
    context: revision.context,
    options: revision.options,
    assumptions: revision.assumptions,
    predictions: revision.predictions,
    selectedOptionId: revision.selectedOptionId,
    decisionDate: revision.decisionDate ?? null,
    reviewDate: revision.reviewDate,
  }
}

export function revisionTrackedStatesEqual(
  a: RevisionTrackedState,
  b: RevisionTrackedState,
): boolean {
  return canonicalJson(a) === canonicalJson(b)
}

/**
 * After commit, any change to revision-tracked working state must append
 * exactly one new revision whose tracked payload equals the previously
 * persisted working state (authentic prior-state capture).
 *
 * Multiple newly appended revisions in one write are rejected as ambiguous.
 */
export function assertPostCommitRevisionCompleteness(
  existing: Decision,
  incoming: Decision,
): void {
  if (!existing.commitSnapshot) {
    return
  }

  const prev = extractRevisionTrackedState(existing)
  const next = extractRevisionTrackedState(incoming)
  const trackedChanged = !revisionTrackedStatesEqual(prev, next)

  const prevLen = existing.revisions.length
  const nextLen = incoming.revisions.length
  const newlyAppended = nextLen - prevLen

  if (!trackedChanged) {
    if (newlyAppended > 0) {
      // Harmless extra empty-history noise is still ambiguous — reject.
      throw new DomainError(
        'REVISION_UNNECESSARY',
        'Cannot append revisions when revision-tracked working state did not change.',
      )
    }
    return
  }

  if (newlyAppended < 1) {
    throw new DomainError(
      'REVISION_REQUIRED',
      'Post-commit changes to revision-tracked fields require an authentic revision capturing the previous state.',
    )
  }

  if (newlyAppended > 1) {
    throw new DomainError(
      'REVISION_CHAIN_AMBIGUOUS',
      'A single persistence write may append at most one revision. Multiple new revisions are unverifiable.',
    )
  }

  const appended = incoming.revisions[prevLen]!
  const claimedPrior = extractRevisionTrackedStateFromRevision(appended)
  if (!revisionTrackedStatesEqual(claimedPrior, prev)) {
    throw new DomainError(
      'REVISION_INAUTHENTIC',
      'Newly appended revision does not faithfully capture the previously persisted working state.',
    )
  }
}
