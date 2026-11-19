import { describe, expect, it } from 'vitest'
import type { Todo } from '../types'
import { initialState, matchesFilter, todosReducer, type TodosState } from './todosReducer'

const make = (id: string, extra: Partial<Todo> = {}): Todo => ({
  id,
  title: `Tarefa ${id}`,
  completed: false,
  priority: null,
  dueDate: null,
  createdAt: 1,
  ...extra,
})

const withTodos = (...todos: Todo[]): TodosState => ({ todos, filter: 'all' })

describe('todosReducer', () => {
  it('adiciona no topo e apara o título', () => {
    const state = todosReducer(withTodos(make('a')), {
      type: 'add',
      todo: make('b', { title: '  Nova  ' }),
    })
    expect(state.todos.map((t) => t.id)).toEqual(['b', 'a'])
    expect(state.todos[0]?.title).toBe('Nova')
  })

  it('ignora título vazio e id duplicado', () => {
    const base = withTodos(make('a'))
    expect(todosReducer(base, { type: 'add', todo: make('b', { title: '   ' }) })).toBe(base)
    expect(todosReducer(base, { type: 'add', todo: make('a') })).toBe(base)
  })

  it('alterna conclusão sem mutar o estado anterior', () => {
    const base = withTodos(make('a'))
    const next = todosReducer(base, { type: 'toggle', id: 'a' })
    expect(next.todos[0]?.completed).toBe(true)
    expect(base.todos[0]?.completed).toBe(false)
    expect(todosReducer(base, { type: 'toggle', id: 'x' })).toBe(base)
  })

  it('atualiza título, prioridade e vencimento', () => {
    const next = todosReducer(withTodos(make('a')), {
      type: 'update',
      id: 'a',
      changes: { title: ' Editada ', priority: 'high', dueDate: '2026-12-01' },
    })
    expect(next.todos[0]).toMatchObject({ title: 'Editada', priority: 'high', dueDate: '2026-12-01' })
  })

  it('não aceita atualização vazia nem id inexistente', () => {
    const base = withTodos(make('a'))
    const changes = { title: '', priority: null, dueDate: null }
    expect(todosReducer(base, { type: 'update', id: 'a', changes })).toBe(base)
    expect(
      todosReducer(base, { type: 'update', id: 'x', changes: { ...changes, title: 'ok' } }),
    ).toBe(base)
  })

  it('remove e limpa concluídas', () => {
    const base = withTodos(make('a'), make('b', { completed: true }), make('c', { completed: true }))
    expect(todosReducer(base, { type: 'remove', id: 'a' }).todos).toHaveLength(2)
    expect(todosReducer(base, { type: 'remove', id: 'x' })).toBe(base)
    expect(todosReducer(base, { type: 'clearCompleted' }).todos.map((t) => t.id)).toEqual(['a'])
    const none = withTodos(make('a'))
    expect(todosReducer(none, { type: 'clearCompleted' })).toBe(none)
  })

  it('move para um índice, limitando às pontas', () => {
    const base = withTodos(make('a'), make('b'), make('c'))
    const ids = (s: TodosState) => s.todos.map((t) => t.id)
    expect(ids(todosReducer(base, { type: 'move', id: 'a', toIndex: 2 }))).toEqual(['b', 'c', 'a'])
    expect(ids(todosReducer(base, { type: 'move', id: 'c', toIndex: -5 }))).toEqual(['c', 'a', 'b'])
    expect(todosReducer(base, { type: 'move', id: 'a', toIndex: 0 })).toBe(base)
    expect(todosReducer(base, { type: 'move', id: 'x', toIndex: 1 })).toBe(base)
    expect(todosReducer(base, { type: 'move', id: 'a', toIndex: 1.5 })).toBe(base)
  })

  it('troca o filtro', () => {
    expect(todosReducer(initialState, { type: 'setFilter', filter: 'active' }).filter).toBe('active')
    expect(todosReducer(initialState, { type: 'setFilter', filter: 'all' })).toBe(initialState)
  })

  it('ignora ações desconhecidas', () => {
    const action = { type: 'nope' } as unknown as Parameters<typeof todosReducer>[1]
    expect(todosReducer(initialState, action)).toBe(initialState)
  })
})

describe('matchesFilter', () => {
  it('filtra por estado', () => {
    const done = make('a', { completed: true })
    expect(matchesFilter(done, 'all')).toBe(true)
    expect(matchesFilter(done, 'active')).toBe(false)
    expect(matchesFilter(done, 'completed')).toBe(true)
  })
})
