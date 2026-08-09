import type { Decision } from './types'
import { SCHEMA_VERSION } from './types'
import {
  assertInvariants,
  checkDecisionInvariants,
} from './invariants'
import { assertSupportedExportSchema } from './schema'
import { migrateDecision } from './migrate'

export type BackupHealthStatus =
  | 'healthy'
  | 'warning'
  | 'invalid'
  | 'unsupported'

export interface BackupHealthReport {
  /** @deprecated prefer `status` — kept for older UI call sites */
  ok: boolean
  status: BackupHealthStatus
  schemaVersion: number | string
  decisionCount: number
  committedCount: number
  reviewedCount: number
  issues: string[]
  warnings: string[]
  /** True when this payload should be importable under current BranchBack rules. */
  importable: boolean
}

/**
 * Non-destructive health check for a backup payload or in-memory library.
 * Fail closed on unsupported schemas; never discards history to "recover".
 * Preview validity must agree with fundamental import validity.
 */
export function assessBackupHealth(raw: unknown): BackupHealthReport {
  const issues: string[] = []
  const warnings: string[] = []

  if (!raw || typeof raw !== 'object') {
    return {
      ok: false,
      status: 'invalid',
      schemaVersion: 'invalid',
      decisionCount: 0,
      committedCount: 0,
      reviewedCount: 0,
      issues: ['Payload is not a JSON object.'],
      warnings: [],
      importable: false,
    }
  }

  const payload = raw as Record<string, unknown>
  try {
    assertSupportedExportSchema(payload.schemaVersion)
  } catch (e) {
    return {
      ok: false,
      status: 'unsupported',
      schemaVersion: String(payload.schemaVersion ?? 'missing'),
      decisionCount: Array.isArray(payload.decisions)
        ? payload.decisions.length
        : 0,
      committedCount: 0,
      reviewedCount: 0,
      issues: [e instanceof Error ? e.message : 'Unsupported schema'],
      warnings: [],
      importable: false,
    }
  }

  if (!Array.isArray(payload.decisions)) {
    issues.push('Backup missing decisions array.')
  }

  const rawDecisions = Array.isArray(payload.decisions)
    ? payload.decisions
    : []
  let committedCount = 0
  let reviewedCount = 0
  const ids = new Set<string>()

  for (const row of rawDecisions) {
    if (!row || typeof row !== 'object') {
      issues.push('Encountered a non-object decision entry.')
      continue
    }
    let d: Decision
    try {
      d = migrateDecision(row)
    } catch (e) {
      issues.push(
        `Decision failed schema migration: ${e instanceof Error ? e.message : 'invalid'}`,
      )
      continue
    }

    if (!d.id) issues.push('Decision missing id.')
    else if (ids.has(d.id)) issues.push(`Duplicate decision id: ${d.id}`)
    else ids.add(d.id)

    if (d.commitSnapshot) committedCount += 1
    if (d.review) reviewedCount += 1

    try {
      assertInvariants(d)
    } catch (e) {
      issues.push(
        `${d.title || d.id}: ${e instanceof Error ? e.message : 'invariant failed'}`,
      )
      continue
    }

    const soft = checkDecisionInvariants(d)
    if (!soft.ok) {
      warnings.push(`${d.title ?? d.id}: ${soft.violations.join('; ')}`)
    }
  }

  if (
    typeof payload.schemaVersion === 'number' &&
    payload.schemaVersion < SCHEMA_VERSION
  ) {
    warnings.push(
      `Backup schema ${payload.schemaVersion} will migrate to ${SCHEMA_VERSION} on import.`,
    )
  }

  const status: BackupHealthStatus =
    issues.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'healthy'

  return {
    ok: status === 'healthy' || status === 'warning',
    status,
    schemaVersion: payload.schemaVersion as number | string,
    decisionCount: rawDecisions.length,
    committedCount,
    reviewedCount,
    issues,
    warnings: warnings.slice(0, 40),
    importable: issues.length === 0,
  }
}

export function assessLibraryHealth(decisions: Decision[]): BackupHealthReport {
  return assessBackupHealth({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    decisions,
  })
}

export function backupHealthLabel(status: BackupHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'warning':
      return 'Warning'
    case 'invalid':
      return 'Invalid / cannot import'
    case 'unsupported':
      return 'Unsupported future version'
  }
}
