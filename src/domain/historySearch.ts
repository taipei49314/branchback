import type { Decision } from './types'
import { describeRevisionChanges, resolveRevisionAfterState } from './revisionDiff'

export type HistoryLayer =
  | 'title'
  | 'description'
  | 'context'
  | 'option'
  | 'assumption'
  | 'prediction'
  | 'review'
  | 'relation'
  | 'evidence'
  | 'tag'

export interface HistorySearchHit {
  decisionId: string
  decisionTitle: string
  layer: HistoryLayer
  /** Where in the temporal stack this text lives. */
  provenanceLabel: string
  excerpt: string
  at: string | null
}

function pushHit(
  hits: HistorySearchHit[],
  hit: HistorySearchHit,
  needle: string,
): void {
  if (hit.excerpt.toLowerCase().includes(needle)) hits.push(hit)
}

/**
 * Search across historical layers with explicit provenance.
 * Never presents later text as if it were Known Then.
 */
export function searchDecisionHistory(
  decisions: Decision[],
  query: string,
  limit = 80,
): HistorySearchHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const hits: HistorySearchHit[] = []

  for (const d of decisions) {
    pushHit(
      hits,
      {
        decisionId: d.id,
        decisionTitle: d.title,
        layer: 'title',
        provenanceLabel: 'Working title (may include later edits)',
        excerpt: d.title,
        at: d.updatedAt,
      },
      needle,
    )
    pushHit(
      hits,
      {
        decisionId: d.id,
        decisionTitle: d.title,
        layer: 'description',
        provenanceLabel: 'Working description (may include later edits)',
        excerpt: d.description,
        at: d.updatedAt,
      },
      needle,
    )

    const snap = d.commitSnapshot
    if (snap) {
      pushHit(
        hits,
        {
          decisionId: d.id,
          decisionTitle: d.title,
          layer: 'context',
          provenanceLabel: 'Known Then — situation at commit',
          excerpt: snap.context.situation,
          at: snap.committedAt,
        },
        needle,
      )
      for (const o of snap.options) {
        pushHit(
          hits,
          {
            decisionId: d.id,
            decisionTitle: d.title,
            layer: 'option',
            provenanceLabel: 'Known Then — option at commit',
            excerpt: `${o.title}: ${o.description}`,
            at: snap.committedAt,
          },
          needle,
        )
      }
      for (const a of snap.assumptions) {
        pushHit(
          hits,
          {
            decisionId: d.id,
            decisionTitle: d.title,
            layer: 'assumption',
            provenanceLabel: 'Known Then — assumption at commit',
            excerpt: a.statement,
            at: snap.committedAt,
          },
          needle,
        )
      }
      for (const p of snap.predictions) {
        pushHit(
          hits,
          {
            decisionId: d.id,
            decisionTitle: d.title,
            layer: 'prediction',
            provenanceLabel: 'Known Then — prediction at commit',
            excerpt: p.statement,
            at: snap.committedAt,
          },
          needle,
        )
      }
    }

    for (let i = 0; i < d.revisions.length; i++) {
      const rev = d.revisions[i]!
      const after = resolveRevisionAfterState(d, i)
      const changes = describeRevisionChanges(rev, after)
      pushHit(
        hits,
        {
          decisionId: d.id,
          decisionTitle: d.title,
          layer: 'description',
          provenanceLabel: `Revision ${rev.revisionNumber} — note`,
          excerpt: rev.note,
          at: rev.createdAt,
        },
        needle,
      )
      for (const c of changes) {
        pushHit(
          hits,
          {
            decisionId: d.id,
            decisionTitle: d.title,
            layer: 'description',
            provenanceLabel: `Revision ${rev.revisionNumber} — ${c.label}`,
            excerpt: `${c.before} → ${c.after}`,
            at: rev.createdAt,
          },
          needle,
        )
      }
      for (const a of after.assumptions) {
        pushHit(
          hits,
          {
            decisionId: d.id,
            decisionTitle: d.title,
            layer: 'assumption',
            provenanceLabel: `After revision ${rev.revisionNumber} (working state then)`,
            excerpt: a.statement,
            at: rev.createdAt,
          },
          needle,
        )
      }
      for (const p of after.predictions) {
        pushHit(
          hits,
          {
            decisionId: d.id,
            decisionTitle: d.title,
            layer: 'prediction',
            provenanceLabel: `After revision ${rev.revisionNumber} (working state then)`,
            excerpt: p.statement,
            at: rev.createdAt,
          },
          needle,
        )
      }
    }

    // Working copy (explicitly labeled as possibly later)
    pushHit(
      hits,
      {
        decisionId: d.id,
        decisionTitle: d.title,
        layer: 'context',
        provenanceLabel: 'Working context (may include later edits)',
        excerpt: d.context.situation,
        at: d.updatedAt,
      },
      needle,
    )
    for (const tag of d.context.tags) {
      pushHit(
        hits,
        {
          decisionId: d.id,
          decisionTitle: d.title,
          layer: 'tag',
          provenanceLabel: 'Working tags',
          excerpt: tag,
          at: d.updatedAt,
        },
        needle,
      )
    }
    for (const a of d.assumptions) {
      pushHit(
        hits,
        {
          decisionId: d.id,
          decisionTitle: d.title,
          layer: 'assumption',
          provenanceLabel: 'Working assumption (may include later edits)',
          excerpt: a.statement,
          at: d.updatedAt,
        },
        needle,
      )
    }
    for (const p of d.predictions) {
      pushHit(
        hits,
        {
          decisionId: d.id,
          decisionTitle: d.title,
          layer: 'prediction',
          provenanceLabel: 'Working prediction (may include later edits)',
          excerpt: p.statement,
          at: d.updatedAt,
        },
        needle,
      )
    }

    const reviews = [...d.priorReviews, ...(d.review ? [d.review] : [])]
    reviews.forEach((r, idx) => {
      const label =
        idx < d.priorReviews.length
          ? `Prior review ${idx + 1}`
          : 'Latest review'
      pushHit(
        hits,
        {
          decisionId: d.id,
          decisionTitle: d.title,
          layer: 'review',
          provenanceLabel: `${label} — what happened`,
          excerpt: r.whatHappened,
          at: r.reviewedAt,
        },
        needle,
      )
      pushHit(
        hits,
        {
          decisionId: d.id,
          decisionTitle: d.title,
          layer: 'review',
          provenanceLabel: `${label} — unexpected`,
          excerpt: r.unexpected,
          at: r.reviewedAt,
        },
        needle,
      )
      if (r.memoryDriftNotes) {
        pushHit(
          hits,
          {
            decisionId: d.id,
            decisionTitle: d.title,
            layer: 'review',
            provenanceLabel: `${label} — memory drift`,
            excerpt: r.memoryDriftNotes,
            at: r.reviewedAt,
          },
          needle,
        )
      }
    })

    for (const rel of d.relations) {
      pushHit(
        hits,
        {
          decisionId: d.id,
          decisionTitle: d.title,
          layer: 'relation',
          provenanceLabel: `Lineage link recorded ${rel.createdAt.slice(0, 10)}`,
          excerpt: `${rel.kind} ${rel.note}`,
          at: rel.createdAt,
        },
        needle,
      )
    }
    for (const e of d.evidence) {
      pushHit(
        hits,
        {
          decisionId: d.id,
          decisionTitle: d.title,
          layer: 'evidence',
          provenanceLabel: `Evidence marked available ${e.availableAt} (recorded ${e.recordedAt.slice(0, 10)})`,
          excerpt: `${e.label} ${e.body}`,
          at: e.recordedAt,
        },
        needle,
      )
    }
  }

  return hits.slice(0, limit)
}
