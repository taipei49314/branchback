import { useContext } from 'react'
import type { Decision } from '@/domain/types'
import { DecisionStoreContext } from './storeContext'
import type { StoreState } from './storeTypes'

export function useDecisionStore(): StoreState {
  const ctx = useContext(DecisionStoreContext)
  if (!ctx) {
    throw new Error('useDecisionStore must be used within DecisionStoreProvider')
  }
  return ctx
}

export function useDecision(id: string | undefined): Decision | undefined {
  const { decisions } = useDecisionStore()
  return decisions.find((d) => d.id === id)
}
