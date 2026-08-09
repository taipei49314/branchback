import type { Decision, Prediction } from './types'
import {
  isBeforeCalendarDay,
  isOnOrBeforeCalendarDay,
  isSameCalendarDay,
} from './dates'

export type PredictionTemporalState =
  | 'awaiting'
  | 'due'
  | 'overdue'
  | 'evaluated'

export function predictionTemporalState(
  prediction: Prediction,
  asOf: Date = new Date(),
): PredictionTemporalState {
  if (prediction.evaluation !== null) return 'evaluated'
  const day = prediction.expectedDate
  if (isSameCalendarDay(day, asOf) || isOnOrBeforeCalendarDay(day, asOf)) {
    if (isBeforeCalendarDay(day, asOf)) return 'overdue'
    return 'due'
  }
  return 'awaiting'
}

export function listAttentionPredictions(
  decisions: Decision[],
  asOf: Date = new Date(),
): Array<{
  decision: Decision
  prediction: Prediction
  state: PredictionTemporalState
}> {
  const out: Array<{
    decision: Decision
    prediction: Prediction
    state: PredictionTemporalState
  }> = []
  for (const d of decisions) {
    if (!d.commitSnapshot) continue
    for (const p of d.predictions) {
      const state = predictionTemporalState(p, asOf)
      if (state === 'due' || state === 'overdue' || state === 'awaiting') {
        out.push({ decision: d, prediction: p, state })
      }
    }
  }
  return out.sort((a, b) =>
    a.prediction.expectedDate.localeCompare(b.prediction.expectedDate),
  )
}

/** @deprecated use listAttentionPredictions — kept for call-site clarity */
export function listDuePredictions(
  decisions: Decision[],
  asOf: Date = new Date(),
) {
  return listAttentionPredictions(decisions, asOf)
}

export function predictionStateLabel(state: PredictionTemporalState): string {
  switch (state) {
    case 'awaiting':
      return 'Awaiting outcome'
    case 'due':
      return 'Due today'
    case 'overdue':
      return 'Overdue — unevaluated'
    case 'evaluated':
      return 'Evaluated'
  }
}
