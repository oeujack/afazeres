/** Usuário pediu movimento reduzido? */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/**
 * Animações de saída/FLIP só rodam quando o ambiente anima de fato. Com
 * movimento reduzido (ou sem Web Animations, como no jsdom) o estado final é
 * aplicado de imediato, sem esperar eventos que não virão.
 */
export function motionEnabled(): boolean {
  return typeof HTMLElement.prototype.animate === 'function' && !prefersReducedMotion()
}

const activeReplays = new WeakMap<HTMLElement, () => void>()

/**
 * Reinicia uma animação baseada em classe e remove a classe no animationend
 * (da animação `until`, quando a classe encadeia mais de uma) ou no
 * animationcancel. Um replay novo substitui o listener do anterior.
 */
export function replayClass(el: HTMLElement, className: string, until?: string): void {
  activeReplays.get(el)?.()
  el.classList.remove(className)
  void el.offsetWidth // força reflow para reiniciar a animação
  el.classList.add(className)
  const cleanup = () => {
    el.removeEventListener('animationend', onEnd)
    el.removeEventListener('animationcancel', onCancel)
    activeReplays.delete(el)
  }
  const onEnd = (event: AnimationEvent) => {
    if (event.target !== el || (until && event.animationName !== until)) return
    el.classList.remove(className)
    cleanup()
  }
  const onCancel = (event: AnimationEvent) => {
    if (event.target !== el) return
    el.classList.remove(className)
    cleanup()
  }
  el.addEventListener('animationend', onEnd)
  el.addEventListener('animationcancel', onCancel)
  // Substituído por outro replay: remove listeners e a classe antiga.
  activeReplays.set(el, () => {
    el.classList.remove(className)
    cleanup()
  })
}
