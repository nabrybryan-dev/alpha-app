import type { CSSProperties } from 'react'
import { useMovimientoReducido } from './movimientoReducido'

/** Rectángulo en px, relativo al contenedor posicionado donde se monta el aro. */
export interface RectFoco {
  x: number
  y: number
  ancho: number
  alto: number
}

interface FocoProps {
  /** Lo que se resalta. `null` = apagado (el aro se desvanece, no se desmonta). */
  rect: RectFoco | null
  /** Radio del borde en px. 22 es el de las tarjetas de la maqueta. */
  radio?: number
  /** Oscurece lo que queda fuera del aro (el velo de la maqueta). */
  velo?: boolean
}

/** Velo de la maqueta (`--scrim`); la app no tiene ese token y no se añade uno por esto. */
const VELO = '0 0 0 3000px rgb(0 0 0 / 0.55)'

/**
 * El aro que resalta (maqueta `#pcFoco`, `1h-v9.css:39`): borde rojo de 2 px y, si se
 * pide, un velo alrededor. Puramente presentacional: no sabe QUÉ elemento resalta, solo
 * dibuja el rectángulo que le dan. Quien lo use mide el elemento y le pasa `rect`.
 *
 * - `pointer-events: none` siempre: el aro y su velo de 3000 px NUNCA atrapan toques.
 * - Va con `aria-hidden`: es un adorno visual; lo que se explica se dice en texto.
 * - Con movimiento reducido salta al sitio sin deslizarse ni desvanecerse.
 * - El contenedor debe ser `position: relative` y recortar (`overflow: hidden`), si no el
 *   velo de 3000 px se sale de la pantalla.
 */
export function Foco({ rect, radio = 22, velo = true }: FocoProps) {
  const reducido = useMovimientoReducido()
  const t = reducido
    ? 'none'
    : [
        'left var(--dur-informativo) var(--ease-salida)',
        'top var(--dur-informativo) var(--ease-salida)',
        'width var(--dur-informativo) var(--ease-salida)',
        'height var(--dur-informativo) var(--ease-salida)',
        'opacity var(--dur-base) var(--ease-salida)',
      ].join(', ')

  const estilo: CSSProperties = {
    position: 'absolute',
    zIndex: 29,
    left: rect?.x ?? 0,
    top: rect?.y ?? 0,
    width: rect?.ancho ?? 0,
    height: rect?.alto ?? 0,
    borderRadius: radio,
    border: '2px solid var(--rojo)',
    boxShadow: velo ? VELO : undefined,
    pointerEvents: 'none',
    opacity: rect ? 1 : 0,
    visibility: rect ? 'visible' : 'hidden',
    transition: t,
  }

  return <div aria-hidden="true" data-foco={rect ? 'on' : 'off'} style={estilo} />
}
