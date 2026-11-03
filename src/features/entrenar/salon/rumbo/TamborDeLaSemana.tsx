import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'
import { movimientoReducido } from '../../../../components/ui/movimientoReducido'
import { COLOR_DEL_ESTADO, estadoDelDia } from './estadoDelDia'
import { Boton3D } from '../../../../components/ui/Boton3D'
import {
  ALTO_FILA,
  diaEnLectura,
  diasTocables,
  encajar,
  FILAS_A_CADA_LADO,
  inclinacionDeFila,
  inercia,
  limitar,
  opacidadDeFila,
  UMBRAL_DE_ARRASTRE,
} from './fisicaDelTambor'

/**
 * LA SEMANA, EN UN TAMBOR (Bryan, 30-oct: vuelve, como en la maqueta 7).
 *
 * Una columna de siete filas que se arrastra, coge inercia y encaja sola, con las vecinas
 * escorzadas. Tocar un día lo CENTRA; el botón «Mirar este día» es lo que lo elige. Por eso
 * elegir un día nunca empieza esa sesión: ni siquiera cambia la sala hasta confirmarlo.
 *
 * ## Lo que falló la vez anterior y no puede repetirse
 *
 * El tambor cilíndrico enseñaba tres días y dejaba dos de canto debajo de la ranura, sin
 * poder tocarse. Aquí se ven y se tocan cinco a la vez y los siete se alcanzan: arrastrando
 * (con inercia, o sin ella con movimiento reducido), con ↑ ↓ Inicio Fin, y con Tab, porque
 * enfocar una fila la centra. `TamborDeLaSemana.test.tsx` lo prueba por cada vía.
 *
 * ## Lo que conserva de la lista desplegable que lo sustituyó
 *
 * Abre en el día que está en pantalla; Escape o tocar fuera cierran; al cerrar el foco vuelve
 * a quien la abrió; `data-no-orbita` para que el dedo no gire la sala; y se puede volver a hoy.
 *
 * ## El giro se escribe en el nodo
 *
 * Sesenta veces por segundo mientras el dedo se mueve. Por estado, cada fotograma
 * re-renderizaría las siete filas y el salón entero. A estado solo sube qué día está en
 * lectura (cuando cambia).
 */

export interface TamborDeLaSemanaProps {
  semana: readonly DiaRuta[]
  /** El día que está en pantalla ahora: el tambor arranca en él. */
  diaActual: number
  /** Se llama solo al confirmar («Mirar este día» o «Volver a hoy»), nunca al centrar. */
  onElegir: (indice: number) => void
  onCerrar: () => void
}

const redondear = (c: number) => String(Number(c.toFixed(3)))

