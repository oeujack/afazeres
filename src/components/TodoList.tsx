import { useCallback, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useAnnounce } from '../hooks/announcer'
import { usePointerReorder } from '../hooks/usePointerReorder'
import type { MoveResult } from '../hooks/useTodos'
import { isOverdue } from '../lib/dates'
import { motionEnabled, replayClass } from '../lib/motion'
import { itemSelector, wrapSelector } from '../lib/selectors'
import { matchesFilter } from '../state/todosReducer'
import type { Filter, Todo, TodoChanges } from '../types'
import { EmptyState } from './EmptyState'
import { TodoItem, type LeavePhase } from './TodoItem'
import { NEW_TODO_ID } from './TodoInput'

const REORDER_UNAVAILABLE = 'Reordenação disponível apenas no filtro Todas.'

interface Leaving {
  phase: LeavePhase
  /** `delete`: some do estado ao fim; `filter`: só deixa de ser exibido. */
  kind: 'delete' | 'filter'
}

interface TodoListProps {
  todos: readonly Todo[]
  filter: Filter
  today: Date
  onToggle: (id: string) => void
  onUpdate: (id: string, changes: TodoChanges) => boolean
  onRemove: (id: string) => void
  onMoveBy: (id: string, delta: -1 | 1) => MoveResult
  onMoveTo: (id: string, toIndex: number) => void
}

interface PendingFocus {
  /** Foca este item após o commit. */
  itemId?: string
  /** Vizinhos para quando o item focado sumir. */
  neighbors?: readonly (string | undefined)[]
  force?: boolean
}

interface FlipRecord {
  tops: Map<string, number>
  focused: Element | null
}

