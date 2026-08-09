import {
  addAssumption,
  addOption,
  addPrediction,
  commitDecision,
  createDecision,
  recordReview,
  reviseAfterCommit,
  addDecisionRelation,
} from './decision'
import {
  bindAssumptionStatus,
  bindPredictionEvaluation,
} from './bindEvaluation'
import { calendarDayFromInstant } from './dates'
import type { Decision, Rating } from './types'

function dayOffset(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number)
  return calendarDayFromInstant(new Date(y!, m! - 1, d! + days))
}

/**
 * Deterministic synthetic library for scale tests — not shipped as default demo.
 */
export function generateSyntheticLibrary(count: number): Decision[] {
  const n = Math.max(0, Math.min(count, 2000))
  const decisions: Decision[] = []
  const baseDay = '2020-01-01'
  const protocols = [
    'general',
    'purchase',
    'career',
    'project',
    'financial',
    'irreversible',
  ] as const

  for (let i = 0; i < n; i++) {
    const title = `Synthetic decision ${String(i + 1).padStart(4, '0')}`
    let d = createDecision({
      title,
      description: `Scale fixture #${i + 1}`,
      protocolId: protocols[i % 6],
      context: {
        situation: `Situation for ${title}`,
        constraints: 'Synthetic constraints',
        stakes: 'Synthetic stakes',
        tags: i % 5 === 0 ? ['scale', 'fixture'] : ['scale'],
      },
      decisionDate: dayOffset(baseDay, i % 365),
      reviewDate: dayOffset(baseDay, (i % 365) + 30),
    })

    d = addOption(d, {
      title: 'Option A',
      description: 'Accept',
      perceivedUpside: 'Upside A',
      perceivedDownside: 'Downside A',
      estimatedProbability: 40 + (i % 40),
      reasonsForChoosing: ['Reason A'],
      reasonsForRejecting: [],
    })
    d = addOption(d, {
      title: 'Option B',
      description: 'Decline',
      perceivedUpside: 'Upside B',
      perceivedDownside: 'Downside B',
      estimatedProbability: 60 - (i % 40),
      reasonsForChoosing: [],
      reasonsForRejecting: ['Reason B'],
    })

    d = addAssumption(d, {
      statement: `Core assumption ${i % 17}`,
      confidence: 50 + (i % 45),
      importance: ((i % 5) + 1) as Rating,
      falsificationCondition: 'If counterexample appears',
      familyId: i % 11 === 0 ? `fam-scale-${i % 3}` : null,
      familyLabel: i % 11 === 0 ? `Scale family ${i % 3}` : null,
    })
    d = addPrediction(d, {
      statement: `Prediction ${i % 13}`,
      expectedResult: 'Result',
      expectedDate: dayOffset(baseDay, (i % 365) + 14),
      confidence: 40 + (i % 50),
      evaluationCriteria: 'Observable outcome',
    })

    if (i % 19 === 0) {
      decisions.push(d)
      continue
    }

    d = commitDecision(d, {
      selectedOptionId: d.options[0]!.id,
      decisionDate: d.decisionDate ?? dayOffset(baseDay, i % 365),
      reviewDate: d.reviewDate ?? dayOffset(baseDay, (i % 365) + 30),
    })

    if (i % 4 === 0) {
      d = reviseAfterCommit(d, {
        note: `Synthetic revision for ${title}`,
        description: `${d.description} (revised)`,
      })
    }
    if (i % 7 === 0) {
      d = reviseAfterCommit(d, {
        note: 'Second synthetic revision',
        context: { ...d.context, stakes: 'Updated stakes' },
      })
    }

    if (i % 3 === 0) {
      const assumptionStatuses = d.assumptions.map((a) =>
        bindAssumptionStatus(
          a,
          (['HELD', 'FAILED', 'PARTIAL', 'UNTESTABLE'] as const)[i % 4]!,
        ),
      )
      const predictionEvaluations = d.predictions.map((p) =>
        bindPredictionEvaluation(
          p,
          (['CORRECT', 'INCORRECT', 'PARTIAL', 'UNKNOWN'] as const)[i % 4]!,
        ),
      )
      d = recordReview(d, {
        whatHappened: `Outcome narrative ${i}`,
        unexpected: i % 5 === 0 ? 'Something unexpected' : '',
        missingInformation: '',
        outcomeRating: ((i % 5) + 1) as Rating,
        decisionQualityRating: (((i + 2) % 5) + 1) as Rating,
        rememberedBelief:
          i % 8 === 0 ? 'I thought it would go differently' : null,
        memoryDriftNotes:
          i % 8 === 0 ? 'Drift between memory and Known Then' : null,
        assumptionStatuses,
        predictionEvaluations,
        counterfactualNotes: [],
      })
    }

    if (i > 0 && i % 9 === 0) {
      const target = decisions[Math.max(0, decisions.length - 5)]
      if (target?.commitSnapshot) {
        d = addDecisionRelation(d, {
          targetDecisionId: target.id,
          kind: (['follows-from', 'related-to', 'revisits'] as const)[i % 3]!,
          note: 'Synthetic lineage',
        })
      }
    }

    decisions.push(d)
  }

  return decisions
}
