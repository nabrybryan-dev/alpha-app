import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Cabecera del ejercicio como «gabinete Alfa»: una tragamonedas de una sola
 * ventana por la que rota la información del ejercicio.
 *
 * Sustituye al título estático. El nombre ya no vive en un `<h3>`: vive dentro
 * del tambor, junto al patrón, la categoría, la nota técnica y la referencia.
 *
 * Spec: `design_handoff_app_asesorado/README.md` §4b. Del handoff se respetan
 * la física (62 ms/paso, blur 1.1px, frenada con rebote, destello de 620 ms),
 * las medidas (celda 104px, radius 12, marco 1.5px/19, 12 bombillas cada
 * 130 ms, palanca 44px, pomo 22px) y los disparadores.
 *
 * DIFERENCIA DELIBERADA CON EL PROTOTIPO: el handoff pinta los acentos en volt
 * `#c8ff1e`, que no existe en el design system del código —aquí el acento es
 * `accion`—. Se usa `accion` para que el componente se integre con el resto de
 * la app en vez de introducir un color fuera del sistema. Decisión de Bryan,
 * 2026-08-09.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CÓMO GIRA (2026-08-09, segunda pasada)
 * ────────────────────────────────────────────────────────────────────────────
 * La primera versión no giraba: cambiaba el contenido con un fundido y un
 * desenfoque, y la curva de rebote se aplicaba a la opacidad, donde el rebote
 * no se ve. Ahora hay una cinta real que se desplaza.
 *
 * La cinta alterna **parada · símbolo · parada · símbolo…**, así que entre dos
 * datos siempre pasa un glifo: es lo que hace que se lea como un tambor y no
 * como un carrusel. Cada celda mide 104 px y el desplazamiento es
 * `translateY(-pos · 104px)`.
 *
 * Un giro son tres tramos:
 *   1. **Arranque** (16 ms) — se enciende la transición antes de mover. Sin
 *      esta pausa el navegador ve el cambio de `transition` y de `transform` en
 *      el mismo repintado y salta sin animar.
 *   2. **Giro** — avanza hasta dos celdas antes del destino, a 62 ms por celda,
 *      lineal y con `blur(1.1px)`. Siempre da **al menos una vuelta entera**
 *      (10 celdas), aunque el destino sea la parada de al lado: un tambor que
 *      recorre dos celdas no parece un tambor.
 *   3. **Frenada** (320 ms) — las dos últimas celdas con la curva de rebote, ya
 *      sin desenfoque. Al parar, destella el marco.
 *
 * `pos` solo crece; al asentar se normaliza al rango 0-9 en el mismo commit en
 * que la transición ya está apagada, así que el salto es invisible (la celda
 * `pos + 10` dibuja exactamente lo mismo que la celda `pos`).
 *
 * En la ventana **solo se montan las celdas del tramo que se recorre**. En
 * reposo eso es UNA: ni el lector de pantalla ni los tests ven cinco copias del
 * texto, y la información del ejercicio aparece una sola vez en el DOM.
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

/** Símbolos que se intercalan entre paradas: se ven al pasar, durante el giro. */
const SIMBOLOS = ['⚡', '★', '🔥', '❚❚❚', '✦'] as const

const ALTO_CELDA = 104
/**
 * El giro dura lo mismo vaya donde vaya, y lo que cambia es a qué velocidad
 * recorre la cinta. Al revés —tiempo por celda— el salto más largo se iba a
 * 1,4 s: la mano ya está en la barra y el dato todavía no ha parado.
 *
 * Los 580 ms salen del presupuesto del handoff: 900 ms de giro total menos la
 * frenada. En el salto típico (una vuelta y la parada de al lado, 10 celdas en
 * el tramo rápido) son los **62 ms por celda** que pide la spec.
 */
const MS_GIRO = 580
const MS_ARRANQUE = 16
const MS_FRENADA = 320
/** Celdas que se recorren ya frenando, con la curva de rebote. */
const CELDAS_FRENADA = 2
const MS_DESTELLO = 620
const MS_AUTO = 4200
const MS_PALANCA = 240
const BOMBILLAS = 12
const CURVA_REBOTE = 'cubic-bezier(.14,1.06,.32,1)'
/** Las paradas son siempre estas cinco, y entre cada dos va un símbolo. */
const PARADAS = 5
const CELDAS = PARADAS * 2

type Celda =
  | { tipo: 'parada'; parada: ParadaEjercicio }
  | { tipo: 'simbolo'; simbolo: string }

type Fase = 'quieto' | 'girando' | 'frenando'

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

/** La cinta: parada, símbolo, parada, símbolo… La parada `k` está en la celda `2k`. */
function construirCeldas(paradas: ParadaEjercicio[]): Celda[] {
  return paradas.flatMap((parada, i) => [
    { tipo: 'parada', parada } as Celda,
    { tipo: 'simbolo', simbolo: SIMBOLOS[i % SIMBOLOS.length] } as Celda,
  ])
}

