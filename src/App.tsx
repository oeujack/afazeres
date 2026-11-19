import { useCallback, useEffect, useState } from 'react'
import { AnnouncerProvider } from './components/Announcer'
import { AppHeader } from './components/AppHeader'
import { FilterBar } from './components/FilterBar'
import { TodoFooter } from './components/TodoFooter'
import { NEW_TODO_ID, TodoInput } from './components/TodoInput'
import { KEYBOARD_HINT_ID } from './components/TodoItem'
import { TodoList } from './components/TodoList'
import { useAnnounce } from './hooks/announcer'
import { useTheme } from './hooks/useTheme'
import { useTodos, type NewTodoInput } from './hooks/useTodos'
import { toISODate } from './lib/dates'
import { clearedAnnouncement, documentTitle, filterAnnouncement } from './lib/text'
import { matchesFilter } from './state/todosReducer'
import type { Filter } from './types'

/** Data de hoje, atualizada quando o dia vira (relevante para "atrasada"). */
function useToday(): Date {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const check = () =>
      setToday((prev) => {
        const now = new Date()
        return toISODate(now) === toISODate(prev) ? prev : now
      })
    const interval = window.setInterval(check, 60_000)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', check)
    }
  }, [])
  return today
}

export const SAVE_ERROR_MESSAGE =
  'Não foi possível salvar no navegador. As alterações serão perdidas ao recarregar a página.'

function TodoApp() {
  const announce = useAnnounce()
  const today = useToday()
  const { theme, toggleTheme } = useTheme()
  const {
    todos,
    filter,
    activeCount,
    completedCount,
    addTodo,
    toggleTodo,
    updateTodo,
    removeTodo,
    clearCompleted,
    setFilter,
    moveTodo,
    moveBy,
  } = useTodos({ onSaveError: () => announce(SAVE_ERROR_MESSAGE) })

  useEffect(() => {
    document.title = documentTitle(activeCount)
  }, [activeCount])

  // Alt+N foca o campo "Nova tarefa" de qualquer lugar.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === 'KeyN') {
        event.preventDefault()
        document.getElementById(NEW_TODO_ID)?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleAdd = useCallback(
    (input: NewTodoInput) => {
      const result = addTodo(input)
      // Só anuncia quando o item foi de fato incluído.
      if (result.status === 'added') announce(`Tarefa adicionada: ${result.todo.title}.`)
      return result.status
    },
    [addTodo, announce],
  )

  const handleFilter = (next: Filter) => {
    setFilter(next)
    announce(filterAnnouncement(next, todos.filter((t) => matchesFilter(t, next)).length))
  }

  const handleClear = () => {
    if (completedCount === 0) return
    clearCompleted()
    announce(clearedAnnouncement(completedCount))
    document.getElementById(NEW_TODO_ID)?.focus()
  }

  const handleTheme = () => {
    const next = toggleTheme()
    announce(next === 'dark' ? 'Tema escuro ativado.' : 'Tema claro ativado.')
  }

  const hasTodos = todos.length > 0

  return (
    <>
      <div className="app">
        <AppHeader today={today} theme={theme} onToggleTheme={handleTheme} />
        <main className="app-main">
          <TodoInput onAdd={handleAdd} />
          <section className="todo-sheet" aria-labelledby="list-heading">
            <h2 id="list-heading" className="sr-only">
              Lista de tarefas
            </h2>
            {hasTodos && <FilterBar filter={filter} onChange={handleFilter} />}
            <TodoList
              todos={todos}
              filter={filter}
              today={today}
              onToggle={toggleTodo}
              onUpdate={updateTodo}
              onRemove={removeTodo}
              onMoveBy={moveBy}
              onMoveTo={moveTodo}
            />
            {hasTodos && (
              <TodoFooter
                activeCount={activeCount}
                completedCount={completedCount}
                onClearCompleted={handleClear}
              />
            )}
          </section>
        </main>
      </div>
      <p id={KEYBOARD_HINT_ID} hidden>
        Enter para editar, Espaço para concluir, Delete para excluir, Alt mais seta para cima ou
        para baixo para mover.
      </p>
    </>
  )
}

export default function App() {
  return (
    <AnnouncerProvider>
      <TodoApp />
    </AnnouncerProvider>
  )
}
