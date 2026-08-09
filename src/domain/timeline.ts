import type { Decision } from './types'
import { temporalSortKey } from './dates'

export type TimelineTone =
  | 'commit'
  | 'revision'
  | 'expect'
  | 'review'
  | 'create'
  | 'future'

export interface TimelineEvent {
  id: string
  at: string
  sortKey: string
  kind: string
  title: string
  decisionId: string
  /** Title frozen for display — prefer commit snapshot title when available. */
  decisionTitle: string
  tone: TimelineTone
  horizon: 'past' | 'future' | 'present'
}

function historicalTitle(d: Decision): string {
  return d.commitSnapshot?.title ?? d.title
}

export function eventsForDecision(
  d: Decision,
  asOf: Date = new Date(),
): TimelineEvent[] {
  const asOfKey = temporalSortKey(asOf.toISOString())
  const decisionTitle = historicalTitle(d)
  const events: TimelineEvent[] = [
    {
      id: `${d.id}-created`,
      at: d.createdAt,
      sortKey: temporalSortKey(d.createdAt),
      kind: 'Created',
      title: 'Draft opened',
      decisionId: d.id,
      decisionTitle,
      tone: 'create',
      horizon: 'past',
    },
  ]
  if (d.commitSnapshot) {
    events.push({
      id: `${d.id}-committed`,
      at: d.commitSnapshot.committedAt,
      sortKey: temporalSortKey(d.commitSnapshot.committedAt),
      kind: 'Committed',
      title: 'Known Then frozen',
      decisionId: d.id,
      decisionTitle,
      tone: 'commit',
      horizon: 'past',
    })
    for (const p of d.commitSnapshot.predictions) {
      const sortKey = temporalSortKey(p.expectedDate)
      events.push({
        id: `${d.id}-pred-${p.id}`,
        at: p.expectedDate,
        sortKey,
        kind: 'Prediction expected',
        title: p.statement,
        decisionId: d.id,
        decisionTitle,
        tone: sortKey > asOfKey ? 'future' : 'expect',
        horizon: sortKey > asOfKey ? 'future' : 'past',
      })
    }
    const reviewDueKey = temporalSortKey(d.commitSnapshot.reviewDate)
    events.push({
      id: `${d.id}-review-due`,
      at: d.commitSnapshot.reviewDate,
      sortKey: reviewDueKey,
      kind: 'Review due',
      title: 'Scheduled review',
      decisionId: d.id,
      decisionTitle,
      tone: reviewDueKey > asOfKey ? 'future' : 'expect',
      horizon: reviewDueKey > asOfKey ? 'future' : 'past',
    })
  }
  for (const rev of d.revisions) {
    events.push({
      id: rev.revisionId,
      at: rev.createdAt,
      sortKey: temporalSortKey(rev.createdAt),
      kind: `Revision r${rev.revisionNumber}`,
      title: rev.note,
      decisionId: d.id,
      decisionTitle,
      tone: 'revision',
      horizon: 'past',
    })
  }
  if (d.review) {
    events.push({
      id: `${d.id}-reviewed`,
      at: d.review.reviewedAt,
      sortKey: temporalSortKey(d.review.reviewedAt),
      kind: 'Reviewed',
      title: `Outcome ${d.review.outcomeRating}/5 · Decision quality ${d.review.decisionQualityRating}/5`,
      decisionId: d.id,
      decisionTitle,
      tone: 'review',
      horizon: 'past',
    })
  }
  return events
}

export function buildTimeline(
  decisions: Decision[],
  asOf: Date = new Date(),
): {
  chronological: TimelineEvent[]
  byDecision: Array<{ decisionId: string; title: string; events: TimelineEvent[] }>
} {
  const chronological = decisions
    .flatMap((d) => eventsForDecision(d, asOf))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  const map = new Map<string, TimelineEvent[]>()
  for (const e of chronological) {
    const list = map.get(e.decisionId) ?? []
    list.push(e)
    map.set(e.decisionId, list)
  }
  const byDecision = [...map.entries()].map(([decisionId, events]) => ({
    decisionId,
    title: events[0]?.decisionTitle ?? decisionId,
    events,
  }))

  return { chronological, byDecision }
}
