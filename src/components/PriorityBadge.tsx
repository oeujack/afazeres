import { PRIORITY_LABEL, type Priority } from '../types'
import { PriorityBarsIcon } from './icons'

const LEVEL: Record<Priority, 1 | 2 | 3> = { low: 1, medium: 2, high: 3 }

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null
  return (
    <span className={`priority-badge priority-badge--${priority}`}>
      <PriorityBarsIcon level={LEVEL[priority]} />
      <span className="sr-only">Prioridade </span>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
