import { memo, useEffect, type AnimationEvent, type CSSProperties, type KeyboardEvent, type PointerEvent, type TransitionEvent } from 'react'
import type { Todo, TodoChanges } from '../types'
import { DragHandle } from './DragHandle'
import { DueDate } from './DueDate'
import { CheckIcon, MoreIcon, TrashIcon } from './icons'
import { ItemMenu } from './ItemMenu'
import { PriorityBadge } from './PriorityBadge'
import { TodoEditForm } from './TodoEditForm'
import { replayClass } from '../lib/motion'

/** Fases da saída animada: risco → deslize para fora → colapso de altura. */
export type LeavePhase = 'strike' | 'exit' | 'collapse'

export const KEYBOARD_HINT_ID = 'todo-keyboard-hint'

/** --dur-slow (260ms, a fase mais longa) + 100ms de folga. */
export const LEAVE_SAFETY_MS = 360

export interface TodoItemHandlers {
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onStartEdit: (id: string) => void
  onSave: (id: string, changes: TodoChanges, refocus: boolean) => void
  onCancelEdit: (id: string, refocus: boolean) => void
  onMove: (id: string, delta: -1 | 1) => void
  onHandlePointerDown: (id: string, event: PointerEvent<HTMLElement>) => void
  onLeaveStep: (id: string, finished: LeavePhase) => void
}

interface TodoItemProps extends TodoItemHandlers {
  todo: Todo
  today: Date
  overdue: boolean
  editing: boolean
  canReorder: boolean
  isFirst: boolean
  isLast: boolean
  leavePhase: LeavePhase | undefined
}

/** Move o foco entre itens com ↑/↓/Home/End (roving pelos `.todo-item`). */
function focusSibling(current: HTMLElement, key: string) {
  const list = current.closest('.todo-list')
  if (!list) return
  const items = Array.from(list.querySelectorAll<HTMLElement>('.todo-item'))
  const index = items.indexOf(current)
  const target =
    key === 'Home'
      ? items[0]
      : key === 'End'
        ? items[items.length - 1]
        : items[index + (key === 'ArrowUp' ? -1 : 1)]
  target?.focus()
}

function TodoItemImpl({
  todo,
  today,
  overdue,
  editing,
  canReorder,
  isFirst,
  isLast,
  leavePhase,
  onToggle,
  onDelete,
  onStartEdit,
  onSave,
  onCancelEdit,
  onMove,
  onHandlePointerDown,
  onLeaveStep,
}: TodoItemProps) {
  const { id, title, completed } = todo
  const textId = `todo-${id}-text`
  const menuId = `menu-${id}`
  const anchorName = `--anchor-${id}`
  const hasMeta = todo.priority !== null || todo.dueDate !== null
  // Rede de segurança: se o transitionend/animationend não chegar (elemento
  // oculto, propriedade não animável, aba em segundo plano), avança a fase.
  useEffect(() => {
    if (!leavePhase) return
    const timer = window.setTimeout(() => onLeaveStep(id, leavePhase), LEAVE_SAFETY_MS)
    return () => window.clearTimeout(timer)
  }, [leavePhase, id, onLeaveStep])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      if (editing) return
      event.preventDefault()
      onMove(id, event.key === 'ArrowUp' ? -1 : 1)
      return
    }
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }
    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        onStartEdit(id)
        break
      case ' ':
        event.preventDefault()
        onToggle(id)
        break
      case 'Delete':
        event.preventDefault()
        onDelete(id)
        break
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Home':
      case 'End':
        event.preventDefault()
        focusSibling(event.currentTarget, event.key)
        break
    }
  }

  const handleWrapTransitionEnd = (event: TransitionEvent<HTMLLIElement>) => {
    if (
      leavePhase === 'collapse' &&
      event.target === event.currentTarget &&
      event.propertyName === 'grid-template-rows'
    ) {
      onLeaveStep(id, 'collapse')
    }
  }

  const handleItemAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (leavePhase === 'exit' && event.target === event.currentTarget && event.animationName === 'todo-exit') {
      onLeaveStep(id, 'exit')
    }
  }

  const handleTextTransitionEnd = (event: TransitionEvent<HTMLSpanElement>) => {
    if (leavePhase === 'strike' && event.propertyName === 'background-size') {
      onLeaveStep(id, 'strike')
    }
  }

  const itemClass = [
    'todo-item',
    completed && 'is-completed',
    overdue && 'is-overdue',
    editing && 'is-editing',
    leavePhase === 'exit' || leavePhase === 'collapse' ? 'is-exiting' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={`todo-item-wrap${leavePhase === 'collapse' ? ' is-collapsing' : ''}`}
      data-id={id}
      onTransitionEnd={handleWrapTransitionEnd}
    >
      <div
        className={itemClass}
        tabIndex={0}
        data-id={id}
        // generic não pode ter nome (ARIA 1.2): group + nome vindo do texto.
        role="group"
        aria-labelledby={editing ? undefined : textId}
        aria-label={editing ? title : undefined}
        aria-describedby={KEYBOARD_HINT_ID}
        onKeyDown={handleKeyDown}
        onAnimationEnd={handleItemAnimationEnd}
      >
        <DragHandle
          disabled={!canReorder || editing}
          onPointerDown={(event) => onHandlePointerDown(id, event)}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            className="checkbox__input"
            checked={completed}
            // Em edição o texto some do DOM: usa o título como nome direto.
            aria-labelledby={editing ? undefined : textId}
            aria-label={editing ? title : undefined}
            onChange={(event) => {
              const box = event.currentTarget.nextElementSibling
              if (!completed && box instanceof HTMLElement) replayClass(box, 'is-popping')
              onToggle(id)
            }}
          />
          <span className="checkbox__box" aria-hidden="true">
            <CheckIcon />
          </span>
        </label>

        {editing ? (
          <TodoEditForm
            todo={todo}
            onSave={(changes, refocus) => onSave(id, changes, refocus)}
            onCancel={(refocus) => onCancelEdit(id, refocus)}
          />
        ) : (
          <div className="todo-item__content">
            <span
              id={textId}
              className="todo-item__text"
              onDoubleClick={() => onStartEdit(id)}
              onTransitionEnd={handleTextTransitionEnd}
            >
              <span className="todo-item__ink">{title}</span>
            </span>
            {hasMeta && (
              <div className="todo-item__meta">
                <PriorityBadge priority={todo.priority} />
                <DueDate dueDate={todo.dueDate} completed={completed} today={today} />
              </div>
            )}
          </div>
        )}

        <div className="todo-item__actions" hidden={editing}>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            aria-label={`Excluir “${title}”`}
            onClick={() => onDelete(id)}
          >
            <TrashIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            popoverTarget={menuId}
            data-anchor={anchorName}
            style={{ anchorName } as CSSProperties}
            aria-label={`Mais ações para “${title}”`}
          >
            <MoreIcon />
          </button>
          <ItemMenu
            id={menuId}
            anchorName={anchorName}
            title={title}
            canReorder={canReorder}
            isFirst={isFirst}
            isLast={isLast}
            onEdit={() => onStartEdit(id)}
            onMoveUp={() => onMove(id, -1)}
            onMoveDown={() => onMove(id, 1)}
          />
        </div>
      </div>
    </li>
  )
}

export const TodoItem = memo(TodoItemImpl)
