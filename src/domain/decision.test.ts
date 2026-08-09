import { describe, expect, it } from 'vitest'
import {
  addAssumption,
  addOption,
  addPrediction,
  commitDecision,
  createDecision,
  recordReview,
  removeOption,
  replaceCommitSnapshot,
  reviseAfterCommit,
  updateDraftFields,
} from '@/domain/decision'
import { DomainError } from '@/domain/errors'
import { checkDecisionInvariants } from '@/domain/invariants'
import { buildDemoDataset } from '@/demo/dataset'
import {
  bindAssumptionStatus,
  bindPredictionEvaluation,
} from './bindEvaluation'
import { decisionToMarkdown } from '@/domain/markdown'
import { computeCalibration } from '@/domain/calibration'
import { analyzeAssumptions } from '@/domain/assumptionAnalytics'
import { branchBackExportSchema } from '@/domain/schema'
import { SCHEMA_VERSION } from '@/domain/types'

function draftWithTwoOptions() {
  let d = createDecision({
    title: 'Test decision',
    description: 'For invariants',
  })
  d = addOption(d, {
    title: 'Option A',
    description: 'A',
    perceivedUpside: 'up',
    perceivedDownside: 'down',
    estimatedProbability: 60,
    reasonsForChoosing: ['reason'],
    reasonsForRejecting: [],
  })
  d = addOption(d, {
    title: 'Option B',
    description: 'B',
    perceivedUpside: 'up',
    perceivedDownside: 'down',
    estimatedProbability: 40,
    reasonsForChoosing: [],
    reasonsForRejecting: ['no'],
  })
  return d
}

describe('decision lifecycle', () => {
  it('creates a decision', () => {
    const d = createDecision({ title: 'Ship feature X' })
    expect(d.status).toBe('OPEN')
    expect(d.title).toBe('Ship feature X')
    expect(d.commitSnapshot).toBeNull()
  })

  it('adds multiple options, assumptions, and predictions', () => {
    let d = draftWithTwoOptions()
    d = addAssumption(d, {
      statement: 'Demand will rise',
      confidence: 70,
      importance: 4,
      falsificationCondition: 'MoM demand down 2 months',
    })
    d = addPrediction(d, {
      statement: 'Ten users in 14 days',
      expectedResult: '10 users',
      expectedDate: '2026-01-01',
      confidence: 75,
      evaluationCriteria: 'Usage count',
    })
    expect(d.options).toHaveLength(2)
    expect(d.assumptions).toHaveLength(1)
    expect(d.predictions).toHaveLength(1)
  })

  it('commits an immutable snapshot', () => {
    let d = draftWithTwoOptions()
    const optionId = d.options[0]!.id
    d = commitDecision(d, {
      selectedOptionId: optionId,
      decisionDate: '2026-01-10',
      reviewDate: '2099-04-10',
    })
    expect(d.commitSnapshot).not.toBeNull()
    expect(d.commitSnapshot!.selectedOptionId).toBe(optionId)
    expect(d.status).toBe('DECIDED')
  })

  it('refuses to overwrite an existing commit snapshot', () => {
    let d = draftWithTwoOptions()
    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: '2026-01-10',
      reviewDate: '2026-04-10',
    })
    const snapId = d.commitSnapshot!.snapshotId
    expect(() =>
      commitDecision(d, {
        selectedOptionId: d.options[1]!.id,
        decisionDate: '2026-01-11',
        reviewDate: '2026-04-11',
      }),
    ).toThrow(DomainError)
    expect(d.commitSnapshot!.snapshotId).toBe(snapId)
    expect(() =>
      replaceCommitSnapshot(d, { ...d.commitSnapshot!, snapshotId: 'x' }),
    ).toThrow(/immutable/i)
  })

  it('creates revision history on post-commit edits without mutating snapshot', () => {
    let d = draftWithTwoOptions()
    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: '2026-01-10',
      reviewDate: '2026-04-10',
    })
    const snapJson = JSON.stringify(d.commitSnapshot)
    d = updateDraftFields(d, {
      title: 'Revised title',
      note: 'Clarified wording',
    })
    expect(d.title).toBe('Revised title')
    expect(d.revisions).toHaveLength(1)
    expect(JSON.stringify(d.commitSnapshot)).toBe(snapJson)
    expect(d.commitSnapshot!.title).toBe('Test decision')
  })

  it('records review with separate outcome and decision quality', () => {
    let d = draftWithTwoOptions()
    d = addAssumption(d, {
      statement: 'Assumed X',
      confidence: 80,
      importance: 5,
      falsificationCondition: 'Not X',
    })
    d = addPrediction(d, {
      statement: 'Y happens',
      expectedResult: 'Y',
      expectedDate: '2026-02-01',
      confidence: 90,
      evaluationCriteria: 'Observe Y',
    })
    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: '2026-01-10',
      reviewDate: '2026-02-10',
    })
    d = recordReview(d, {
      whatHappened: 'Bad outcome',
      unexpected: 'Shock',
      missingInformation: 'Unknown unknown',
      outcomeRating: 2,
      decisionQualityRating: 4,
      rememberedBelief: 'I thought we picked B',
      memoryDriftNotes: 'Memory drift vs snapshot',
      assumptionStatuses: [
        bindAssumptionStatus(d.assumptions[0]!, 'FAILED'),
      ],
      predictionEvaluations: [
        bindPredictionEvaluation(d.predictions[0]!, 'INCORRECT'),
      ],
      counterfactualNotes: [],
    })
    expect(d.review!.outcomeRating).toBe(2)
    expect(d.review!.decisionQualityRating).toBe(4)
    expect(d.review!.outcomeRating).not.toBe(d.review!.decisionQualityRating)
    expect(d.assumptions[0]!.status).toBe('FAILED')
    expect(d.predictions[0]!.evaluation).toBe('INCORRECT')
    expect(d.status).toBe('REVIEWED')
  })

  it('requires at least two options to commit', () => {
    let d = createDecision({ title: 'Only one' })
    d = addOption(d, {
      title: 'Solo',
      description: '',
      perceivedUpside: '',
      perceivedDownside: '',
      estimatedProbability: 50,
      reasonsForChoosing: [],
      reasonsForRejecting: [],
    })
    expect(() =>
      commitDecision(d, {
        selectedOptionId: d.options[0]!.id,
        decisionDate: '2026-01-01',
        reviewDate: '2026-02-01',
      }),
    ).toThrow(/two options/i)
  })

  it('refuses post-commit option removal that would leave fewer than two options', () => {
    let d = draftWithTwoOptions()
    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: '2026-01-10',
      reviewDate: '2099-04-10',
    })
    expect(() => removeOption(d, d.options[1]!.id)).toThrow(/two options/i)
  })

  it('preserves prior review when recording a later review', () => {
    let d = draftWithTwoOptions()
    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: '2026-01-10',
      reviewDate: '2099-04-10',
    })
    d = recordReview(d, {
      whatHappened: 'First',
      unexpected: '',
      missingInformation: '',
      outcomeRating: 3,
      decisionQualityRating: 3,
      rememberedBelief: null,
      memoryDriftNotes: null,
      assumptionStatuses: [],
      predictionEvaluations: [],
      counterfactualNotes: [],
    })
    d = recordReview(d, {
      whatHappened: 'Second',
      unexpected: '',
      missingInformation: '',
      outcomeRating: 4,
      decisionQualityRating: 3,
      rememberedBelief: null,
      memoryDriftNotes: null,
      assumptionStatuses: [],
      predictionEvaluations: [],
      counterfactualNotes: [],
    })
    expect(d.review!.whatHappened).toBe('Second')
    expect(d.priorReviews).toHaveLength(1)
    expect(d.priorReviews[0]!.whatHappened).toBe('First')
  })
})

