import type { SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'aria-hidden' | 'focusable'>

/** Base para todos os ícones: decorativos, fora da árvore de acessibilidade. */
function Svg({ children, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" {...props}>
      {children}
    </svg>
  )
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function SunIcon(props: IconProps) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" {...stroke} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" {...stroke} {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2.5} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" {...stroke} {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Svg>
  )
}

export function MoreIcon(props: IconProps) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </Svg>
  )
}

export function GripIcon(props: IconProps) {
  return (
    <Svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" {...props}>
      <circle cx="3" cy="3" r="1.25" />
      <circle cx="9" cy="3" r="1.25" />
      <circle cx="3" cy="9" r="1.25" />
      <circle cx="9" cy="9" r="1.25" />
      <circle cx="3" cy="15" r="1.25" />
      <circle cx="9" cy="15" r="1.25" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" {...props}>
      <polyline points="4 11 8 15 16 6" />
    </Svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" {...stroke} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" {...stroke} {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </Svg>
  )
}

export function ErrorIcon(props: IconProps) {
  return (
    <Svg width="16" height="16" viewBox="0 0 16 16" {...props}>
      <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.25v4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="8" cy="11.25" r="1" fill="currentColor" />
    </Svg>
  )
}

/** Três barras (4, 7 e 10px); as preenchidas seguem o nível. */
export function PriorityBarsIcon({ level, ...props }: IconProps & { level: 1 | 2 | 3 }) {
  const bars = [
    { x: 0.5, h: 4 },
    { x: 4.5, h: 7 },
    { x: 8.5, h: 10 },
  ]
  return (
    <Svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" {...props}>
      {bars.map((bar, i) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={11 - bar.h}
          width="3"
          height={bar.h}
          rx="0.5"
          opacity={i < level ? 1 : 0.3}
        />
      ))}
    </Svg>
  )
}
