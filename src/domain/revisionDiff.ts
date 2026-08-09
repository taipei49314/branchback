import type {
  Assumption,
  Decision,
  DecisionRevision,
  Option,
  Prediction,
} from './types'
import { extractRevisionTrackedState } from './revisionContract'
import { canonicalJson } from './canonical'

export interface FieldChange {
  field: string
  label: string
  before: string
  after: string
  kind?:
    | 'text'
    | 'option-added'
    | 'option-removed'
    | 'option-changed'
    | 'assumption-added'
    | 'assumption-removed'
    | 'assumption-changed'
    | 'prediction-added'
    | 'prediction-removed'
    | 'prediction-changed'
    | 'confidence'
    | 'date'
}

function summarize(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value.trim() || '—'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return 'none'
    if (typeof value[0] === 'string') return value.join(', ')
    return `${value.length} items`
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if ('situation' in o) return String(o.situation || '—').slice(0, 160)
    return canonicalJson(value).slice(0, 120)
  }
  return String(value)
}

function optionMap(options: Option[]): Map<string, Option> {
  return new Map(options.map((o) => [o.id, o]))
}

function assumptionMap(list: Assumption[]): Map<string, Assumption> {
  return new Map(list.map((a) => [a.id, a]))
}

function predictionMap(list: Prediction[]): Map<string, Prediction> {
  return new Map(list.map((p) => [p.id, p]))
}

function describeCollectionChanges(
  priorOptions: Option[],
  afterOptions: Option[],
  priorAssumptions: Assumption[],
  afterAssumptions: Assumption[],
  priorPredictions: Prediction[],
  afterPredictions: Prediction[],
): FieldChange[] {
  const changes: FieldChange[] = []
  const po = optionMap(priorOptions)
  const ao = optionMap(afterOptions)
  for (const [id, o] of ao) {
    if (!po.has(id)) {
      changes.push({
        field: 'options',
        label: 'Option added',
        before: '—',
        after: o.title,
        kind: 'option-added',
      })
    } else if (canonicalJson(po.get(id)) !== canonicalJson(o)) {
      const prev = po.get(id)!
      const confChanged = prev.estimatedProbability !== o.estimatedProbability
      changes.push({
        field: 'options',
        label: confChanged ? 'Option confidence changed' : 'Option changed',
        before: `${prev.title} (${prev.estimatedProbability}%)`,
        after: `${o.title} (${o.estimatedProbability}%)`,
        kind: confChanged ? 'confidence' : 'option-changed',
      })
    }
  }
  for (const [id, o] of po) {
    if (!ao.has(id)) {
      changes.push({
        field: 'options',
        label: 'Option removed',
        before: o.title,
        after: '—',
        kind: 'option-removed',
      })
    }
  }

  const pa = assumptionMap(priorAssumptions)
  const aa = assumptionMap(afterAssumptions)
  for (const [id, a] of aa) {
    if (!pa.has(id)) {
      changes.push({
        field: 'assumptions',
        label: 'Assumption added',
        before: '—',
        after: a.statement,
        kind: 'assumption-added',
      })
    } else if (canonicalJson(pa.get(id)) !== canonicalJson(a)) {
      const prev = pa.get(id)!
      const confChanged = prev.confidence !== a.confidence
      changes.push({
        field: 'assumptions',
        label: confChanged
          ? 'Assumption confidence changed'
          : 'Assumption changed',
        before: confChanged
          ? `${prev.statement} (${prev.confidence}%)`
          : prev.statement,
        after: confChanged ? `${a.statement} (${a.confidence}%)` : a.statement,
        kind: confChanged ? 'confidence' : 'assumption-changed',
      })
    }
  }
  for (const [id, a] of pa) {
    if (!aa.has(id)) {
      changes.push({
        field: 'assumptions',
        label: 'Assumption removed',
        before: a.statement,
        after: '—',
        kind: 'assumption-removed',
      })
    }
  }

  const pp = predictionMap(priorPredictions)
  const ap = predictionMap(afterPredictions)
  for (const [id, p] of ap) {
    if (!pp.has(id)) {
      changes.push({
        field: 'predictions',
        label: 'Prediction added',
        before: '—',
        after: p.statement,
        kind: 'prediction-added',
      })
    } else if (canonicalJson(pp.get(id)) !== canonicalJson(p)) {
      const prev = pp.get(id)!
      const confChanged = prev.confidence !== p.confidence
      const dateChanged = prev.expectedDate !== p.expectedDate
      changes.push({
        field: 'predictions',
        label: confChanged
          ? 'Prediction confidence changed'
          : dateChanged
            ? 'Prediction date changed'
            : 'Prediction changed',
        before: `${prev.statement} (${prev.confidence}% · ${prev.expectedDate})`,
        after: `${p.statement} (${p.confidence}% · ${p.expectedDate})`,
        kind: confChanged
          ? 'confidence'
          : dateChanged
            ? 'date'
            : 'prediction-changed',
      })
    }
  }
  for (const [id, p] of pp) {
    if (!ap.has(id)) {
      changes.push({
        field: 'predictions',
        label: 'Prediction removed',
        before: p.statement,
        after: '—',
        kind: 'prediction-removed',
      })
    }
  }

  return changes
}

