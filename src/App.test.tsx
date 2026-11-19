import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { TODOS_KEY } from './state/storage'
import { mediaState } from './test/setup'

function setup() {
  const user = userEvent.setup()
  const utils = render(<App />)
  return { user, ...utils }
}

const newTodoInput = () => screen.getByRole('textbox', { name: 'Nova tarefa' })

async function addTask(user: UserEvent, title: string) {
  await user.type(newTodoInput(), `${title}{Enter}`)
}

async function expectAnnounced(text: string) {
  await waitFor(() => expect(document.getElementById('announcer')).toHaveTextContent(text))
}

const titles = () =>
  Array.from(document.querySelectorAll('.todo-item__text')).map((el) => el.textContent)

function itemOf(title: string): HTMLElement {
  const text = Array.from(document.querySelectorAll('.todo-item__text')).find(
    (el) => el.textContent === title,
  )
  const el = text?.closest<HTMLElement>('.todo-item')
  if (!el) throw new Error(`Item ${title} não encontrado`)
  return el
}

function seed(...items: { title: string; completed?: boolean; dueDate?: string | null }[]) {
  localStorage.setItem(
    TODOS_KEY,
    JSON.stringify({
      version: 1,
      todos: items.map((item, i) => ({
        id: `t${i}`,
        title: item.title,
        completed: item.completed ?? false,
        priority: null,
        dueDate: item.dueDate ?? null,
        createdAt: i,
      })),
    }),
  )
}

describe('estrutura e estado vazio', () => {
  it('mostra o estado vazio sem filtros nem rodapé', () => {
    setup()
    expect(screen.getByRole('heading', { level: 1, name: 'Afazeres' })).toBeInTheDocument()
    expect(screen.getByText('Página em branco.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filtrar tarefas' })).not.toBeInTheDocument()
    expect(screen.queryByText('Nenhuma tarefa pendente')).not.toBeInTheDocument()
    expect(document.title).toBe('Afazeres')
  })
})

describe('criar', () => {
  it('cria no topo, limpa o campo, mantém o foco e anuncia', async () => {
    const { user } = setup()
    await addTask(user, 'Primeira')
    await addTask(user, 'Segunda')
    expect(titles()).toEqual(['Segunda', 'Primeira'])
    expect(newTodoInput()).toHaveValue('')
    expect(newTodoInput()).toHaveFocus()
    expect(screen.getByText('tarefas pendentes').parentElement).toHaveTextContent('2 tarefas pendentes')
    expect(document.title).toBe('(2) Afazeres')
    await expectAnnounced('Tarefa adicionada: Segunda.')
  })

  it('mostra erro para texto vazio, limpa ao digitar e com Esc', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escreva algo antes de adicionar.')
    expect(newTodoInput()).toHaveAttribute('aria-invalid', 'true')
    expect(newTodoInput()).toHaveAttribute('aria-describedby', 'new-todo-error')
    expect(newTodoInput()).toHaveFocus()

    await user.type(newTodoInput(), '   ')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.type(newTodoInput(), 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.clear(newTodoInput())
    await user.keyboard('{Enter}')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.type(newTodoInput(), 'abc{Escape}')
    expect(newTodoInput()).toHaveValue('')
  })

  it('cria com prioridade e vencimento e reseta as opções', async () => {
    const { user } = setup()
    const priority = screen.getByLabelText('Prioridade')
    const due = screen.getByLabelText('Vencimento')
    await user.selectOptions(priority, 'Alta')
    fireEvent.change(due, { target: { value: '2020-01-02' } })
    await addTask(user, 'Pagar boleto')

    const item = itemOf('Pagar boleto')
    expect(within(item).getByText('Alta')).toHaveTextContent('Prioridade Alta')
    expect(within(item).getByText(/Atrasada/)).toBeInTheDocument()
    expect(item).toHaveClass('is-overdue')
    expect(priority).toHaveValue('')
    expect(due).toHaveValue('')
  })

  it('Alt+N foca o campo de nova tarefa', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Tema escuro' }))
    await user.keyboard('{Alt>}n{/Alt}')
    expect(newTodoInput()).toHaveFocus()
  })
})

