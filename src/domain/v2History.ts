import type {
  Decision,
  DecisionRelation,
  EvidenceRef,
} from './types'
import { DomainError } from './errors'
import { canonicalJson } from './canonical'

export function activeRelations(
  decision: Decision,
): DecisionRelation[] {
  return decision.relations.filter((r) => !r.removedAt)
}

export function activeEvidence(decision: Decision): EvidenceRef[] {
  return decision.evidence.filter((e) => !e.removedAt)
}

/** Identity fields that must never change after a relation is accepted. */
function relationIdentity(r: DecisionRelation): string {
  return canonicalJson({
    id: r.id,
    targetDecisionId: r.targetDecisionId,
    kind: r.kind,
    createdAt: r.createdAt,
  })
}

function evidenceIdentity(e: EvidenceRef): string {
  return canonicalJson({
    id: e.id,
    kind: e.kind,
    label: e.label,
    body: e.body,
    url: e.url,
    availableAt: e.availableAt,
    recordedAt: e.recordedAt,
  })
}

/**
 * Previously accepted relations cannot disappear.
 * Ordinary removal may only set removedAt (tombstone).
 * Identity/provenance fields are immutable after acceptance.
 */
export function assertRelationHistoryIntegrity(
  existing: Decision | undefined,
  incoming: Decision,
): void {
  if (!existing) return
  const prev = existing.relations ?? []
  if (prev.length === 0) return

  const nextById = new Map(incoming.relations.map((r) => [r.id, r]))

  for (const old of prev) {
    const next = nextById.get(old.id)
    if (!next) {
      throw new DomainError(
        'RELATION_HISTORY_TAMPER',
        'Previously accepted lineage relation cannot be silently erased.',
      )
    }
    if (relationIdentity(old) !== relationIdentity(next)) {
      throw new DomainError(
        'RELATION_HISTORY_TAMPER',
        'Previously accepted lineage relation identity cannot be rewritten.',
      )
    }
    if (old.removedAt) {
      if (next.removedAt !== old.removedAt) {
        throw new DomainError(
          'RELATION_HISTORY_TAMPER',
          'Relation tombstone cannot be cleared or rewritten.',
        )
      }
    } else if (next.removedAt) {
      // Allowed: first tombstone.
    } else if (old.note !== next.note) {
      throw new DomainError(
        'RELATION_HISTORY_TAMPER',
        'Active relation note cannot be silently rewritten; remove and record a new link if needed.',
      )
    }
  }
}

export function assertEvidenceHistoryIntegrity(
  existing: Decision | undefined,
  incoming: Decision,
): void {
  if (!existing) return
  const prev = existing.evidence ?? []
  if (prev.length === 0) return

  const nextById = new Map(incoming.evidence.map((e) => [e.id, e]))

  for (const old of prev) {
    const next = nextById.get(old.id)
    if (!next) {
      throw new DomainError(
        'EVIDENCE_HISTORY_TAMPER',
        'Previously accepted evidence reference cannot be silently erased.',
      )
    }
    if (evidenceIdentity(old) !== evidenceIdentity(next)) {
      throw new DomainError(
        'EVIDENCE_HISTORY_TAMPER',
        'Previously accepted evidence identity/provenance cannot be rewritten.',
      )
    }
    if (old.removedAt) {
      if (next.removedAt !== old.removedAt) {
        throw new DomainError(
          'EVIDENCE_HISTORY_TAMPER',
          'Evidence tombstone cannot be cleared or rewritten.',
        )
      }
    }
  }
}

/**
 * Evidence provenance: distinguish user-claimed availability from when
 * BranchBack first recorded the reference.
 */
export function describeEvidenceProvenance(
  decision: Decision,
  evidence: EvidenceRef,
): {
  claimedAvailability: EvidenceRef['availableAt']
  recordedAt: string
  relativeToCommit: 'before-commit' | 'at-or-after-commit' | 'no-commit-yet'
  summary: string
} {
  const claimedAvailability = evidence.availableAt
  const recordedAt = evidence.recordedAt
  const snap = decision.commitSnapshot
  let relativeToCommit: 'before-commit' | 'at-or-after-commit' | 'no-commit-yet' =
    'no-commit-yet'
  if (snap) {
    relativeToCommit =
      recordedAt < snap.committedAt ? 'before-commit' : 'at-or-after-commit'
  }

  const recordedDay = recordedAt.slice(0, 10)
  let summary: string
  if (claimedAvailability === 'later') {
    summary = `Discovered later · recorded ${recordedDay}`
  } else if (relativeToCommit === 'before-commit') {
    summary = `Available then · recorded by BranchBack before commit (${recordedDay})`
  } else if (relativeToCommit === 'at-or-after-commit') {
    summary = `Claimed available then · recorded later on ${recordedDay}`
  } else {
    summary = `Claimed available then · recorded ${recordedDay} (decision not yet committed)`
  }

  return {
    claimedAvailability,
    recordedAt,
    relativeToCommit,
    summary,
  }
}
