import type { Filter } from '../types'

const pluralRules = new Intl.PluralRules('pt-BR')

/**
 * Usa Intl.PluralRules('pt-BR'). O CLDR trata 0 como "one" em pt-BR, mas
 * "0 tarefas" é a forma natural, então o zero vai para o plural.
 */
export function plural(n: number, one: string, other: string): string {
  return n !== 0 && pluralRules.select(n) === 'one' ? one : other
}

export function pendingLabel(n: number): string {
  if (n === 0) return 'Nenhuma tarefa pendente'
  return plural(n, 'tarefa pendente', 'tarefas pendentes')
}

export function tasksCount(n: number): string {
  return `${n} ${plural(n, 'tarefa', 'tarefas')}`
}

const FILTER_ANNOUNCE: Record<Filter, string> = {
  all: 'todas',
  active: 'ativas',
  completed: 'concluídas',
}

export function filterAnnouncement(filter: Filter, n: number): string {
  return `Mostrando ${FILTER_ANNOUNCE[filter]}: ${tasksCount(n)}.`
}

export function clearedAnnouncement(n: number): string {
  return n === 1 ? '1 tarefa concluída removida.' : `${n} tarefas concluídas removidas.`
}

export function documentTitle(pending: number): string {
  return pending > 0 ? `(${pending}) Afazeres` : 'Afazeres'
}
