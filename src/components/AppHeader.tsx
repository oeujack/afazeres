import { formatHeaderDate, toISODate } from '../lib/dates'
import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'

interface AppHeaderProps {
  today: Date
  theme: Theme
  onToggleTheme: () => void
}

export function AppHeader({ today, theme, onToggleTheme }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div>
        <h1 className="app-title">
          <span className="mark">Afazeres</span>
        </h1>
        <p className="app-date">
          <time dateTime={toISODate(today)}>{formatHeaderDate(today)}</time>
        </p>
      </div>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </header>
  )
}
