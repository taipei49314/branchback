import { createId, deepFreeze, nowIso, structuredCloneJson } from './ids'
import { assertDomain, DomainError } from './errors'
import { applyDerivedStatus } from './status'
import { assertInvariants } from './invariants'
import {
  assumptionFingerprint,
  assertEvaluationsTargetKnownPropositions,
  predictionFingerprint,
} from './historicalIdentity'
import type {
  Assumption,
  CommitDecisionInput,
  CommitSnapshot,
  CreateDecisionInput,
  Decision,
  DecisionContext,
  DecisionProtocolId,
  DecisionRelation,
  DecisionRevision,
  EvidenceRef,
  Option,
  Prediction,
  RelationKind,
  ReviewRecord,
} from './types'

function emptyContext(partial?: Partial<DecisionContext>): DecisionContext {
  return {
    situation: partial?.situation ?? '',
    constraints: partial?.constraints ?? '',
    stakes: partial?.stakes ?? '',
    deadline: partial?.deadline ?? null,
    peopleInvolved: partial?.peopleInvolved ?? [],
    tags: partial?.tags ?? [],
  }
}

/** Every public mutation returns a Decision that satisfies domain invariants. */
function finalize(decision: Decision): Decision {
  const next = applyDerivedStatus(decision)
  assertInvariants(next)
  return next
}

export function createDecision(input: CreateDecisionInput): Decision {
  assertDomain(
    input.title.trim().length > 0,
    'TITLE_REQUIRED',
    'A decision needs a title.',
  )
  const stamp = nowIso()
  return finalize({
    id: createId('dec'),
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    createdAt: stamp,
    updatedAt: stamp,
    decisionDate: input.decisionDate ?? null,
    reviewDate: input.reviewDate ?? null,
    status: 'OPEN',
    protocolId: input.protocolId ?? 'general',
    context: emptyContext(input.context),
    options: [],
    assumptions: [],
    predictions: [],
    selectedOptionId: null,
    commitSnapshot: null,
    revisions: [],
    review: null,
    priorReviews: [],
    relations: [],
    evidence: [],
  })
}

export function updateDraftFields(
  decision: Decision,
  patch: {
    title?: string
    description?: string
    context?: Partial<DecisionContext>
    decisionDate?: string | null
    reviewDate?: string | null
    note?: string
  },
): Decision {
  if (decision.commitSnapshot) {
    return reviseAfterCommit(decision, {
      title: patch.title ?? decision.title,
      description: patch.description ?? decision.description,
      context: { ...decision.context, ...patch.context },
      decisionDate: patch.decisionDate ?? decision.decisionDate,
      reviewDate: patch.reviewDate ?? decision.reviewDate,
      note: patch.note ?? 'Edited after commit',
    })
  }

  const next: Decision = {
    ...decision,
    title: patch.title?.trim() || decision.title,
    description:
      patch.description !== undefined
        ? patch.description.trim()
        : decision.description,
    context: patch.context
      ? { ...decision.context, ...patch.context }
      : decision.context,
    decisionDate:
      patch.decisionDate !== undefined
        ? patch.decisionDate
        : decision.decisionDate,
    reviewDate:
      patch.reviewDate !== undefined ? patch.reviewDate : decision.reviewDate,
    updatedAt: nowIso(),
  }
  return finalize(next)
}

function captureRevision(
  decision: Decision,
  note: string,
): DecisionRevision {
  return {
    revisionId: createId('rev'),
    revisionNumber: decision.revisions.length + 1,
    createdAt: nowIso(),
    note,
    title: decision.title,
    description: decision.description,
    context: structuredCloneJson(decision.context),
    options: structuredCloneJson(decision.options),
    assumptions: structuredCloneJson(decision.assumptions),
    predictions: structuredCloneJson(decision.predictions),
    selectedOptionId: decision.selectedOptionId,
    decisionDate: decision.decisionDate,
    reviewDate: decision.reviewDate,
  }
}

