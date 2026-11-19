import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadTheme,
  loadTodos,
  MAX_RAW_LENGTH,
  parseTodo,
  parseTodos,
  saveTheme,
  saveTodos,
  THEME_KEY,
  TODOS_KEY,
} from './storage'

const valid = {
  id: 'abc-123',
  title: 'Comprar pão',
  completed: false,
  priority: 'high',
  dueDate: '2026-11-21',
  createdAt: 1700000000000,
}

const wrap = (todos: unknown) => JSON.stringify({ version: 1, todos })

describe('parseTodo', () => {
  it('aceita um item válido e copia só os campos conhecidos', () => {
    const todo = parseTodo({ ...valid, extra: '<img onerror=alert(1)>' })
    expect(todo).toEqual(valid)
    expect(todo).not.toHaveProperty('extra')
  })

  it.each([
    ['nulo', null],
    ['array', []],
    ['string', 'x'],
    ['id com caracteres inválidos', { ...valid, id: '"><script>' }],
    ['id vazio', { ...valid, id: '' }],
    ['título numérico', { ...valid, title: 42 }],
    ['título vazio', { ...valid, title: '   ' }],
    ['título só com controles', { ...valid, title: '\t\u0000\n' }],
    ['completed não booleano', { ...valid, completed: 'true' }],
    ['prioridade desconhecida', { ...valid, priority: 'urgent' }],
    ['data inexistente', { ...valid, dueDate: '2026-02-30' }],
    ['data em outro formato', { ...valid, dueDate: '21/11/2026' }],
    ['data numérica', { ...valid, dueDate: 20261121 }],
    ['createdAt negativo', { ...valid, createdAt: -1 }],
    ['createdAt fracionário', { ...valid, createdAt: 1.5 }],
    ['createdAt string', { ...valid, createdAt: '1' }],
    ['objeto com protótipo', Object.create({ polluted: true }) as unknown],
  ])('rejeita %s', (_label, input) => {
    expect(parseTodo(input)).toBeNull()
  })

  it('normaliza o título (mesma regra da criação) em vez de rejeitar', () => {
    expect(parseTodo({ ...valid, title: 'Comprar\tpão' })?.title).toBe('Comprar pão')
    expect(parseTodo({ ...valid, title: 'x'.repeat(250) })?.title).toHaveLength(200)
  })

  it('aceita prioridade e data nulas', () => {
    expect(parseTodo({ ...valid, priority: null, dueDate: null })).not.toBeNull()
  })
})

describe('parseTodos', () => {
  it('descarta JSON inválido, versão errada e formatos inesperados', () => {
    expect(parseTodos(null)).toEqual([])
    expect(parseTodos('{')).toEqual([])
    expect(parseTodos('[]')).toEqual([])
    expect(parseTodos(JSON.stringify({ version: 2, todos: [valid] }))).toEqual([])
    expect(parseTodos(JSON.stringify({ version: 1, todos: 'x' }))).toEqual([])
    expect(parseTodos('x'.repeat(MAX_RAW_LENGTH + 1))).toEqual([])
  })

  it('mantém os válidos, descarta inválidos e ids duplicados', () => {
    const raw = wrap([valid, { ...valid, title: 'duplicado' }, { nope: true }, { ...valid, id: 'b' }])
    expect(parseTodos(raw).map((t) => t.id)).toEqual(['abc-123', 'b'])
  })

  it('não sofre poluição de protótipo via __proto__', () => {
    const raw = `{"version":1,"todos":[{"__proto__":{"polluted":true},"id":"a","title":"t","completed":false,"priority":null,"dueDate":null,"createdAt":0}]}`
    const [todo] = parseTodos(raw)
    expect(todo).toBeDefined()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(todo)).toBe(Object.prototype)
  })
})

describe('localStorage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('salva e carrega tarefas', () => {
    const todo = parseTodo(valid)
    expect(todo).not.toBeNull()
    if (!todo) return
    expect(saveTodos([todo])).toBe(true)
    expect(loadTodos()).toEqual([todo])
    expect(JSON.parse(localStorage.getItem(TODOS_KEY) ?? '')).toMatchObject({ version: 1 })
  })

  it('sobrevive a falhas de leitura e escrita', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cota')
    })
    expect(loadTodos()).toEqual([])
    expect(saveTodos([])).toBe(false)
    expect(loadTheme()).toBeNull()
    expect(saveTheme('dark')).toBe(false)
  })

  it('valida o tema salvo', () => {
    expect(loadTheme()).toBeNull()
    saveTheme('dark')
    expect(loadTheme()).toBe('dark')
    localStorage.setItem(THEME_KEY, 'roxo')
    expect(loadTheme()).toBeNull()
  })
})