export function TodoList({
  todos,
  filter,
  today,
  onToggle,
  onUpdate,
  onRemove,
  onMoveBy,
  onMoveTo,
}: TodoListProps) {
  const announce = useAnnounce()
  const listRef = useRef<HTMLUListElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<ReadonlyMap<string, Leaving>>(() => new Map())
  const [leavingFilter, setLeavingFilter] = useState(filter)

  const indexById = useMemo(() => new Map(todos.map((t, i) => [t.id, i])), [todos])

  // Ajuste durante o render:
  // - ao trocar de filtro, saídas "de filtro" pendentes deixam de fazer sentido;
  // - entradas órfãs (o item já saiu do estado, ex.: "Limpar concluídas" durante
  //   a animação) são podadas; senão bloqueariam o arraste para sempre.
  const filterChanged = leavingFilter !== filter
  const hasOrphans = [...leaving.keys()].some((id) => !indexById.has(id))
  if (filterChanged || hasOrphans) {
    if (filterChanged) setLeavingFilter(filter)
    setLeaving(
      (prev) =>
        new Map(
          [...prev].filter(
            ([id, v]) => indexById.has(id) && (!filterChanged || v.kind === 'delete'),
          ),
        ),
    )
  }

  const rendered = useMemo(
    () => todos.filter((t) => matchesFilter(t, filter) || leaving.has(t.id)),
    [todos, filter, leaving],
  )

  const latest = useRef({ todos, filter, rendered, leaving, editingId })
  useLayoutEffect(() => {
    latest.current = { todos, filter, rendered, leaving, editingId }
  })

  const pendingFocus = useRef<PendingFocus | null>(null)
  const flip = useRef<FlipRecord | null>(null)
  const knownIds = useRef<Set<string> | null>(null)

  const focusItem = useCallback((id: string | undefined): boolean => {
    if (!id) return false
    const el = listRef.current?.querySelector<HTMLElement>(itemSelector(id))
    if (!el) return false
    el.focus()
    return true
  }, [])

  const focusNeighbor = useCallback(
    (neighbors: readonly (string | undefined)[]) => {
      if (!neighbors.some((n) => focusItem(n))) document.getElementById(NEW_TODO_ID)?.focus()
    },
    [focusItem],
  )

  const neighborsOf = useCallback((id: string): (string | undefined)[] => {
    const list = latest.current.rendered
    const i = list.findIndex((t) => t.id === id)
    return [list[i + 1]?.id, list[i - 1]?.id]
  }, [])

  // Pós-commit: foco pendente, FLIP de reordenação e entrada de itens novos.
  useLayoutEffect(() => {
    const pending = pendingFocus.current
    if (pending) {
      pendingFocus.current = null
      if (pending.itemId) focusItem(pending.itemId)
      else if (pending.neighbors) {
        const active = document.activeElement
        if (pending.force || !active || active === document.body) focusNeighbor(pending.neighbors)
      }
    }

    const record = flip.current
    if (record && listRef.current) {
      flip.current = null
      const animate = motionEnabled()
      listRef.current.querySelectorAll<HTMLElement>('.todo-item-wrap').forEach((wrap) => {
        const id = wrap.dataset.id ?? ''
        const before = record.tops.get(id)
        if (!animate || before === undefined) return
        const delta = before - wrap.getBoundingClientRect().top
        if (Math.abs(delta) < 0.5) return
        wrap.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], {
          duration: 180,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })
      })
      // O nó focado pode perder o foco ao ser movido no DOM: refoca.
      if (record.focused instanceof HTMLElement && document.activeElement !== record.focused) {
        record.focused.focus()
      }
    }

    const ids = new Set(todos.map((t) => t.id))
    const known = knownIds.current
    knownIds.current = ids
    if (known && motionEnabled()) {
      for (const id of ids) {
        if (known.has(id)) continue
        const el = listRef.current?.querySelector<HTMLElement>(itemSelector(id))
        if (el) replayClass(el, 'is-entering', 'highlight-flash')
      }
    }
  }, [todos, editingId, leaving, focusItem, focusNeighbor])

  const setPhase = useCallback((id: string, value: Leaving | null) => {
    setLeaving((prev) => {
      const next = new Map(prev)
      if (value) next.set(id, value)
      else next.delete(id)
      return next
    })
  }, [])

  const handleToggle = useCallback(
    (id: string) => {
      const { todos: all, filter: f, leaving: l } = latest.current
      const todo = all.find((t) => t.id === id)
      if (!todo || l.get(id)?.kind === 'delete') return
      const willComplete = !todo.completed
      onToggle(id)
      announce(`${willComplete ? 'Tarefa concluída' : 'Tarefa reaberta'}: ${todo.title}.`)
      // Continua no filtro (ou desfez durante o risco: handleLeaveStep mantém o item).
      if (matchesFilter({ ...todo, completed: willComplete }, f)) return
      if (motionEnabled()) {
        // Em edição o texto (e o risco) não existe: pula direto para a saída.
        const phase = latest.current.editingId === id ? 'exit' : 'strike'
        if (!l.has(id)) setPhase(id, { phase, kind: 'filter' })
      } else {
        pendingFocus.current = { neighbors: neighborsOf(id) }
      }
    },
    [announce, neighborsOf, onToggle, setPhase],
  )

  const handleDelete = useCallback(
    (id: string) => {
      const { todos: all, leaving: l } = latest.current
      const todo = all.find((t) => t.id === id)
      if (!todo || l.get(id)?.kind === 'delete') return
      announce(`Tarefa excluída: ${todo.title}.`)
      const neighbors = neighborsOf(id)
      if (latest.current.editingId === id) setEditingId(null)
      if (motionEnabled()) {
        setPhase(id, { phase: 'exit', kind: 'delete' })
        focusNeighbor(neighbors)
      } else {
        onRemove(id)
        pendingFocus.current = { neighbors, force: true }
      }
    },
    [announce, focusNeighbor, neighborsOf, onRemove, setPhase],
  )

  const handleLeaveStep = useCallback(
    (id: string, finished: LeavePhase) => {
      const { todos: all, filter: f, leaving: l } = latest.current
      const entry = l.get(id)
      // Evento atrasado ou duplicado (o timeout de segurança e o evento real).
      if (!entry || entry.phase !== finished) return
      if (finished === 'strike') {
        const todo = all.find((t) => t.id === id)
        if (todo && matchesFilter(todo, f)) setPhase(id, null)
        else setPhase(id, { ...entry, phase: 'exit' })
      } else if (finished === 'exit') {
        setPhase(id, { ...entry, phase: 'collapse' })
      } else {
        const wrap = listRef.current?.querySelector(wrapSelector(id))
        if (wrap?.contains(document.activeElement)) {
          pendingFocus.current = { neighbors: neighborsOf(id), force: true }
        }
        setPhase(id, null)
        setEditingId((current) => (current === id ? null : current))
        if (entry.kind === 'delete') onRemove(id)
      }
    },
    [neighborsOf, onRemove, setPhase],
  )

  const handleStartEdit = useCallback((id: string) => {
    if (latest.current.leaving.has(id)) return
    setEditingId(id)
  }, [])

  const handleSave = useCallback(
    (id: string, changes: TodoChanges, refocus: boolean) => {
      if (onUpdate(id, changes)) announce(`Tarefa atualizada: ${changes.title.trim()}.`)
      setEditingId((current) => (current === id ? null : current))
      if (refocus) pendingFocus.current = { itemId: id }
    },
    [announce, onUpdate],
  )

  const handleCancelEdit = useCallback((id: string, refocus: boolean) => {
    setEditingId((current) => (current === id ? null : current))
    if (refocus) pendingFocus.current = { itemId: id }
  }, [])

  const handleMove = useCallback(
    (id: string, delta: -1 | 1) => {
      if (latest.current.filter !== 'all') {
        announce(REORDER_UNAVAILABLE)
        return
      }
      const tops = new Map<string, number>()
      listRef.current?.querySelectorAll<HTMLElement>('.todo-item-wrap').forEach((wrap) => {
        tops.set(wrap.dataset.id ?? '', wrap.getBoundingClientRect().top)
      })
      const focused = document.activeElement
      const result = onMoveBy(id, delta)
      if (result.status === 'moved') {
        flip.current = { tops, focused }
        const el = listRef.current?.querySelector<HTMLElement>(itemSelector(id))
        if (el) replayClass(el, 'is-moved')
        announce(`${result.todo.title} movida para a posição ${result.position} de ${result.total}.`)
      } else if (result.status === 'top') {
        announce('Já está no topo da lista.')
      } else if (result.status === 'bottom') {
        announce('Já está no fim da lista.')
      } else if (result.status === 'unavailable') {
        announce(REORDER_UNAVAILABLE)
      }
    },
    [announce, onMoveBy],
  )

  const { onHandlePointerDown } = usePointerReorder({
    listRef,
    getOrder: () => latest.current.rendered.map((t) => t.id),
    canStart: (id) =>
      latest.current.filter === 'all' &&
      latest.current.editingId !== id &&
      latest.current.leaving.size === 0,
    getTitle: (id) => latest.current.todos.find((t) => t.id === id)?.title ?? '',
    onBlocked: () => {
      if (latest.current.filter !== 'all') announce(REORDER_UNAVAILABLE)
    },
    onDrop: onMoveTo,
    announce,
  })

  const handlePointerDown = useCallback(
    (id: string, event: PointerEvent<HTMLElement>) => onHandlePointerDown(id, event),
    [onHandlePointerDown],
  )

  if (rendered.length === 0) {
    return <EmptyState variant={todos.length === 0 ? 'none' : filter} />
  }

  const canReorder = filter === 'all'
  const lastIndex = todos.length - 1

  return (
    <ul className="todo-list" aria-label="Tarefas" ref={listRef}>
      {rendered.map((todo) => {
        const index = indexById.get(todo.id) ?? -1
        return (
          <TodoItem
            key={todo.id}
            todo={todo}
            today={today}
            overdue={isOverdue(todo.dueDate, todo.completed, today)}
            editing={editingId === todo.id}
            canReorder={canReorder}
            isFirst={index === 0}
            isLast={index === lastIndex}
            leavePhase={leaving.get(todo.id)?.phase}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onStartEdit={handleStartEdit}
            onSave={handleSave}
            onCancelEdit={handleCancelEdit}
            onMove={handleMove}
            onHandlePointerDown={handlePointerDown}
            onLeaveStep={handleLeaveStep}
          />
        )
      })}
    </ul>
  )
}