/** Diff revision-tracked state between a prior revision and after state. */
export function describeRevisionChanges(
  prior: DecisionRevision,
  after: Pick<
    Decision,
    | 'title'
    | 'description'
    | 'context'
    | 'options'
    | 'assumptions'
    | 'predictions'
    | 'selectedOptionId'
    | 'decisionDate'
    | 'reviewDate'
  >,
): FieldChange[] {
  const a = extractRevisionTrackedState(prior)
  const b = extractRevisionTrackedState(after)
  const changes: FieldChange[] = []

  const scalar: Array<[keyof typeof a, string, FieldChange['kind']]> = [
    ['title', 'Title', 'text'],
    ['description', 'Description', 'text'],
    ['selectedOptionId', 'Selected option', 'text'],
    ['decisionDate', 'Decision date', 'date'],
    ['reviewDate', 'Review date', 'date'],
  ]
  for (const [key, label, kind] of scalar) {
    if (canonicalJson(a[key]) !== canonicalJson(b[key])) {
      changes.push({
        field: key,
        label,
        before: summarize(a[key]),
        after: summarize(b[key]),
        kind,
      })
    }
  }

  if (canonicalJson(a.context) !== canonicalJson(b.context)) {
    const fields: Array<[keyof typeof a.context, string]> = [
      ['situation', 'Situation'],
      ['constraints', 'Constraints'],
      ['stakes', 'Stakes'],
      ['deadline', 'Deadline'],
      ['tags', 'Tags'],
      ['peopleInvolved', 'People involved'],
    ]
    for (const [key, label] of fields) {
      if (canonicalJson(a.context[key]) !== canonicalJson(b.context[key])) {
        changes.push({
          field: `context.${key}`,
          label,
          before: summarize(a.context[key]),
          after: summarize(b.context[key]),
          kind: key === 'deadline' ? 'date' : 'text',
        })
      }
    }
  }

  changes.push(
    ...describeCollectionChanges(
      a.options,
      b.options,
      a.assumptions,
      b.assumptions,
      a.predictions,
      b.predictions,
    ),
  )

  return changes
}

export function resolveRevisionAfterState(
  decision: Decision,
  revisionIndex: number,
): Pick<
  Decision,
  | 'title'
  | 'description'
  | 'context'
  | 'options'
  | 'assumptions'
  | 'predictions'
  | 'selectedOptionId'
  | 'decisionDate'
  | 'reviewDate'
> {
  const next = decision.revisions[revisionIndex + 1]
  if (next) {
    return {
      title: next.title,
      description: next.description,
      context: next.context,
      options: next.options,
      assumptions: next.assumptions,
      predictions: next.predictions,
      selectedOptionId: next.selectedOptionId,
      decisionDate: next.decisionDate,
      reviewDate: next.reviewDate,
    }
  }
  return decision
}

/** Known Then → revisions → review sequence for history UI. */
export function buildHistorySequence(decision: Decision): Array<{
  id: string
  label: string
  at: string
  detail: string
  changes?: FieldChange[]
}> {
  const seq: Array<{
    id: string
    label: string
    at: string
    detail: string
    changes?: FieldChange[]
  }> = []
  if (decision.commitSnapshot) {
    seq.push({
      id: 'known-then',
      label: 'Known Then',
      at: decision.commitSnapshot.committedAt,
      detail: `Committed “${decision.commitSnapshot.title}”`,
    })
  }
  for (let i = 0; i < decision.revisions.length; i++) {
    const rev = decision.revisions[i]!
    const after = resolveRevisionAfterState(decision, i)
    seq.push({
      id: rev.revisionId,
      label: `Revision ${rev.revisionNumber}`,
      at: rev.createdAt,
      detail: rev.note,
      changes: describeRevisionChanges(rev, after),
    })
  }
  if (decision.review) {
    seq.push({
      id: 'review',
      label: 'Review',
      at: decision.review.reviewedAt,
      detail: `Outcome ${decision.review.outcomeRating}/5 · Decision quality ${decision.review.decisionQualityRating}/5`,
    })
  }
  return seq
}
