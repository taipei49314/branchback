/**
 * Test-only storage teardown.
 *
 * Production application modules must not import this file.
 * Architectural tests enforce that only `*.test.ts` / `*.spec.ts` (and this
 * package's tests) reference it.
 *
 * This is NOT an ordinary history-erasure API for the product UI — product
 * clears go through DecisionRepository.clearAll({ confirmEraseExistingHistory: true }).
 */
import { deleteDatabaseForTests } from './db'

export async function resetStorageForTests(): Promise<void> {
  await deleteDatabaseForTests()
}