/** Post-commit edits preserve history and never touch the commit snapshot. */
export function reviseAfterCommit(
  decision: Decision,
  patch: {
    title?: string
    description?: string
    context?: DecisionContext
    options?: Option[]
    assumptions?: Assumption[]
    predictions?: Prediction[]
    selectedOptionId?: string | null
    decisionDate?: string | null
    reviewDate?: string | null
    note?: string
  },
): Decision {
  assertDomain(
    decision.commitSnapshot !== null,
    'NOT_COMMITTED',
    'Revisions require a committed decision.',
  )

  const frozenSnapshot = decision.commitSnapshot
  const revision = captureRevision(
    decision,
    patch.note ?? 'Post-commit revision',
  )

  const next: Decision = {
    ...decision,
    title: patch.title ?? decision.title,
    description: patch.description ?? decision.description,
    context: patch.context ?? decision.context,
    options: patch.options ?? decision.options,
    assumptions: patch.assumptions ?? decision.assumptions,
    predictions: patch.predictions ?? decision.predictions,
    selectedOptionId:
      patch.selectedOptionId !== undefined
        ? patch.selectedOptionId
        : decision.selectedOptionId,
    decisionDate:
      patch.decisionDate !== undefined
        ? patch.decisionDate
        : decision.decisionDate,
    reviewDate:
      patch.reviewDate !== undefined ? patch.reviewDate : decision.reviewDate,
    revisions: [...decision.revisions, revision],
    commitSnapshot: frozenSnapshot,
    updatedAt: nowIso(),
  }

  return finalize(next)
}

export function addOption(
  decision: Decision,
  partial: Omit<Option, 'id'> & { id?: string },
): Decision {
  const option: Option = {
    id: partial.id ?? createId('opt'),
    title: partial.title.trim(),
    description: partial.description,
    perceivedUpside: partial.perceivedUpside,
    perceivedDownside: partial.perceivedDownside,
    estimatedProbability: clampPercent(partial.estimatedProbability),
    reasonsForChoosing: [...partial.reasonsForChoosing],
    reasonsForRejecting: [...partial.reasonsForRejecting],
  }
  assertDomain(option.title.length > 0, 'OPTION_TITLE', 'Option title required.')

  if (decision.commitSnapshot) {
    return reviseAfterCommit(decision, {
      options: [...decision.options, option],
      note: `Added option “${option.title}”`,
    })
  }

  return finalize({
    ...decision,
    options: [...decision.options, option],
    updatedAt: nowIso(),
  })
}

export function updateOption(
  decision: Decision,
  optionId: string,
  patch: Partial<Omit<Option, 'id'>>,
): Decision {
  const idx = decision.options.findIndex((o) => o.id === optionId)
  assertDomain(idx >= 0, 'OPTION_MISSING', 'Option not found.')
  const current = decision.options[idx]!
  const updated: Option = {
    ...current,
    ...patch,
    title: patch.title !== undefined ? patch.title.trim() : current.title,
    estimatedProbability:
      patch.estimatedProbability !== undefined
        ? clampPercent(patch.estimatedProbability)
        : current.estimatedProbability,
    reasonsForChoosing:
      patch.reasonsForChoosing !== undefined
        ? [...patch.reasonsForChoosing]
        : current.reasonsForChoosing,
    reasonsForRejecting:
      patch.reasonsForRejecting !== undefined
        ? [...patch.reasonsForRejecting]
        : current.reasonsForRejecting,
  }
  const options = decision.options.map((o) =>
    o.id === optionId ? updated : o,
  )

  if (decision.commitSnapshot) {
    return reviseAfterCommit(decision, {
      options,
      note: `Updated option “${updated.title}”`,
    })
  }

  return finalize({ ...decision, options, updatedAt: nowIso() })
}

export function removeOption(decision: Decision, optionId: string): Decision {
  assertDomain(
    !decision.commitSnapshot || decision.selectedOptionId !== optionId,
    'CANNOT_REMOVE_SELECTED',
    'Cannot remove the selected option after commit without selecting another first.',
  )
  const options = decision.options.filter((o) => o.id !== optionId)
  assertDomain(
    !decision.commitSnapshot || options.length >= 2,
    'OPTIONS_MIN',
    'Committed decisions must retain at least two options.',
  )
  const selectedOptionId =
    decision.selectedOptionId === optionId ? null : decision.selectedOptionId

  if (decision.commitSnapshot) {
    return reviseAfterCommit(decision, {
      options,
      selectedOptionId,
      note: 'Removed an option',
    })
  }

  return finalize({
    ...decision,
    options,
    selectedOptionId,
    updatedAt: nowIso(),
  })
}

export function addAssumption(
  decision: Decision,
  partial: Omit<Assumption, 'id' | 'status' | 'familyId' | 'familyLabel'> & {
    id?: string
    status?: Assumption['status']
    familyId?: string | null
    familyLabel?: string | null
  },
): Decision {
  const assumption: Assumption = {
    id: partial.id ?? createId('asm'),
    statement: partial.statement.trim(),
    confidence: clampPercent(partial.confidence),
    importance: partial.importance,
    falsificationCondition: partial.falsificationCondition,
    status: partial.status ?? 'UNKNOWN',
    familyId: partial.familyId ?? null,
    familyLabel: partial.familyLabel ?? null,
  }
  assertDomain(
    assumption.statement.length > 0,
    'ASSUMPTION_REQUIRED',
    'Assumption statement required.',
  )

  if (decision.commitSnapshot) {
    return reviseAfterCommit(decision, {
      assumptions: [...decision.assumptions, assumption],
      note: 'Added assumption',
    })
  }

  return finalize({
    ...decision,
    assumptions: [...decision.assumptions, assumption],
    updatedAt: nowIso(),
  })
}

