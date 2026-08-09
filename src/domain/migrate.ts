import type { Decision } from './types'
import { decisionSchema, assertSupportedExportSchema } from './schema'

function migrateAssumption(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const row = raw as Record<string, unknown>
  return {
    ...row,
    familyId: row.familyId ?? null,
    familyLabel: row.familyLabel ?? null,
  }
}

function migrateAssumptionList(raw: unknown): unknown {
  return Array.isArray(raw) ? raw.map(migrateAssumption) : raw
}

function migrateNestedDecisionBody(record: Record<string, unknown>): Record<string, unknown> {
  const commit =
    record.commitSnapshot && typeof record.commitSnapshot === 'object'
      ? {
          ...(record.commitSnapshot as Record<string, unknown>),
          assumptions: migrateAssumptionList(
            (record.commitSnapshot as Record<string, unknown>).assumptions,
          ),
        }
      : record.commitSnapshot

  const revisions = Array.isArray(record.revisions)
    ? record.revisions.map((rev) => {
        if (!rev || typeof rev !== 'object') return rev
        const r = rev as Record<string, unknown>
        return {
          ...r,
          assumptions: migrateAssumptionList(r.assumptions),
        }
      })
    : record.revisions

  return {
    ...record,
    assumptions: migrateAssumptionList(record.assumptions),
    commitSnapshot: commit,
    revisions,
    priorReviews: Array.isArray(record.priorReviews)
      ? record.priorReviews
      : [],
    relations: Array.isArray(record.relations)
      ? record.relations.map((rel) => {
          if (!rel || typeof rel !== 'object') return rel
          const row = rel as Record<string, unknown>
          return { ...row, removedAt: row.removedAt ?? null }
        })
      : [],
    evidence: Array.isArray(record.evidence)
      ? record.evidence.map((ev) => {
          if (!ev || typeof ev !== 'object') return ev
          const row = ev as Record<string, unknown>
          return { ...row, removedAt: row.removedAt ?? null }
        })
      : [],
    protocolId: record.protocolId ?? 'general',
  }
}

/** Normalize older persisted shapes into the current Decision contract (schema 5). */
export function migrateDecision(raw: unknown): Decision {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return decisionSchema.parse(migrateNestedDecisionBody(record))
}

export function migrateExportPayload(raw: unknown): {
  schemaVersion: number
  exportedAt: string
  decisions: Decision[]
} {
  if (!raw || typeof raw !== 'object') {
    throw new Error('INVALID_BACKUP: expected a BranchBack JSON object')
  }
  const payload = raw as Record<string, unknown>
  assertSupportedExportSchema(payload.schemaVersion)
  const decisions = Array.isArray(payload.decisions)
    ? payload.decisions.map((d) => migrateDecision(d))
    : []
  return {
    schemaVersion: Number(payload.schemaVersion),
    exportedAt: String(payload.exportedAt ?? ''),
    decisions,
  }
}
