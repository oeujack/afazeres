import { sanitizeTitle } from '../lib/sanitize'
import { MAX_TODOS, type Filter, type Todo, type TodoChanges } from '../types'

export interface TodosState {
  readonly todos: readonly Todo[]
  readonly filter: Filter
}

export type TodosAction =
  | { type: 'add'; todo: Todo }
  | { type: 'toggle'; id: string }
  | { type: 'update'; id: string; changes: TodoChanges }
  | { type: 'remove'; id: string }
  | { type: 'clearCompleted' }
  | { type: 'move'; id: string; toIndex: number }
  | { type: 'setFilter'; filter: Filter }

export const initialState: TodosState = { todos: [], filter: 'all' }

export function matchesFilter(todo: Todo, filter: Filter): boolean {
  if (filter === 'active') return !todo.completed
  if (filter === 'completed') return todo.completed
  return true
}

/** Reducer puro: nunca muta o estado e devolve a mesma referência quando nada muda. */
export function todosReducer(state: TodosState, action: TodosAction): TodosState {
  switch (action.type) {
    case 'add': {
      const title = sanitizeTitle(action.todo.title)
      if (
        !title ||
        state.todos.length >= MAX_TODOS ||
        state.todos.some((t) => t.id === action.todo.id)
      ) {
        return state
      }
      // Itens novos entram no topo da lista.
      return { ...state, todos: [{ ...action.todo, title }, ...state.todos] }
    }
    case 'toggle': {
      if (!state.todos.some((t) => t.id === action.id)) return state
      return {
        ...state,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, completed: !t.completed } : t)),
      }
    }
    case 'update': {
      const title = sanitizeTitle(action.changes.title)
      if (!title || !state.todos.some((t) => t.id === action.id)) return state
      return {
        ...state,
        todos: state.todos.map((t) =>
          t.id === action.id
            ? { ...t, title, priority: action.changes.priority, dueDate: action.changes.dueDate }
            : t,
        ),
      }
    }
    case 'remove': {
      const todos = state.todos.filter((t) => t.id !== action.id)
      return todos.length === state.todos.length ? state : { ...state, todos }
    }
    case 'clearCompleted': {
      const todos = state.todos.filter((t) => !t.completed)
      return todos.length === state.todos.length ? state : { ...state, todos }
    }
    case 'move': {
      const from = state.todos.findIndex((t) => t.id === action.id)
      if (from === -1 || !Number.isInteger(action.toIndex)) return state
      const to = Math.min(Math.max(action.toIndex, 0), state.todos.length - 1)
      if (to === from) return state
      const todos = [...state.todos]
      const [item] = todos.splice(from, 1) as [Todo]
      todos.splice(to, 0, item)
      return { ...state, todos }
    }
    case 'setFilter':
      return action.filter === state.filter ? state : { ...state, filter: action.filter }
    default:
      return state
  }
}