export function TamborDeLaSemana({ semana, diaActual, onElegir, onCerrar }: TamborDeLaSemanaProps) {
  const n = semana.length
  const inicio = limitar(diaActual, n)
  const visor = useRef<HTMLDivElement>(null)
  const filas = useRef<Array<HTMLButtonElement | null>>([])
  const centro = useRef(inicio)
  const gesto = useRef<{ y: number; centro: number; t: number; v: number } | null>(null)
  const cuadro = useRef(0)
  const temporizador = useRef(0)
  // Un arrastre no debe elegir el día que queda bajo el dedo al soltar: se distingue por si hubo
  // recorrido, no por el tiempo que duró.
  const arrastro = useRef(false)
  const [lectura, setLectura] = useState(inicio)
  const [encajado, setEncajado] = useState(true)
  const alAlcance = diasTocables(lectura, n)
  const hoy = semana.findIndex((d) => d.esHoy)
  const hoyIso = semana[hoy]?.fechaIso

  const pintarNodos = () => {
    const c = centro.current
    visor.current?.style.setProperty('--centro', redondear(c))
    filas.current.forEach((f, i) => {
      if (!f) return
      const d = i - c
      f.style.transform = `translateY(${(d * ALTO_FILA).toFixed(1)}px) rotateX(${inclinacionDeFila(d).toFixed(1)}deg)`
      f.style.opacity = opacidadDeFila(d).toFixed(2)
    })
  }

  const pintar = () => {
    pintarNodos()
    setLectura(diaEnLectura(centro.current, n))
  }

  const irA = (dia: number) => {
    cancelAnimationFrame(cuadro.current)
    centro.current = limitar(dia, n)
    setEncajado(true)
    pintar()
  }

  // Primer pintado, el foco en el día que se ve y Escape. El foco vuelve a quien abrió la capa.
  useEffect(() => {
    pintarNodos()
    const quienAbrio = document.activeElement as HTMLElement | null
    filas.current[inicio]?.focus({ preventScroll: true })
    const alPulsar = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPulsar)
    return () => {
      document.removeEventListener('keydown', alPulsar)
      cancelAnimationFrame(cuadro.current)
      clearTimeout(temporizador.current)
      quienAbrio?.focus?.({ preventScroll: true })
    }
    // Solo al montar: el giro vive en refs y `onCerrar` es estable en quien la usa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCerrar])

  const alBajarDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    cancelAnimationFrame(cuadro.current)
    gesto.current = { y: e.clientY, centro: centro.current, t: e.timeStamp, v: 0 }
    arrastro.current = false
    setEncajado(false)
  }

  const alMoverDedo = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesto.current
    if (!g) return
    const ahora = e.timeStamp
    // El dedo sube = el tambor avanza hacia el sábado.
    const nuevo = limitar(g.centro - (e.clientY - g.y) / ALTO_FILA, n)
    // La velocidad se mide del ÚLTIMO movimiento, no de todo el gesto: un arrastre largo que
    // termina parado tiene velocidad media alta y final cero, y la mano espera lo segundo.
    g.v = ((nuevo - centro.current) / Math.max(1, ahora - g.t)) * 16
    g.t = ahora
    centro.current = nuevo
    pintar()
    if (!arrastro.current && Math.abs(e.clientY - g.y) > UMBRAL_DE_ARRASTRE) {
      arrastro.current = true
      // Desde aquí el gesto es un arrastre: el clic que lo cierre ya no llegará a una fila.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } catch {
        /* sin captura el arrastre sigue funcionando mientras el dedo esté sobre el tambor */
      }
    }
  }

  const alSoltarDedo = () => {
    const g = gesto.current
    if (!g) return
    gesto.current = null
    // El clic que sigue a un arrastre se ignora; después ya no hay arrastre que ignorar.
    clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => {
      arrastro.current = false
    }, 0)
    // Sin movimiento, o con movimiento reducido: nada de inercia, encaja donde está.
    if (!arrastro.current || movimientoReducido() || Math.abs(g.v) < 0.02) {
      centro.current = encajar(centro.current, n)
      setEncajado(true)
      pintar()
      return
    }
    let v = g.v
    const seguir = () => {
      const paso = inercia(centro.current, v, n)
      if (!paso) {
        // El día se elige al PARAR, no al soltar: con inercia el tambor aún recorre filas.
        centro.current = encajar(centro.current, n)
        setEncajado(true)
        pintar()
        return
      }
      centro.current = paso.centro
      v = paso.velocidad
      pintar()
      cuadro.current = requestAnimationFrame(seguir)
    }
    cuadro.current = requestAnimationFrame(seguir)
  }

  const alPulsarTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const dia = diaEnLectura(centro.current, n)
    const destino =
      e.key === 'ArrowDown' ? dia + 1
      : e.key === 'ArrowUp' ? dia - 1
      : e.key === 'PageDown' ? dia + 3
      : e.key === 'PageUp' ? dia - 3
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : null
    if (destino === null) return
    e.preventDefault()
    irA(destino)
    filas.current[limitar(destino, n)]?.focus({ preventScroll: true })
  }

  return (
    <div data-no-orbita data-hueco="semana" className="absolute inset-0">
      <div
        data-testid="fondo-de-la-semana"
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'rgb(var(--ink-1000-rgb) / 0.78)' }}
        onClick={onCerrar}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tu semana"
        className="desplegar-semana pointer-events-auto overflow-hidden rounded-[18px] border border-ink-500 bg-ink-800 pb-3"
        style={{
          width: 'min(340px, calc(100% - 24px))',
          boxShadow: '0 18px 40px -12px var(--salon-3d-sombra-menu)',
        }}
      >
        <p className="px-4 pb-1 pt-3 font-display text-sm font-black uppercase tracking-[0.06em] text-texto">
          Tu semana
        </p>

        <div
          ref={visor}
          data-testid="tambor-de-la-semana"
          className="relative mx-2 overflow-hidden"
          style={{
            height: ALTO_FILA * (FILAS_A_CADA_LADO * 2 + 1),
            perspective: '600px',
            touchAction: 'none',
            WebkitMaskImage: 'linear-gradient(transparent, #000 22%, #000 78%, transparent)',
            maskImage: 'linear-gradient(transparent, #000 22%, #000 78%, transparent)',
          }}
          onKeyDown={alPulsarTecla}
          onPointerDown={alBajarDedo}
          onPointerMove={alMoverDedo}
          onPointerUp={alSoltarDedo}
          onPointerCancel={alSoltarDedo}
        >
          {semana.map((d, i) => {
            const estado = estadoDelDia(d, hoyIso)
            const enLectura = i === lectura
            return (
              <button
                key={d.fechaIso}
                ref={(el) => {
                  filas.current[i] = el
                }}
                type="button"
                aria-pressed={enLectura}
                // Marca las filas que se ven y se tocan con el tambor quieto (las demás se alcanzan girando).
                data-al-alcance={alAlcance.includes(i) ? 'si' : 'no'}
                aria-label={`${d.dia.toLowerCase()} ${d.numero}: ${d.titulo}, ${estado.toLowerCase()}${d.esHoy ? ', hoy' : ''}`}
                onFocus={() => irA(i)}
                onClick={() => {
                  if (arrastro.current) return
                  irA(i)
                }}
                className="press absolute inset-x-0 flex items-center gap-3 rounded-boton px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accion"
                style={{
                  top: '50%',
                  height: ALTO_FILA - 4,
                  marginTop: -(ALTO_FILA - 4) / 2,
                  backfaceVisibility: 'hidden',
                  transition: encajado ? 'transform var(--dur-transicional) var(--muelle-transicional), opacity var(--dur-transicional)' : 'none',
                  background: enLectura ? 'rgb(var(--accion-rgb) / 0.14)' : undefined,
                }}
              >
                <span className="flex w-[48px] shrink-0 flex-col leading-none">
                  <span className={`font-mono text-xs uppercase tracking-[0.12em] ${d.esHoy ? 'text-accion' : 'text-tenue'}`}>
                    {d.abreviatura}
                  </span>
                  <span className="cifras mt-1 text-[15px] font-bold text-texto">{d.numero}</span>
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[14px] font-black uppercase tracking-[0.02em] text-texto">
                  {d.titulo}
                </span>
                <span className={`shrink-0 text-xs font-semibold ${COLOR_DEL_ESTADO[estado]}`}>{estado}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 flex flex-col gap-2 px-3">
          <Boton3D bloque
            type="button"
            onClick={() => onElegir(diaEnLectura(centro.current, n))}
          >
            Mirar este día
          </Boton3D>
          <div className="flex gap-2">
            {hoy !== -1 && (
              <button
                type="button"
                onClick={() => onElegir(hoy)}
                className="press min-h-[44px] flex-1 rounded-boton border border-ink-500 py-2 text-sm text-texto"
              >
                Volver a hoy
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              className="press min-h-[44px] flex-1 rounded-boton border border-ink-500 py-2 text-sm text-tenue"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
