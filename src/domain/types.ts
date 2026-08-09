/** Core domain types for BranchBack decision replay. */

export type DecisionStatus =
  | 'OPEN'
  | 'DECIDED'
  | 'REVIEW_DUE'
  | 'REVIEWED'
  | 'ARCHIVED'

export type AssumptionStatus =
  | 'UNKNOWN'
  | 'HELD'
  | 'FAILED'
  | 'PARTIAL'
  | 'UNTESTABLE'

export type PredictionEvaluation =
  | 'CORRECT'
  | 'INCORRECT'
  | 'PARTIAL'
  | 'UNKNOWN'

export type Rating = 1 | 2 | 3 | 4 | 5

export interface DecisionContext {
  situation: string
  constraints: string
  stakes: string
  deadline: string | null
  peopleInvolved: string[]
  tags: string[]
}

export interface Option {
  id: string
  title: string
  description: string
  perceivedUpside: string
  perceivedDownside: string
  /** Estimated probability of success, 0–100 */
  estimatedProbability: number
  reasonsForChoosing: string[]
  reasonsForRejecting: string[]
}

export interface Assumption {
  id: string
  statement: string
  /** Confidence 0–100 */
  confidence: number
  /** Importance 1–5 */
  importance: Rating
  falsificationCondition: string
  status: AssumptionStatus
  /**
   * Optional user-confirmed recurring belief family.
   * Never auto-merged from text similarity.
   */
  familyId: string | null
  familyLabel: string | null
}

export interface Prediction {
  id: string
  statement: string
  expectedResult: string
  expectedDate: string
  /** Confidence 0–100 */
  confidence: number
  evaluationCriteria: string
  evaluation: PredictionEvaluation | null
}

export type RelationKind =
  | 'follows-from'
  | 'depends-on'
  | 'revisits'
  | 'supersedes'
  | 'related-to'

/** Lightweight historical link to another decision. */
export interface DecisionRelation {
  id: string
  targetDecisionId: string
  kind: RelationKind
  note: string
  /** When the user recorded this relationship (not when the target was created). */
  createdAt: string
  /**
   * Tombstone: ordinary removal sets this instead of deleting the record.
   * Once set, the historical assertion remains reconstructable.
   */
  removedAt: string | null
}

export type EvidenceAvailability = 'then' | 'later'

/** Text/URL references only — no binary blobs. */
export interface EvidenceRef {
  id: string
  kind: 'note' | 'url' | 'quote'
  label: string
  body: string
  url: string | null
  /**
   * User claim about when the material was available for the decision.
   * Not proof that BranchBack recorded it before commit.
   */
  availableAt: EvidenceAvailability
  /** When BranchBack accepted this evidence record. */
  recordedAt: string
  /** Tombstone — ordinary removal must not erase prior existence. */
  removedAt: string | null
}

export type DecisionProtocolId =
  | 'general'
  | 'purchase'
  | 'career'
  | 'project'
  | 'financial'
  | 'irreversible'

/**
 * Frozen record of what the user believed at commit time.
 * Must never be mutated after creation — only replaced by a new revision history entry.
 */
export interface CommitSnapshot {
  readonly snapshotId: string
  readonly committedAt: string
  readonly decisionDate: string
  readonly reviewDate: string
  readonly title: string
  readonly description: string
  readonly context: Readonly<DecisionContext>
  readonly options: ReadonlyArray<Readonly<Option>>
  readonly assumptions: ReadonlyArray<Readonly<Assumption>>
  readonly predictions: ReadonlyArray<Readonly<Prediction>>
  readonly selectedOptionId: string
}

/** Post-commit edits create revisions; they do not alter the commit snapshot. */
export interface DecisionRevision {
  revisionId: string
  revisionNumber: number
  createdAt: string
  note: string
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

export interface ReviewRecord {
  reviewedAt: string
  whatHappened: string
  unexpected: string
  missingInformation: string
  /** Outcome quality — what happened (1–5). Separate from decisionQuality. */
  outcomeRating: Rating
  /** Decision quality — reasonableness given information at the time (1–5). */
  decisionQualityRating: Rating
  rememberedBelief: string | null
  memoryDriftNotes: string | null
  assumptionStatuses: Array<{
    assumptionId: string
    status: AssumptionStatus
    /** Semantic fingerprint of the exact historical proposition evaluated. */
    fingerprint: string
    provenance?:
      | 'at-commit'
      | 'added-later'
      | 'revised-later'
      | 'removed-from-working'
  }>
  predictionEvaluations: Array<{
    predictionId: string
    evaluation: PredictionEvaluation
    /** Semantic fingerprint of the exact historical proposition evaluated. */
    fingerprint: string
    provenance?:
      | 'at-commit'
      | 'added-later'
      | 'revised-later'
      | 'removed-from-working'
  }>
  counterfactualNotes: Array<{ optionId: string; note: string }>
}

export interface Decision {
  id: string
  title: string
  description: string
  createdAt: string
  updatedAt: string
  decisionDate: string | null
  reviewDate: string | null
  status: DecisionStatus
  /** Optional capture protocol — prompts fields, never advises. */
  protocolId: DecisionProtocolId
  context: DecisionContext
  options: Option[]
  assumptions: Assumption[]
  predictions: Prediction[]
  selectedOptionId: string | null
  /** Set once on commit. Never silently overwritten. */
  commitSnapshot: CommitSnapshot | null
  revisions: DecisionRevision[]
  /** Latest review, if any. */
  review: ReviewRecord | null
  /**
   * Prior review records retained when a later review is recorded.
   * Temporal history must remain distinguishable — never silently rewrite.
   */
  priorReviews: ReviewRecord[]
  /** Cross-decision lineage links recorded by the user. */
  relations: DecisionRelation[]
  /** Evidence/references available then vs discovered later. */
  evidence: EvidenceRef[]
}

export interface CreateDecisionInput {
  title: string
  description?: string
  context?: Partial<DecisionContext>
  decisionDate?: string | null
  reviewDate?: string | null
  protocolId?: DecisionProtocolId
}

export interface CommitDecisionInput {
  selectedOptionId: string
  decisionDate: string
  reviewDate: string
}

export const SCHEMA_VERSION = 5 as const

export interface BranchBackExport {
  schemaVersion: typeof SCHEMA_VERSION | 1 | 2 | 3 | 4 | 5
  exportedAt: string
  decisions: Decision[]
}
