export type Priority = 'low' | 'medium' | 'high'

export type Filter = 'all' | 'active' | 'completed'

export interface Todo {
  readonly id: string
  readonly title: string
  readonly completed: boolean
  readonly priority: Priority | null
  /** Data local no formato ISO `YYYY-MM-DD`. */
  readonly dueDate: string | null
  readonly createdAt: number
}

export interface TodoChanges {
  readonly title: string
  readonly priority: Priority | null
  readonly dueDate: string | null
}

export type Theme = 'light' | 'dark'

export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high']

export function parsePriority(value: unknown): Priority | null {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value)
    ? (value as Priority)
    : null
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

export const FILTERS: readonly Filter[] = ['all', 'active', 'completed']

export const FILTER_LABEL: Record<Filter, string> = {
  all: 'Todas',
  active: 'Ativas',
  completed: 'Concluídas',
}

export const MAX_TITLE_LENGTH = 200

/** Limite de tarefas: a criação é recusada a partir daqui e o load trunca nele. */
export const MAX_TODOS = 1000
