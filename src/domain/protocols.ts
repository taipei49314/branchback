import type { DecisionProtocolId } from './types'

export interface DecisionProtocol {
  id: DecisionProtocolId
  label: string
  /** Capture prompts only — never advice about which option to choose. */
  prompts: {
    situation: string
    stakes: string
    constraints: string
  }
  suggestedTags: string[]
}

export const DECISION_PROTOCOLS: DecisionProtocol[] = [
  {
    id: 'general',
    label: 'General',
    prompts: {
      situation: 'What is the situation you are deciding in?',
      stakes: 'What is at stake if you choose poorly?',
      constraints: 'What hard constraints bind this choice?',
    },
    suggestedTags: [],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    prompts: {
      situation: 'What are you considering buying, and why now?',
      stakes: 'What is the cost of buying vs waiting?',
      constraints: 'Budget, return window, switching costs?',
    },
    suggestedTags: ['purchase'],
  },
  {
    id: 'career',
    label: 'Career',
    prompts: {
      situation: 'What career fork are you facing?',
      stakes: 'What does this change about your next 1–3 years?',
      constraints: 'Location, compensation floor, family constraints?',
    },
    suggestedTags: ['career'],
  },
  {
    id: 'project',
    label: 'Project commitment',
    prompts: {
      situation: 'What project are you committing to (or declining)?',
      stakes: 'Opportunity cost of the commitment?',
      constraints: 'Capacity, dependencies, deadline?',
    },
    suggestedTags: ['project'],
  },
  {
    id: 'financial',
    label: 'Financial allocation',
    prompts: {
      situation: 'What money allocation are you deciding?',
      stakes: 'Downside if the allocation is wrong?',
      constraints: 'Liquidity needs, risk tolerance, time horizon?',
    },
    suggestedTags: ['finance'],
  },
  {
    id: 'irreversible',
    label: 'Hard to reverse',
    prompts: {
      situation: 'What makes this difficult to reverse later?',
      stakes: 'What permanent costs attach to each option?',
      constraints: 'Legal, contractual, or social lock-in?',
    },
    suggestedTags: ['irreversible'],
  },
]

export function getProtocol(id: DecisionProtocolId): DecisionProtocol {
  return DECISION_PROTOCOLS.find((p) => p.id === id) ?? DECISION_PROTOCOLS[0]!
}