export function ExerciseSlotMachine({
  ejercicio,
  indice,
  total,
  rango,
  activa = true,
}: ExerciseSlotMachineProps) {
  const paradas = construirParadas(ejercicio)
  const celdas = construirCeldas(paradas)

  const [reducido, setReducido] = useState(usaMovimientoReducido)
  // Arranca girando: es el disparador «al entrar a la sesión». Se decide aquí y
  // no en un efecto para no llamar a setState de forma síncrona dentro de uno
  // (`react-hooks/set-state-in-effect`, que en este repo es error).
  const [fase, setFase] = useState<Fase>(() => (usaMovimientoReducido() ? 'quieto' : 'girando'))
  const [idx, setIdx] = useState(0)
  const [pos, setPos] = useState(0)
  /** Tramo montado en la ventana. En reposo, una sola celda. */
  const [tramo, setTramo] = useState(() =>
    usaMovimientoReducido() ? { desde: 0, hasta: 0 } : { desde: 0, hasta: CELDAS },
  )
  // Arranca con los tiempos del giro de entrada: ponerlos desde el efecto sería
  // un setState síncrono dentro de él, que aquí es error de linter.
  const [movimiento, setMovimiento] = useState({ ms: MS_GIRO, curva: 'linear' })
  const [destello, setDestello] = useState(false)
  const [palancaAbajo, setPalancaAbajo] = useState(false)
  /** Sube con cada gesto de la persona; reinicia el reloj del giro automático. */
  const [ciclo, setCiclo] = useState(0)

  // El giro se dispara desde un intervalo y desde los botones: las callbacks
  // leen la posición de aquí, no de la clausura, para no quedarse con un valor
  // viejo cuando el intervalo no se recrea.
  const posRef = useRef(0)
  const faseRef = useRef<Fase>(fase)
  const idxRef = useRef(0)

  const temporizadores = useRef<number[]>([])
  const programar = useCallback((fn: () => void, ms: number) => {
    temporizadores.current.push(window.setTimeout(fn, ms))
  }, [])
  const limpiar = useCallback(() => {
    temporizadores.current.forEach(clearTimeout)
    temporizadores.current = []
  }, [])

  const mover = useCallback((p: number) => {
    posRef.current = p
    setPos(p)
  }, [])

  const asentar = useCallback(
    (paradaDestino: number, celdaDestino: number) => {
      faseRef.current = 'quieto'
      idxRef.current = paradaDestino
      setFase('quieto')
      setIdx(paradaDestino)
      // Normaliza en el mismo commit en que la transición ya está apagada: la
      // celda `celdaDestino + 10·k` dibuja lo mismo, así que el salto no se ve.
      mover(celdaDestino)
      setTramo({ desde: celdaDestino, hasta: celdaDestino })
      setDestello(true)
      programar(() => setDestello(false), MS_DESTELLO)
    },
    [mover, programar],
  )

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
      const paradaDestino = ((destino % PARADAS) + PARADAS) % PARADAS
      const celdaDestino = paradaDestino * 2

      if (reducido) {
        // Sin desplazamiento ni desenfoque: la parada cambia en el sitio.
        limpiar()
        faseRef.current = 'quieto'
        idxRef.current = paradaDestino
        setFase('quieto')
        setIdx(paradaDestino)
        mover(celdaDestino)
        setTramo({ desde: celdaDestino, hasta: celdaDestino })
        return
      }

      // Un giro en curso se abandona y empieza el nuevo: si no, tocar dos
      // puntos seguidos deja dos frenadas peleándose por la misma cinta.
      limpiar()

      const actual = posRef.current
      // Siempre una vuelta entera de más: el destino de al lado son 2 celdas y
      // eso no se lee como un tambor girando.
      const avance = ((((celdaDestino - actual) % CELDAS) + CELDAS) % CELDAS) + CELDAS
      const fin = actual + avance

      setTramo({ desde: actual, hasta: fin })
      faseRef.current = 'girando'
      setFase('girando')
      setMovimiento({ ms: MS_GIRO, curva: 'linear' })

      programar(() => mover(fin - CELDAS_FRENADA), MS_ARRANQUE)
      programar(() => {
        faseRef.current = 'frenando'
        setFase('frenando')
        setMovimiento({ ms: MS_FRENADA, curva: CURVA_REBOTE })
        mover(fin)
      }, MS_ARRANQUE + MS_GIRO)
      programar(() => asentar(paradaDestino, celdaDestino), MS_ARRANQUE + MS_GIRO + MS_FRENADA)
    },
    [asentar, limpiar, mover, programar, reducido],
  )

  // Cierre del giro de entrada. El cambio de ejercicio NO se maneja aquí: el
  // componente se remonta con `key`, así que el estado nace limpio solo.
  useEffect(() => {
    if (reducido) return
    programar(() => mover(CELDAS - CELDAS_FRENADA), MS_ARRANQUE)
    programar(() => {
      faseRef.current = 'frenando'
      setFase('frenando')
      setMovimiento({ ms: MS_FRENADA, curva: CURVA_REBOTE })
      mover(CELDAS)
    }, MS_ARRANQUE + MS_GIRO)
    programar(() => asentar(0, 0), MS_ARRANQUE + MS_GIRO + MS_FRENADA)
    return limpiar
  }, [asentar, limpiar, mover, programar, reducido])

  // Disparador: automático cada 4,2 s mientras la sesión está activa.
  //
  // `ciclo` cambia con cada gesto de la persona y reinicia el intervalo. Sin
  // eso, tocar un punto justo antes de un tic automático te arranca de la parada
  // que acabas de pedir: eliges «nota técnica» y medio segundo después el
  // gabinete se te va solo a la siguiente.
  useEffect(() => {
    if (!activa || reducido) return
    const id = window.setInterval(() => {
      if (faseRef.current !== 'quieto') return // ya está girando: no se encadena
      girarA(idxRef.current + 1)
    }, MS_AUTO)
    return () => clearInterval(id)
  }, [activa, ciclo, girarA, reducido])

  /** Un gesto de la persona: gira y devuelve al reloj automático a cero. */
  const girarAMano = (destino: number) => {
    setCiclo((c) => c + 1)
    girarA(destino)
  }

  const tirarPalanca = () => {
    setPalancaAbajo(true)
    // Registrado como el resto: si no, el desmontaje a mitad de tirón deja este
    // temporizador vivo escribiendo en un componente que ya no existe.
    programar(() => setPalancaAbajo(false), MS_PALANCA)
    girarAMano(idxRef.current + 1)
  }

  const parada = paradas[idx]
  const girando = fase !== 'quieto'
  const celdaEn = (i: number) => celdas[((i % CELDAS) + CELDAS) % CELDAS]
  const montadas: number[] = []
  for (let i = tramo.desde; i <= tramo.hasta; i++) montadas.push(i)

  return (
    <div
      className="flex items-stretch gap-2"
      data-testid="slot-ejercicio"
      data-parada={parada.etiqueta}
      data-girando={girando ? 'si' : 'no'}
      data-reducido={reducido ? 'si' : 'no'}
      data-pos={pos}
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
            {/* La única línea fija del ejercicio: número y rango, nada más.
                La categoría estuvo aquí hasta el 2026-08-09 y se quitó porque es
                una de las cinco paradas del tambor: enseñarla fija le robaba el
                sentido a que rotara. */}
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-tenue">
              <span className="cifras">
                Ejercicio {String(indice).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
              <span aria-hidden="true" className="h-3 w-px bg-linea/60" />
              <span className="cifras">Rango {rango.replace(/[()]/g, '')}</span>
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

            {/* LA ventana: una sola, 104px, radius 12.
                `aria-live` anuncia la parada al asentar, y la cinta se esconde
                del árbol de accesibilidad mientras gira: quien usa lector de
                pantalla no necesita oír las celdas de paso. */}
            <div
              aria-live="polite"
              className="relative mt-2 overflow-hidden rounded-[12px] border border-accion/30 bg-ink-900"
              style={{ height: ALTO_CELDA, boxShadow: 'var(--inset-top-light)' }}
            >
              {/* Marcas de línea de pago, 4×22px pegadas a los lados */}
              <span aria-hidden="true" className="absolute left-0 top-1/2 z-10 h-[22px] w-[4px] -translate-y-1/2 bg-accion" />
              <span aria-hidden="true" className="absolute right-0 top-1/2 z-10 h-[22px] w-[4px] -translate-y-1/2 bg-accion" />

              {/* La cinta. Solo se montan las celdas del tramo que se recorre. */}
              <div
                data-cinta="si"
                aria-hidden={girando}
                className="absolute inset-x-0 top-0"
                style={{
                  transform: `translateY(${-pos * ALTO_CELDA}px)`,
                  transition: girando ? `transform ${movimiento.ms}ms ${movimiento.curva}` : 'none',
                  filter: fase === 'girando' ? 'blur(1.1px)' : undefined,
                }}
              >
                {montadas.map((i) => {
                  const celda = celdaEn(i)
                  return (
                    <div
                      key={i}
                      className="absolute inset-x-0 flex items-center gap-3 px-4"
                      style={{ top: i * ALTO_CELDA, height: ALTO_CELDA }}
                    >
                      {celda.tipo === 'simbolo' ? (
                        <span
                          aria-hidden="true"
                          className="grid h-[52px] w-full place-items-center text-[26px] opacity-45"
                        >
                          {celda.simbolo}
                        </span>
                      ) : (
                        <>
                          <span
                            aria-hidden="true"
                            className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[10px] border border-linea/60 bg-ink-700 text-[22px]"
                          >
                            {celda.parada.icono}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="cifras block text-[8.5px] font-bold uppercase tracking-[0.2em] text-tenue">
                              {celda.parada.etiqueta}
                            </span>
                            <span
                              className={`mt-1 block font-display text-[19px] font-black leading-tight [text-wrap:balance] ${celda.parada.tono ?? ''}`}
                            >
                              {celda.parada.valor}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  )
                })}
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
                  onClick={() => girarAMano(i)}
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
              transitionTimingFunction: CURVA_REBOTE,
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
