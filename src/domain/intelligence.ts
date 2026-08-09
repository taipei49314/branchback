import type { Decision, Rating } from './types'

export type OutcomeQuadrant =
  | 'good-decision-good-outcome'
  | 'good-decision-bad-outcome'
  | 'weak-decision-good-outcome'
  | 'weak-decision-bad-outcome'

export interface QuadrantBucket {
  id: OutcomeQuadrant
  label: string
  description: string
  sampleSize: number
  decisions: Array<{ id: string; title: string; decisionQ: Rating; outcomeQ: Rating }>
}

function isGood(rating: Rating): boolean {
  return rating >= 4
}

export function computeOutcomeMatrix(decisions: Decision[]): QuadrantBucket[] {
  const reviewed = decisions.filter((d) => d.review)
  const buckets: Record<OutcomeQuadrant, QuadrantBucket> = {
    'good-decision-good-outcome': {
      id: 'good-decision-good-outcome',
      label: 'Good decision · Good outcome',
      description: 'Reasonable process and favorable result — association only, not proof of causality.',
      sampleSize: 0,
      decisions: [],
    },
    'good-decision-bad-outcome': {
      id: 'good-decision-bad-outcome',
      label: 'Good decision · Bad outcome',
      description: 'Process looked sound; result disappointed. Outcome ≠ decision quality.',
      sampleSize: 0,
      decisions: [],
    },
    'weak-decision-good-outcome': {
      id: 'weak-decision-good-outcome',
      label: 'Weak decision · Good outcome',
      description: 'Favorable result despite weaker process — luck is possible.',
      sampleSize: 0,
      decisions: [],
    },
    'weak-decision-bad-outcome': {
      id: 'weak-decision-bad-outcome',
      label: 'Weak decision · Bad outcome',
      description: 'Weaker process and disappointing result — still not a moral score.',
      sampleSize: 0,
      decisions: [],
    },
  }

  for (const d of reviewed) {
    const dq = d.review!.decisionQualityRating
    const oq = d.review!.outcomeRating
    const id: OutcomeQuadrant =
      isGood(dq) && isGood(oq)
        ? 'good-decision-good-outcome'
        : isGood(dq) && !isGood(oq)
          ? 'good-decision-bad-outcome'
          : !isGood(dq) && isGood(oq)
            ? 'weak-decision-good-outcome'
            : 'weak-decision-bad-outcome'
    buckets[id].sampleSize += 1
    buckets[id].decisions.push({
      id: d.id,
      title: d.title,
      decisionQ: dq,
      outcomeQ: oq,
    })
  }

  return Object.values(buckets)
}

export interface DecisionCompareRow {
  id: string
  title: string
  meanPredictionConfidence: number | null
  assumptionCount: number
  predictionCount: number
  outcomeQuality: number | null
  decisionQuality: number | null
  daysToReview: number | null
  revisionCount: number
  status: string
}

function daysBetween(isoA: string, isoB: string): number | null {
  const a = Date.parse(isoA)
  const b = Date.parse(isoB)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

export function buildDecisionCompareRows(
  decisions: Decision[],
  ids: string[],
): DecisionCompareRow[] {
  return ids
    .map((id) => decisions.find((d) => d.id === id))
    .filter((d): d is Decision => Boolean(d))
    .map((d) => {
      const confs = d.commitSnapshot?.predictions.map((p) => p.confidence) ?? []
      return {
        id: d.id,
        title: d.title,
        meanPredictionConfidence:
          confs.length === 0
            ? null
            : confs.reduce((s, c) => s + c, 0) / confs.length,
        assumptionCount: d.assumptions.length,
        predictionCount: d.predictions.length,
        outcomeQuality: d.review?.outcomeRating ?? null,
        decisionQuality: d.review?.decisionQualityRating ?? null,
        daysToReview:
          d.commitSnapshot && d.review
            ? daysBetween(d.commitSnapshot.committedAt, d.review.reviewedAt)
            : null,
        revisionCount: d.revisions.length,
        status: d.status,
      }
    })
}
