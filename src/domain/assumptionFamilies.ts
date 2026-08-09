import { createId } from './ids'
import type { Assumption, Decision } from './types'
import { assumptionFingerprint } from './historicalIdentity'

export interface AssumptionFamilyMember {
  decisionId: string
  decisionTitle: string
  assumptionId: string
  statement: string
  fingerprint: string
  confidence: number
  status: Assumption['status']
  committed: boolean
}

export interface AssumptionFamilySummary {
  familyId: string
  familyLabel: string
  memberCount: number
  distinctFingerprints: number
  members: AssumptionFamilyMember[]
}

/**
 * Aggregate user-confirmed assumption families across the library.
 * Families are never inferred from text similarity — only explicit familyId.
 */
export function summarizeAssumptionFamilies(
  decisions: Decision[],
): AssumptionFamilySummary[] {
  const map = new Map<
    string,
    {
      familyLabel: string
      members: AssumptionFamilyMember[]
      fingerprints: Set<string>
    }
  >()

  for (const decision of decisions) {
    for (const a of decision.assumptions) {
      if (!a.familyId || !a.familyLabel) continue
      const fp = assumptionFingerprint(a)
      const bucket = map.get(a.familyId) ?? {
        familyLabel: a.familyLabel,
        members: [],
        fingerprints: new Set<string>(),
      }
      bucket.familyLabel = a.familyLabel
      bucket.fingerprints.add(fp)
      bucket.members.push({
        decisionId: decision.id,
        decisionTitle: decision.title,
        assumptionId: a.id,
        statement: a.statement,
        fingerprint: fp,
        confidence: a.confidence,
        status: a.status,
        committed: Boolean(decision.commitSnapshot),
      })
      map.set(a.familyId, bucket)
    }
  }

  return [...map.entries()]
    .map(([familyId, v]) => ({
      familyId,
      familyLabel: v.familyLabel,
      memberCount: v.members.length,
      distinctFingerprints: v.fingerprints.size,
      members: v.members.sort((a, b) =>
        a.decisionTitle.localeCompare(b.decisionTitle),
      ),
    }))
    .sort((a, b) => b.memberCount - a.memberCount || a.familyLabel.localeCompare(b.familyLabel))
}

/** Create a new family id for user confirmation (not a merge). */
export function newAssumptionFamilyId(): string {
  return createId('fam')
}
