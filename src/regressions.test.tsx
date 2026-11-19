/**
 * Regressões dos achados de revisão/auditoria (A–H). Cada teste falharia
 * antes da correção correspondente.
 */
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../index.html?raw'
import themeInitSource from '../public/theme-init.js?raw'
import App, { SAVE_ERROR_MESSAGE } from './App'
import { LIMIT_ERROR, TodoInput } from './components/TodoInput'
import { useTodos } from './hooks/useTodos'
import { sanitizeTitle } from './lib/sanitize'
import { THEME_KEY, TODOS_BACKUP_KEY, TODOS_KEY } from './state/storage'
import { MAX_TODOS } from './types'

const rawTodo = (id: string, title = `Tarefa ${id}`, completed = false) => ({
  id,
  title,
  completed,
  priority: null,
  dueDate: null,
  createdAt: 1,
})

function seed(...todos: ReturnType<typeof rawTodo>[]) {
  localStorage.setItem(TODOS_KEY, JSON.stringify({ version: 1, todos }))
}

const itemOf = (id: string) => document.querySelector<HTMLElement>(`.todo-item[data-id="${id}"]`)
const wrapOf = (id: string) => document.querySelector<HTMLElement>(`.todo-item-wrap[data-id="${id}"]`)
const titles = () =>
  Array.from(document.querySelectorAll('.todo-list .todo-item__text')).map((el) => el.textContent)

function fire(el: Element, type: 'animationend' | 'transitionend', props: Record<string, string>) {
  const types = type === 'animationend' ? ['animationend', 'webkitAnimationEnd'] : [type]
  act(() => {
    for (const t of types) el.dispatchEvent(Object.assign(new Event(t, { bubbles: true }), props))
  })
}

function enableMotion() {
  HTMLElement.prototype.animate = vi.fn(() => ({}) as Animation)
}
function disableMotion() {
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate
}

describe('A. não regrava o storage na montagem e faz backup do que foi descartado', () => {
  it('versão desconhecida: original intacto + backup', () => {
    const raw = JSON.stringify({ version: 2, todos: [rawTodo('a')] })
    localStorage.setItem(TODOS_KEY, raw)
    renderHook(() => useTodos())
    expect(localStorage.getItem(TODOS_KEY)).toBe(raw)
    expect(localStorage.getItem(TODOS_BACKUP_KEY)).toBe(raw)
  })

  it('item inválido: original intacto até a primeira alteração; backup preserva o bruto', () => {
    const raw = JSON.stringify({ version: 1, todos: [rawTodo('a'), { id: 'b', title: 7 }] })
    localStorage.setItem(TODOS_KEY, raw)
    const { result } = renderHook(() => useTodos())
    expect(localStorage.getItem(TODOS_KEY)).toBe(raw)

    act(() => {
      result.current.addTodo({ title: 'Nova' })
    })
    const saved = JSON.parse(localStorage.getItem(TODOS_KEY) ?? '{}') as { todos: unknown[] }
    expect(saved.todos).toHaveLength(2)
    expect(localStorage.getItem(TODOS_BACKUP_KEY)).toBe(raw)
  })

  it('dados íntegros não geram backup', () => {
    seed(rawTodo('a'))
    renderHook(() => useTodos())
    expect(localStorage.getItem(TODOS_BACKUP_KEY)).toBeNull()
  })
})

describe('B. título com TAB colado sobrevive ao recarregar', () => {
  it('sanitizeTitle troca controles por espaço, apara e corta', () => {
    expect(sanitizeTitle('  a\t\tb\u0000c  ')).toBe('a b c')
    expect(sanitizeTitle('\t\n')).toBe('')
    expect(sanitizeTitle(`${'x'.repeat(199)} y`)).toHaveLength(199)
  })

  it('cria com TAB, normaliza e mantém após F5', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    const input = screen.getByRole('textbox', { name: 'Nova tarefa' })
    fireEvent.change(input, { target: { value: 'Comprar\tpão' } })
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(titles()).toEqual(['Comprar pão'])
    unmount()
    render(<App />)
    expect(titles()).toEqual(['Comprar pão'])
  })

  it('a edição usa a mesma normalização', async () => {
    seed(rawTodo('a', 'Original'))
    const user = userEvent.setup()
    render(<App />)
    await user.dblClick(document.querySelector('.todo-item__text') as HTMLElement)
    const input = screen.getByRole('textbox', { name: 'Editar tarefa' })
    fireEvent.change(input, { target: { value: 'Com\ttab' } })
    await user.keyboard('{Enter}')
    expect(titles()).toEqual(['Com tab'])
  })
})

