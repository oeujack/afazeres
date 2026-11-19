import type { Theme } from '../types'
import { MoonIcon, SunIcon } from './icons'

interface ThemeToggleProps {
  theme: Theme
  onToggle: () => void
}

/** Botão toggle com nome fixo "Tema escuro"; o estado vem de aria-pressed. */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-pressed={theme === 'dark'}
      onClick={onToggle}
    >
      <SunIcon className="theme-toggle__sun" />
      <MoonIcon className="theme-toggle__moon" />
      <span className="sr-only">Tema escuro</span>
    </button>
  )
}
