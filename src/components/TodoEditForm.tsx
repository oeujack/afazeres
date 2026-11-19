import { useLayoutEffect, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { replayClass } from '../lib/motion'
import { MAX_TITLE_LENGTH, type Priority, type Todo, type TodoChanges } from '../types'
import { DueDateField, FieldError, PriorityField } from './TodoOptionFields'

export const EDIT_ERROR = 'A tarefa não pode ficar vazia. Pressione Esc para cancelar.'

interface TodoEditFormProps {
  todo: Todo
  /** `refocus`: devolver o foco ao item (Enter/Salvar) ou não (blur). */
  onSave: (changes: TodoChanges, refocus: boolean) => void
  onCancel: (refocus: boolean) => void
}

export function TodoEditForm({ todo, onSave, onCancel }: TodoEditFormProps) {
  const [title, setTitle] = useState(todo.title)
  const [priority, setPriority] = useState<Priority | null>(todo.priority)
  const [dueDate, setDueDate] = useState(todo.dueDate ?? '')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)

  const inputId = `edit-${todo.id}`
  const errorId = `${inputId}-error`

  // Foco no campo com o cursor no fim do texto.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    const len = input.value.length
    input.setSelectionRange(len, len)
  }, [])

  const changes = (): TodoChanges => ({ title, priority, dueDate: dueDate || null })

  const showError = () => {
    setError(true)
    const input = inputRef.current
    if (input) {
      input.focus()
      replayClass(input, 'is-invalid')
    }
  }

  const finish = (fn: () => void) => {
    if (doneRef.current) return
    doneRef.current = true
    fn()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) {
      showError()
      return
    }
    finish(() => onSave(changes(), true))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      finish(() => onCancel(true))
    }
  }

  // Foco saiu do item inteiro: salva se válido, senão cancela.
  const handleBlur = (event: FocusEvent<HTMLFormElement>) => {
    const next = event.relatedTarget
    const item = event.currentTarget.closest('.todo-item')
    if (next instanceof Node && item?.contains(next)) return
    if (title.trim()) finish(() => onSave(changes(), false))
    else finish(() => onCancel(false))
  }

  // Safari não foca botões no clique: sem isto o blur salvaria antes do "Cancelar".
  const keepFocus = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault()

  return (
    <form
      className="todo-edit"
      aria-label="Editar tarefa"
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <label htmlFor={inputId} className="sr-only">
        Editar tarefa
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className="text-field text-field--edit"
        type="text"
        autoComplete="off"
        maxLength={MAX_TITLE_LENGTH}
        value={title}
        aria-invalid={error || undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setTitle(e.target.value)
          if (error && e.target.value.trim()) setError(false)
        }}
      />
      {error && <FieldError id={errorId} message={EDIT_ERROR} />}
      <div className="todo-edit__row">
        <PriorityField id={`${inputId}-priority`} value={priority} onChange={setPriority} />
        <DueDateField id={`${inputId}-due`} value={dueDate} onChange={setDueDate} />
        <button type="submit" className="btn btn--primary btn--sm" onMouseDown={keepFocus}>
          Salvar
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onMouseDown={keepFocus}
          onClick={() => finish(() => onCancel(true))}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
