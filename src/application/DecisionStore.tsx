import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Decision } from '@/domain/types'
import { applyDerivedStatus } from '@/domain/status'
import { repository, type ImportMode } from '@/storage/repository'
import { buildDemoDataset } from '@/demo/dataset'
import { DecisionStoreContext } from './storeContext'

export type { StoreState } from './storeTypes'

const ERASE = { confirmEraseExistingHistory: true as const }

export function DecisionStoreProvider({ children }: { children: ReactNode }) {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await repository.list()
      setDecisions(list.map((d) => applyDerivedStatus(d)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load decisions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(async (decision: Decision) => {
    const stored = await repository.save(applyDerivedStatus(decision))
    setDecisions((prev) => {
      const others = prev.filter((d) => d.id !== stored.id)
      return [stored, ...others].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )
    })
    return stored
  }, [])

  const remove = useCallback(async (id: string) => {
    await repository.remove(id, ERASE)
    setDecisions((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const clearAll = useCallback(async () => {
    await repository.clearAll(ERASE)
    setDecisions([])
  }, [])

  const loadDemo = useCallback(async () => {
    setError(null)
    try {
      const demo = buildDemoDataset()
      for (const d of demo) {
        await repository.save(d)
      }
      await repository.markDemoLoaded(true)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Demo load failed')
      throw e
    }
  }, [refresh])

  const exportJson = useCallback(async () => {
    const payload = await repository.exportAll()
    return JSON.stringify(payload, null, 2)
  }, [])

  const importJson = useCallback(
    async (raw: string, mode: ImportMode = 'merge') => {
      const parsed: unknown = JSON.parse(raw)
      const result =
        mode === 'destructive-wipe'
          ? await repository.importAll(parsed, mode, ERASE)
          : await repository.importAll(parsed, mode)
      await refresh()
      return result.imported
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      decisions,
      loading,
      error,
      refresh,
      save,
      remove,
      clearAll,
      loadDemo,
      exportJson,
      importJson,
    }),
    [
      decisions,
      loading,
      error,
      refresh,
      save,
      remove,
      clearAll,
      loadDemo,
      exportJson,
      importJson,
    ],
  )

  return (
    <DecisionStoreContext.Provider value={value}>
      {children}
    </DecisionStoreContext.Provider>
  )
}
