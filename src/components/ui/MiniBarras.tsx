import { useEffect, useState } from 'react'
import { useMovimientoReducido } from './movimientoReducido'

interface MiniBarrasProps {
  /** Alturas relativas, de 0 a 1. Una barra por valor. `undefined` = sin dato: queda un trazo, no una barra a cero. */
  valores: ReadonlyArray<number | undefined>
  /** Alto total en px (46 en la maqueta). */
  alto?: number
  /** Retardo entre una barra y la siguiente, en ms (80 en la maqueta). */
  escalon?: number
  /** Como lo dice un lector de pantalla: «5 ejercicios, el mayor de 80 kg». */
  etiqueta: string
}

/** Altura minima visible de una barra con dato, para que un 0 real no desaparezca. */
const MINIMO = 0.06

function acotar(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

/** Falso un fotograma y luego verdadero: asi las barras nacen a cero y despues crecen. */
function useVivo(): boolean {
  const [vivo, setVivo] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVivo(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return vivo
}

/**
 * Los recuadros animados de Praxis (maqueta `.pc-barras`, `1h-v9.css:45-50`): barras
 * que crecen desde abajo, una tras otra. Puramente presentacional: los datos entran por
 * `valores` y el componente no sabe de donde salen.
 *
 * - Escalonado: la barra i tarda `i * escalon` ms (`transition` con retardo).
 * - Movimiento reducido: las barras salen ya a su altura, sin crecer ni retardo.
 * - Un valor `undefined` pinta un trazo tenue, no una barra a cero (no medido no es cero).
 * - Las barras son adorno (`aria-hidden`); el lector oye `etiqueta` una vez.
 */
export function MiniBarras({ valores, alto = 46, escalon = 80, etiqueta }: MiniBarrasProps) {
  const reducido = useMovimientoReducido()
  const vivo = useVivo()
  const crecidas = reducido || vivo

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        aria-hidden="true"
        data-minibarras={crecidas ? 'vivo' : 'quieto'}
        style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: alto, marginTop: 6 }}
      >
        {valores.map((v, i) => {
          const sinDato = v === undefined
          const h = sinDato ? MINIMO : Math.max(MINIMO, acotar(v))
          return (
            <i
              key={i}
              data-barra={sinDato ? 'sin-dato' : 'dato'}
              style={{
                flex: 1,
                height: `${Math.round(h * 100)}%`,
                borderRadius: 7,
                background: sinDato ? 'var(--linea)' : 'var(--rojo)',
                opacity: sinDato ? 1 : 0.85,
                transformOrigin: 'bottom',
                transform: crecidas ? 'scaleY(1)' : 'scaleY(0)',
                transition: reducido
                  ? 'none'
                  : `transform var(--dur-informativo) var(--ease-salida) ${i * escalon}ms`,
              }}
            />
          )
        })}
      </div>
      <span className="sr-only">{etiqueta}</span>
    </div>
  )
}

/** Una barra horizontal que se llena (maqueta `.pc-bar`). `valor` de 0 a 1; `undefined` = sin dato. */
export function MiniBarra({ valor, etiqueta }: { valor: number | undefined; etiqueta: string }) {
  const reducido = useMovimientoReducido()
  const vivo = useVivo()
  const lleno = valor === undefined ? 0 : acotar(valor)
  const crecida = reducido || vivo

  return (
    <div>
      <div aria-hidden="true" style={{ height: 8, borderRadius: 99, background: 'var(--linea)', overflow: 'hidden' }}>
        <i
          data-barra={valor === undefined ? 'sin-dato' : 'dato'}
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.round(lleno * 100)}%`,
            borderRadius: 99,
            background: 'var(--rojo)',
            transformOrigin: 'left',
            transform: crecida ? 'scaleX(1)' : 'scaleX(0)',
            transition: reducido ? 'none' : 'transform 0.9s var(--ease-salida)',
          }}
        />
      </div>
      <span className="sr-only">{etiqueta}</span>
    </div>
  )
}