export function updateAssumption(
  decision: Decision,
  assumptionId: string,
  patch: Partial<Omit<Assumption, 'id'>>,
): Decision {
  const idx = decision.assumptions.findIndex((a) => a.id === assumptionId)
  assertDomain(idx >= 0, 'ASSUMPTION_MISSING', 'Assumption not found.')
  const current = decision.assumptions[idx]!
  const updated: Assumption = {
    ...current,
    ...patch,
    statement:
      patch.statement !== undefined ? patch.statement.trim() : current.statement,
    confidence:
      patch.confidence !== undefined
        ? clampPercent(patch.confidence)
        : current.confidence,
  }
  const assumptions = decision.assumptions.map((a) =>
    a.id === assumptionId ? updated : a,
  )

  if (decision.commitSnapshot) {
    return reviseAfterCommit(decision, {
      assumptions,
      note: 'Updated assumption',
    })
  }

  return finalize({
    ...decision,
    assumptions,
    updatedAt: nowIso(),
  })
}

export function addPrediction(
  decision: Decision,
  partial: Omit<Prediction, 'id' | 'evaluation'> & {
    id?: string
    evaluation?: Prediction['evaluation']
  },
): Decision {
  const prediction: Prediction = {
    id: partial.id ?? createId('prd'),
    statement: partial.statement.trim(),
    expectedResult: partial.expectedResult,
    expectedDate: partial.expectedDate,
    confidence: clampPercent(partial.confidence),
    evaluationCriteria: partial.evaluationCriteria,
    evaluation: partial.evaluation ?? null,
  }
  assertDomain(
    prediction.statement.length > 0,
    'PREDICTION_REQUIRED',
    'Prediction statement required.',
  )

  if (decision.commitSnapshot) {
    return reviseAfterCommit(decision, {
      predictions: [...decision.predictions, prediction],
      note: 'Added prediction',
    })
  }

  return finalize({
    ...decision,
    predictions: [...decision.predictions, prediction],
    updatedAt: nowIso(),
  })
}

export function updatePrediction(
  decision: Decision,
  predictionId: string,
  patch: Partial<Omit<Prediction, 'id'>>,
): Decision {
  const idx = decision.predictions.findIndex((p) => p.id === predictionId)
  assertDomain(idx >= 0, 'PREDICTION_MISSING', 'Prediction not found.')
  const current = decision.predictions[idx]!
  const updated: Prediction = {
    ...current,
    ...patch,
    statement:
      patch.statement !== undefined ? patch.statement.trim() : current.statement,
    confidence:
      patch.confidence !== undefined
        ? clampPercent(patch.confidence)
        : current.confidence,
  }
  const predictions = decision.predictions.map((p) =>
    p.id === predictionId ? updated : p,
  )

  if (decision.commitSnapshot) {
    return reviseAfterCommit(decision, {
      predictions,
      note: 'Updated prediction',
    })
  }

  return finalize({
    ...decision,
    predictions,
    updatedAt: nowIso(),
  })
}

/**
 * Finalize a decision: create an immutable commit snapshot.
 * Calling commit twice throws — the snapshot cannot be silently overwritten.
 */
export function commitDecision(
  decision: Decision,
  input: CommitDecisionInput,
): Decision {
  if (decision.commitSnapshot) {
    throw new DomainError(
      'ALREADY_COMMITTED',
      'Commit snapshot already exists and cannot be overwritten. Create a revision instead.',
    )
  }

  assertDomain(
    decision.options.length >= 2,
    'OPTIONS_MIN',
    'Commit requires at least two options.',
  )
  const selected = decision.options.find((o) => o.id === input.selectedOptionId)
  assertDomain(
    selected !== undefined,
    'SELECTED_MISSING',
    'Selected option must exist among current options.',
  )
  assertDomain(
    input.decisionDate.trim().length > 0,
    'DECISION_DATE',
    'Decision date is required to commit.',
  )
  assertDomain(
    input.reviewDate.trim().length > 0,
    'REVIEW_DATE',
    'Review date is required to commit.',
  )

  const snapshot: CommitSnapshot = deepFreeze({
    snapshotId: createId('snap'),
    committedAt: nowIso(),
    decisionDate: input.decisionDate,
    reviewDate: input.reviewDate,
    title: decision.title,
    description: decision.description,
    context: structuredCloneJson(decision.context),
    options: structuredCloneJson(decision.options),
    assumptions: structuredCloneJson(decision.assumptions),
    predictions: structuredCloneJson(decision.predictions),
    selectedOptionId: input.selectedOptionId,
  })

  const next: Decision = {
    ...decision,
    selectedOptionId: input.selectedOptionId,
    decisionDate: input.decisionDate,
    reviewDate: input.reviewDate,
    commitSnapshot: snapshot,
    updatedAt: nowIso(),
  }

  return finalize(next)
}

