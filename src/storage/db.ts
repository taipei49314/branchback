/**
 * Internal IndexedDB access. ONLY `repository.ts` may import this module.
 *
 * Application / page / feature / component / demo code must not import it.
 * Architectural tests scan the tree for illegal imports.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Decision } from '@/domain/types'
import { SCHEMA_VERSION } from '@/domain/types'

export interface BranchBackDb extends DBSchema {
  meta: {
    key: string
    value: { key: string; value: unknown }
  }
  decisions: {
    key: string
    value: Decision
    indexes: { 'by-status': string; 'by-updated': string }
  }
}

const DB_NAME = 'branchback'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<BranchBackDb>> | null = null

export async function getDb(): Promise<IDBPDatabase<BranchBackDb>> {
  if (!dbPromise) {
    dbPromise = openDB<BranchBackDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('decisions')) {
          const store = db.createObjectStore('decisions', { keyPath: 'id' })
          store.createIndex('by-status', 'status')
          store.createIndex('by-updated', 'updatedAt')
        }
      },
    })
    const db = await dbPromise
    const existing = await db.get('meta', 'schemaVersion')
    if (!existing) {
      await db.put('meta', { key: 'schemaVersion', value: SCHEMA_VERSION })
    }
  }
  return dbPromise
}

export function resetDbHandle(): void {
  dbPromise = null
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return
  const db = await dbPromise
  db.close()
  dbPromise = null
}

/**
 * Test-only full database teardown. Not a production API.
 * Reachable only through the storage testing harness from Vitest files.
 */
export async function deleteDatabaseForTests(): Promise<void> {
  await closeDb()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () =>
      reject(req.error ?? new Error('Failed to delete IndexedDB'))
    req.onblocked = () => resolve()
  })
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  const row = await db.get('meta', key)
  return row?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('meta', { key, value })
}

export async function listDecisionsRaw(): Promise<Decision[]> {
  const db = await getDb()
  const all = await db.getAll('decisions')
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
