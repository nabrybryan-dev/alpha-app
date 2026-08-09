import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Cabecera del ejercicio como «gabinete Alfa»: una tragamonedas de una sola
 * ventana por la que rota la información del ejercicio.
 *
 * Sustituye al título estático. El nombre ya no vive en un `<h3>`: vive dentro
 * del tambor, junto al patrón, la categoría, la nota técnica y la referencia.
 *
 * Spec: `design_handoff_app_asesorado/README.md` §4b. Del handoff se respetan
 * la física (62 ms/paso, blur 1.1px, frenada a los 900 ms con rebote, destello
 * de 620 ms), las medidas (ventana 104px, radius 12, marco 1.5px/19, 12
 * bombillas cada 130 ms, palanca 44px, pomo 22px) y los disparadores.
 *
 * DIFERENCIA DELIBERADA CON EL PROTOTIPO: el handoff pinta los acentos en volt
 * `#c8ff1e`, que no existe en el design system del código —aquí el acento es
 * `accion`—. Se usa `accion` para que el componente se integre con el resto de
 * la app en vez de introducir un color fuera del sistema. Decisión de Bryan,
 * 2026-08-09.
 */

export interface ParadaEjercicio {
  /** Etiqueta mono de 8.5px sobre el valor. */
  etiqueta: string
  valor: string
  /** Glifo del cuadro de 52px. */
  icono: string
  /** Clase de color del valor. Sin definir, hereda el color del texto. */
  tono?: string
}

export interface DatosSlotEjercicio {
  nombre: string
  /** Patrón de movimiento: «Bisagra de cadera». */
  patron?: string
  /** Clase del ejercicio: «Compuesto · Cadena posterior». */
  categoria?: string
  /** Nota técnica: «Excéntrico 3 s · cadera atrás». */
  tecnica?: string
  /** Referencia visual: «Video · vista lateral 45°». */
  referencia?: string
}

export interface ExerciseSlotMachineProps {
  ejercicio: DatosSlotEjercicio
  /** 1-indexado, para «Ejercicio 01 / 04». */
  indice: number
  total: number
  /** Rango de reps tal cual viene del microciclo, p. ej. «(8-12)». */
  rango: string
  /** El auto-giro se detiene cuando la sesión terminó o hay celebración. */
  activa?: boolean
}

/** Símbolos que se intercalan entre paradas: solo se perciben durante el giro. */
const SIMBOLOS = ['⚡', '★', '🔥', '❚❚❚', '✦'] as const

const MS_POR_PASO = 62
const MS_GIRO = 900
const MS_DESTELLO = 620
const MS_AUTO = 4200
const ALTO_PARADA = 104
const BOMBILLAS = 12

