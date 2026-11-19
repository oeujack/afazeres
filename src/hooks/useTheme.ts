import { useCallback, useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import { loadTheme, saveTheme } from '../state/storage'
import type { Theme } from '../types'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const SWITCH_CLASS = 'is-theme-switching'
const SWITCH_MS = 300

function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
    ? 'dark'
    : 'light'
}

/** Preferência explícita: lida do `data-theme` aplicado pelo script anti-flash. */
function explicitTheme(): Theme | null {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : null
}

/**
 * Estado inicial: o `data-theme` do theme-init.js ou, na falta dele, o storage
 * (que também migra a chave antiga `theme` para `afazeres:theme`).
 */
function initialTheme(): Theme | null {
  const fromDom = explicitTheme()
  if (fromDom) return fromDom
  const stored = loadTheme()
  if (stored) document.documentElement.dataset.theme = stored
  return stored
}

export function useTheme() {
  const [explicit, setExplicit] = useState<Theme | null>(initialTheme)
  const switchTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(switchTimer.current), [])
  const [system, setSystem] = useState<Theme>(systemTheme)

  // Enquanto não houver escolha salva, acompanha o sistema.
  useEffect(() => {
    if (explicit || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [explicit])

  const theme: Theme = explicit ?? system

  const toggleTheme = useCallback((): Theme => {
    const next: Theme = (explicitTheme() ?? systemTheme()) === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    if (!prefersReducedMotion()) {
      // A especificação define a classe por 300ms (cobre a transição de 260ms).
      // Cliques rápidos: o timer anterior não pode remover a classe cedo demais.
      window.clearTimeout(switchTimer.current)
      root.classList.add(SWITCH_CLASS)
      switchTimer.current = window.setTimeout(() => root.classList.remove(SWITCH_CLASS), SWITCH_MS)
    }
    root.dataset.theme = next
    saveTheme(next)
    setExplicit(next)
    return next
  }, [])

  return { theme, toggleTheme }
}
