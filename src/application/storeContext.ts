import { createContext } from 'react'
import type { StoreState } from './storeTypes'

export const DecisionStoreContext = createContext<StoreState | null>(null)
