import {
  SCHEMA_VERSION,
  type BranchBackExport,
  type Decision,
} from '@/domain/types'
import { assertSupportedExportSchema } from '@/domain/schema'
import { nowIso } from '@/domain/ids'
import { assertInvariants } from '@/domain/invariants'
import {
  assertHistoricalWriteIntegrity,
  assertReplaceDoesNotOmitCommittedHistory,
} from '@/domain/integrity'
import { migrateDecision } from '@/domain/migrate'
import { DomainError } from '@/domain/errors'
import { getDb, getMeta, listDecisionsRaw, setMeta } from './db'

export type ImportMode = 'merge' | 'replace' | 'destructive-wipe'

export interface DestructiveConfirm {
  /** Must be literally true — prevents accidental history erasure. */
  confirmEraseExistingHistory: true
}

/**
 * Authoritative persistence boundary for BranchBack.
 *
 * Ordinary application writes (save / import) validate historical integrity
 * and persist inside the same IndexedDB readwrite transaction so concurrent
 * tabs or overlapping async saves cannot win a check-then-write race.
 */
export class DecisionRepository {
  async list(): Promise<Decision[]> {
    const all = await listDecisionsRaw()
    return all.map((d) => migrateDecision(d))
  }

  async get(id: string): Promise<Decision | undefined> {
    const db = await getDb()
    const row = await db.get('decisions', id)
    return row ? migrateDecision(row) : undefined
  }

  /**
   * Atomic validate + write for a single decision.
   * Read of the current record and the authorized put share one transaction.
   */
  async save(decision: Decision): Promise<Decision> {
    const parsed = migrateDecision(decision)
    assertInvariants(parsed)

    const db = await getDb()
    const tx = db.transaction('decisions', 'readwrite')
    const existingRaw = await tx.store.get(parsed.id)
    const existing = existingRaw ? migrateDecision(existingRaw) : undefined
    assertHistoricalWriteIntegrity(existing, parsed)
    await tx.store.put(parsed)
    await tx.done
    return parsed
  }

  /**
   * Explicit destructive delete of one decision.
   * Ordinary callers must pass confirmEraseExistingHistory: true.
   */
  async remove(id: string, confirm: DestructiveConfirm): Promise<void> {
    assertDestructiveConfirm(confirm)
    const db = await getDb()
    const tx = db.transaction('decisions', 'readwrite')
    await tx.store.delete(id)
    await tx.done
  }

  /**
   * Explicit destructive wipe of all decisions.
   */
  async clearAll(confirm: DestructiveConfirm): Promise<void> {
    assertDestructiveConfirm(confirm)
    const db = await getDb()
    const tx = db.transaction('decisions', 'readwrite')
    await tx.store.clear()
    await tx.done
  }

  async exportAll(): Promise<BranchBackExport> {
    const decisions = await this.list()
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      decisions,
    }
  }

  /**
   * Import semantics:
   *
   * - `merge`: upsert each decision with historical integrity; never deletes.
   * - `replace`: restore backup as the full store **only if** every currently
   *   committed decision is present in the backup. Omission of committed
   *   history is rejected (`REPLACE_OMITS_HISTORY`).
   * - `destructive-wipe`: clear the store then load the backup. Requires
   *   `{ confirmEraseExistingHistory: true }`.
   */
  async importAll(
    payload: unknown,
    mode: ImportMode = 'merge',
    confirm?: DestructiveConfirm,
  ): Promise<{ imported: number }> {
    if (!payload || typeof payload !== 'object') {
      throw new DomainError(
        'INVALID_BACKUP',
        'Expected a BranchBack JSON object.',
      )
    }
    const raw = payload as Record<string, unknown>
    assertSupportedExportSchema(raw.schemaVersion)

    const incoming = (
      Array.isArray(raw.decisions) ? raw.decisions : []
    ).map((d) => migrateDecision(d))

    for (const d of incoming) {
      assertInvariants(d)
    }

    if (mode === 'merge') {
      // All-or-nothing: validate every incoming decision against current store,
      // then write all puts in one IndexedDB transaction.
      const db = await getDb()
      const tx = db.transaction('decisions', 'readwrite')
      const current = await tx.store.getAll()
      const currentById = new Map(
        current.map((row) => [row.id, migrateDecision(row)] as const),
      )
      for (const d of incoming) {
        assertHistoricalWriteIntegrity(currentById.get(d.id), d)
      }
      for (const d of incoming) {
        await tx.store.put(d)
      }
      await tx.done
      return { imported: incoming.length }
    }

    if (mode === 'replace') {
      const existing = await this.list()
      assertReplaceDoesNotOmitCommittedHistory(existing, incoming)

      // Validate each overlapping id against current history, then atomically
      // clear + write the full incoming set in one transaction.
      const db = await getDb()
      const tx = db.transaction('decisions', 'readwrite')
      const current = await tx.store.getAll()
      const currentById = new Map(
        current.map((row) => [row.id, migrateDecision(row)] as const),
      )
      assertReplaceDoesNotOmitCommittedHistory(
        [...currentById.values()],
        incoming,
      )
      for (const d of incoming) {
        assertHistoricalWriteIntegrity(currentById.get(d.id), d)
      }
      await tx.store.clear()
      for (const d of incoming) {
        await tx.store.put(d)
      }
      await tx.done
      return { imported: incoming.length }
    }

    if (mode === 'destructive-wipe') {
      assertDestructiveConfirm(confirm)
      const db = await getDb()
      const tx = db.transaction('decisions', 'readwrite')
      await tx.store.clear()
      for (const d of incoming) {
        await tx.store.put(d)
      }
      await tx.done
      return { imported: incoming.length }
    }

    throw new DomainError('IMPORT_MODE', `Unknown import mode: ${String(mode)}`)
  }

  async isDemoLoaded(): Promise<boolean> {
    return (await getMeta<boolean>('demoLoaded')) === true
  }

  async markDemoLoaded(value: boolean): Promise<void> {
    await setMeta('demoLoaded', value)
  }
}

function assertDestructiveConfirm(
  confirm: DestructiveConfirm | undefined,
): asserts confirm is DestructiveConfirm {
  if (!confirm || confirm.confirmEraseExistingHistory !== true) {
    throw new DomainError(
      'DESTRUCTIVE_CONFIRM_REQUIRED',
      'Erasing historical records requires confirmEraseExistingHistory: true.',
    )
  }
}

export const repository = new DecisionRepository()

export { DomainError }
