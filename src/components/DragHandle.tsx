import type { PointerEvent } from 'react'
import { GripIcon } from './icons'

interface DragHandleProps {
  disabled: boolean
  onPointerDown: (event: PointerEvent<HTMLSpanElement>) => void
}

/**
 * Alça de arraste: decorativa e fora da ordem de tabulação. As alternativas são
 * Alt+↑/↓ no teclado e "Mover para cima/baixo" no menu (SC 2.5.7).
 */
export function DragHandle({ disabled, onPointerDown }: DragHandleProps) {
  return (
    <span
      className={`drag-handle${disabled ? ' is-disabled' : ''}`}
      aria-hidden="true"
      onPointerDown={onPointerDown}
    >
      <GripIcon />
    </span>
  )
}
