import { FILTER_LABEL, FILTERS, type Filter } from '../types'

interface FilterBarProps {
  filter: Filter
  onChange: (filter: Filter) => void
}

export function FilterBar({ filter, onChange }: FilterBarProps) {
  return (
    <div role="group" aria-label="Filtrar tarefas" className="filter-bar">
      {FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          className="filter-bar__btn"
          aria-pressed={filter === f}
          onClick={() => onChange(f)}
        >
          {FILTER_LABEL[f]}
        </button>
      ))}
    </div>
  )
}
