import { createContext, useContext } from 'react'

export type Announce = (message: string) => void

export const AnnouncerContext = createContext<Announce>(() => {})

/** Envia uma mensagem para a live region única do app. */
export function useAnnounce(): Announce {
  return useContext(AnnouncerContext)
}
