import type { CommitSnapshot, Decision } from './types'

export type MemoryDriftSignal =
  | 'recorded-then'
  | 'remembered-now'
  | 'omitted-in-memory'
  | 'newly-remembered'

export interface MemoryDriftRow {
  label: string
  recordedThen: string
  rememberedNow: string
  signal: MemoryDriftSignal
  note: string
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length > 2),
  )
}

function mentions(haystack: string, needle: string): boolean {
  const n = needle.trim().toLowerCase()
  if (!n) return false
  if (haystack.toLowerCase().includes(n)) return true
  const ht = tokens(haystack)
  const nt = [...tokens(needle)]
  if (!nt.length) return false
  const hits = nt.filter((t) => ht.has(t)).length
  return hits / nt.length >= 0.5
}

/**
 * Deterministic Memory Drift rows — no LLM.
 * Signals are mechanical string overlap only.
 */
export function buildMemoryDriftComparison(
  snap: CommitSnapshot,
  rememberedBelief: string,
): MemoryDriftRow[] {
  const remembered = rememberedBelief.trim()
  const chosen =
    snap.options.find((o) => o.id === snap.selectedOptionId) ?? null
  const rejected = snap.options.filter((o) => o.id !== snap.selectedOptionId)
  const rows: MemoryDriftRow[] = []

  const chosenTitle = chosen?.title ?? '—'
  const chosenMentioned = remembered
    ? mentions(remembered, chosenTitle)
    : false
  rows.push({
    label: 'Chosen option',
    recordedThen: chosenTitle,
    rememberedNow: remembered || '—',
    signal: !remembered
      ? 'recorded-then'
      : chosenMentioned
        ? 'remembered-now'
        : 'omitted-in-memory',
    note: chosenMentioned
      ? 'Remembered text mentions the recorded choice.'
      : remembered
        ? 'Remembered text does not clearly mention the recorded choice.'
        : 'No remembered belief recorded.',
  })

  const reasons = chosen?.reasonsForChoosing ?? []
  if (reasons.length) {
    const joined = reasons.join('; ')
    const hit = remembered ? reasons.some((r) => mentions(remembered, r)) : false
    rows.push({
      label: 'Major reasons',
      recordedThen: joined,
      rememberedNow: remembered || '—',
      signal: !remembered
        ? 'recorded-then'
        : hit
          ? 'remembered-now'
          : 'omitted-in-memory',
      note: hit
        ? 'At least one recorded reason appears in memory.'
        : 'Recorded reasons are not clearly present in memory.',
    })
  }

  if (rejected.length) {
    const titles = rejected.map((o) => o.title).join(' · ')
    const hit = remembered
      ? rejected.some((o) => mentions(remembered, o.title))
      : false
    rows.push({
      label: 'Rejected alternatives',
      recordedThen: titles,
      rememberedNow: remembered || '—',
      signal: !remembered
        ? 'recorded-then'
        : hit
          ? 'remembered-now'
          : 'omitted-in-memory',
      note: hit
        ? 'Memory mentions at least one rejected option.'
        : 'Rejected options are not clearly present in memory.',
    })
  }

  for (const a of snap.assumptions.slice(0, 4)) {
    const hit = remembered ? mentions(remembered, a.statement) : false
    rows.push({
      label: `Assumption (${a.confidence}% then)`,
      recordedThen: a.statement,
      rememberedNow: remembered || '—',
      signal: !remembered
        ? 'recorded-then'
        : hit
          ? 'remembered-now'
          : 'omitted-in-memory',
      note: hit
        ? 'Assumption appears reflected in memory.'
        : 'Assumption not clearly reflected in memory.',
    })
  }

  for (const p of snap.predictions.slice(0, 3)) {
    const hit = remembered ? mentions(remembered, p.statement) : false
    rows.push({
      label: `Prediction (${p.confidence}% then)`,
      recordedThen: `${p.statement} · criteria: ${p.evaluationCriteria || '—'}`,
      rememberedNow: remembered || '—',
      signal: !remembered
        ? 'recorded-then'
        : hit
          ? 'remembered-now'
          : 'omitted-in-memory',
      note: hit
        ? 'Prediction appears reflected in memory.'
        : 'Prediction not clearly reflected in memory.',
    })
  }

  if (snap.context.situation) {
    const hit = remembered ? mentions(remembered, snap.context.situation) : false
    rows.push({
      label: 'Important context',
      recordedThen: snap.context.situation,
      rememberedNow: remembered || '—',
      signal: !remembered
        ? 'recorded-then'
        : hit
          ? 'remembered-now'
          : 'omitted-in-memory',
      note: hit
        ? 'Situation themes appear in memory.'
        : 'Situation text is not clearly present in memory.',
    })
  }

  if (remembered) {
    const recordedBlob = [
      chosenTitle,
      ...(chosen?.reasonsForChoosing ?? []),
      ...rejected.map((o) => o.title),
      ...snap.assumptions.map((a) => a.statement),
      ...snap.predictions.map((p) => p.statement),
      snap.context.situation,
    ].join(' ')
    const remTokens = [...tokens(remembered)]
    const novel = remTokens.filter((t) => !tokens(recordedBlob).has(t))
    if (novel.length >= 3) {
      rows.push({
        label: 'Memory-only themes',
        recordedThen: '—',
        rememberedNow: novel.slice(0, 8).join(', '),
        signal: 'newly-remembered',
        note: 'Words appearing in memory that are not prominent in the recorded Known Then text (mechanical token check only).',
      })
    }
  }

  return rows
}

export function memoryDriftSignalLabel(signal: MemoryDriftSignal): string {
  switch (signal) {
    case 'recorded-then':
      return 'Recorded then'
    case 'remembered-now':
      return 'Remembered now'
    case 'omitted-in-memory':
      return 'Omitted in memory'
    case 'newly-remembered':
      return 'Newly remembered'
  }
}

export function buildReviewSummary(decision: Decision): {
  whatHappened: string
  decisionQuality: number | null
  outcomeQuality: number | null
  failedAssumptions: string[]
  missedPredictions: string[]
  memoryDrift: string | null
  unknowable: string
} | null {
  const review = decision.review
  if (!review) return null
  const failedAssumptions = decision.assumptions
    .filter((a) => a.status === 'FAILED')
    .map((a) => a.statement)
  const missedPredictions = decision.predictions
    .filter((p) => p.evaluation === 'INCORRECT' || p.evaluation === 'PARTIAL')
    .map((p) => p.statement)
  return {
    whatHappened: review.whatHappened,
    decisionQuality: review.decisionQualityRating,
    outcomeQuality: review.outcomeRating,
    failedAssumptions,
    missedPredictions,
    memoryDrift: review.rememberedBelief
      ? review.memoryDriftNotes ??
        'Remembered belief was recorded for Memory Drift comparison.'
      : null,
    unknowable:
      'Unchosen branches remain counterfactual — BranchBack does not invent what would have happened.',
  }
}