describe('C. limite de tarefas e falha de gravação', () => {
  it('addTodo recusa a partir do limite', () => {
    seed(...Array.from({ length: MAX_TODOS }, (_, i) => rawTodo(`t${i}`)))
    const { result } = renderHook(() => useTodos())
    let status = ''
    act(() => {
      status = result.current.addTodo({ title: 'Uma a mais' }).status
    })
    expect(status).toBe('limit')
    expect(result.current.todos).toHaveLength(MAX_TODOS)
  })

  it('o campo mostra o erro de limite e não limpa o texto', async () => {
    const user = userEvent.setup()
    render(<TodoInput onAdd={() => 'limit'} />)
    const input = screen.getByRole('textbox', { name: 'Nova tarefa' })
    await user.type(input, 'Uma a mais{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(LIMIT_ERROR)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveValue('Uma a mais')
    expect(input).toHaveFocus()
  })

  it('falha de gravação é avisada uma única vez (de novo só após recuperar)', () => {
    const onSaveError = vi.fn()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cota')
    })
    const { result } = renderHook(() => useTodos({ onSaveError }))
    act(() => {
      result.current.addTodo({ title: 'A' })
    })
    act(() => {
      result.current.addTodo({ title: 'B' })
    })
    expect(onSaveError).toHaveBeenCalledTimes(1)

    setItem.mockRestore()
    act(() => {
      result.current.addTodo({ title: 'C' })
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cota')
    })
    act(() => {
      result.current.addTodo({ title: 'D' })
    })
    expect(onSaveError).toHaveBeenCalledTimes(2)
  })

  it('a falha é anunciada junto com a ação (sem sobrescrever o anúncio)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox', { name: 'Nova tarefa' }), 'X{Enter}')
    const announcer = document.getElementById('announcer')
    await waitFor(() => expect(announcer).toHaveTextContent(SAVE_ERROR_MESSAGE))
    expect(announcer).toHaveTextContent('Tarefa adicionada: X.')
  })
})

describe('D/E. saídas animadas não ficam presas', () => {
  beforeEach(enableMotion)
  afterEach(disableMotion)

  it('D. entrada órfã em `leaving` não bloqueia o arraste', async () => {
    seed(rawTodo('a', 'A', true), rawTodo('b', 'B'))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Excluir “A”' }))
    expect(itemOf('a')).toHaveClass('is-exiting')
    // Remove A do estado no meio da animação de saída.
    await user.click(screen.getByRole('button', { name: /Limpar concluídas/ }))
    expect(wrapOf('a')).toBeNull()

    const handle = itemOf('b')?.querySelector('.drag-handle') as HTMLElement
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 50 })
    expect(document.querySelector('.is-drag-ghost')).not.toBeNull()
    fireEvent.pointerUp(window, { pointerId: 1, clientY: 50 })
  })

  it('E. concluir um item em edição no filtro Ativas pula direto para a saída', async () => {
    seed(rawTodo('a', 'A'))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Ativas' }))
    await user.dblClick(document.querySelector('.todo-item__text') as HTMLElement)
    expect(screen.getByRole('textbox', { name: 'Editar tarefa' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'A' }))
    expect(itemOf('a')).toHaveClass('is-exiting')
  })

  it('E. sem eventos de animação, o timeout de segurança conclui a saída', async () => {
    seed(rawTodo('a', 'A'), rawTodo('b', 'B'))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Ativas' }))
    await user.click(screen.getByRole('checkbox', { name: 'A' }))
    expect(wrapOf('a')).not.toBeNull()
    // strike → exit → collapse, ~360ms cada, sem nenhum transitionend/animationend.
    await waitFor(() => expect(wrapOf('a')).toBeNull(), { timeout: 3000 })
    expect(titles()).toEqual(['B'])
  })
})

describe('F. callbacks do useTodos são estáveis', () => {
  it('moveBy (e os demais) mantêm a identidade após mutações', () => {
    const { result } = renderHook(() => useTodos())
    const before = result.current
    act(() => {
      result.current.addTodo({ title: 'A' })
    })
    act(() => {
      result.current.toggleTodo(result.current.todos[0]?.id ?? '')
    })
    act(() => result.current.setFilter('active'))
    const after = result.current
    expect(after.moveBy).toBe(before.moveBy)
    expect(after.addTodo).toBe(before.addTodo)
    expect(after.toggleTodo).toBe(before.toggleTodo)
    expect(after.updateTodo).toBe(before.updateTodo)
    // Mesmo estável, lê o estado atual.
    expect(after.moveBy(after.todos[0]?.id ?? '', 1)).toEqual({ status: 'unavailable' })
  })
})

/** Layout falso: itens de 60px a partir de y=100, respeitando translateY e o clone. */
function mockLayout() {
  const LIST_TOP = 100
  const HEIGHT = 60
  return vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      const el = this as HTMLElement
      let top = 0
      if (el.classList.contains('is-drag-ghost')) {
        top = Number.parseFloat(el.style.top) || 0
      } else {
        const wrap = el.closest<HTMLElement>('.todo-item-wrap')
        if (wrap?.parentElement) {
          const index = Array.from(wrap.parentElement.children).indexOf(wrap)
          const shift = /translateY\((-?[\d.]+)px\)/.exec(wrap.style.transform)
          top = LIST_TOP + index * HEIGHT + (shift ? Number(shift[1]) : 0)
        }
      }
      return DOMRect.fromRect({ x: 0, y: top, width: 600, height: HEIGHT })
    })
}

