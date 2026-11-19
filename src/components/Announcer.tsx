import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnnouncerContext } from '../hooks/announcer'

export const ANNOUNCE_DELAY = 50

/**
 * Live region única (polite). Esvazia o texto e define a nova mensagem após
 * 50ms, para que mensagens idênticas em sequência também sejam lidas.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef('')

  // Mensagens na mesma janela de 50ms são somadas, não sobrescritas.
  const announce = useCallback((next: string) => {
    window.clearTimeout(timer.current)
    pending.current = pending.current ? `${pending.current} ${next}` : next
    setMessage('')
    timer.current = window.setTimeout(() => {
      setMessage(pending.current)
      pending.current = ''
    }, ANNOUNCE_DELAY)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div id="announcer" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnouncerContext.Provider>
  )
}
