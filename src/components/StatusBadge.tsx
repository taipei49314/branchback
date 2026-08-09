import type { DecisionStatus } from '@/domain/types'

const STATUS_LABEL: Record<DecisionStatus, string> = {
  OPEN: 'Open',
  DECIDED: 'Decided',
  REVIEW_DUE: 'Review due',
  REVIEWED: 'Reviewed',
  ARCHIVED: 'Archived',
}

export function StatusBadge({ status }: { status: DecisionStatus }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-text">{STATUS_LABEL[status]}</span>
    </span>
  )
}
