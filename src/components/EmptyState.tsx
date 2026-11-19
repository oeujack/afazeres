import type { Filter } from '../types'

const COPY: Record<'none' | Filter, { title: string; body: string }> = {
  none: { title: 'Página em branco.', body: 'Anote a primeira tarefa no campo acima.' },
  all: { title: 'Página em branco.', body: 'Anote a primeira tarefa no campo acima.' },
  active: { title: 'Nada pendente. Respire.', body: 'Todas as tarefas foram concluídas.' },
  completed: {
    title: 'Nada riscado ainda.',
    body: 'Marque uma tarefa como concluída e ela aparece aqui.',
  },
}

/** Renderizado no lugar do <ul>, para não deixar uma lista vazia no DOM. */
export function EmptyState({ variant }: { variant: 'none' | Filter }) {
  const { title, body } = COPY[variant]
  return (
    <div className="empty-state">
      <p className="empty-state__title">
        <span className="mark">{title}</span>
      </p>
      <p className="empty-state__body">{body}</p>
    </div>
  )
}
