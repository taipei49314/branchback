import { DomainError } from './errors'
import type {
  Assumption,
  AssumptionStatus,
  Decision,
  Prediction,
  PredictionEvaluation,
  ReviewRecord,
} from './types'
import { canonicalJson } from './canonical'

export type PropositionProvenance =
  | 'at-commit'
  | 'added-later'
  | 'revised-later'
  | 'removed-from-working'

/** Semantic fingerprint — id and later evaluation/status are excluded. */
export function predictionFingerprint(
  prediction: Pick<
    Prediction,
    | 'statement'
    | 'expectedResult'
    | 'expectedDate'
    | 'confidence'
    | 'evaluationCriteria'
  >,
): string {
  return canonicalJson({
    statement: prediction.statement,
    expectedResult: prediction.expectedResult,
    expectedDate: prediction.expectedDate,
    confidence: prediction.confidence,
    evaluationCriteria: prediction.evaluationCriteria,
  })
}

export function assumptionFingerprint(
  assumption: Pick<
    Assumption,
    'statement' | 'confidence' | 'importance' | 'falsificationCondition'
  >,
): string {
  return canonicalJson({
    statement: assumption.statement,
    confidence: assumption.confidence,
    importance: assumption.importance,
    falsificationCondition: assumption.falsificationCondition,
  })
}

export interface HistoricalPredictionTarget {
  key: string
  predictionId: string
  fingerprint: string
  provenance: PropositionProvenance
  proposition: Prediction
  label: string
  /** Stable temporal order: commit → revisions → working */
  sequence: number
  firstSeenAt: string
  inWorkingState: boolean
}

export interface HistoricalAssumptionTarget {
  key: string
  assumptionId: string
  fingerprint: string
  provenance: PropositionProvenance
  proposition: Assumption
  label: string
  sequence: number
  firstSeenAt: string
  inWorkingState: boolean
}

type PredDraft = {
  key: string
  predictionId: string
  fingerprint: string
  proposition: Prediction
  sequence: number
  firstSeenAt: string
  seenInCommit: boolean
  seenInRevision: boolean
  seenInWorking: boolean
  idExistedAtCommit: boolean
}

type AsmDraft = {
  key: string
  assumptionId: string
  fingerprint: string
  proposition: Assumption
  sequence: number
  firstSeenAt: string
  seenInCommit: boolean
  seenInRevision: boolean
  seenInWorking: boolean
  idExistedAtCommit: boolean
}

function classifyPredictionDraft(d: PredDraft): {
  provenance: PropositionProvenance
  label: string
} {
  if (d.seenInCommit) {
    if (d.seenInWorking) {
      return { provenance: 'at-commit', label: 'At commit' }
    }
    return {
      provenance: 'removed-from-working',
      label: 'At commit · removed from working state',
    }
  }
  if (d.idExistedAtCommit) {
    return {
      provenance: 'revised-later',
      label: d.seenInWorking
        ? 'Revised later'
        : 'Revised later · not in working state',
    }
  }
  if (d.seenInWorking) {
    return { provenance: 'added-later', label: 'Added later' }
  }
  return {
    provenance: 'revised-later',
    label: 'Revised later · not in working state',
  }
}

/**
 * Historical Proposition Registry for predictions.
 * Reconstructs every distinct (id, fingerprint) from commitSnapshot → revisions[] → working.
 */
