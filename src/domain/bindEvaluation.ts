import type {
  Assumption,
  AssumptionStatus,
  Prediction,
  PredictionEvaluation,
} from './types'
import type { PropositionProvenance } from './historicalIdentity'
import {
  assumptionFingerprint,
  predictionFingerprint,
} from './historicalIdentity'

export function bindPredictionEvaluation(
  prediction: Prediction,
  evaluation: PredictionEvaluation,
  provenance: PropositionProvenance = 'at-commit',
) {
  return {
    predictionId: prediction.id,
    evaluation,
    fingerprint: predictionFingerprint(prediction),
    provenance,
  }
}

export function bindAssumptionStatus(
  assumption: Assumption,
  status: AssumptionStatus,
  provenance: PropositionProvenance = 'at-commit',
) {
  return {
    assumptionId: assumption.id,
    status,
    fingerprint: assumptionFingerprint(assumption),
    provenance,
  }
}
