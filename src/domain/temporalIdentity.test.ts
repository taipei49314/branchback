import { describe, expect, it } from 'vitest'
import {
  collectHistoricalPredictionScores,
  computeCalibration,
} from './calibration'
import {
  addAssumption,
  addPrediction,
  commitDecision,
  createDecision,
  recordReview,
  reviseAfterCommit,
} from './decision'
import {
  bindPredictionEvaluation,
} from './bindEvaluation'
import {
  listHistoricalAssumptionTargets,
  listHistoricalPredictionTargets,
  predictionFingerprint,
  resolvePredictionEvaluation,
} from './historicalIdentity'
import { DomainError } from './errors'
import type { Option } from './types'

function twoOptions(): Option[] {
  return [
    {
      id: 'o1',
      title: 'A',
      description: '',
      perceivedUpside: '',
      perceivedDownside: '',
      estimatedProbability: 60,
      reasonsForChoosing: [],
      reasonsForRejecting: [],
    },
    {
      id: 'o2',
      title: 'B',
      description: '',
      perceivedUpside: '',
      perceivedDownside: '',
      estimatedProbability: 40,
      reasonsForChoosing: [],
      reasonsForRejecting: [],
    },
  ]
}

describe('historical proposition chain', () => {
  it('exposes June, September, and December as distinct targets', () => {
    let d = createDecision({ title: 'Chain' })
    d = { ...d, options: twoOptions() }
    d = addPrediction(d, {
      statement: 'Ship by June',
      expectedResult: 'shipped',
      expectedDate: '2025-06-01',
      confidence: 80,
      evaluationCriteria: 'shipped',
    })
    const predId = d.predictions[0]!.id
    d = commitDecision(d, {
      selectedOptionId: 'o1',
      decisionDate: '2025-01-01',
      reviewDate: '2025-07-01',
    })
    d = reviseAfterCommit(d, {
      note: 'slip to September',
      predictions: d.predictions.map((p) =>
        p.id === predId
          ? {
              ...p,
              statement: 'Ship by September',
              expectedDate: '2025-09-01',
              confidence: 65,
            }
          : p,
      ),
    })
    d = reviseAfterCommit(d, {
      note: 'slip to December',
      predictions: d.predictions.map((p) =>
        p.id === predId
          ? {
              ...p,
              statement: 'Ship by December',
              expectedDate: '2025-12-01',
              confidence: 50,
            }
          : p,
      ),
    })

    const targets = listHistoricalPredictionTargets(d)
    const statements = targets.map((t) => t.proposition.statement)
    expect(statements).toContain('Ship by June')
    expect(statements).toContain('Ship by September')
    expect(statements).toContain('Ship by December')
    expect(targets).toHaveLength(3)
  })

  it('keeps assumption A and B after remove from working', () => {
    let d = createDecision({ title: 'Asm chain' })
    d = { ...d, options: twoOptions() }
    d = addAssumption(d, {
      statement: 'Demand holds',
      confidence: 80,
      importance: 4,
      falsificationCondition: 'Churn',
    })
    const id = d.assumptions[0]!.id
    d = commitDecision(d, {
      selectedOptionId: 'o1',
      decisionDate: '2025-01-01',
      reviewDate: '2025-02-01',
    })
    d = reviseAfterCommit(d, {
      note: 'soften',
      assumptions: d.assumptions.map((a) =>
        a.id === id ? { ...a, statement: 'Demand mostly holds', confidence: 60 } : a,
      ),
    })
    d = reviseAfterCommit(d, {
      note: 'drop',
      assumptions: [],
    })
    const targets = listHistoricalAssumptionTargets(d)
    expect(targets.map((t) => t.proposition.statement)).toEqual(
      expect.arrayContaining(['Demand holds', 'Demand mostly holds']),
    )
    expect(targets.every((t) => !t.inWorkingState)).toBe(true)
  })

  it('rejects fabricated evaluation fingerprints', () => {
    let d = createDecision({ title: 'Fabricated' })
    d = { ...d, options: twoOptions() }
    d = addPrediction(d, {
      statement: 'Ship by June',
      expectedResult: 'shipped',
      expectedDate: '2025-06-01',
      confidence: 80,
      evaluationCriteria: 'shipped',
    })
    d = commitDecision(d, {
      selectedOptionId: 'o1',
      decisionDate: '2025-01-01',
      reviewDate: '2025-07-01',
    })
    expect(() =>
      recordReview(d, {
        whatHappened: 'x',
        unexpected: '',
        missingInformation: '',
        outcomeRating: 3,
        decisionQualityRating: 3,
        rememberedBelief: null,
        memoryDriftNotes: null,
        assumptionStatuses: [],
        predictionEvaluations: [
          {
            predictionId: d.predictions[0]!.id,
            evaluation: 'CORRECT',
            fingerprint: '{"statement":"Totally fabricated"}',
            provenance: 'at-commit',
          },
        ],
        counterfactualNotes: [],
      }),
    ).toThrow(DomainError)
  })

  it('prior review evaluation survives a later review that omits it', () => {
    let d = createDecision({ title: 'Prior eval' })
    d = { ...d, options: twoOptions() }
    d = addPrediction(d, {
      statement: 'Ship by June',
      expectedResult: 'shipped',
      expectedDate: '2025-06-01',
      confidence: 80,
      evaluationCriteria: 'shipped',
    })
    d = commitDecision(d, {
      selectedOptionId: 'o1',
      decisionDate: '2025-01-01',
      reviewDate: '2025-07-01',
    })
    const commitPred = d.commitSnapshot!.predictions[0]!
    d = reviseAfterCommit(d, {
      note: 'remove',
      predictions: [],
    })
    d = recordReview(d, {
      whatHappened: 'Missed',
      unexpected: '',
      missingInformation: '',
      outcomeRating: 2,
      decisionQualityRating: 4,
      rememberedBelief: null,
      memoryDriftNotes: null,
      assumptionStatuses: [],
      predictionEvaluations: [
        bindPredictionEvaluation(commitPred, 'INCORRECT', 'removed-from-working'),
      ],
      counterfactualNotes: [],
    })
    d = recordReview(d, {
      whatHappened: 'Second pass notes only',
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
    expect(d.priorReviews).toHaveLength(1)
    const resolved = resolvePredictionEvaluation(
      d,
      commitPred.id,
      predictionFingerprint(commitPred),
    )
    expect(resolved).toBe('INCORRECT')
    const { scored } = collectHistoricalPredictionScores([d])
    expect(scored).toHaveLength(1)
    expect(scored[0]?.confidence).toBe(80)
  })

  it('evaluating December does not score June confidence', () => {
    let d = createDecision({ title: 'No leakage' })
    d = { ...d, options: twoOptions() }
    d = addPrediction(d, {
      statement: 'Ship by June',
      expectedResult: 'shipped',
      expectedDate: '2025-06-01',
      confidence: 80,
      evaluationCriteria: 'shipped',
    })
    const predId = d.predictions[0]!.id
    d = commitDecision(d, {
      selectedOptionId: 'o1',
      decisionDate: '2025-01-01',
      reviewDate: '2025-07-01',
    })
    d = reviseAfterCommit(d, {
      note: 'December',
      predictions: d.predictions.map((p) =>
        p.id === predId
          ? {
              ...p,
              statement: 'Ship by December',
              expectedDate: '2025-12-01',
              confidence: 50,
            }
          : p,
      ),
    })
    const later = d.predictions[0]!
    d = recordReview(d, {
      whatHappened: 'Shipped Dec',
      unexpected: '',
      missingInformation: '',
      outcomeRating: 4,
      decisionQualityRating: 3,
      rememberedBelief: null,
      memoryDriftNotes: null,
      assumptionStatuses: [],
      predictionEvaluations: [
        bindPredictionEvaluation(later, 'CORRECT', 'revised-later'),
      ],
      counterfactualNotes: [],
    })
    const buckets = computeCalibration([d])
    expect(buckets.find((b) => b.bucket === '61-80')?.sampleSize).toBe(0)
    expect(buckets.find((b) => b.bucket === '41-60')?.sampleSize).toBe(1)
  })
})
