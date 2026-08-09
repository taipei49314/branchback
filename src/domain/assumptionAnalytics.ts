import type { Assumption, AssumptionStatus, Decision } from './types'
import {
  listHistoricalAssumptionTargets,
  resolveAssumptionStatus,
} from './historicalIdentity'

export interface AssumptionPattern {
  normalizedStatement: string
  occurrences: number
  failedCount: number
  heldCount: number
  decisionIds: string[]
  highConfidenceFailures: number
}

function normalizeStatement(statement: string): string {
  return statement.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Assumption analytics:
 * - Registry propositions (commit + revisions + working), deduped by fingerprint
 * - Status via latest-evaluation-wins across priorReviews + review
 * - High-confidence failures use that proposition's own confidence
 */
export function analyzeAssumptions(decisions: Decision[]): {
  failureRate: number | null
  totalAssumptions: number
  failedAssumptions: number
  mostFrequentFailures: AssumptionPattern[]
  highConfidenceFailures: Array<{
    statement: string
    confidence: number
    decisionId: string
    decisionTitle: string
    confidenceSource: 'commit' | 'working' | 'revision'
    fingerprintMatched: boolean
  }>
  reusedAcrossDecisions: AssumptionPattern[]
  skippedAmbiguous: number
} {
  const byKey = new Map<string, AssumptionPattern>()
  let total = 0
  let failed = 0
  const skippedAmbiguous = 0
  const highConfidenceFailures: Array<{
    statement: string
    confidence: number
    decisionId: string
    decisionTitle: string
    confidenceSource: 'commit' | 'working' | 'revision'
    fingerprintMatched: boolean
  }> = []

  for (const d of decisions) {
    if (!d.commitSnapshot && !d.assumptions.length) continue
    const targets = listHistoricalAssumptionTargets(d)
    for (const t of targets) {
      total += 1
      const key = normalizeStatement(t.proposition.statement)
      const existing = byKey.get(key) ?? {
        normalizedStatement: key,
        occurrences: 0,
        failedCount: 0,
        heldCount: 0,
        decisionIds: [],
        highConfidenceFailures: 0,
      }
      existing.occurrences += 1
      if (!existing.decisionIds.includes(d.id)) {
        existing.decisionIds.push(d.id)
      }
      const status = resolveAssumptionStatus(
        d,
        t.assumptionId,
        t.fingerprint,
      )
      if (status === 'FAILED') {
        failed += 1
        existing.failedCount += 1
        if (t.proposition.confidence >= 70) {
          existing.highConfidenceFailures += 1
          highConfidenceFailures.push({
            statement: t.proposition.statement,
            confidence: t.proposition.confidence,
            decisionId: d.id,
            decisionTitle: d.title,
            confidenceSource:
              t.provenance === 'at-commit' ||
              t.provenance === 'removed-from-working'
                ? 'commit'
                : t.provenance === 'added-later'
                  ? 'working'
                  : 'revision',
            fingerprintMatched: true,
          })
        }
      } else if (status === 'HELD') {
        existing.heldCount += 1
      }
      byKey.set(key, existing)
    }
  }

  const patterns = [...byKey.values()]
  return {
    failureRate: total === 0 ? null : failed / total,
    totalAssumptions: total,
    failedAssumptions: failed,
    mostFrequentFailures: patterns
      .filter((p) => p.failedCount > 0)
      .sort(
        (a, b) =>
          b.failedCount - a.failedCount || b.occurrences - a.occurrences,
      ),
    highConfidenceFailures: highConfidenceFailures.sort(
      (a, b) => b.confidence - a.confidence,
    ),
    reusedAcrossDecisions: patterns
      .filter((p) => p.decisionIds.length >= 2)
      .sort((a, b) => b.decisionIds.length - a.decisionIds.length),
    skippedAmbiguous,
  }
}

export function listFailedAssumptions(decisions: Decision[]): Array<{
  assumption: Assumption
  decisionId: string
  decisionTitle: string
  beliefConfidence: number
  status: AssumptionStatus
}> {
  const out: Array<{
    assumption: Assumption
    decisionId: string
    decisionTitle: string
    beliefConfidence: number
    status: AssumptionStatus
  }> = []
  for (const d of decisions) {
    for (const t of listHistoricalAssumptionTargets(d)) {
      const status = resolveAssumptionStatus(
        d,
        t.assumptionId,
        t.fingerprint,
      )
      if (status === 'FAILED') {
        out.push({
          assumption: t.proposition,
          decisionId: d.id,
          decisionTitle: d.title,
          beliefConfidence: t.proposition.confidence,
          status,
        })
      }
    }
  }
  return out
}
