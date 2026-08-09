import type { Decision, DecisionStatus } from './types'
import { isOnOrBeforeCalendarDay } from './dates'

/** Recompute status from dates and review presence. Does not invent outcome judgments. */
export function deriveStatus(
  decision: Pick<
    Decision,
    'status' | 'commitSnapshot' | 'reviewDate' | 'review'
  >,
  asOf: Date = new Date(),
): DecisionStatus {
  if (decision.status === 'ARCHIVED') {
    return 'ARCHIVED'
  }
  if (decision.review) {
    return 'REVIEWED'
  }
  if (!decision.commitSnapshot) {
    return 'OPEN'
  }
  if (decision.reviewDate && isOnOrBeforeCalendarDay(decision.reviewDate, asOf)) {
    return 'REVIEW_DUE'
  }
  return 'DECIDED'
}

export function applyDerivedStatus(decision: Decision, asOf?: Date): Decision {
  return {
    ...decision,
    status: deriveStatus(decision, asOf),
  }
}
