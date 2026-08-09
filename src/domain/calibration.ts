import type { Decision } from './types'
import {
  listHistoricalPredictionTargets,
  resolvePredictionEvaluation,
} from './historicalIdentity'

export type ConfidenceBucket =
  | '0-20'
  | '21-40'
  | '41-60'
  | '61-80'
  | '81-100'

export interface CalibrationBucket {
  bucket: ConfidenceBucket
  sampleSize: number
  correctCount: number
  observedRate: number | null
  meanConfidence: number | null
  caveat: string
  skippedAmbiguous: number
}

/**
 * Calibration policy:
 * - Object: each historical prediction proposition (fingerprint) in the registry
 * - Confidence: that proposition's own confidence
 * - Evaluation: latest fingerprint-matched evaluation across priorReviews + review
 * - Never pairs one proposition's confidence with another's evaluation
 */

const BUCKETS: Array<{ bucket: ConfidenceBucket; min: number; max: number }> = [
  { bucket: '0-20', min: 0, max: 20 },
  { bucket: '21-40', min: 21, max: 40 },
  { bucket: '41-60', min: 41, max: 60 },
  { bucket: '61-80', min: 61, max: 80 },
  { bucket: '81-100', min: 81, max: 100 },
]

type Scored = {
  confidence: number
  evaluation: 'CORRECT' | 'INCORRECT' | 'PARTIAL'
  fingerprint: string
}

function correctnessWeight(
  evaluation: 'CORRECT' | 'INCORRECT' | 'PARTIAL',
): number {
  if (evaluation === 'CORRECT') return 1
  if (evaluation === 'PARTIAL') return 0.5
  return 0
}

export function collectHistoricalPredictionScores(decisions: Decision[]): {
  scored: Scored[]
  skippedAmbiguous: number
} {
  const scored: Scored[] = []
  let skippedAmbiguous = 0
  for (const d of decisions) {
    if (!d.commitSnapshot) continue
    const targets = listHistoricalPredictionTargets(d)
    for (const t of targets) {
      const evaluation = resolvePredictionEvaluation(
        d,
        t.predictionId,
        t.fingerprint,
      )
      if (
        evaluation === 'CORRECT' ||
        evaluation === 'INCORRECT' ||
        evaluation === 'PARTIAL'
      ) {
        scored.push({
          confidence: t.proposition.confidence,
          evaluation,
          fingerprint: t.fingerprint,
        })
      }
    }
    // Count review rows whose fingerprint is unknown to the registry (should be zero post-v1)
    for (const review of [...(d.priorReviews ?? []), d.review].filter(Boolean)) {
      for (const e of review!.predictionEvaluations) {
        if (!e.fingerprint) continue
        const known = targets.some(
          (t) =>
            t.predictionId === e.predictionId &&
            t.fingerprint === e.fingerprint,
        )
        if (!known && e.evaluation !== 'UNKNOWN') skippedAmbiguous += 1
      }
    }
  }
  return { scored, skippedAmbiguous }
}

export function computeCalibration(decisions: Decision[]): CalibrationBucket[] {
  const { scored: evaluated, skippedAmbiguous } =
    collectHistoricalPredictionScores(decisions)

  return BUCKETS.map(({ bucket, min, max }, i) => {
    const inBucket = evaluated.filter(
      (p) => p.confidence >= min && p.confidence <= max,
    )
    const sampleSize = inBucket.length
    const correctCount = inBucket.reduce(
      (sum, p) => sum + correctnessWeight(p.evaluation),
      0,
    )
    const observedRate = sampleSize === 0 ? null : correctCount / sampleSize
    const meanConfidence =
      sampleSize === 0
        ? null
        : inBucket.reduce((s, p) => s + p.confidence, 0) / sampleSize

    let caveat = ''
    if (sampleSize === 0) {
      caveat = 'No fingerprint-matched evaluations in this confidence range yet.'
    } else if (sampleSize < 5) {
      caveat =
        'Too little data for a stable conclusion. Treat as a weak signal only.'
    } else if (sampleSize < 20) {
      caveat = 'Modest sample — interpret cautiously.'
    } else {
      caveat = 'Sample size is large enough for a rough pattern read.'
    }

    return {
      bucket,
      sampleSize,
      correctCount,
      observedRate,
      meanConfidence,
      caveat,
      skippedAmbiguous: i === 0 ? skippedAmbiguous : 0,
    }
  })
}

export function formatCalibrationSummary(bucket: CalibrationBucket): string {
  if (bucket.sampleSize === 0 || bucket.observedRate === null) {
    return `${bucket.bucket}% stated confidence (historical proposition): no data (n=0).`
  }
  const pct = Math.round(bucket.observedRate * 100)
  return `Historical propositions recorded as ${bucket.bucket}% confident were scored correct ${pct}% of the time (n=${bucket.sampleSize}). ${bucket.caveat}`
}

export function countAmbiguousPredictionEvaluations(
  decisions: Decision[],
): number {
  return collectHistoricalPredictionScores(decisions).skippedAmbiguous
}
