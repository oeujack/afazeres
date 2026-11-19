import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'

interface ItemMenuProps {
  id: string
  anchorName: string
  title: string
  canReorder: boolean
  isFirst: boolean
  isLast: boolean
  onEdit: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

const SHEET_QUERY = '(max-width: 599.98px)'

function supportsAnchorPositioning(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? CSS.supports('position-area: bottom')
    : false
}

function isSheetLayout(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(SHEET_QUERY).matches
}

/** Fallback sem CSS Anchor Positioning: posiciona via getBoundingClientRect. */
function positionWithJs(menu: HTMLElement, anchorName: string) {
  const anchor = document.querySelector<HTMLElement>(`[data-anchor="${anchorName}"]`)
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const menuRect = menu.getBoundingClientRect()
  const below = rect.bottom + 4
  const fitsBelow = below + menuRect.height <= window.innerHeight
  menu.style.position = 'fixed'
  menu.style.inset = 'auto'
  menu.style.margin = '0'
  menu.style.top = `${fitsBelow ? below : Math.max(8, rect.top - menuRect.height - 4)}px`
  menu.style.left = `${Math.max(8, rect.right - menuRect.width)}px`
}

function clearJsPosition(menu: HTMLElement) {
  for (const prop of ['position', 'inset', 'margin', 'top', 'left'] as const) menu.style[prop] = ''
}

/** Popover nativo "Mais ações". Vira bottom sheet abaixo de 600px. */
export function ItemMenu({
  id,
  anchorName,
  title,
  canReorder,
  isFirst,
  isLast,
  onEdit,
  onMoveUp,
  onMoveDown,
}: ItemMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const menu = ref.current
    if (!menu) return
    const onToggle = (event: Event) => {
      const state = (event as ToggleEvent).newState
      if (state !== 'open') {
        clearJsPosition(menu)
        return
      }
      if (!isSheetLayout() && !supportsAnchorPositioning()) positionWithJs(menu, anchorName)
      menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    }
    menu.addEventListener('toggle', onToggle)
    return () => menu.removeEventListener('toggle', onToggle)
  }, [anchorName])

  const run = (action: () => void) => {
    // Fecha antes de executar a ação (o navegador devolve o foco ao "⋯").
    ref.current?.hidePopover?.()
    action()
  }

  // No bottom sheet (modal visualmente), o Tab circula dentro do menu.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !isSheetLayout()) return
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    )
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const style = { positionAnchor: anchorName } as CSSProperties

  return (
    <div id={id} ref={ref} popover="auto" className="item-menu" style={style} onKeyDown={handleKeyDown}>
      <p className="item-menu__title">{title}</p>
      <button type="button" className="item-menu__btn" onClick={() => run(onEdit)}>
        Editar
      </button>
      <button
        type="button"
        className="item-menu__btn"
        disabled={!canReorder || isFirst}
        onClick={() => run(onMoveUp)}
      >
        Mover para cima
      </button>
      <button
        type="button"
        className="item-menu__btn"
        disabled={!canReorder || isLast}
        onClick={() => run(onMoveDown)}
      >
        Mover para baixo
      </button>
      {!canReorder && <p className="item-menu__note">Disponível no filtro Todas</p>}
    </div>
  )
}
