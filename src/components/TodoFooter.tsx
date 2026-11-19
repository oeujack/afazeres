import { pendingLabel } from '../lib/text'

interface TodoFooterProps {
  activeCount: number
  completedCount: number
  onClearCompleted: () => void
}

export function TodoFooter({ activeCount, completedCount, onClearCompleted }: TodoFooterProps) {
  return (
    <div className="todo-footer">
      <p className="todo-count">
        {activeCount > 0 && <strong>{activeCount}</strong>}
        {activeCount > 0 ? ' ' : ''}
        {pendingLabel(activeCount)}
      </p>
      <button
        type="button"
        className="btn-text"
        disabled={completedCount === 0}
        onClick={onClearCompleted}
      >
        {completedCount > 0 ? `Limpar concluídas (${completedCount})` : 'Limpar concluídas'}
      </button>
    </div>
  )
}