describe('G. arraste realista e assentamento', () => {
  it('solta numa posição intermediária, aguarda o transitionend e recusa novo arraste no meio', async () => {
    mockLayout()
    seed(rawTodo('a', 'A'), rawTodo('b', 'B'), rawTodo('c', 'C'))
    render(<App />)
    const handleA = itemOf('a')?.querySelector('.drag-handle') as HTMLElement
    fireEvent.pointerDown(handleA, { button: 0, pointerId: 1, clientY: 130 })
    // Centro de A passa do meio de B (190) mas não do de C (250): destino = 2ª posição.
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 195 })
    expect(wrapOf('b')?.style.transform).toBe('translateY(-60px)')
    expect(wrapOf('a')?.style.transform).toBe('translateY(60px)')
    expect(wrapOf('c')?.style.transform).toBe('')

    // L. Teclas que alteram a lista são engolidas durante o arraste.
    fireEvent.keyDown(itemOf('a') as HTMLElement, { key: 'Delete' })
    expect(titles()).toEqual(['A', 'B', 'C'])

    fireEvent.pointerUp(window, { pointerId: 1, clientY: 195 })
    const ghost = document.querySelector('.is-drag-ghost') as HTMLElement
    // O clone assenta (160px) antes do commit.
    expect(ghost).toHaveClass('is-settling')
    expect(ghost.style.top).toBe('160px')
    expect(titles()).toEqual(['A', 'B', 'C'])

    // Novo pointerdown durante o assentamento é recusado.
    const handleC = itemOf('c')?.querySelector('.drag-handle') as HTMLElement
    fireEvent.pointerDown(handleC, { button: 0, pointerId: 2, clientY: 250 })
    fireEvent.pointerMove(window, { pointerId: 2, clientY: 100 })
    expect(document.querySelectorAll('.is-drag-ghost')).toHaveLength(1)

    fire(ghost, 'transitionend', { propertyName: 'top' })
    expect(titles()).toEqual(['B', 'A', 'C'])
    expect(document.querySelector('.is-drag-ghost')).toBeNull()
    expect(wrapOf('b')?.style.transform).toBe('')
    expect(itemOf('a')).toHaveFocus()
    await waitFor(() =>
      expect(document.getElementById('announcer')).toHaveTextContent('A movida para a posição 2 de 3.'),
    )

    // Depois do teardown, um novo arraste funciona.
    fireEvent.pointerDown(handleC, { button: 0, pointerId: 3, clientY: 250 })
    fireEvent.pointerMove(window, { pointerId: 3, clientY: 100 })
    expect(document.querySelectorAll('.is-drag-ghost')).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'Escape' })
  })

  it('desmontar durante o assentamento remove o clone', () => {
    mockLayout()
    seed(rawTodo('a', 'A'), rawTodo('b', 'B'))
    const { unmount } = render(<App />)
    const handle = itemOf('a')?.querySelector('.drag-handle') as HTMLElement
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 130 })
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 195 })
    fireEvent.pointerUp(window, { pointerId: 1, clientY: 195 })
    expect(document.querySelector('.is-drag-ghost')).not.toBeNull()
    unmount()
    expect(document.querySelector('.is-drag-ghost')).toBeNull()
    expect(document.body).not.toHaveClass('is-dragging')
  })

  it('o clone não carrega atributos style copiados (CSP sem unsafe-inline)', () => {
    mockLayout()
    seed(rawTodo('a', 'A'), rawTodo('b', 'B'))
    render(<App />)
    const handle = itemOf('a')?.querySelector('.drag-handle') as HTMLElement
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 130 })
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 195 })
    const ghost = document.querySelector('.is-drag-ghost') as HTMLElement
    expect(ghost.querySelector('[style]')).toBeNull()
    expect(ghost.style.top).not.toBe('')
    fireEvent.keyDown(window, { key: 'Escape' })
  })
})

describe('H/J. tema sem script inline e com chave nova', () => {
  it('index.html não tem <script> nem <style> inline', () => {
    const scripts = indexHtml.match(/<script\b[^>]*>/g) ?? []
    expect(scripts.length).toBeGreaterThan(0)
    for (const tag of scripts) expect(tag).toMatch(/\ssrc=/)
    expect(indexHtml).not.toMatch(/<script\b[^>]*>\s*[^<\s]/)
    expect(indexHtml).not.toMatch(/<style\b/)
    expect(indexHtml).toContain('<script src="/theme-init.js"></script>')
    expect(indexHtml).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  })

  const runThemeInit = () => new Function(themeInitSource)()

  it('theme-init.js aplica a preferência salva', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    runThemeInit()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('theme-init.js migra a chave antiga e ignora valores inválidos', () => {
    localStorage.setItem('theme', 'light')
    runThemeInit()
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    delete document.documentElement.dataset.theme
    localStorage.clear()
    localStorage.setItem('theme', '<script>')
    runThemeInit()
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('o app também migra quando o script não rodou', async () => {
    localStorage.setItem('theme', 'dark')
    render(<App />)
    expect(screen.getByRole('button', { name: 'Tema escuro' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Tema escuro' }))
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})
