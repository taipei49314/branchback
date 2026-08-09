import type { Decision, ReviewRecord } from './types'
import {
  buildHistorySequence,
  describeRevisionChanges,
  resolveRevisionAfterState,
  type FieldChange,
} from './revisionDiff'
import { RELATION_KIND_LABELS } from './lineage'
import { describeEvidenceProvenance } from './v2History'

export type ExplorerEventKind =
  | 'commit'
  | 'revision'
  | 'prior-review'
  | 'review'
  | 'relation'
  | 'evidence'
  | 'working'

export interface ExplorerEvent {
  id: string
  kind: ExplorerEventKind
  label: string
  at: string
  detail: string
  changes?: FieldChange[]
  review?: ReviewRecord
  revisionIndex?: number
}

/**
 * Temporal spine: Known Then → revisions → relation/evidence assertions → reviews.
 * Relation/evidence events answer when BranchBack first recorded them (and tombstones).
 */
export function buildHistoryExplorer(decision: Decision): ExplorerEvent[] {
  const events: ExplorerEvent[] = []
  const snap = decision.commitSnapshot
  if (snap) {
    events.push({
      id: 'commit',
      kind: 'commit',
      label: 'Commit (Known Then)',
      at: snap.committedAt,
      detail: `Frozen belief at commit — “${snap.title}”`,
    })
  }

  for (let i = 0; i < decision.revisions.length; i++) {
    const rev = decision.revisions[i]!
    const after = resolveRevisionAfterState(decision, i)
    events.push({
      id: rev.revisionId,
      kind: 'revision',
      label: `Revision ${rev.revisionNumber}`,
      at: rev.createdAt,
      detail: rev.note || 'Post-commit change',
      changes: describeRevisionChanges(rev, after),
      revisionIndex: i,
    })
  }

  for (const rel of decision.relations) {
    events.push({
      id: `relation-add-${rel.id}`,
      kind: 'relation',
      label: 'Lineage link recorded',
      at: rel.createdAt,
      detail: `${RELATION_KIND_LABELS[rel.kind]} → ${rel.targetDecisionId}${rel.note ? ` — ${rel.note}` : ''}`,
    })
    if (rel.removedAt) {
      events.push({
        id: `relation-remove-${rel.id}`,
        kind: 'relation',
        label: 'Lineage link removed',
        at: rel.removedAt,
        detail: `Tombstone for ${RELATION_KIND_LABELS[rel.kind]} → ${rel.targetDecisionId} (original record retained)`,
      })
    }
  }

  for (const ev of decision.evidence) {
    const prov = describeEvidenceProvenance(decision, ev)
    events.push({
      id: `evidence-add-${ev.id}`,
      kind: 'evidence',
      label: 'Evidence recorded',
      at: ev.recordedAt,
      detail: `${ev.label} — ${prov.summary}`,
    })
    if (ev.removedAt) {
      events.push({
        id: `evidence-remove-${ev.id}`,
        kind: 'evidence',
        label: 'Evidence removed',
        at: ev.removedAt,
        detail: `Tombstone for “${ev.label}” (original record retained)`,
      })
    }
  }

  decision.priorReviews.forEach((review, index) => {
    events.push({
      id: `prior-review-${index}`,
      kind: 'prior-review',
      label: `Prior review ${index + 1}`,
      at: review.reviewedAt,
      detail: `Outcome ${review.outcomeRating}/5 · Decision quality ${review.decisionQualityRating}/5`,
      review,
    })
  })

  if (decision.review) {
    events.push({
      id: 'review-latest',
      kind: 'review',
      label: 'Latest review',
      at: decision.review.reviewedAt,
      detail: `Outcome ${decision.review.outcomeRating}/5 · Decision quality ${decision.review.decisionQualityRating}/5`,
      review: decision.review,
    })
  }

  events.sort((a, b) => a.at.localeCompare(b.at))
  return events
}

export function compareExplorerEvents(
  decision: Decision,
  leftId: string,
  rightId: string,
): { left: ExplorerEvent | null; right: ExplorerEvent | null; summary: string } {
  const events = buildHistoryExplorer(decision)
  const left = events.find((e) => e.id === leftId) ?? null
  const right = events.find((e) => e.id === rightId) ?? null
  if (!left || !right) {
    return { left, right, summary: 'Select two timeline events to compare.' }
  }
  if (left.kind === 'revision' && right.kind === 'revision') {
    const changes = right.changes ?? []
    return {
      left,
      right,
      summary: `${changes.length} field change(s) captured on ${right.label}.`,
    }
  }
  return {
    left,
    right,
    summary: `Comparing ${left.label} (${left.at.slice(0, 19)}) with ${right.label} (${right.at.slice(0, 19)}).`,
  }
}

/** Compact sequence used by the detail page; includes prior reviews. */
export function buildEnrichedHistorySequence(decision: Decision): Array<{
  id: string
  label: string
  at: string
  detail: string
  changes?: FieldChange[]
}> {
  const base = buildHistorySequence(decision)
  if (!decision.priorReviews.length) return base
  const withoutLatestReview = base.filter((s) => s.id !== 'review')
  const prior = decision.priorReviews.map((r, i) => ({
    id: `prior-review-${i}`,
    label: `Prior review ${i + 1}`,
    at: r.reviewedAt,
    detail: `Outcome ${r.outcomeRating}/5 · Decision quality ${r.decisionQualityRating}/5`,
  }))
  const latest = decision.review
    ? [
        {
          id: 'review',
          label: 'Latest review',
          at: decision.review.reviewedAt,
          detail: `Outcome ${decision.review.outcomeRating}/5 · Decision quality ${decision.review.decisionQualityRating}/5`,
        },
      ]
    : []
  return [...withoutLatestReview, ...prior, ...latest].sort((a, b) =>
    a.at.localeCompare(b.at),
  )
}
