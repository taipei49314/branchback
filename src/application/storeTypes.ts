import type { Decision } from '@/domain/types'
import type { ImportMode } from '@/storage/repository'

export interface StoreState {
  decisions: Decision[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  save: (decision: Decision) => Promise<Decision>
  remove: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  loadDemo: () => Promise<void>
  exportJson: () => Promise<string>
  importJson: (raw: string, mode?: ImportMode) => Promise<number>
}