describe('editar', () => {
  it('duplo clique edita; Enter salva e devolve o foco ao item', async () => {
    seed({ title: 'Original' })
    const { user } = setup()
    await user.dblClick(itemOf('Original').querySelector('.todo-item__text') as HTMLElement)
    const input = screen.getByRole('textbox', { name: 'Editar tarefa' })
    expect(input).toHaveFocus()
    expect(input).toHaveValue('Original')
    await user.clear(input)
    await user.type(input, 'Alterada{Enter}')
    expect(titles()).toEqual(['Alterada'])
    expect(itemOf('Alterada')).toHaveFocus()
    await expectAnnounced('Tarefa atualizada: Alterada.')
  })

  it('Enter no item entra em edição; Esc cancela e restaura', async () => {
    seed({ title: 'Original' })
    const { user } = setup()
    itemOf('Original').focus()
    await user.keyboard('{Enter}')
    const input = screen.getByRole('textbox', { name: 'Editar tarefa' })
    await user.type(input, ' mudada')
    await user.keyboard('{Escape}')
    expect(titles()).toEqual(['Original'])
    expect(itemOf('Original')).toHaveFocus()
  })

  it('não salva texto vazio e não exclui o item', async () => {
    seed({ title: 'Original' })
    const { user } = setup()
    await user.dblClick(itemOf('Original').querySelector('.todo-item__text') as HTMLElement)
    const input = screen.getByRole('textbox', { name: 'Editar tarefa' })
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('A tarefa não pode ficar vazia.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    await user.type(input, 'Nova')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(titles()).toEqual(['Original'])
  })

  it('edita prioridade e salva ao perder o foco', async () => {
    seed({ title: 'Original' })
    const { user } = setup()
    await user.dblClick(itemOf('Original').querySelector('.todo-item__text') as HTMLElement)
    const form = screen.getByRole('form', { name: 'Editar tarefa' })
    await user.selectOptions(within(form).getByLabelText('Prioridade'), 'Média')
    await user.type(within(form).getByRole('textbox'), '!')
    await user.click(newTodoInput())
    expect(titles()).toEqual(['Original!'])
    expect(within(itemOf('Original!')).getByText('Média')).toBeInTheDocument()
    expect(newTodoInput()).toHaveFocus()
  })

  it('cancela ao perder o foco com texto vazio', async () => {
    seed({ title: 'Original' })
    const { user } = setup()
    await user.dblClick(itemOf('Original').querySelector('.todo-item__text') as HTMLElement)
    await user.clear(screen.getByRole('textbox', { name: 'Editar tarefa' }))
    await user.click(newTodoInput())
    expect(titles()).toEqual(['Original'])
  })

  it('edita pelo menu "Mais ações"', async () => {
    seed({ title: 'Original' })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Mais ações para “Original”' }))
    const edit = screen.getByRole('button', { name: 'Editar' })
    expect(edit).toHaveFocus()
    await user.click(edit)
    expect(screen.getByRole('textbox', { name: 'Editar tarefa' })).toHaveFocus()
  })
})

describe('concluir e excluir', () => {
  it('conclui pelo checkbox e reabre com Espaço no item', async () => {
    seed({ title: 'Tarefa' })
    const { user } = setup()
    const checkbox = screen.getByRole('checkbox', { name: 'Tarefa' })
    await user.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(itemOf('Tarefa')).toHaveClass('is-completed')
    expect(screen.getByText('Nenhuma tarefa pendente')).toBeInTheDocument()
    await expectAnnounced('Tarefa concluída: Tarefa.')

    itemOf('Tarefa').focus()
    await user.keyboard(' ')
    expect(checkbox).not.toBeChecked()
    await expectAnnounced('Tarefa reaberta: Tarefa.')
  })

  it('no filtro Ativas o item concluído sai e o foco vai ao próximo', async () => {
    seed({ title: 'A' }, { title: 'B' })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Ativas' }))
    itemOf('A').focus()
    await user.keyboard(' ')
    expect(titles()).toEqual(['B'])
    expect(itemOf('B')).toHaveFocus()
  })

  it('exclui pelo botão e pela tecla Delete, movendo o foco', async () => {
    seed({ title: 'A' }, { title: 'B' }, { title: 'C' })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Excluir “B”' }))
    expect(titles()).toEqual(['A', 'C'])
    expect(itemOf('C')).toHaveFocus()
    await expectAnnounced('Tarefa excluída: B.')

    await user.keyboard('{Delete}')
    expect(titles()).toEqual(['A'])
    expect(itemOf('A')).toHaveFocus()

    await user.keyboard('{Delete}')
    expect(newTodoInput()).toHaveFocus()
    expect(screen.getByText('Página em branco.')).toBeInTheDocument()
  })
})

describe('filtros e limpar concluídas', () => {
  it('filtra, anuncia e mostra estados vazios', async () => {
    seed({ title: 'Ativa' }, { title: 'Feita', completed: true })
    const { user } = setup()
    const active = screen.getByRole('button', { name: 'Ativas' })
    await user.click(active)
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(active).toHaveFocus()
    expect(titles()).toEqual(['Ativa'])
    await expectAnnounced('Mostrando ativas: 1 tarefa.')

    await user.click(screen.getByRole('button', { name: 'Concluídas' }))
    expect(titles()).toEqual(['Feita'])

    await user.click(screen.getByRole('checkbox', { name: 'Feita' }))
    expect(screen.getByText('Nada riscado ainda.')).toBeInTheDocument()

    await user.click(active)
    await user.click(screen.getByRole('checkbox', { name: 'Ativa' }))
    await user.click(screen.getByRole('checkbox', { name: 'Feita' }))
    expect(screen.getByText('Nada pendente. Respire.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Todas' }))
    expect(titles()).toEqual(['Ativa', 'Feita'])
    await expectAnnounced('Mostrando todas: 2 tarefas.')
  })

  it('limpa concluídas, anuncia e foca o campo', async () => {
    seed({ title: 'A', completed: true }, { title: 'B' }, { title: 'C', completed: true })
    const { user } = setup()
    const clear = screen.getByRole('button', { name: 'Limpar concluídas (2)' })
    await user.click(clear)
    expect(titles()).toEqual(['B'])
    expect(screen.getByRole('button', { name: 'Limpar concluídas' })).toBeDisabled()
    expect(newTodoInput()).toHaveFocus()
    await expectAnnounced('2 tarefas concluídas removidas.')
  })
})

