import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { TODOS_KEY } from '../state/storage'
import { mediaState } from '../test/setup'

function seed(...titles: string[]) {
  localStorage.setItem(
    TODOS_KEY,
    JSON.stringify({
      version: 1,
      todos: titles.map((title, i) => ({
        id: `t${i}`,
        title,
        completed: false,
        priority: null,
        dueDate: null,
        createdAt: i,
      })),
    }),
  )
}

/**
 * Dispara eventos de animação/transição com as propriedades que o React lê.
 * Sem AnimationEvent no jsdom, o React escuta o nome prefixado
 * (webkitAnimationEnd); disparamos os dois nomes.
 */
function fire(el: Element, type: 'animationend' | 'transitionend', props: Record<string, string>) {
  const types = type === 'animationend' ? ['animationend', 'webkitAnimationEnd'] : [type]
  act(() => {
    for (const t of types) el.dispatchEvent(Object.assign(new Event(t, { bubbles: true }), props))
  })
}

const wrapOf = (id: string) => document.querySelector(`.todo-item-wrap[data-id="${id}"]`) as HTMLElement
const itemOf = (id: string) => document.querySelector(`.todo-item[data-id="${id}"]`) as HTMLElement

describe('com animações habilitadas', () => {
  beforeEach(() => {
    // jsdom não tem Web Animations: o stub faz motionEnabled() retornar true.
    HTMLElement.prototype.animate = vi.fn(() => ({}) as Animation)
  })
  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate
  })

  it('excluir: todo-exit → colapso → remoção, com foco no próximo', async () => {
    seed('A', 'B', 'C')
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Excluir “B”' }))
    expect(itemOf('t1')).toHaveClass('is-exiting')
    expect(itemOf('t2')).toHaveFocus()

    fire(itemOf('t1'), 'animationend', { animationName: 'todo-exit' })
    expect(wrapOf('t1')).toHaveClass('is-collapsing')

    fire(wrapOf('t1'), 'transitionend', { propertyName: 'grid-template-rows' })
    expect(wrapOf('t1')).toBeNull()
    expect(JSON.parse(localStorage.getItem(TODOS_KEY) ?? '{}').todos).toHaveLength(2)
  })

  it('concluir no filtro Ativas: risco → saída → colapso; foco vai ao próximo', async () => {
    seed('A', 'B')
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Ativas' }))
    await user.click(screen.getByRole('checkbox', { name: 'A' }))
    // Continua visível até o risco terminar.
    expect(itemOf('t0')).toHaveClass('is-completed')

    const text = itemOf('t0').querySelector('.todo-item__text') as HTMLElement
    fire(text, 'transitionend', { propertyName: 'color' }) // ignorado
    expect(itemOf('t0')).not.toHaveClass('is-exiting')
    fire(text, 'transitionend', { propertyName: 'background-size' })
    expect(itemOf('t0')).toHaveClass('is-exiting')
    fire(itemOf('t0'), 'animationend', { animationName: 'todo-exit' })
    fire(wrapOf('t0'), 'transitionend', { propertyName: 'grid-template-rows' })
    expect(wrapOf('t0')).toBeNull()
    expect(itemOf('t1')).toHaveFocus()
  })

  it('reabrir durante o risco mantém o item no filtro', async () => {
    seed('A')
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Ativas' }))
    const checkbox = screen.getByRole('checkbox', { name: 'A' })
    await user.click(checkbox)
    await user.click(checkbox)
    const text = itemOf('t0').querySelector('.todo-item__text') as HTMLElement
    fire(text, 'transitionend', { propertyName: 'background-size' })
    expect(itemOf('t0')).not.toHaveClass('is-exiting')
    expect(itemOf('t0')).not.toHaveClass('is-completed')
  })

  it('trocar de filtro descarta saídas pendentes', async () => {
    seed('A')
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Ativas' }))
    await user.click(screen.getByRole('checkbox', { name: 'A' }))
    await user.click(screen.getByRole('button', { name: 'Concluídas' }))
    await user.click(screen.getByRole('button', { name: 'Ativas' }))
    expect(screen.getByText('Nada pendente. Respire.')).toBeInTheDocument()

    // Nenhuma saída pendente sobrou: o arraste volta a funcionar no filtro Todas.
    await user.click(screen.getByRole('button', { name: 'Todas' }))
    const handle = itemOf('t0').querySelector('.drag-handle') as HTMLElement
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 40 })
    expect(document.querySelector('.is-drag-ghost')).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
  })

  it('item novo recebe a passada de marca-texto', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox', { name: 'Nova tarefa' }), 'Nova{Enter}')
    const item = document.querySelector('.todo-item') as HTMLElement
    expect(item).toHaveClass('is-entering')
    fire(item, 'animationend', { animationName: 'todo-enter' })
    expect(item).toHaveClass('is-entering')
    fire(item, 'animationend', { animationName: 'highlight-flash' })
    expect(item).not.toHaveClass('is-entering')
  })

  it('mover pelo teclado aplica highlight-flash', async () => {
    seed('A', 'B')
    const user = userEvent.setup()
    render(<App />)
    itemOf('t0').focus()
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(itemOf('t0')).toHaveClass('is-moved')
  })
})

describe('menu "Mais ações"', () => {
  it('posiciona via JS sem CSS Anchor Positioning e limpa ao fechar', async () => {
    const original = globalThis.CSS
    vi.stubGlobal('CSS', { ...original, supports: () => false })
    seed('A')
    const user = userEvent.setup()
    render(<App />)
    const trigger = screen.getByRole('button', { name: 'Mais ações para “A”' })
    await user.click(trigger)
    const menu = document.getElementById('menu-t0') as HTMLElement
    expect(menu.style.position).toBe('fixed')
    await user.click(trigger)
    expect(menu.style.position).toBe('')
    vi.unstubAllGlobals()
  })

  it('no bottom sheet o Tab circula dentro do menu', async () => {
    mediaState.narrow = true
    seed('A', 'B')
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Mais ações para “A”' }))
    const edit = screen.getByRole('button', { name: 'Editar' })
    const down = screen.getByRole('button', { name: 'Mover para baixo' })
    expect(edit).toHaveFocus()
    await user.tab({ shift: true })
    expect(down).toHaveFocus()
    await user.tab()
    expect(edit).toHaveFocus()
  })
})

describe('anúncios repetidos', () => {
  it('reanuncia mensagens idênticas', async () => {
    seed('A')
    const user = userEvent.setup()
    render(<App />)
    const announcer = document.getElementById('announcer') as HTMLElement
    itemOf('t0').focus()
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
    await waitFor(() => expect(announcer).toHaveTextContent('Já está no topo da lista.'))
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(announcer).toHaveTextContent('')
    await waitFor(() => expect(announcer).toHaveTextContent('Já está no topo da lista.'))
  })
})
