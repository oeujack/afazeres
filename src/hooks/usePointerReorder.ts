import { useEffect, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { replayClass } from '../lib/motion'
import { itemSelector, wrapSelector } from '../lib/selectors'

const DRAG_THRESHOLD = 4
const EDGE = 48
const MAX_SCROLL_STEP = 16
/** --dur-base (180ms) + 100ms de folga. */
const SETTLE_SAFETY_MS = 280

export interface PointerReorderOptions {
  listRef: RefObject<HTMLUListElement | null>
  /** Ids visíveis na ordem atual (o arraste só existe no filtro "Todas"). */
  getOrder: () => readonly string[]
  canStart: (id: string) => boolean
  getTitle: (id: string) => string
  onBlocked: () => void
  onDrop: (id: string, toIndex: number) => void
  announce: (message: string) => void
}

interface DragSession {
  id: string
  pointerId: number
  handle: HTMLElement
  startClientY: number
  lastClientY: number
  started: boolean
  wraps: HTMLElement[]
  tops: number[]
  heights: number[]
  index: number
  target: number
  startScrollY: number
  ghost: HTMLElement | null
  ghostStartTop: number
  raf: number
}

/** Índice de destino a partir do centro do clone (coordenadas de página). */
export function computeTargetIndex(
  tops: readonly number[],
  heights: readonly number[],
  index: number,
  center: number,
): number {
  let target = index
  for (let j = index + 1; j < tops.length; j++) {
    if (center > (tops[j] ?? 0) + (heights[j] ?? 0) / 2) target = j
  }
  for (let j = index - 1; j >= 0; j--) {
    if (center < (tops[j] ?? 0) + (heights[j] ?? 0) / 2) target = j
  }
  return target
}

function sum(values: readonly number[], from: number, to: number): number {
  let total = 0
  for (let i = from; i <= to; i++) total += values[i] ?? 0
  return total
}

/**
 * Reordenação por arraste com Pointer Events nativos: limiar de 4px,
 * placeholder no slot original, clone flutuante, vizinhos deslizando via
 * translateY, auto-scroll perto das bordas e Esc para cancelar.
 * Controlador imperativo (fora do ciclo de render do React).
 */
export class PointerReorderController {
  private session: DragSession | null = null
  /** Sessão encerrada cujo clone ainda está assentando (até o teardown). */
  private settling: DragSession | null = null
  private options: PointerReorderOptions | null = null

  setOptions(options: PointerReorderOptions): void {
    this.options = options
  }

  private getOptions(): PointerReorderOptions {
    if (!this.options) throw new Error('PointerReorderController sem opções.')
    return this.options
  }

  onHandlePointerDown = (id: string, event: ReactPointerEvent<HTMLElement>): void => {
    // Recusa novo arraste enquanto o anterior assenta: os rects ainda têm os
    // translateY antigos e o teardown antigo limparia o novo.
    if (event.button !== 0 || this.session || this.settling || !this.options) return
    const opts = this.options
    if (!opts.canStart(id)) {
      opts.onBlocked()
      return
    }
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture?.(event.pointerId)
    this.session = {
      id,
      pointerId: event.pointerId,
      handle,
      startClientY: event.clientY,
      lastClientY: event.clientY,
      started: false,
      wraps: [],
      tops: [],
      heights: [],
      index: 0,
      target: 0,
      startScrollY: 0,
      ghost: null,
      ghostStartTop: 0,
      raf: 0,
    }
    window.addEventListener('pointermove', this.handleMove)
    window.addEventListener('pointerup', this.handleUp)
    window.addEventListener('pointercancel', this.handleCancel)
    window.addEventListener('keydown', this.handleKey, true)
  }

  destroy(): void {
    const settling = this.settling
    if (settling) {
      this.settling = null
      this.teardown(settling)
    }
    const session = this.session
    if (!session) return
    this.session = null
    this.removeListeners()
    if (session.started) this.teardown(session)
  }

  private removeListeners() {
    window.removeEventListener('pointermove', this.handleMove)
    window.removeEventListener('pointerup', this.handleUp)
    window.removeEventListener('pointercancel', this.handleCancel)
    window.removeEventListener('keydown', this.handleKey, true)
  }

  private handleMove = (event: PointerEvent) => {
    const session = this.session
    if (!session || event.pointerId !== session.pointerId) return
    session.lastClientY = event.clientY
    if (!session.started) {
      if (Math.abs(event.clientY - session.startClientY) < DRAG_THRESHOLD) return
      if (!this.begin(session)) {
        this.end(false)
        return
      }
    }
    event.preventDefault()
    this.layout(session)
  }

  private handleUp = (event: PointerEvent) => {
    if (event.pointerId === this.session?.pointerId) this.end(true)
  }

  private handleCancel = (event: PointerEvent) => {
    if (event.pointerId === this.session?.pointerId) this.end(false)
  }

  /**
   * Durante o arraste, Esc cancela e as demais teclas são engolidas (captura
   * em window), para que Alt+↑/↓, Delete, Espaço etc. não alterem a lista.
   */
  private handleKey = (event: KeyboardEvent) => {
    if (!this.session?.started) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') this.end(false)
  }

  private begin(session: DragSession): boolean {
    const opts = this.getOptions()
    const list = opts.listRef.current
    if (!list) return false
    const order = opts.getOrder()
    const wraps = order
      .map((id) => list.querySelector<HTMLElement>(wrapSelector(id)))
      .filter((el): el is HTMLElement => el !== null)
    const index = order.indexOf(session.id)
    const item = wraps[index]?.querySelector<HTMLElement>('.todo-item')
    if (!item || wraps.length !== order.length) return false

    const scrollY = window.scrollY
    const rects = wraps.map((w) => w.getBoundingClientRect())
    session.wraps = wraps
    session.tops = rects.map((r) => r.top + scrollY)
    session.heights = rects.map((r) => r.height)
    session.index = index
    session.target = index
    session.startScrollY = scrollY

    const rect = item.getBoundingClientRect()
    const ghost = item.cloneNode(true) as HTMLElement
    ghost.removeAttribute('tabindex')
    ghost.removeAttribute('aria-describedby')
    ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
    // Atributos style copiados pelo clone seriam bloqueados por uma CSP sem
    // 'unsafe-inline'; o posicionamento abaixo usa CSSOM, que a CSP permite.
    ghost.removeAttribute('style')
    ghost.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'))
    ghost.querySelectorAll('[popover]').forEach((el) => el.remove())
    ghost.setAttribute('aria-hidden', 'true')
    ghost.setAttribute('inert', '')
    ghost.classList.add('is-drag-ghost')
    ghost.style.left = `${rect.left}px`
    ghost.style.top = `${rect.top}px`
    ghost.style.width = `${rect.width}px`
    session.ghostStartTop = rect.top
    session.ghost = ghost
    document.body.appendChild(ghost)

    item.classList.add('is-placeholder')
    list.classList.add('is-reordering')
    document.body.classList.add('is-dragging')
    session.started = true
    opts.announce(`Movendo ${opts.getTitle(session.id)}. Pressione Esc para cancelar.`)
    session.raf = window.requestAnimationFrame(this.autoScroll)
    return true
  }

  private layout(session: DragSession) {
    const { wraps, tops, heights, index } = session
    const clientDelta = session.lastClientY - session.startClientY
    const pageDelta = clientDelta + (window.scrollY - session.startScrollY)
    if (session.ghost) session.ghost.style.top = `${session.ghostStartTop + clientDelta}px`
    const center = (tops[index] ?? 0) + (heights[index] ?? 0) / 2 + pageDelta
    const target = computeTargetIndex(tops, heights, index, center)
    session.target = target
    const h = heights[index] ?? 0
    wraps.forEach((wrap, j) => {
      let offset = 0
      if (j === index) {
        offset = target > index ? sum(heights, index + 1, target) : -sum(heights, target, index - 1)
      } else if (j > index && j <= target) {
        offset = -h
      } else if (j < index && j >= target) {
        offset = h
      }
      wrap.style.transform = offset ? `translateY(${offset}px)` : ''
    })
  }

  private autoScroll = () => {
    const session = this.session
    if (!session?.started) return
    const y = session.lastClientY
    let step = 0
    if (y < EDGE) step = -Math.ceil(((EDGE - y) / EDGE) * MAX_SCROLL_STEP)
    else if (y > window.innerHeight - EDGE) {
      step = Math.ceil(((y - (window.innerHeight - EDGE)) / EDGE) * MAX_SCROLL_STEP)
    }
    if (step) {
      window.scrollBy(0, step)
      this.layout(session)
    }
    session.raf = window.requestAnimationFrame(this.autoScroll)
  }

  private end(commit: boolean) {
    const session = this.session
    if (!session) return
    this.session = null
    this.removeListeners()
    if (session.handle.hasPointerCapture?.(session.pointerId)) {
      session.handle.releasePointerCapture(session.pointerId)
    }
    if (!session.started) return
    window.cancelAnimationFrame(session.raf)
    this.settling = session
    const opts = this.getOptions()
    const moved = commit && session.target !== session.index
    if (!commit) {
      // Devolve tudo à posição original antes de assentar.
      session.target = session.index
      for (const wrap of session.wraps) wrap.style.transform = ''
      opts.announce('Movimento cancelado.')
    }
    this.settle(session, () => {
      // destroy() já fez o teardown desta sessão.
      if (this.settling !== session) return
      this.settling = null
      const total = opts.getOrder().length
      if (moved) flushSync(() => opts.onDrop(session.id, session.target))
      this.teardown(session)
      const item = opts.listRef.current?.querySelector<HTMLElement>(itemSelector(session.id))
      if (item) {
        replayClass(item, 'is-moved')
        item.focus({ preventScroll: true })
      }
      if (moved) {
        opts.announce(
          `${opts.getTitle(session.id)} movida para a posição ${session.target + 1} de ${total}.`,
        )
      }
    })
  }

  /** Assenta o clone no slot (transição em --dur-base) e chama `done` no transitionend. */
  private settle(session: DragSession, done: () => void) {
    const ghost = session.ghost
    const slot = session.wraps[session.index]
    if (!ghost || !slot) {
      done()
      return
    }
    const top = slot.getBoundingClientRect().top
    if (Math.abs(top - ghost.getBoundingClientRect().top) < 0.5) {
      done()
      return
    }
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      window.clearTimeout(safety)
      ghost.removeEventListener('transitionend', onEnd)
      ghost.removeEventListener('transitioncancel', finish)
      done()
    }
    // Se o transitionend não chegar, não deixa o controlador preso em "settling".
    const safety = window.setTimeout(finish, SETTLE_SAFETY_MS)
    const onEnd = (event: TransitionEvent) => {
      if (event.propertyName === 'top') finish()
    }
    ghost.addEventListener('transitionend', onEnd)
    ghost.addEventListener('transitioncancel', finish)
    ghost.classList.add('is-settling')
    ghost.style.top = `${top}px`
  }

  private teardown(session: DragSession) {
    window.cancelAnimationFrame(session.raf)
    session.ghost?.remove()
    // Sem transição: após o commit cada item já está no slot onde foi desenhado.
    for (const wrap of session.wraps) {
      wrap.style.transition = 'none'
      wrap.style.transform = ''
    }
    session.wraps[session.index]?.querySelector('.todo-item')?.classList.remove('is-placeholder')
    this.getOptions().listRef.current?.classList.remove('is-reordering')
    document.body.classList.remove('is-dragging')
    void document.body.offsetWidth
    for (const wrap of session.wraps) wrap.style.transition = ''
  }
}

export function usePointerReorder(options: PointerReorderOptions) {
  const [controller] = useState(() => new PointerReorderController())
  useEffect(() => {
    controller.setOptions(options)
  })
  // Desmontagem no meio de um arraste: limpa DOM e listeners.
  useEffect(() => () => controller.destroy(), [controller])
  return { onHandlePointerDown: controller.onHandlePointerDown }
}
