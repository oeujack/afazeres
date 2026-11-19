import { parsePriority, PRIORITIES, PRIORITY_LABEL, type Priority } from '../types'
import { ErrorIcon } from './icons'

interface PriorityFieldProps {
  id: string
  value: Priority | null
  onChange: (value: Priority | null) => void
}

export function PriorityField({ id, value, onChange }: PriorityFieldProps) {
  return (
    <label className="field-chip" htmlFor={id}>
      <span className="field-chip__label">Prioridade</span>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(parsePriority(e.target.value))}>
        <option value="">Sem prioridade</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
    </label>
  )
}

interface DueDateFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
}

export function DueDateField({ id, value, onChange }: DueDateFieldProps) {
  return (
    <label className="field-chip" htmlFor={id}>
      <span className="field-chip__label">Vencimento</span>
      <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="field-error" role="alert">
      <ErrorIcon />
      {message}
    </p>
  )
}