/** ¿El sistema pide menos movimiento? Se lee en vivo, no solo al montar. */
function usaMovimientoReducido(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function construirParadas(e: DatosSlotEjercicio): ParadaEjercicio[] {
  return [
    { etiqueta: 'EJERCICIO', valor: e.nombre, icono: '🏋', tono: 'text-texto' },
    { etiqueta: 'PATRÓN DE MOVIMIENTO', valor: e.patron ?? '—', icono: '⤢', tono: 'text-accion' },
    { etiqueta: 'CATEGORÍA', valor: e.categoria ?? '—', icono: '◈', tono: 'text-oro' },
    { etiqueta: 'NOTA TÉCNICA', valor: e.tecnica ?? '—', icono: '✎', tono: 'text-texto' },
    { etiqueta: 'REFERENCIA VISUAL', valor: e.referencia ?? '—', icono: '▶', tono: 'text-accion' },
  ]
}

export function ExerciseSlotMachine({
  ejercicio,
  indice,
  total,
  rango,
  activa = true,
}: ExerciseSlotMachineProps) {
  const paradas = construirParadas(ejercicio)
  const n = paradas.length

  const [idx, setIdx] = useState(0)
  // Arranca girando: es el disparador «al entrar a la sesión». Se decide aquí y
  // no en un efecto para no llamar a setState de forma síncrona dentro de uno
  // (`react-hooks/set-state-in-effect`, que en este repo es error).
  const [girando, setGirando] = useState(() => !usaMovimientoReducido())
  const [destello, setDestello] = useState(false)
  const [palancaAbajo, setPalancaAbajo] = useState(false)
  const [reducido, setReducido] = useState(usaMovimientoReducido)

  const temporizadores = useRef<number[]>([])
  const programar = useCallback((fn: () => void, ms: number) => {
    temporizadores.current.push(window.setTimeout(fn, ms))
  }, [])
  const limpiar = useCallback(() => {
    temporizadores.current.forEach(clearTimeout)
    temporizadores.current = []
  }, [])

  // El usuario puede cambiar la preferencia con la app abierta.
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const alCambiar = () => setReducido(mq.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])

  const girarA = useCallback(
    (destino: number) => {
      const objetivo = ((destino % n) + n) % n
      if (reducido) {
        // Sin giro ni desenfoque: la parada cambia con un fundido corto.
        setIdx(objetivo)
        return
      }
      setGirando(true)
      programar(() => {
        setIdx(objetivo)
        setGirando(false)
        setDestello(true)
        programar(() => setDestello(false), MS_DESTELLO)
      }, MS_GIRO)
    },
    [n, programar, reducido],
  )

  // Cierre del giro de entrada. El cambio de ejercicio NO se maneja aquí: el
  // componente se remonta con `key`, así que el estado nace limpio solo.
  useEffect(() => {
    if (reducido) return
    programar(() => {
      setGirando(false)
      setDestello(true)
      programar(() => setDestello(false), MS_DESTELLO)
    }, MS_GIRO)
    return limpiar
  }, [limpiar, programar, reducido])

  // Disparador: automático cada 4,2 s mientras la sesión está activa.
  useEffect(() => {
    if (!activa || reducido) return
    let cierre = 0
    const id = window.setInterval(() => {
      setIdx(previo => (previo + 1) % n)
      setGirando(true)
      // El cierre del giro anterior se cancela antes de abrir otro: sin esto
      // cada ciclo deja un timeout huérfano y en cinco minutos de sesión hay
      // setenta corriendo a la vez.
      clearTimeout(cierre)
      cierre = window.setTimeout(() => setGirando(false), MS_GIRO)
    }, MS_AUTO)
    return () => {
      clearInterval(id)
      clearTimeout(cierre)
    }
  }, [activa, n, reducido])

  const tirarPalanca = () => {
    setPalancaAbajo(true)
    window.setTimeout(() => setPalancaAbajo(false), 240)
    girarA(idx + 1)
  }

  const parada = paradas[idx]

  return (
    <div
      className="flex items-stretch gap-2"
      data-testid="slot-ejercicio"
      data-parada={parada.etiqueta}
      data-girando={girando ? 'si' : 'no'}
      data-reducido={reducido ? 'si' : 'no'}
    >
      {/* Riel metálico vertical de 7px */}
      <span
        aria-hidden="true"
        className="w-[7px] shrink-0 rounded-full"
        style={{ background: 'var(--metal-grad)' }}
      />

      <div className="min-w-0 flex-1">
        {/* Marco metálico: padding 1.5px, radius 19 */}
        <div
          className="rounded-[19px] transition-shadow duration-300"
          style={{
            padding: '1.5px',
            background: 'var(--metal-grad)',
            boxShadow: destello ? 'var(--glow-accion)' : undefined,
          }}
        >
          <div className="rounded-[17.5px] bg-ink-800 px-3 pb-3 pt-2">
            {/* Línea superior */}
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em]">
              <span className="cifras text-tenue">
                Ejercicio {String(indice).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
              <span aria-hidden="true" className="h-3 w-px bg-linea/60" />
              <span className="min-w-0 truncate text-accion">{ejercicio.categoria ?? '—'}</span>
              <span className="cifras ml-auto shrink-0 text-tenue">
                Rango {rango.replace(/[()]/g, '')}
              </span>
            </div>

            {/* Marquesina: 12 bombillas, 130 ms de retardo escalonado */}
            <div aria-hidden="true" className="mt-2 flex justify-between px-1">
              {Array.from({ length: BOMBILLAS }, (_, i) => (
                <span
                  key={i}
                  className={`h-[5px] w-[5px] rounded-full bg-accion ${reducido ? '' : 'animate-pulse'}`}
                  style={reducido ? undefined : { animationDelay: `${i * 130}ms` }}
                />
              ))}
            </div>

            {/* LA ventana: una sola, 104px, radius 12 */}
            <div
              className="relative mt-2 overflow-hidden rounded-[12px] border border-accion/30 bg-ink-900"
              style={{ height: ALTO_PARADA, boxShadow: 'var(--inset-top-light)' }}
            >
              {/* Marcas de línea de pago, 4×22px pegadas a los lados */}
              <span aria-hidden="true" className="absolute left-0 top-1/2 h-[22px] w-[4px] -translate-y-1/2 bg-accion" />
              <span aria-hidden="true" className="absolute right-0 top-1/2 h-[22px] w-[4px] -translate-y-1/2 bg-accion" />

              {/* La cinta */}
              <div
                className="flex h-full items-center gap-3 px-4 transition-opacity"
                style={{
                  filter: girando ? 'blur(1.1px)' : undefined,
                  opacity: girando ? 0.35 : 1,
                  transitionDuration: reducido ? '180ms' : `${MS_POR_PASO}ms`,
                  transitionTimingFunction: 'cubic-bezier(.14,1.06,.32,1)',
                }}
              >
                <span
                  aria-hidden="true"
                  className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[10px] border border-linea/60 bg-ink-700 text-[22px]"
                >
                  {girando ? SIMBOLOS[idx % SIMBOLOS.length] : parada.icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="cifras block text-[8.5px] font-bold uppercase tracking-[0.2em] text-tenue">
                    {parada.etiqueta}
                  </span>
                  <span
                    className={`mt-1 block font-display text-[19px] font-black leading-tight [text-wrap:balance] ${parada.tono ?? ''}`}
                  >
                    {parada.valor}
                  </span>
                </span>
              </div>

              {/* Viñeta: simula la curvatura del tambor */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(8,9,10,.82), transparent 34%, transparent 66%, rgba(8,9,10,.82))',
                }}
              />
            </div>

            {/* Paginador: el activo se alarga a 22px */}
            <div className="mt-2.5 flex items-center justify-center gap-1.5">
              {paradas.map((p, i) => (
                <button
                  key={p.etiqueta}
                  type="button"
                  onClick={() => girarA(i)}
                  aria-label={`Ver ${p.etiqueta.toLowerCase()}`}
                  aria-current={i === idx}
                  className={`h-[5px] rounded-full transition-all duration-300 ${
                    i === idx ? 'w-[22px] bg-accion' : 'w-[5px] bg-linea'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Palanca, 44px */}
      <div className="flex w-[44px] shrink-0 flex-col items-center justify-center gap-1">
        <button
          type="button"
          onClick={tirarPalanca}
          aria-label="Girar la información del ejercicio"
          className="grid place-items-center"
        >
          <span
            aria-hidden="true"
            className="block h-[22px] w-[22px] rounded-full bg-accion transition-transform duration-200"
            style={{
              boxShadow: 'var(--glow-accion)',
              transform: palancaAbajo ? 'rotate(26deg) translateY(6px)' : undefined,
              transitionTimingFunction: 'cubic-bezier(.14,1.06,.32,1)',
            }}
          />
          <span
            aria-hidden="true"
            className="mt-0.5 block h-[30px] w-[6px] rounded-full"
            style={{ background: 'var(--metal-grad)' }}
          />
        </button>
        <span className="cifras text-[7.5px] font-bold uppercase tracking-[0.18em] text-tenue">Tirar</span>
      </div>
    </div>
  )
}