/**
 * Defensive guard: attempting to replace an existing snapshot is always rejected.
 */
export function replaceCommitSnapshot(
  _decision: Decision,
  _snapshot: CommitSnapshot,
): never {
  throw new DomainError(
    'SNAPSHOT_IMMUTABLE',
    'Commit snapshots are immutable and cannot be replaced.',
  )
}

export function recordReview(
  decision: Decision,
  review: Omit<ReviewRecord, 'reviewedAt'> & { reviewedAt?: string },
): Decision {
  assertDomain(
    decision.commitSnapshot !== null,
    'REVIEW_REQUIRES_COMMIT',
    'Only committed decisions can be reviewed.',
  )
  assertDomain(
    review.outcomeRating >= 1 && review.outcomeRating <= 5,
    'OUTCOME_RATING',
    'Outcome rating must be 1–5.',
  )
  assertDomain(
    review.decisionQualityRating >= 1 && review.decisionQualityRating <= 5,
    'DECISION_QUALITY_RATING',
    'Decision quality rating must be 1–5.',
  )

  const newReview: ReviewRecord = {
    ...review,
    assumptionStatuses: review.assumptionStatuses.map((s) => ({
      ...s,
      fingerprint: s.fingerprint ?? '',
    })),
    predictionEvaluations: review.predictionEvaluations.map((e) => ({
      ...e,
      fingerprint: e.fingerprint ?? '',
    })),
    reviewedAt: review.reviewedAt ?? nowIso(),
  }

  for (const e of newReview.predictionEvaluations) {
    assertDomain(
      Boolean(e.fingerprint),
      'EVALUATION_REQUIRES_FINGERPRINT',
      'Prediction evaluations must target an exact historical proposition fingerprint.',
    )
  }
  for (const s of newReview.assumptionStatuses) {
    assertDomain(
      Boolean(s.fingerprint),
      'EVALUATION_REQUIRES_FINGERPRINT',
      'Assumption evaluations must target an exact historical proposition fingerprint.',
    )
  }
  assertEvaluationsTargetKnownPropositions(
    decision,
    newReview.predictionEvaluations,
    newReview.assumptionStatuses,
  )

  // Preserve prior review as distinguishable history — never silent overwrite.
  const priorReviews = decision.review
    ? [...decision.priorReviews, decision.review]
    : [...decision.priorReviews]

  const willMutateWorking =
    newReview.assumptionStatuses.length > 0 ||
    newReview.predictionEvaluations.length > 0

  // Capture prior working state BEFORE applying review-driven mutations.
  const revisions = willMutateWorking
    ? [
        ...decision.revisions,
        captureRevision(decision, 'Review: working evaluations updated'),
      ]
    : [...decision.revisions]

  let assumptions = decision.assumptions
  if (newReview.assumptionStatuses.length > 0) {
    assumptions = decision.assumptions.map((a) => {
      const fp = assumptionFingerprint(a)
      const hit = newReview.assumptionStatuses.find(
        (s) => s.assumptionId === a.id && s.fingerprint === fp,
      )
      return hit ? { ...a, status: hit.status } : a
    })
  }

  let predictions = decision.predictions
  if (newReview.predictionEvaluations.length > 0) {
    predictions = decision.predictions.map((p) => {
      const fp = predictionFingerprint(p)
      const hit = newReview.predictionEvaluations.find(
        (e) => e.predictionId === p.id && e.fingerprint === fp,
      )
      return hit ? { ...p, evaluation: hit.evaluation } : p
    })
  }

  const next: Decision = {
    ...decision,
    review: newReview,
    priorReviews,
    assumptions,
    predictions,
    revisions,
    commitSnapshot: decision.commitSnapshot,
    updatedAt: nowIso(),
  }

  return finalize(next)
}

export function archiveDecision(decision: Decision): Decision {
  return finalize({
    ...decision,
    status: 'ARCHIVED',
    updatedAt: nowIso(),
  })
}

