import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { isValidISODate } from '../lib/dates'
import { createId } from '../lib/id'
import { sanitizeTitle } from '../lib/sanitize'
import { loadTodos, saveTodos } from '../state/storage'
import { matchesFilter, todosReducer, type TodosState } from '../state/todosReducer'
import { MAX_TODOS, type Filter, type Priority, type Todo, type TodoChanges } from '../types'

export interface NewTodoInput {
  readonly title: string
  readonly priority?: Priority | null
  readonly dueDate?: string | null
}

export type AddResult =
  | { readonly status: 'added'; readonly todo: Todo }
  | { readonly status: 'empty' | 'limit' }

export type MoveResult =
  | { readonly status: 'moved'; readonly todo: Todo; readonly position: number; readonly total: number }
  | { readonly status: 'top' | 'bottom' | 'unavailable' | 'missing' }

export interface UseTodosOptions {
  /** Chamado uma vez quando a gravação falha (de novo só depois de uma gravação bem-sucedida). */
  onSaveError?: () => void
}

function normalizeDueDate(value: string | null | undefined): string | null {
  return value && isValidISODate(value) ? value : null
}

export function useTodos(options: UseTodosOptions = {}) {
  // O array carregado é guardado para não regravar o storage na montagem:
  // se o load descartou algo, o original (e o backup) continuam intactos.
  const [loaded] = useState(loadTodos)
  const [state, dispatch] = useReducer(
    todosReducer,
    loaded,
    (todos): TodosState => ({ todos, filter: 'all' }),
  )
  const { todos, filter } = state

  // Estado mais recente para callbacks estáveis (preserva o memo dos itens).
  const stateRef = useRef(state)
  const optionsRef = useRef(options)
  useLayoutEffect(() => {
    stateRef.current = state
    optionsRef.current = options
  })

  const saveFailed = useRef(false)
  useEffect(() => {
    if (todos === loaded) return
    if (saveTodos(todos)) {
      saveFailed.current = false
    } else if (!saveFailed.current) {
      saveFailed.current = true
      optionsRef.current.onSaveError?.()
    }
  }, [todos, loaded])

  const visibleTodos = useMemo(() => todos.filter((t) => matchesFilter(t, filter)), [todos, filter])
  const activeCount = useMemo(() => todos.filter((t) => !t.completed).length, [todos])
  const completedCount = todos.length - activeCount

  const addTodo = useCallback((input: NewTodoInput): AddResult => {
    const title = sanitizeTitle(input.title)
    if (!title) return { status: 'empty' }
    if (stateRef.current.todos.length >= MAX_TODOS) return { status: 'limit' }
    const todo: Todo = {
      id: createId(),
      title,
      completed: false,
      priority: input.priority ?? null,
      dueDate: normalizeDueDate(input.dueDate),
      createdAt: Date.now(),
    }
    dispatch({ type: 'add', todo })
    stateRef.current = todosReducer(stateRef.current, { type: 'add', todo })
    return { status: 'added', todo }
  }, [])

  const toggleTodo = useCallback((id: string) => dispatch({ type: 'toggle', id }), [])

  const updateTodo = useCallback((id: string, changes: TodoChanges): boolean => {
    const title = sanitizeTitle(changes.title)
    if (!title) return false
    dispatch({
      type: 'update',
      id,
      changes: { title, priority: changes.priority, dueDate: normalizeDueDate(changes.dueDate) },
    })
    return true
  }, [])

  const removeTodo = useCallback((id: string) => dispatch({ type: 'remove', id }), [])
  const clearCompleted = useCallback(() => dispatch({ type: 'clearCompleted' }), [])
  const setFilter = useCallback((next: Filter) => dispatch({ type: 'setFilter', filter: next }), [])

  const moveTodo = useCallback(
    (id: string, toIndex: number) => dispatch({ type: 'move', id, toIndex }),
    [],
  )

  /** Move uma posição; só disponível no filtro "Todas". Estável entre renders. */
  const moveBy = useCallback((id: string, delta: -1 | 1): MoveResult => {
    const { todos: list, filter: current } = stateRef.current
    if (current !== 'all') return { status: 'unavailable' }
    const from = list.findIndex((t) => t.id === id)
    const todo = list[from]
    if (!todo) return { status: 'missing' }
    const to = from + delta
    if (to < 0) return { status: 'top' }
    if (to >= list.length) return { status: 'bottom' }
    dispatch({ type: 'move', id, toIndex: to })
    // Atualiza já, para movimentos encadeados antes do próximo commit.
    stateRef.current = todosReducer(stateRef.current, { type: 'move', id, toIndex: to })
    return { status: 'moved', todo, position: to + 1, total: list.length }
  }, [])

  return {
    todos,
    filter,
    visibleTodos,
    activeCount,
    completedCount,
    addTodo,
    toggleTodo,
    updateTodo,
    removeTodo,
    clearCompleted,
    setFilter,
    moveTodo,
    moveBy,
  }
}

export type TodosApi = ReturnType<typeof useTodos>
