import { isValidISODate } from '../lib/dates'
import { sanitizeTitle } from '../lib/sanitize'
import { MAX_TODOS, parsePriority, type Theme, type Todo } from '../types'

export { MAX_TODOS }

export const TODOS_KEY = 'afazeres:todos'
/** Cópia do conteúdo bruto quando o load descartou algo (antes de qualquer gravação). */
export const TODOS_BACKUP_KEY = 'afazeres:todos:backup'
export const THEME_KEY = 'afazeres:theme'
/** Chave antiga do tema, migrada para THEME_KEY. */
export const LEGACY_THEME_KEY = 'theme'
export const STORAGE_VERSION = 1
/** Acima disso o conteúdo salvo é tratado como corrompido e ignorado. */
export const MAX_RAW_LENGTH = 1_000_000

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Valida um item desconhecido e devolve um Todo novo (só com os campos
 * conhecidos) ou null. Nunca reaproveita o objeto de entrada, o que evita
 * carregar propriedades extras ou chaves como `__proto__`. O título é
 * normalizado (mesma regra da criação), não rejeitado.
 */
export function parseTodo(value: unknown): Todo | null {
  if (!isPlainObject(value)) return null
  const { id, title, completed, priority, dueDate, createdAt } = value

  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null
  if (typeof title !== 'string') return null
  const clean = sanitizeTitle(title)
  if (!clean) return null
  if (typeof completed !== 'boolean') return null
  const parsedPriority = parsePriority(priority)
  if (priority !== null && parsedPriority === null) return null
  if (dueDate !== null && (typeof dueDate !== 'string' || !isValidISODate(dueDate))) return null
  if (typeof createdAt !== 'number' || !Number.isSafeInteger(createdAt) || createdAt < 0) {
    return null
  }

  return { id, title: clean, completed, priority: parsedPriority, dueDate, createdAt }
}

export interface ParseResult {
  readonly todos: Todo[]
  /** true quando algo do conteúdo bruto não foi aproveitado. */
  readonly lossy: boolean
}

/** Valida o JSON bruto. Itens inválidos e ids duplicados são descartados. */
export function parseTodosDetailed(raw: string | null): ParseResult {
  if (raw === null) return { todos: [], lossy: false }
  if (raw.length > MAX_RAW_LENGTH) return { todos: [], lossy: true }
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { todos: [], lossy: true }
  }
  if (!isPlainObject(data) || data.version !== STORAGE_VERSION || !Array.isArray(data.todos)) {
    return { todos: [], lossy: true }
  }
  const seen = new Set<string>()
  const todos: Todo[] = []
  for (const item of data.todos.slice(0, MAX_TODOS)) {
    const todo = parseTodo(item)
    if (todo && !seen.has(todo.id)) {
      seen.add(todo.id)
      todos.push(todo)
    }
  }
  return { todos, lossy: todos.length !== data.todos.length }
}

export function parseTodos(raw: string | null): Todo[] {
  return parseTodosDetailed(raw).todos
}

/**
 * Carrega as tarefas. Se o parse descartou qualquer coisa (versão diferente,
 * item inválido, excesso de itens, JSON quebrado), o bruto é copiado para
 * TODOS_BACKUP_KEY para que nada se perca de forma permanente.
 */
export function loadTodos(): Todo[] {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(TODOS_KEY)
  } catch {
    // localStorage indisponível (modo privado, política de cookies etc.).
    return []
  }
  const { todos, lossy } = parseTodosDetailed(raw)
  if (lossy && raw !== null) {
    try {
      window.localStorage.setItem(TODOS_BACKUP_KEY, raw)
    } catch {
      // Sem espaço para o backup: o original continua intacto, pois não salvamos na montagem.
    }
  }
  return todos
}

export function saveTodos(todos: readonly Todo[]): boolean {
  try {
    window.localStorage.setItem(TODOS_KEY, JSON.stringify({ version: STORAGE_VERSION, todos }))
    return true
  } catch {
    // Cota excedida ou storage bloqueado: o app segue funcionando em memória.
    return false
  }
}

function asTheme(value: string | null): Theme | null {
  return value === 'light' || value === 'dark' ? value : null
}

/** Lê o tema salvo, migrando a chave antiga `theme` quando a nova não existe. */
export function loadTheme(): Theme | null {
  try {
    const storage = window.localStorage
    const current = storage.getItem(THEME_KEY)
    if (current !== null) return asTheme(current)
    const legacy = asTheme(storage.getItem(LEGACY_THEME_KEY))
    if (legacy) storage.setItem(THEME_KEY, legacy)
    return legacy
  } catch {
    return null
  }
}

export function saveTheme(theme: Theme): boolean {
  try {
    window.localStorage.setItem(THEME_KEY, theme)
    return true
  } catch {
    return false
  }
}
