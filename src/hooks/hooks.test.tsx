import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TODOS_KEY } from '../state/storage'
import { setSystemDark } from '../test/setup'
import { useTheme } from './useTheme'
import { useTodos } from './useTodos'

describe('useTodos', () => {
  it('carrega do storage descartando itens inválidos', () => {
    localStorage.setItem(
      TODOS_KEY,
      JSON.stringify({
        version: 1,
        todos: [
          { id: 'a', title: 'Válida', completed: false, priority: null, dueDate: null, createdAt: 1 },
          { id: 'b', title: 123 },
        ],
      }),
    )
    const { result } = renderHook(() => useTodos())
    expect(result.current.todos.map((t) => t.id)).toEqual(['a'])
  })

  it('cria, conta, filtra, edita, remove e persiste', () => {
    const { result } = renderHook(() => useTodos())
    let created: ReturnType<typeof result.current.addTodo> = { status: 'empty' }
    act(() => {
      created = result.current.addTodo({ title: '  Primeira ', priority: 'low', dueDate: 'lixo' })
    })
    expect(created).toMatchObject({
      status: 'added',
      todo: { title: 'Primeira', priority: 'low', dueDate: null },
    })
    act(() => {
      result.current.addTodo({ title: 'Segunda', dueDate: '2026-12-01' })
    })
    expect(result.current.addTodo({ title: '   ' })).toEqual({ status: 'empty' })

    const [second, first] = result.current.todos
    expect(second?.title).toBe('Segunda')
    expect(first?.title).toBe('Primeira')
    expect(result.current.activeCount).toBe(2)

    act(() => result.current.toggleTodo(first?.id ?? ''))
    expect(result.current.completedCount).toBe(1)

    act(() => result.current.setFilter('completed'))
    expect(result.current.visibleTodos.map((t) => t.title)).toEqual(['Primeira'])

    let ok = false
    act(() => {
      ok = result.current.updateTodo(second?.id ?? '', { title: 'Editada', priority: 'high', dueDate: null })
    })
    expect(ok).toBe(true)
    expect(result.current.updateTodo(second?.id ?? '', { title: ' ', priority: null, dueDate: null })).toBe(false)
    expect(result.current.todos[0]?.title).toBe('Editada')

    act(() => result.current.clearCompleted())
    expect(result.current.todos).toHaveLength(1)

    act(() => result.current.removeTodo(second?.id ?? ''))
    expect(result.current.todos).toHaveLength(0)
    expect(JSON.parse(localStorage.getItem(TODOS_KEY) ?? '{}')).toEqual({ version: 1, todos: [] })
  })

  it('move com moveBy e moveTodo', () => {
    const { result } = renderHook(() => useTodos())
    act(() => {
      result.current.addTodo({ title: 'C' })
      result.current.addTodo({ title: 'B' })
      result.current.addTodo({ title: 'A' })
    })
    const titles = () => result.current.todos.map((t) => t.title)
    const idOf = (title: string) => result.current.todos.find((t) => t.title === title)?.id ?? ''

    expect(result.current.moveBy(idOf('A'), -1)).toEqual({ status: 'top' })
    expect(result.current.moveBy(idOf('C'), 1)).toEqual({ status: 'bottom' })
    expect(result.current.moveBy('nada', 1)).toEqual({ status: 'missing' })

    let moved: ReturnType<typeof result.current.moveBy> = { status: 'missing' }
    act(() => {
      moved = result.current.moveBy(idOf('A'), 1)
    })
    expect(moved).toMatchObject({ status: 'moved', position: 2, total: 3 })
    expect(titles()).toEqual(['B', 'A', 'C'])

    act(() => result.current.moveTodo(idOf('C'), 0))
    expect(titles()).toEqual(['C', 'B', 'A'])

    act(() => result.current.setFilter('active'))
    expect(result.current.moveBy(idOf('C'), 1)).toEqual({ status: 'unavailable' })
  })
})

describe('useTheme', () => {
  it('segue o sistema até haver escolha e então persiste', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => setSystemDark(true))
    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('afazeres:theme')).toBe('light')
    expect(document.documentElement.classList.contains('is-theme-switching')).toBe(true)

    // Depois da escolha explícita, o sistema não manda mais.
    act(() => setSystemDark(false))
    act(() => setSystemDark(true))
    expect(result.current.theme).toBe('light')
  })

  it('respeita o data-theme aplicado pelo script anti-flash', () => {
    document.documentElement.dataset.theme = 'dark'
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })
})