export function listHistoricalPredictionTargets(
  decision: Decision,
): HistoricalPredictionTarget[] {
  const snap = decision.commitSnapshot
  const commitIds = new Set(snap?.predictions.map((p) => p.id) ?? [])
  const byKey = new Map<string, PredDraft>()
  let seq = 0

  const consider = (
    prediction: Prediction,
    at: string,
    where: 'commit' | 'revision' | 'working',
  ) => {
    const fingerprint = predictionFingerprint(prediction)
    const key = `${prediction.id}:${fingerprint}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        key,
        predictionId: prediction.id,
        fingerprint,
        proposition: { ...prediction, evaluation: null },
        sequence: seq++,
        firstSeenAt: at,
        seenInCommit: where === 'commit',
        seenInRevision: where === 'revision',
        seenInWorking: where === 'working',
        idExistedAtCommit: commitIds.has(prediction.id),
      })
    } else {
      if (where === 'commit') existing.seenInCommit = true
      if (where === 'revision') existing.seenInRevision = true
      if (where === 'working') {
        existing.seenInWorking = true
        existing.proposition = {
          ...prediction,
          evaluation: prediction.evaluation,
        }
      }
      if (commitIds.has(prediction.id)) existing.idExistedAtCommit = true
    }
  }

  if (snap) {
    for (const p of snap.predictions) {
      consider(p, snap.committedAt, 'commit')
    }
  }
  for (const rev of decision.revisions) {
    for (const p of rev.predictions) {
      consider(p, rev.createdAt, 'revision')
    }
  }
  for (const p of decision.predictions) {
    consider(p, decision.updatedAt, 'working')
  }

  // Mark commit identity: if fingerprint equals commit prediction for same id
  if (snap) {
    for (const draft of byKey.values()) {
      const commitPred = snap.predictions.find((p) => p.id === draft.predictionId)
      if (
        commitPred &&
        predictionFingerprint(commitPred) === draft.fingerprint
      ) {
        draft.seenInCommit = true
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => a.sequence - b.sequence)
    .map((d) => {
      const { provenance, label } = classifyPredictionDraft(d)
      return {
        key: d.key,
        predictionId: d.predictionId,
        fingerprint: d.fingerprint,
        provenance,
        proposition: d.proposition,
        label,
        sequence: d.sequence,
        firstSeenAt: d.firstSeenAt,
        inWorkingState: d.seenInWorking,
      }
    })
}

export function listHistoricalAssumptionTargets(
  decision: Decision,
): HistoricalAssumptionTarget[] {
  const snap = decision.commitSnapshot
  const commitIds = new Set(snap?.assumptions.map((a) => a.id) ?? [])
  const byKey = new Map<string, AsmDraft>()
  let seq = 0

  const consider = (
    assumption: Assumption,
    at: string,
    where: 'commit' | 'revision' | 'working',
  ) => {
    const fingerprint = assumptionFingerprint(assumption)
    const key = `${assumption.id}:${fingerprint}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        key,
        assumptionId: assumption.id,
        fingerprint,
        proposition: { ...assumption, status: 'UNKNOWN' },
        sequence: seq++,
        firstSeenAt: at,
        seenInCommit: where === 'commit',
        seenInRevision: where === 'revision',
        seenInWorking: where === 'working',
        idExistedAtCommit: commitIds.has(assumption.id),
      })
    } else {
      if (where === 'commit') existing.seenInCommit = true
      if (where === 'revision') existing.seenInRevision = true
      if (where === 'working') {
        existing.seenInWorking = true
        existing.proposition = { ...assumption }
      }
      if (commitIds.has(assumption.id)) existing.idExistedAtCommit = true
    }
  }

  if (snap) {
    for (const a of snap.assumptions) {
      consider(a, snap.committedAt, 'commit')
    }
  }
  for (const rev of decision.revisions) {
    for (const a of rev.assumptions) {
      consider(a, rev.createdAt, 'revision')
    }
  }
  for (const a of decision.assumptions) {
    consider(a, decision.updatedAt, 'working')
  }

  if (snap) {
    for (const draft of byKey.values()) {
      const commitAsm = snap.assumptions.find((a) => a.id === draft.assumptionId)
      if (
        commitAsm &&
        assumptionFingerprint(commitAsm) === draft.fingerprint
      ) {
        draft.seenInCommit = true
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => a.sequence - b.sequence)
    .map((d) => {
      let provenance: PropositionProvenance
      let label: string
      if (d.seenInCommit) {
        provenance = d.seenInWorking ? 'at-commit' : 'removed-from-working'
        label = d.seenInWorking
          ? 'At commit'
          : 'At commit · removed from working state'
      } else if (d.idExistedAtCommit) {
        provenance = 'revised-later'
        label = d.seenInWorking
          ? 'Revised later'
          : 'Revised later · not in working state'
      } else if (d.seenInWorking) {
        provenance = 'added-later'
        label = 'Added later'
      } else {
        provenance = 'revised-later'
        label = 'Revised later · not in working state'
      }
      return {
        key: d.key,
        assumptionId: d.assumptionId,
        fingerprint: d.fingerprint,
        provenance,
        proposition: d.proposition,
        label,
        sequence: d.sequence,
        firstSeenAt: d.firstSeenAt,
        inWorkingState: d.seenInWorking,
      }
    })
}

export function provenanceLabel(p: PropositionProvenance): string {
  switch (p) {
    case 'at-commit':
      return 'At commit'
    case 'added-later':
      return 'Added later'
    case 'revised-later':
      return 'Revised later'
    case 'removed-from-working':
      return 'Removed from working state'
  }
}

/** Ordered review history: priorReviews (oldest→newest) then current review. */
export function orderedReviewHistory(decision: Decision): ReviewRecord[] {
  const prior = decision.priorReviews ?? []
  return decision.review ? [...prior, decision.review] : [...prior]
}

/**
 * Latest-evaluation-wins across the complete ordered review history.
 * Documented in docs/HISTORICAL_ANALYTICS.md
 */
export function resolvePredictionEvaluation(
  decision: Decision,
  predictionId: string,
  fingerprint: string,
): PredictionEvaluation | null {
  const history = orderedReviewHistory(decision)
  for (let i = history.length - 1; i >= 0; i--) {
    const review = history[i]!
    const bound = review.predictionEvaluations.find(
      (e) =>
        e.predictionId === predictionId &&
        e.fingerprint === fingerprint &&
        e.evaluation !== 'UNKNOWN',
    )
    if (bound) return bound.evaluation

    // Legacy id-only: only if this fingerprint is the sole historical version for that id
    const legacy = review.predictionEvaluations.find(
      (e) =>
        e.predictionId === predictionId &&
        (!e.fingerprint || e.fingerprint === '') &&
        e.evaluation !== 'UNKNOWN',
    )
    if (legacy) {
      const versions = listHistoricalPredictionTargets(decision).filter(
        (t) => t.predictionId === predictionId,
      )
      if (versions.length === 1 && versions[0]!.fingerprint === fingerprint) {
        return legacy.evaluation
      }
    }
  }

  const working = decision.predictions.find((p) => p.id === predictionId)
  if (
    working &&
    predictionFingerprint(working) === fingerprint &&
    working.evaluation &&
    working.evaluation !== 'UNKNOWN'
  ) {
    return working.evaluation
  }
  return null
}

export function resolveAssumptionStatus(
  decision: Decision,
  assumptionId: string,
  fingerprint: string,
): AssumptionStatus | null {
  const history = orderedReviewHistory(decision)
  for (let i = history.length - 1; i >= 0; i--) {
    const review = history[i]!
    const bound = review.assumptionStatuses.find(
      (s) =>
        s.assumptionId === assumptionId && s.fingerprint === fingerprint,
    )
    if (bound) return bound.status

    const legacy = review.assumptionStatuses.find(
      (s) =>
        s.assumptionId === assumptionId &&
        (!s.fingerprint || s.fingerprint === ''),
    )
    if (legacy) {
      const versions = listHistoricalAssumptionTargets(decision).filter(
        (t) => t.assumptionId === assumptionId,
      )
      if (versions.length === 1 && versions[0]!.fingerprint === fingerprint) {
        return legacy.status
      }
    }
  }

  const working = decision.assumptions.find((a) => a.id === assumptionId)
  if (working && assumptionFingerprint(working) === fingerprint) {
    return working.status
  }
  return null
}

/** @deprecated use resolvePredictionEvaluation with explicit fingerprint */
export function resolveCommitPredictionEvaluation(
  decision: Decision,
  commitPrediction: Prediction,
): PredictionEvaluation | null {
  return resolvePredictionEvaluation(
    decision,
    commitPrediction.id,
    predictionFingerprint(commitPrediction),
  )
}

/** @deprecated use resolveAssumptionStatus with explicit fingerprint */
export function resolveCommitAssumptionStatus(
  decision: Decision,
  commitAssumption: Assumption,
): AssumptionStatus | null {
  return resolveAssumptionStatus(
    decision,
    commitAssumption.id,
    assumptionFingerprint(commitAssumption),
  )
}

export function assertEvaluationsTargetKnownPropositions(
  decision: Decision,
  predictionEvaluations: Array<{ predictionId: string; fingerprint: string }>,
  assumptionStatuses: Array<{ assumptionId: string; fingerprint: string }>,
): void {
  const predKeys = new Set(
    listHistoricalPredictionTargets(decision).map((t) => t.key),
  )
  const asmKeys = new Set(
    listHistoricalAssumptionTargets(decision).map((t) => t.key),
  )
  for (const e of predictionEvaluations) {
    const key = `${e.predictionId}:${e.fingerprint}`
    if (!predKeys.has(key)) {
      throw new DomainError(
        'EVALUATION_UNKNOWN_PROPOSITION',
        `Prediction evaluation does not target a known historical proposition (${e.predictionId}).`,
      )
    }
  }
  for (const s of assumptionStatuses) {
    const key = `${s.assumptionId}:${s.fingerprint}`
    if (!asmKeys.has(key)) {
      throw new DomainError(
        'EVALUATION_UNKNOWN_PROPOSITION',
        `Assumption evaluation does not target a known historical proposition (${s.assumptionId}).`,
      )
    }
  }
}
