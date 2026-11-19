import { describeDueDate } from '../lib/dates'
import { AlertIcon, CalendarIcon } from './icons'

interface DueDateProps {
  dueDate: string | null
  completed: boolean
  today: Date
}

export function DueDate({ dueDate, completed, today }: DueDateProps) {
  if (!dueDate) return null
  const { status, label } = describeDueDate(dueDate, completed, today)

  if (status === 'overdue') {
    return (
      <span className="due-date due-date--overdue">
        <AlertIcon />
        <span>
          Atrasada
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, vencida em </span>
          <time dateTime={dueDate}>{label}</time>
        </span>
      </span>
    )
  }

  return (
    <span className={`due-date due-date--${status}`}>
      <CalendarIcon />
      <span>
        <span className="sr-only">Vence </span>
        <time dateTime={dueDate}>{label}</time>
      </span>
    </span>
  )
}