export function getKnownThenView(decision: Decision): CommitSnapshot | null {
  return decision.commitSnapshot
}

export function getKnownNowView(decision: Decision): {
  title: string
  description: string
  context: DecisionContext
  options: Option[]
  assumptions: Assumption[]
  predictions: Prediction[]
  selectedOptionId: string | null
  reviewDate: string | null
  revisionCount: number
} {
  return {
    title: decision.title,
    description: decision.description,
    context: decision.context,
    options: decision.options,
    assumptions: decision.assumptions,
    predictions: decision.predictions,
    selectedOptionId: decision.selectedOptionId,
    reviewDate: decision.reviewDate,
    revisionCount: decision.revisions.length,
  }
}

/** Protocol is capture guidance only — changing it does not rewrite history. */
export function setDecisionProtocol(
  decision: Decision,
  protocolId: DecisionProtocolId,
): Decision {
  return finalize({
    ...decision,
    protocolId,
    updatedAt: nowIso(),
  })
}

/**
 * Record a lightweight lineage link. Does not mutate the target decision.
 * Temporal meaning: createdAt is when the user asserted the relationship.
 */
export function addDecisionRelation(
  decision: Decision,
  input: {
    targetDecisionId: string
    kind: RelationKind
    note?: string
  },
): Decision {
  assertDomain(
    input.targetDecisionId.trim().length > 0,
    'RELATION_TARGET_REQUIRED',
    'Relation needs a target decision id.',
  )
  assertDomain(
    input.targetDecisionId !== decision.id,
    'RELATION_SELF',
    'A decision cannot relate to itself.',
  )
  const relation: DecisionRelation = {
    id: createId('rel'),
    targetDecisionId: input.targetDecisionId.trim(),
    kind: input.kind,
    note: (input.note ?? '').trim(),
    createdAt: nowIso(),
    removedAt: null,
  }
  return finalize({
    ...decision,
    relations: [...decision.relations, relation],
    updatedAt: nowIso(),
  })
}

export function removeDecisionRelation(
  decision: Decision,
  relationId: string,
): Decision {
  const idx = decision.relations.findIndex((r) => r.id === relationId)
  assertDomain(idx >= 0, 'RELATION_MISSING', 'Relation not found.')
  const current = decision.relations[idx]!
  assertDomain(
    !current.removedAt,
    'RELATION_ALREADY_REMOVED',
    'Relation is already tombstoned.',
  )
  const next = [...decision.relations]
  next[idx] = { ...current, removedAt: nowIso() }
  return finalize({
    ...decision,
    relations: next,
    updatedAt: nowIso(),
  })
}

/**
 * Attach a text/URL evidence reference.
 * availableAt is a user claim; recordedAt is when BranchBack accepted the record.
 */
export function addEvidenceRef(
  decision: Decision,
  input: {
    kind: EvidenceRef['kind']
    label: string
    body: string
    url?: string | null
    availableAt: EvidenceRef['availableAt']
  },
): Decision {
  const label = input.label.trim()
  assertDomain(label.length > 0, 'EVIDENCE_LABEL', 'Evidence needs a label.')
  const evidence: EvidenceRef = {
    id: createId('ev'),
    kind: input.kind,
    label,
    body: input.body.trim(),
    url: input.url?.trim() || null,
    availableAt: input.availableAt,
    recordedAt: nowIso(),
    removedAt: null,
  }
  return finalize({
    ...decision,
    evidence: [...decision.evidence, evidence],
    updatedAt: nowIso(),
  })
}

export function removeEvidenceRef(
  decision: Decision,
  evidenceId: string,
): Decision {
  const idx = decision.evidence.findIndex((e) => e.id === evidenceId)
  assertDomain(idx >= 0, 'EVIDENCE_MISSING', 'Evidence reference not found.')
  const current = decision.evidence[idx]!
  assertDomain(
    !current.removedAt,
    'EVIDENCE_ALREADY_REMOVED',
    'Evidence is already tombstoned.',
  )
  const next = [...decision.evidence]
  next[idx] = { ...current, removedAt: nowIso() }
  return finalize({
    ...decision,
    evidence: next,
    updatedAt: nowIso(),
  })
}

/**
 * Explicitly link an assumption into a user-confirmed family.
 * Never auto-merges by text similarity.
 */
export function assignAssumptionFamily(
  decision: Decision,
  assumptionId: string,
  family: { familyId: string; familyLabel: string } | null,
): Decision {
  return updateAssumption(decision, assumptionId, {
    familyId: family?.familyId ?? null,
    familyLabel: family?.familyLabel?.trim() || null,
  })
}

function clampPercent(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}
