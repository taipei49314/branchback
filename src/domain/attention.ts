import type { Decision } from './types'
import { analyzeAssumptions } from './assumptionAnalytics'
import {
  listAttentionPredictions,
  predictionTemporalState,
} from './predictions'
import { applyDerivedStatus } from './status'

export interface AttentionBoard {
  open: Decision[]
  reviewsDue: Decision[]
  predictionsDue: Array<{
    decision: Decision
    predictionId: string
    predictionStatement: string
    expectedDate: string
    state: 'due' | 'overdue'
  }>
  recentlyReviewed: Decision[]
  highConfidenceFailures: Array<{
    statement: string
    confidence: number
    decisionId: string
    decisionTitle: string
  }>
}

export function buildAttentionBoard(
  decisions: Decision[],
  asOf: Date = new Date(),
): AttentionBoard {
  const live = decisions.map((d) => applyDerivedStatus(d, asOf))
  const open = live.filter((d) => d.status === 'OPEN')
  const reviewsDue = live.filter((d) => d.status === 'REVIEW_DUE')
  const predictionsDue = listAttentionPredictions(live, asOf)
    .filter((x) => x.state === 'due' || x.state === 'overdue')
    .map((x) => ({
      decision: x.decision,
      predictionId: x.prediction.id,
      predictionStatement: x.prediction.statement,
      expectedDate: x.prediction.expectedDate,
      state: x.state as 'due' | 'overdue',
    }))
  const recentlyReviewed = live
    .filter((d) => d.review)
    .sort((a, b) =>
      (b.review?.reviewedAt ?? '').localeCompare(a.review?.reviewedAt ?? ''),
    )
    .slice(0, 8)
  const highConfidenceFailures = analyzeAssumptions(live)
    .highConfidenceFailures.slice(0, 5)
    .map(({ statement, confidence, decisionId, decisionTitle }) => ({
      statement,
      confidence,
      decisionId,
      decisionTitle,
    }))

  return {
    open,
    reviewsDue,
    predictionsDue,
    recentlyReviewed,
    highConfidenceFailures,
  }
}

export function decisionMatchesQuery(
  decision: Decision,
  query: {
    text?: string
    status?: string
    tag?: string
    reviewState?: 'any' | 'reviewed' | 'unreviewed' | 'due'
    fromDate?: string
    toDate?: string
    attention?: 'predictions' | 'assumptions' | 'any'
  },
  asOf: Date = new Date(),
): boolean {
  const live = applyDerivedStatus(decision, asOf)
  if (query.status && live.status !== query.status) return false
  if (query.tag && !live.context.tags.includes(query.tag)) return false
  if (query.reviewState === 'reviewed' && !live.review) return false
  if (query.reviewState === 'unreviewed' && live.review) return false
  if (query.reviewState === 'due' && live.status !== 'REVIEW_DUE') return false

  const anchor = live.commitSnapshot?.committedAt?.slice(0, 10) ??
    live.createdAt.slice(0, 10)
  if (query.fromDate && anchor < query.fromDate) return false
  if (query.toDate && anchor > query.toDate) return false

  if (query.attention === 'predictions') {
    const hit = listAttentionPredictions([live], asOf).some(
      (x) => x.state === 'due' || x.state === 'overdue',
    )
    if (!hit) return false
  }
  if (query.attention === 'assumptions') {
    const hit = live.assumptions.some(
      (a) => a.status === 'FAILED' && a.confidence >= 70,
    )
    if (!hit) return false
  }

  const text = query.text?.trim().toLowerCase()
  if (text) {
    const hay = [
      live.title,
      live.description,
      live.context.situation,
      ...live.context.tags,
      ...live.assumptions.map((a) => a.statement),
      ...live.predictions.map((p) => p.statement),
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(text)) return false
  }
  return true
}

export { predictionTemporalState }
