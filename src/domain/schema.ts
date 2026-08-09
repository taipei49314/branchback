import { z } from 'zod'
import { isCalendarDay } from './dates'

const calendarDaySchema = z
  .string()
  .refine((v) => isCalendarDay(v), {
    message: 'Expected a local calendar day YYYY-MM-DD',
  })

const calendarDayNullableSchema = z.union([calendarDaySchema, z.null()])

export const decisionStatusSchema = z.enum([
  'OPEN',
  'DECIDED',
  'REVIEW_DUE',
  'REVIEWED',
  'ARCHIVED',
])

export const assumptionStatusSchema = z.enum([
  'UNKNOWN',
  'HELD',
  'FAILED',
  'PARTIAL',
  'UNTESTABLE',
])

export const predictionEvaluationSchema = z.enum([
  'CORRECT',
  'INCORRECT',
  'PARTIAL',
  'UNKNOWN',
])

export const propositionProvenanceSchema = z.enum([
  'at-commit',
  'added-later',
  'revised-later',
  'removed-from-working',
])

export const relationKindSchema = z.enum([
  'follows-from',
  'depends-on',
  'revisits',
  'supersedes',
  'related-to',
])

export const decisionProtocolSchema = z.enum([
  'general',
  'purchase',
  'career',
  'project',
  'financial',
  'irreversible',
])

export const ratingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

export const decisionContextSchema = z.object({
  situation: z.string(),
  constraints: z.string(),
  stakes: z.string(),
  deadline: calendarDayNullableSchema,
  peopleInvolved: z.array(z.string()),
  tags: z.array(z.string()),
})

export const optionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  perceivedUpside: z.string(),
  perceivedDownside: z.string(),
  estimatedProbability: z.number().min(0).max(100),
  reasonsForChoosing: z.array(z.string()),
  reasonsForRejecting: z.array(z.string()),
})

export const assumptionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  confidence: z.number().min(0).max(100),
  importance: ratingSchema,
  falsificationCondition: z.string(),
  status: assumptionStatusSchema,
  familyId: z.string().nullable().default(null),
  familyLabel: z.string().nullable().default(null),
})

export const predictionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  expectedResult: z.string(),
  expectedDate: calendarDaySchema,
  confidence: z.number().min(0).max(100),
  evaluationCriteria: z.string(),
  evaluation: predictionEvaluationSchema.nullable(),
})

export const decisionRelationSchema = z.object({
  id: z.string().min(1),
  targetDecisionId: z.string().min(1),
  kind: relationKindSchema,
  note: z.string(),
  createdAt: z.string(),
  removedAt: z.string().nullable().default(null),
})

export const evidenceRefSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['note', 'url', 'quote']),
  label: z.string(),
  body: z.string(),
  url: z.string().nullable(),
  availableAt: z.enum(['then', 'later']),
  recordedAt: z.string(),
  removedAt: z.string().nullable().default(null),
})

export const commitSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  committedAt: z.string(),
  decisionDate: calendarDaySchema,
  reviewDate: calendarDaySchema,
  title: z.string(),
  description: z.string(),
  context: decisionContextSchema,
  options: z.array(optionSchema),
  assumptions: z.array(assumptionSchema),
  predictions: z.array(predictionSchema),
  selectedOptionId: z.string().min(1),
})

export const decisionRevisionSchema = z.object({
  revisionId: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  createdAt: z.string(),
  note: z.string(),
  title: z.string(),
  description: z.string(),
  context: decisionContextSchema,
  options: z.array(optionSchema),
  assumptions: z.array(assumptionSchema),
  predictions: z.array(predictionSchema),
  selectedOptionId: z.string().nullable(),
  decisionDate: calendarDayNullableSchema.default(null),
  reviewDate: calendarDayNullableSchema,
})

export const reviewRecordSchema = z.object({
  reviewedAt: z.string(),
  whatHappened: z.string(),
  unexpected: z.string(),
  missingInformation: z.string(),
  outcomeRating: ratingSchema,
  decisionQualityRating: ratingSchema,
  rememberedBelief: z.string().nullable(),
  memoryDriftNotes: z.string().nullable(),
  assumptionStatuses: z.array(
    z.object({
      assumptionId: z.string(),
      status: assumptionStatusSchema,
      fingerprint: z.string().default(''),
      provenance: propositionProvenanceSchema.optional(),
    }),
  ),
  predictionEvaluations: z.array(
    z.object({
      predictionId: z.string(),
      evaluation: predictionEvaluationSchema,
      fingerprint: z.string().default(''),
      provenance: propositionProvenanceSchema.optional(),
    }),
  ),
  counterfactualNotes: z.array(
    z.object({
      optionId: z.string(),
      note: z.string(),
    }),
  ),
})

export const decisionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  decisionDate: calendarDayNullableSchema,
  reviewDate: calendarDayNullableSchema,
  status: decisionStatusSchema,
  protocolId: decisionProtocolSchema.default('general'),
  context: decisionContextSchema,
  options: z.array(optionSchema),
  assumptions: z.array(assumptionSchema),
  predictions: z.array(predictionSchema),
  selectedOptionId: z.string().nullable(),
  commitSnapshot: commitSnapshotSchema.nullable(),
  revisions: z.array(decisionRevisionSchema),
  review: reviewRecordSchema.nullable(),
  priorReviews: z.array(reviewRecordSchema).default([]),
  relations: z.array(decisionRelationSchema).default([]),
  evidence: z.array(evidenceRefSchema).default([]),
})

export const branchBackExportSchema = z.object({
  schemaVersion: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  exportedAt: z.string(),
  decisions: z.array(decisionSchema),
})

/** Fail closed on unknown future schemas. */
export function assertSupportedExportSchema(version: unknown): void {
  if (
    version !== 1 &&
    version !== 2 &&
    version !== 3 &&
    version !== 4 &&
    version !== 5
  ) {
    throw new Error(
      `UNSUPPORTED_SCHEMA: BranchBack cannot import schemaVersion ${String(version)}. Export from a compatible version or upgrade BranchBack.`,
    )
  }
}
