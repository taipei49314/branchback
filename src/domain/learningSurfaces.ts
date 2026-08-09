import type { Decision } from './types'
import { summarizeAssumptionFamilies } from './assumptionFamilies'
import { countLibraryRelations } from './lineage'
import {
  listHistoricalAssumptionTargets,
  listHistoricalPredictionTargets,
  resolveAssumptionStatus,
  resolvePredictionEvaluation,
} from './historicalIdentity'

export interface LearningSurfaces {
  sampleSizes: {
    decisions: number
    committed: number
    reviewed: number
    withRevisions: number
    withLineage: number
  }
  qualityTrend: Array<{
    decisionId: string
    title: string
    reviewedAt: string
    decisionQuality: number
    outcomeQuality: number
  }>
  highConfidenceMisses: Array<{
    decisionId: string
    title: string
    statement: string
    confidence: number
    kind: 'assumption' | 'prediction'
  }>
  substantialBeliefChanges: Array<{
    decisionId: string
    title: string
    revisionCount: number
    note: string
  }>
  memoryDriftReviews: Array<{
    decisionId: string
    title: string
    reviewedAt: string
    notes: string
  }>
  unresolvedPropositions: Array<{
    decisionId: string
    title: string
    kind: 'assumption' | 'prediction'
    statement: string
    provenance: string
  }>
  revisionIntensity: {
    meanRevisionsAmongCommitted: number
    maxRevisions: number
    decisionsWithThreePlus: number
  }
  families: ReturnType<typeof summarizeAssumptionFamilies>
  lineage: ReturnType<typeof countLibraryRelations>
}

/**
 * Deterministic learning surfaces for large libraries.
 * Always expose sample sizes; never imply causality or life scores.
 */
export function buildLearningSurfaces(decisions: Decision[]): LearningSurfaces {
  const committed = decisions.filter((d) => d.commitSnapshot)
  const reviewed = decisions.filter((d) => d.review)
  const withRevisions = decisions.filter((d) => d.revisions.length > 0)
  const withLineage = decisions.filter((d) =>
    d.relations.some((r) => !r.removedAt),
  )

  const qualityTrend = reviewed
    .map((d) => ({
      decisionId: d.id,
      title: d.title,
      reviewedAt: d.review!.reviewedAt,
      decisionQuality: d.review!.decisionQualityRating,
      outcomeQuality: d.review!.outcomeRating,
    }))
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))

  const highConfidenceMisses: LearningSurfaces['highConfidenceMisses'] = []
  for (const d of decisions) {
    for (const t of listHistoricalAssumptionTargets(d)) {
      const status = resolveAssumptionStatus(
        d,
        t.assumptionId,
        t.fingerprint,
      )
      if (status === 'FAILED' && t.proposition.confidence >= 70) {
        highConfidenceMisses.push({
          decisionId: d.id,
          title: d.title,
          statement: t.proposition.statement,
          confidence: t.proposition.confidence,
          kind: 'assumption',
        })
      }
    }
    for (const t of listHistoricalPredictionTargets(d)) {
      const evaluation = resolvePredictionEvaluation(
        d,
        t.predictionId,
        t.fingerprint,
      )
      if (
        (evaluation === 'INCORRECT' || evaluation === 'PARTIAL') &&
        t.proposition.confidence >= 70
      ) {
        highConfidenceMisses.push({
          decisionId: d.id,
          title: d.title,
          statement: t.proposition.statement,
          confidence: t.proposition.confidence,
          kind: 'prediction',
        })
      }
    }
  }
  highConfidenceMisses.sort((a, b) => b.confidence - a.confidence)

  const substantialBeliefChanges = withRevisions
    .filter((d) => d.revisions.length >= 2)
    .map((d) => ({
      decisionId: d.id,
      title: d.title,
      revisionCount: d.revisions.length,
      note: d.revisions[d.revisions.length - 1]?.note ?? '',
    }))
    .sort((a, b) => b.revisionCount - a.revisionCount)

  const memoryDriftReviews: LearningSurfaces['memoryDriftReviews'] = []
  for (const d of decisions) {
    const reviews = [...d.priorReviews, ...(d.review ? [d.review] : [])]
    for (const r of reviews) {
      if (r.memoryDriftNotes?.trim()) {
        memoryDriftReviews.push({
          decisionId: d.id,
          title: d.title,
          reviewedAt: r.reviewedAt,
          notes: r.memoryDriftNotes.trim(),
        })
      }
    }
  }

  const unresolvedPropositions: LearningSurfaces['unresolvedPropositions'] = []
  for (const d of reviewed.length ? reviewed : committed) {
    for (const t of listHistoricalAssumptionTargets(d)) {
      if (!resolveAssumptionStatus(d, t.assumptionId, t.fingerprint)) {
        unresolvedPropositions.push({
          decisionId: d.id,
          title: d.title,
          kind: 'assumption',
          statement: t.proposition.statement,
          provenance: t.provenance,
        })
      }
    }
    for (const t of listHistoricalPredictionTargets(d)) {
      if (!resolvePredictionEvaluation(d, t.predictionId, t.fingerprint)) {
        unresolvedPropositions.push({
          decisionId: d.id,
          title: d.title,
          kind: 'prediction',
          statement: t.proposition.statement,
          provenance: t.provenance,
        })
      }
    }
  }

  const revCounts = committed.map((d) => d.revisions.length)
  const meanRevisionsAmongCommitted = revCounts.length
    ? revCounts.reduce((a, b) => a + b, 0) / revCounts.length
    : 0

  return {
    sampleSizes: {
      decisions: decisions.length,
      committed: committed.length,
      reviewed: reviewed.length,
      withRevisions: withRevisions.length,
      withLineage: withLineage.length,
    },
    qualityTrend,
    highConfidenceMisses: highConfidenceMisses.slice(0, 20),
    substantialBeliefChanges: substantialBeliefChanges.slice(0, 20),
    memoryDriftReviews: memoryDriftReviews.slice(0, 20),
    unresolvedPropositions: unresolvedPropositions.slice(0, 30),
    revisionIntensity: {
      meanRevisionsAmongCommitted:
        Math.round(meanRevisionsAmongCommitted * 100) / 100,
      maxRevisions: revCounts.length ? Math.max(...revCounts) : 0,
      decisionsWithThreePlus: revCounts.filter((n) => n >= 3).length,
    },
    families: summarizeAssumptionFamilies(decisions),
    lineage: countLibraryRelations(decisions),
  }
}