describe('demo dataset', () => {
  it('loads six decisions covering required domains', () => {
    const demo = buildDemoDataset()
    expect(demo).toHaveLength(6)
    const tags = demo.flatMap((d) => d.context.tags)
    for (const needed of [
      'career',
      'finance',
      'relationships',
      'purchasing',
      'projects',
      'travel',
    ]) {
      expect(tags).toContain(needed)
    }
    expect(demo.every((d) => d.commitSnapshot)).toBe(true)
    expect(demo.some((d) => d.review?.outcomeRating !== d.review?.decisionQualityRating)).toBe(
      true,
    )
    expect(demo.some((d) => d.review?.rememberedBelief)).toBe(true)
    expect(
      demo.some((d) =>
        d.assumptions.some((a) => a.status === 'FAILED'),
      ),
    ).toBe(true)
    expect(
      demo.some((d) =>
        d.predictions.some((p) => p.evaluation === 'INCORRECT'),
      ),
    ).toBe(true)
  })
})

describe('export / analytics helpers', () => {
  it('exports markdown and validates backup schema shape', () => {
    const demo = buildDemoDataset()
    const md = decisionToMarkdown(demo[0]!)
    expect(md).toContain('# ')
    expect(md).toContain('Immutable commit snapshot')
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      decisions: demo,
    }
    expect(() => branchBackExportSchema.parse(payload)).not.toThrow()
  })

  it('computes calibration with sample sizes', () => {
    const buckets = computeCalibration(buildDemoDataset())
    expect(buckets).toHaveLength(5)
    expect(buckets.every((b) => typeof b.sampleSize === 'number')).toBe(true)
    expect(buckets.some((b) => b.sampleSize > 0)).toBe(true)
  })

  it('analyzes assumption patterns deterministically', () => {
    const stats = analyzeAssumptions(buildDemoDataset())
    expect(stats.totalAssumptions).toBeGreaterThan(0)
    expect(stats.failedAssumptions).toBeGreaterThan(0)
  })
})

describe('invariants', () => {
  it('flags decided without snapshot', () => {
    const d = {
      ...createDecision({ title: 'Broken' }),
      status: 'DECIDED' as const,
      commitSnapshot: null,
    }
    const result = checkDecisionInvariants(d)
    expect(result.ok).toBe(false)
  })

  it('reviseAfterCommit preserves snapshot identity', () => {
    let d = draftWithTwoOptions()
    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: '2026-01-10',
      reviewDate: '2026-04-10',
    })
    const id = d.commitSnapshot!.snapshotId
    d = reviseAfterCommit(d, { description: 'note later', note: 'post' })
    expect(d.commitSnapshot!.snapshotId).toBe(id)
  })
})
