import type { Decision, DecisionRelation, RelationKind } from './types'
import { activeRelations } from './v2History'

export const RELATION_KIND_LABELS: Record<RelationKind, string> = {
  'follows-from': 'Follows from',
  'depends-on': 'Depends on',
  revisits: 'Revisits',
  supersedes: 'Supersedes',
  'related-to': 'Related to',
}

export interface ResolvedRelation {
  relation: DecisionRelation
  target: Decision | null
  /** Human-readable temporal note: when the link was recorded. */
  recordedAt: string
}

/** Outbound relations from a decision, resolved against the library. */
export function resolveOutboundRelations(
  decision: Decision,
  library: Decision[],
  { includeRemoved = false }: { includeRemoved?: boolean } = {},
): ResolvedRelation[] {
  const byId = new Map(library.map((d) => [d.id, d]))
  const list = includeRemoved ? decision.relations : activeRelations(decision)
  return list.map((relation) => ({
    relation,
    target: byId.get(relation.targetDecisionId) ?? null,
    recordedAt: relation.createdAt,
  }))
}

/** Inbound: other decisions that point at this one. */
export function resolveInboundRelations(
  decisionId: string,
  library: Decision[],
  { includeRemoved = false }: { includeRemoved?: boolean } = {},
): Array<ResolvedRelation & { source: Decision }> {
  const results: Array<ResolvedRelation & { source: Decision }> = []
  for (const source of library) {
    if (source.id === decisionId) continue
    const list = includeRemoved ? source.relations : activeRelations(source)
    for (const relation of list) {
      if (relation.targetDecisionId !== decisionId) continue
      results.push({
        source,
        relation,
        target: library.find((d) => d.id === decisionId) ?? null,
        recordedAt: relation.createdAt,
      })
    }
  }
  return results.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
}

export function countLibraryRelations(library: Decision[]): {
  totalLinks: number
  byKind: Record<RelationKind, number>
  decisionsWithLinks: number
} {
  const byKind: Record<RelationKind, number> = {
    'follows-from': 0,
    'depends-on': 0,
    revisits: 0,
    supersedes: 0,
    'related-to': 0,
  }
  let totalLinks = 0
  let decisionsWithLinks = 0
  for (const d of library) {
    const active = activeRelations(d)
    if (active.length) decisionsWithLinks += 1
    for (const r of active) {
      totalLinks += 1
      byKind[r.kind] += 1
    }
  }
  return { totalLinks, byKind, decisionsWithLinks }
}
