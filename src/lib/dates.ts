const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Verifica se a string é uma data de calendário real no formato `YYYY-MM-DD`. */
export function isValidISODate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** Converte `YYYY-MM-DD` em Date à meia-noite local. Assume entrada válida. */
export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
}

/** Data local (não UTC) no formato `YYYY-MM-DD`. */
export function toISODate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Diferença em dias de calendário locais (b - a), ignorando horas e horário de verão. */
export function dayDiff(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / 86_400_000)
}

export function isOverdue(dueDate: string | null, completed: boolean, today: Date): boolean {
  if (!dueDate || completed) return false
  return dayDiff(today, parseISODate(dueDate)) < 0
}

const headerFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** Ex.: "quarta-feira, 19 de novembro". */
export function formatHeaderDate(date: Date): string {
  return headerFormatter.format(date)
}

const shortFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function shortParts(date: Date) {
  const parts = shortFormatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return { weekday: get('weekday'), day: get('day'), month: get('month'), year: get('year') }
}

/** Ex.: "sex., 21 nov." (ano incluído se diferente do atual). */
export function formatShortDate(date: Date, today: Date, withWeekday = true): string {
  const { weekday, day, month, year } = shortParts(date)
  const base = `${day} ${month}`
  const withYear = date.getFullYear() !== today.getFullYear() ? `${base} ${year}` : base
  return withWeekday ? `${weekday}, ${withYear}` : withYear
}

export type DueStatus = 'today' | 'tomorrow' | 'future' | 'overdue' | 'past'

export interface DueInfo {
  readonly status: DueStatus
  /** Texto visível principal (sem o prefixo "Atrasada"). */
  readonly label: string
}

export function describeDueDate(dueDate: string, completed: boolean, today: Date): DueInfo {
  const date = parseISODate(dueDate)
  const diff = dayDiff(today, date)
  if (diff === 0) return { status: 'today', label: 'Hoje' }
  if (diff === 1) return { status: 'tomorrow', label: 'Amanhã' }
  if (diff > 1) return { status: 'future', label: formatShortDate(date, today) }
  if (completed) return { status: 'past', label: formatShortDate(date, today) }
  return { status: 'overdue', label: formatShortDate(date, today, false) }
}