describe('reordenar', () => {
  it('Alt+↑/↓ move, mantém o foco e anuncia', async () => {
    seed({ title: 'A' }, { title: 'B' }, { title: 'C' })
    const { user } = setup()
    itemOf('A').focus()
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(titles()).toEqual(['B', 'A', 'C'])
    expect(itemOf('A')).toHaveFocus()
    await expectAnnounced('A movida para a posição 2 de 3.')

    await user.keyboard('{Alt>}{ArrowUp}{ArrowUp}{/Alt}')
    expect(titles()).toEqual(['A', 'B', 'C'])
    await expectAnnounced('Já está no topo da lista.')

    itemOf('C').focus()
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    await expectAnnounced('Já está no fim da lista.')
  })

  it('Alt+seta funciona a partir de um controle interno', async () => {
    seed({ title: 'A' }, { title: 'B' })
    const { user } = setup()
    screen.getByRole('checkbox', { name: 'B' }).focus()
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(titles()).toEqual(['B', 'A'])
  })

  it('só reordena no filtro Todas', async () => {
    seed({ title: 'A' }, { title: 'B' })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Ativas' }))
    itemOf('A').focus()
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(titles()).toEqual(['A', 'B'])
    await expectAnnounced('Reordenação disponível apenas no filtro Todas.')
    await user.click(screen.getByRole('button', { name: 'Mais ações para “A”' }))
    const menu = document.getElementById('menu-t0') as HTMLElement
    expect(within(menu).getByText('Disponível no filtro Todas')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Mover para baixo' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mover para cima' })).toBeDisabled()
  })

  it('menu Mover para cima/baixo (ponteiro sem arrastar)', async () => {
    seed({ title: 'A' }, { title: 'B' })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Mais ações para “A”' }))
    expect(screen.getByRole('button', { name: 'Mover para cima' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Mover para baixo' }))
    expect(titles()).toEqual(['B', 'A'])
    // O popover fecha antes da ação.
    expect(screen.queryByRole('button', { name: 'Mover para baixo' })).not.toBeInTheDocument()
    await expectAnnounced('A movida para a posição 2 de 2.')

    await user.click(screen.getByRole('button', { name: 'Mais ações para “A”' }))
    expect(screen.getByRole('button', { name: 'Mover para baixo' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Mover para cima' }))
    expect(titles()).toEqual(['A', 'B'])
  })

  it('setas, Home e End navegam entre itens', async () => {
    seed({ title: 'A' }, { title: 'B' }, { title: 'C' })
    const { user } = setup()
    itemOf('A').focus()
    await user.keyboard('{ArrowDown}')
    expect(itemOf('B')).toHaveFocus()
    await user.keyboard('{End}')
    expect(itemOf('C')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(itemOf('B')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(itemOf('A')).toHaveFocus()
  })

  it('arrasta pela alça com Pointer Events', async () => {
    seed({ title: 'A' }, { title: 'B' }, { title: 'C' })
    setup()
    const handle = itemOf('A').querySelector('.drag-handle') as HTMLElement
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 10 })
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 12 }) // abaixo do limiar
    expect(document.querySelector('.is-drag-ghost')).toBeNull()
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 200 })
    expect(document.querySelector('.is-drag-ghost')).not.toBeNull()
    expect(itemOf('A')).toHaveClass('is-placeholder')
    expect(document.body).toHaveClass('is-dragging')
    await expectAnnounced('Movendo A. Pressione Esc para cancelar.')
    fireEvent.pointerUp(window, { pointerId: 1, clientY: 200 })
    expect(titles()).toEqual(['B', 'C', 'A'])
    expect(document.querySelector('.is-drag-ghost')).toBeNull()
    expect(document.body).not.toHaveClass('is-dragging')
    await expectAnnounced('A movida para a posição 3 de 3.')
  })

  it('Esc cancela o arraste', async () => {
    seed({ title: 'A' }, { title: 'B' })
    setup()
    const handle = itemOf('A').querySelector('.drag-handle') as HTMLElement
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 100 })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(titles()).toEqual(['A', 'B'])
    expect(document.querySelector('.is-drag-ghost')).toBeNull()
    await expectAnnounced('Movimento cancelado.')
  })

  it('arraste é ignorado fora do filtro Todas', async () => {
    seed({ title: 'A' }, { title: 'B' })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Ativas' }))
    const handle = itemOf('A').querySelector('.drag-handle') as HTMLElement
    expect(handle).toHaveClass('is-disabled')
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 0 })
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 100 })
    expect(document.querySelector('.is-drag-ghost')).toBeNull()
    await expectAnnounced('Reordenação disponível apenas no filtro Todas.')
  })
})

describe('tema e persistência', () => {
  it('alterna o tema, persiste e anuncia', async () => {
    const { user } = setup()
    const toggle = screen.getByRole('button', { name: 'Tema escuro' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('afazeres:theme')).toBe('dark')
    await expectAnnounced('Tema escuro ativado.')
    await user.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('light')
    await expectAnnounced('Tema claro ativado.')
  })

  it('não aplica a classe de transição de tema com movimento reduzido', async () => {
    mediaState.reducedMotion = true
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Tema escuro' }))
    expect(document.documentElement).not.toHaveClass('is-theme-switching')
  })

  it('persiste entre recarregamentos', async () => {
    const { user, unmount } = setup()
    await addTask(user, 'Persistida')
    unmount()
    render(<App />)
    expect(titles()).toEqual(['Persistida'])
  })

  it('ignora dados corrompidos no storage', () => {
    localStorage.setItem(TODOS_KEY, '{"version":1,"todos":[{"id":"<b>","title":"x"}]}')
    setup()
    expect(screen.getByText('Página em branco.')).toBeInTheDocument()
  })
})
