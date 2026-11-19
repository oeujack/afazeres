import { describe, expect, it, vi } from 'vitest'
import {
  dayDiff,
  describeDueDate,
  formatHeaderDate,
  formatShortDate,
  isOverdue,
  isValidISODate,
  parseISODate,
  toISODate,
} from './dates'
import { createId } from './id'
import {
  clearedAnnouncement,
  documentTitle,
  filterAnnouncement,
  pendingLabel,
  tasksCount,
} from './text'

const today = new Date(2026, 10, 19, 15, 30) // quinta-feira, 19 nov. 2026

describe('datas', () => {
  it('valida datas ISO reais', () => {
    expect(isValidISODate('2026-11-19')).toBe(true)
    expect(isValidISODate('2024-02-29')).toBe(true)
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2026-13-01')).toBe(false)
    expect(isValidISODate('0000-01-01')).toBe(false)
    expect(isValidISODate('2026-1-1')).toBe(false)
  })

  it('converte entre Date local e ISO', () => {
    expect(toISODate(parseISODate('2026-03-05'))).toBe('2026-03-05')
    expect(dayDiff(today, parseISODate('2026-11-21'))).toBe(2)
  })

  it('formata datas em pt-BR', () => {
    expect(formatHeaderDate(today)).toBe('quinta-feira, 19 de novembro')
    expect(formatShortDate(parseISODate('2026-11-21'), today)).toBe('sáb., 21 nov.')
    expect(formatShortDate(parseISODate('2027-01-08'), today)).toBe('sex., 8 jan. 2027')
    expect(formatShortDate(parseISODate('2026-11-18'), today, false)).toBe('18 nov.')
  })

  it('descreve o vencimento', () => {
    expect(describeDueDate('2026-11-19', false, today)).toEqual({ status: 'today', label: 'Hoje' })
    expect(describeDueDate('2026-11-20', false, today).label).toBe('Amanhã')
    expect(describeDueDate('2026-11-25', false, today).status).toBe('future')
    expect(describeDueDate('2026-11-18', false, today)).toEqual({ status: 'overdue', label: '18 nov.' })
    expect(describeDueDate('2026-11-18', true, today).status).toBe('past')
  })

  it('identifica atrasadas', () => {
    expect(isOverdue('2026-11-18', false, today)).toBe(true)
    expect(isOverdue('2026-11-18', true, today)).toBe(false)
    expect(isOverdue('2026-11-19', false, today)).toBe(false)
    expect(isOverdue(null, false, today)).toBe(false)
  })
})

describe('textos', () => {
  it('pluraliza em pt-BR', () => {
    expect(pendingLabel(0)).toBe('Nenhuma tarefa pendente')
    expect(pendingLabel(1)).toBe('tarefa pendente')
    expect(pendingLabel(3)).toBe('tarefas pendentes')
    expect(tasksCount(0)).toBe('0 tarefas')
    expect(tasksCount(1)).toBe('1 tarefa')
  })

  it('monta anúncios e título', () => {
    expect(filterAnnouncement('active', 3)).toBe('Mostrando ativas: 3 tarefas.')
    expect(filterAnnouncement('completed', 1)).toBe('Mostrando concluídas: 1 tarefa.')
    expect(clearedAnnouncement(1)).toBe('1 tarefa concluída removida.')
    expect(clearedAnnouncement(2)).toBe('2 tarefas concluídas removidas.')
    expect(documentTitle(0)).toBe('Afazeres')
    expect(documentTitle(3)).toBe('(3) Afazeres')
  })
})

describe('createId', () => {
  it('gera ids seguros para atributos', () => {
    expect(createId()).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('usa fallback sem crypto.randomUUID', () => {
    const original = globalThis.crypto.randomUUID
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const spy = vi.spyOn(globalThis.crypto, 'getRandomValues')
      expect(createId()).toMatch(/^[0-9a-f]{32}$/)
      expect(spy).toHaveBeenCalled()
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: original, configurable: true })
    }
  })
})

describe('replayClass', () => {
  it('um replay novo substitui o anterior e animationcancel limpa a classe', async () => {
    const { replayClass } = await import('./motion')
    const el = document.createElement('div')
    replayClass(el, 'is-moved')
    replayClass(el, 'is-entering', 'highlight-flash')
    expect(el.classList.contains('is-moved')).toBe(false)
    expect(el.classList.contains('is-entering')).toBe(true)

    // O listener antigo foi removido: o animationend dele não mexe em nada.
    el.dispatchEvent(Object.assign(new Event('animationend'), { animationName: 'todo-enter' }))
    expect(el.classList.contains('is-entering')).toBe(true)

    el.dispatchEvent(new Event('animationcancel'))
    expect(el.classList.contains('is-entering')).toBe(false)
  })
})
