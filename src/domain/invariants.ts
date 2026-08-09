import type { Decision } from './types'
import { DomainError } from './errors'
import { snapshotsEqual } from './integrity'

export interface InvariantResult {
  ok: boolean
  violations: string[]
}

/** Deterministic checks that protect BranchBack's anti-hindsight contract. */
export function checkDecisionInvariants(decision: Decision): InvariantResult {
  const violations: string[] = []

  if (!decision.title.trim()) {
    violations.push('Decision title is empty.')
  }

  if (decision.commitSnapshot) {
    if (decision.options.length < 2) {
      violations.push('Committed decision must retain at least two options.')
    }
    if (
      !decision.commitSnapshot.options.some(
        (o) => o.id === decision.commitSnapshot!.selectedOptionId,
      )
    ) {
      violations.push(
        'Commit snapshot selected option is missing from snapshot options.',
      )
    }
    if (decision.commitSnapshot.options.length < 2) {
      violations.push('Commit snapshot itself must contain at least two options.')
    }
  }

  if (decision.status === 'DECIDED' || decision.status === 'REVIEW_DUE') {
    if (!decision.commitSnapshot) {
      violations.push('DECIDED/REVIEW_DUE requires a commit snapshot.')
    }
  }

  if (decision.status === 'REVIEWED' && !decision.review) {
    violations.push('REVIEWED status requires a review record.')
  }

  if (decision.review) {
    if (
      typeof decision.review.outcomeRating !== 'number' ||
      typeof decision.review.decisionQualityRating !== 'number'
    ) {
      violations.push(
        'Review must keep outcome and decision quality as separate ratings.',
      )
    }
  }

  if (!Array.isArray(decision.priorReviews)) {
    violations.push('priorReviews must be an array.')
  }

  for (const option of decision.options) {
    if (option.estimatedProbability < 0 || option.estimatedProbability > 100) {
      violations.push(`Option ${option.id} probability out of range.`)
    }
  }

  return { ok: violations.length === 0, violations }
}

export function assertInvariants(decision: Decision): void {
  const result = checkDecisionInvariants(decision)
  if (!result.ok) {
    throw new DomainError('INVARIANT', result.violations.join(' '))
  }
}

/** True when a proposed snapshot would change an existing historical snapshot. */
export function wouldOverwriteSnapshot(
  existing: Decision['commitSnapshot'],
  proposed: Decision['commitSnapshot'],
): boolean {
  if (!existing || !proposed) return false
  return !snapshotsEqual(existing, proposed)
}
