import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { replayClass } from '../lib/motion'
import { MAX_TITLE_LENGTH, MAX_TODOS, type Priority } from '../types'
import type { AddResult, NewTodoInput } from '../hooks/useTodos'
import { PlusIcon } from './icons'
import { DueDateField, FieldError, PriorityField } from './TodoOptionFields'

export const NEW_TODO_ID = 'new-todo'
const ERROR_ID = 'new-todo-error'
export const CREATE_ERROR = 'Escreva algo antes de adicionar.'
export const LIMIT_ERROR = `Limite de ${MAX_TODOS} tarefas atingido. Exclua ou limpe tarefas concluídas para adicionar novas.`

interface TodoInputProps {
  onAdd: (input: NewTodoInput) => AddResult['status']
}

export function TodoInput({ onAdd }: TodoInputProps) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = inputRef.current
    const showError = (message: string) => {
      setError(message)
      if (input) {
        input.focus()
        replayClass(input, 'is-invalid')
      }
    }
    const status = title.trim() ? onAdd({ title, priority, dueDate: dueDate || null }) : 'empty'
    if (status === 'empty') {
      showError(CREATE_ERROR)
      return
    }
    if (status === 'limit') {
      showError(LIMIT_ERROR)
      return
    }
    setTitle('')
    setPriority(null)
    setDueDate('')
    setError(null)
    input?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    if (error) setError(null)
    else setTitle('')
  }

  return (
    <form className="todo-input" aria-label="Criar tarefa" noValidate onSubmit={handleSubmit}>
      <div className="todo-input__row">
        <label htmlFor={NEW_TODO_ID} className="sr-only">
          Nova tarefa
        </label>
        <input
          ref={inputRef}
          id={NEW_TODO_ID}
          className="text-field"
          type="text"
          autoComplete="off"
          maxLength={MAX_TITLE_LENGTH}
          placeholder="O que precisa ser feito?"
          value={title}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ERROR_ID : undefined}
          onChange={(e) => {
            setTitle(e.target.value)
            // O erro de limite persiste até um envio bem-sucedido.
            if (error === CREATE_ERROR && e.target.value.trim()) setError(null)
          }}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className="btn btn--primary btn--add">
          <PlusIcon />
          <span className="btn__label">Adicionar</span>
        </button>
      </div>
      {error && <FieldError id={ERROR_ID} message={error} />}
      <div className="todo-input__options">
        <PriorityField id="new-todo-priority" value={priority} onChange={setPriority} />
        <DueDateField id="new-todo-due" value={dueDate} onChange={setDueDate} />
      </div>
    </form>
  )
}
