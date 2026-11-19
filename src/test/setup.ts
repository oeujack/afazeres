import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

/** matchMedia controlável nos testes (jsdom não implementa). */
export const mediaState = { dark: false, reducedMotion: false, narrow: false }
const listeners = new Set<(event: MediaQueryListEvent) => void>()

function matches(query: string): boolean {
  if (query.includes('prefers-color-scheme: dark')) return mediaState.dark
  if (query.includes('prefers-reduced-motion')) return mediaState.reducedMotion
  if (query.includes('max-width')) return mediaState.narrow
  return false
}

window.matchMedia = (query: string): MediaQueryList =>
  ({
    get matches() {
      return matches(query)
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }) as MediaQueryList

/** Simula a troca do tema do sistema. */
export function setSystemDark(dark: boolean) {
  mediaState.dark = dark
  for (const listener of listeners) listener({ matches: dark } as MediaQueryListEvent)
}

/**
 * Shim mínimo da Popover API: o jsdom oculta `[popover]` via UA stylesheet,
 * mas não implementa showPopover/hidePopover nem `popovertarget`.
 */
const popoverStyle = document.createElement('style')
popoverStyle.textContent = '[popover][data-test-open] { display: block !important; }'
document.head.appendChild(popoverStyle)

function setPopover(el: HTMLElement, open: boolean) {
  if (el.hasAttribute('data-test-open') === open) return
  el.toggleAttribute('data-test-open', open)
  el.dispatchEvent(Object.assign(new Event('toggle'), { newState: open ? 'open' : 'closed' }))
}

HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement) {
  setPopover(this, true)
}
HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement) {
  setPopover(this, false)
}
HTMLElement.prototype.togglePopover = function togglePopover(this: HTMLElement) {
  const open = !this.hasAttribute('data-test-open')
  setPopover(this, open)
  return open
}

document.addEventListener('click', (event) => {
  const invoker = (event.target as Element | null)?.closest?.('[popovertarget]')
  const id = invoker?.getAttribute('popovertarget')
  const target = id ? document.getElementById(id) : null
  target?.togglePopover()
})

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
  document.documentElement.className = ''
  mediaState.dark = false
  mediaState.reducedMotion = false
  mediaState.narrow = false
})

afterEach(() => {
  cleanup()
})
