import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'
import {
  diaEnLectura,
  encajar,
  giroDelDia,
  GRADOS_POR_PIXEL,
  inercia,
  PASO,
} from './fisicaDelTambor'

/**
 * LA SEMANA, EN UN TAMBOR.
 *
 * Siete filas sobre un cilindro que se arrastra, coge inercia y encaja solo. Tocar un día
 * abre su sesión.
 *
 * ## Por qué un tambor y no una lista
 *
 * En una lista de siete filas el dedo tapa tres, así que elegir el jueves obliga a mirar
 * dónde está la mano. En un tambor se tira y se suelta, y la fila de lectura —la que está
 * entre los dos filetes rojos— no se toca nunca.
 *
 * Y hay una segunda razón, de sitio: esto no es una pantalla nueva, es una capa que se
 * abre encima de la sala. Una lista con siete tarjetas sería otra pantalla; un cilindro
 * con las filas escorzándose deja ver que el salón sigue detrás.
 *
 * ## `backface-visibility: hidden`, y no es un detalle
 *
 * Las filas de la mitad de atrás del cilindro están giradas hacia el otro lado. Sin
 * esconder su cara trasera se ven ESPEJADAS a través del hueco entre las de delante: se
 * lee «SETRAM» flotando encima de «MARTES» y no hay forma de entender por qué.
 *
 * ## El giro se escribe en el nodo
 *
 * Sesenta veces por segundo mientras el dedo se mueve, y otras tantas durante la inercia.
 * Por estado, cada fotograma re-renderizaría las siete filas y el salón entero que hay
 * detrás. Lo único que sube a estado es qué día quedó elegido.
 */

export interface TamborDeLaSemanaProps {
  semana: readonly DiaRuta[]
  /** El día que está abierto ahora, para arrancar el tambor en él. */
  diaActual: number
  onElegir: (indice: number) => void
  onCerrar: () => void
}

export function TamborDeLaSemana({
  semana,
  diaActual,
  onElegir,
  onCerrar,
}: TamborDeLaSemanaProps) {
  const cilindro = useRef<HTMLDivElement>(null)
  const giro = useRef(giroDelDia(diaActual))
  const gesto = useRef<{ y: number; giro: number; t: number; v: number } | null>(null)
  const cuadro = useRef(0)
  // Un arrastre no debe elegir el día que quedó bajo el dedo al soltar: se distingue por
  // si hubo recorrido, no por el tiempo que duró.
  const arrastro = useRef(false)
  const [encajado, setEncajado] = useState(true)

  const pintar = () => {
    cilindro.current?.style.setProperty('--giro', `${giro.current.toFixed(2)}deg`)
  }

  useEffect(() => {
    pintar()
    return () => cancelAnimationFrame(cuadro.current)
  }, [])

  const alBajarDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    cancelAnimationFrame(cuadro.current)
    gesto.current = { y: e.clientY, giro: giro.current, t: performance.now(), v: 0 }
    arrastro.current = false
    setEncajado(false)
  }

  const alMoverDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesto.current
    if (!g) return
    const ahora = performance.now()
    const nuevo = g.giro + (e.clientY - g.y) * -GRADOS_POR_PIXEL
    // La velocidad se mide del ÚLTIMO movimiento, no de todo el gesto: un arrastre largo
    // que termina parado tiene velocidad media alta y velocidad final cero, y lo que la
    // mano espera al soltar es lo segundo.
    g.v = ((nuevo - giro.current) / Math.max(1, ahora - g.t)) * 16
    g.t = ahora
    giro.current = nuevo
    pintar()
    if (Math.abs(e.clientY - g.y) > 6) arrastro.current = true
  }

  const alSoltarDedo = () => {
    const g = gesto.current
    if (!g) return
    gesto.current = null
    if (!arrastro.current) {
      setEncajado(true)
      return
    }
    let v = g.v
    const seguir = () => {
      const paso = inercia(giro.current, v)
      if (!paso) {
        giro.current = encajar(giro.current)
        setEncajado(true)
        pintar()
        // El día se elige al PARAR, no al soltar: soltar con inercia todavía mueve el
        // tambor varias filas, y elegir ahí abriría la sesión de un día que ya pasó.
        onElegir(diaEnLectura(giro.current))
        return
      }
      giro.current = paso.giro
      v = paso.velocidad
      pintar()
      cuadro.current = requestAnimationFrame(seguir)
    }
    cuadro.current = requestAnimationFrame(seguir)
  }

  return (
    <div
      data-hueco="semana"
      role="dialog"
      aria-label="Tu semana"
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ zIndex: 'var(--z-elevado)', background: 'rgb(var(--ink-1000-rgb) / 0.86)' }}
      onClick={() => {
        if (!arrastro.current) onCerrar()
      }}
      onPointerDown={alBajarDedo}
      onPointerMove={alMoverDedo}
      onPointerUp={alSoltarDedo}
      onPointerCancel={alSoltarDedo}
    >
      <p className="muro-rotulo text-[10.5px]">Tu semana</p>

      <div
        className="relative mt-2.5 h-[360px] w-full"
        style={{ perspective: '800px', perspectiveOrigin: '50% 50%', touchAction: 'none' }}
      >
        <div
          ref={cilindro}
          data-tambor
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            transform: 'rotateX(var(--giro, 0deg))',
            transition: encajado ? 'transform var(--dur-transicional) var(--muelle-transicional)' : 'none',
          }}
        >
          {semana.map((d, i) => (
            <button
              key={d.fechaIso}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (arrastro.current) return
                giro.current = giroDelDia(i)
                setEncajado(true)
                pintar()
                onElegir(i)
              }}
              className="absolute left-1/2 top-1/2 flex h-[56px] w-[280px] items-center justify-between gap-3 rounded-boton border border-ink-500 bg-ink-800 px-[18px] text-left"
              style={{
                margin: '-28px 0 0 -140px',
                // Cada fila en su punto del cilindro, mirando hacia fuera.
                transform: `rotateX(${(i * PASO).toFixed(3)}deg) translateZ(150px)`,
                // Sin esto, las filas de atrás se ven ESPEJADAS por el hueco entre las de
                // delante: se lee «SETRAM» encima de «MARTES».
                backfaceVisibility: 'hidden',
              }}
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-tenue">
                {d.dia}
              </span>
              <span className="font-display text-[15px] font-black uppercase tracking-[0.02em] text-texto">
                {d.titulo}
              </span>
            </button>
          ))}
        </div>

        {/* LA RANURA DE LECTURA, PINTADA ENCIMA DEL CILINDRO.
            Estaba antes que él y no se veía: las filas van empujadas 150 px hacia el
            observador —es el radio del tambor— así que se pintan por delante de cualquier
            hermano que esté detrás, y el `z-index` no las alcanza porque viven en un
            contexto 3D. Sacada del espacio y puesta después, la ranura vuelve a ser lo que
            es: la abertura por la que se lee, no una fila más del tambor. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[62px] w-[300px] -translate-x-1/2 -translate-y-1/2"
          style={{
            borderTop: '1px solid rgb(var(--accion-rgb) / 0.55)',
            borderBottom: '1px solid rgb(var(--accion-rgb) / 0.55)',
          }}
        />
      </div>

      <p className="muro-rotulo text-[10px]">Desliza · toca el día</p>
    </div>
  )
}
