import type {
  CommitSnapshot,
  Decision,
  DecisionRevision,
  ReviewRecord,
} from './types'
import { DomainError } from './errors'
import { canonicalJson } from './canonical'
import { assertPostCommitRevisionCompleteness } from './revisionContract'
import {
  assertEvidenceHistoryIntegrity,
  assertRelationHistoryIntegrity,
} from './v2History'

export { canonicalJson } from './canonical'
export {
  activeEvidence,
  activeRelations,
  assertEvidenceHistoryIntegrity,
  assertRelationHistoryIntegrity,
  describeEvidenceProvenance,
} from './v2History'

export function snapshotsEqual(
  a: CommitSnapshot | null | undefined,
  b: CommitSnapshot | null | undefined,
): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return canonicalJson(a) === canonicalJson(b)
}

export function reviewsEqual(a: ReviewRecord, b: ReviewRecord): boolean {
  return canonicalJson(a) === canonicalJson(b)
}

export function revisionsEqual(
  a: DecisionRevision,
  b: DecisionRevision,
): boolean {
  return canonicalJson(a) === canonicalJson(b)
}

export function collectReviewHistory(decision: Decision): ReviewRecord[] {
  const prior = decision.priorReviews ?? []
  return decision.review ? [...prior, decision.review] : [...prior]
}

export function hasCommittedHistory(decision: Decision): boolean {
  return decision.commitSnapshot !== null
}

/**
 * Append-only / immutable historical structures (persistence boundary):
 * - commitSnapshot (immutable once set)
 * - revisions[] (prefix-stable; only append; authenticity enforced separately)
 * - priorReviews[] + retained review records
 */
export function assertSnapshotIntegrity(
  existing: Decision | undefined,
  incoming: Decision,
): void {
  if (!existing?.commitSnapshot) {
    return
  }

  if (!incoming.commitSnapshot) {
    throw new DomainError(
      'SNAPSHOT_CLEARED',
      'Historical commit snapshot cannot be cleared by an ordinary write.',
    )
  }

  if (!snapshotsEqual(existing.commitSnapshot, incoming.commitSnapshot)) {
    throw new DomainError(
      'SNAPSHOT_TAMPER',
      'Historical commit snapshot cannot be silently rewritten.',
    )
  }
}

/**
 * Previously persisted revisions are append-only.
 * Incoming revisions must start with the exact prior sequence (same content, same order).
 */
export function assertRevisionHistoryIntegrity(
  existing: Decision | undefined,
  incoming: Decision,
): void {
  if (!existing) return
  const prev = existing.revisions ?? []
  if (prev.length === 0) return

  const next = incoming.revisions ?? []
  if (next.length < prev.length) {
    throw new DomainError(
      'REVISION_HISTORY_TAMPER',
      'Previously persisted revisions cannot be removed or shortened.',
    )
  }

  for (let i = 0; i < prev.length; i++) {
    if (!revisionsEqual(prev[i]!, next[i]!)) {
      throw new DomainError(
        'REVISION_HISTORY_TAMPER',
        'Previously persisted revisions cannot be modified, replaced, or reordered.',
      )
    }
  }
}

export function assertReviewHistoryIntegrity(
  existing: Decision | undefined,
  incoming: Decision,
): void {
  if (!existing) return
  const previous = collectReviewHistory(existing)
  if (previous.length === 0) return

  const next = collectReviewHistory(incoming)
  for (const old of previous) {
    const preserved = next.some((r) => reviewsEqual(r, old))
    if (!preserved) {
      throw new DomainError(
        'REVIEW_HISTORY_TAMPER',
        'Previously recorded review cannot be silently rewritten or dropped.',
      )
    }
  }
}

export function assertHistoricalWriteIntegrity(
  existing: Decision | undefined,
  incoming: Decision,
): void {
  if (existing && existing.id !== incoming.id) {
    throw new DomainError(
      'ID_MISMATCH',
      'Cannot save a decision under a different id than the existing record.',
    )
  }
  assertSnapshotIntegrity(existing, incoming)
  assertRevisionHistoryIntegrity(existing, incoming)
  assertReviewHistoryIntegrity(existing, incoming)
  assertRelationHistoryIntegrity(existing, incoming)
  assertEvidenceHistoryIntegrity(existing, incoming)
  if (existing) {
    assertPostCommitRevisionCompleteness(existing, incoming)
  }
}

export function assertReplaceDoesNotOmitCommittedHistory(
  existingDecisions: Decision[],
  incomingDecisions: Decision[],
): void {
  const incomingIds = new Set(incomingDecisions.map((d) => d.id))
  const omitted = existingDecisions.filter(
    (d) => hasCommittedHistory(d) && !incomingIds.has(d.id),
  )
  if (omitted.length > 0) {
    throw new DomainError(
      'REPLACE_OMITS_HISTORY',
      `Replace import omits ${omitted.length} committed decision(s). Use destructive wipe with explicit confirmation to erase historical records.`,
    )
  }
}
