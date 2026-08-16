import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'

/**
 * La cabecera del ejercicio como un gabinete de tragamonedas: en vez de un
 * título estático, un tambor que rota entre cinco datos del ejercicio actual.
 *
 * El movimiento es decorativo; la INFORMACIÓN nunca lo es. El nombre completo
 * está siempre en el árbol de accesibilidad aunque el tambor esté en otra
 * parada, la parada visible se anuncia por `aria-live`, y con
 * `prefers-reduced-motion` no gira solo: cambia con un fundido.
 *
 * DECISIÓN PENDIENTE: el brief pide acento volt (#c8ff1e) y los tokens
 * `--glow-volt` y `--ease-power`. Este proyecto no los tiene: su acento es el
 * rojo Alpha (`--accion`) y así está declarado en `tokens.css` —«si aparece en
 * otra pantalla, es que algo se copió mal»—. Como el encargo prohíbe tocar los
 * tokens globales y hardcodear colores, se usa `--accion` y `--glow-accion`.
 * Si la marca cambia a volt, se cambia el token y esto sigue igual.
 *
 * DECISIÓN PENDIENTE: el brief pide iconos Lucide, pero Lucide no está
 * instalado y las dependencias nuevas están prohibidas. Los trazos van en
 * línea, que es lo que ya hace el resto de la app.
 */

/** Alto de la ventana y de cada fila de la cinta. */
const ALTO = 104
/** Milisegundos por paso mientras gira. */
const PASO_MS = 62
/** Cuánto gira antes de frenar. */
const GIRO_MS = 900
/** Pasos del giro, derivados de la duración: 900 / 62 ≈ 15. */
const PASOS_GIRO = Math.round(GIRO_MS / PASO_MS)
/** Cuánto dura el destello del marco al aterrizar. */
const DESTELLO_MS = 620
/** Cada cuánto gira solo mientras la sesión está viva. */
const AUTO_MS = 4200

export interface ExerciseSlotMachineProps {
  index: number
  total: number
  nombre: string
  patron?: string
  clase?: string
  tecnica?: string
  refVisual?: string
  categoria: string
  rango: string
  autoSpin?: boolean
  paused?: boolean
  onRefTap?: () => void
}

interface Parada {
  etiqueta: string
  valor: string
  tono: 'texto' | 'accion' | 'oro'
  icono: ReactElement
  accion?: boolean
}

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

/** Trazos de Lucide en línea: dumbbell, move-3d, layers, notebook-pen, play-circle. */
const ICONOS = {
  dumbbell: <svg {...trazo} className="h-5 w-5"><path d="M14.4 14.4 9.6 9.6M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l1.767-1.768a2 2 0 1 1 2.829 2.829z" /><path d="m21.5 21.5-1.4-1.4M3.9 3.9 2.5 2.5" /><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.767a2 2 0 1 1 2.829 2.829z" /></svg>,
  move3d: <svg {...trazo} className="h-5 w-5"><path d="M5 3v16h16M5 19l6-6M15 8l4-4M19 4h-4M19 4v4" /></svg>,
  layers: <svg {...trazo} className="h-5 w-5"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m6.08 10.37-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59" /></svg>,
  nota: <svg {...trazo} className="h-5 w-5"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6M8 7h6M8 11h4" /><path d="M18.4 9.6a2 2 0 0 1 3 3L17 17l-4 1 1-4Z" /></svg>,
  play: <svg {...trazo} className="h-5 w-5"><circle cx="12" cy="12" r="10" /><path d="m10 8 6 4-6 4Z" /></svg>,
}

/** Símbolos de casino: zap, star, flame, align-justify, sparkles. */
const SIMBOLOS = [
  <svg key="zap" {...trazo} className="h-4 w-4"><path d="M4 14h7l-3 7 12-11h-7l3-7z" /></svg>,
  <svg key="star" {...trazo} className="h-4 w-4"><path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8z" /></svg>,
  <svg key="flame" {...trazo} className="h-4 w-4"><path d="M12 3c2 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 1 1 1.5 2 2 0-3 .5-5 1-7Z" /></svg>,
  <svg key="barras" {...trazo} className="h-4 w-4"><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  <svg key="comodin" {...trazo} className="h-4 w-4"><path d="m12 3 1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z" /><path d="M19 15.5 19.7 17l1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7z" /></svg>,
]

function construirParadas(p: ExerciseSlotMachineProps): Parada[] {
  const paradas: Parada[] = [
    { etiqueta: 'Ejercicio', valor: p.nombre, tono: 'texto', icono: ICONOS.dumbbell },
  ]
  // Los datos opcionales que no vengan simplemente no crean parada: con menos
  // de cinco el tambor gira igual y el layout no se rompe.
  if (p.patron) paradas.push({ etiqueta: 'Patrón de movimiento', valor: p.patron, tono: 'accion', icono: ICONOS.move3d })
  if (p.clase) paradas.push({ etiqueta: 'Categoría del ejercicio', valor: p.clase, tono: 'oro', icono: ICONOS.layers })
  if (p.tecnica) paradas.push({ etiqueta: 'Nota técnica', valor: p.tecnica, tono: 'texto', icono: ICONOS.nota })
  if (p.refVisual) paradas.push({ etiqueta: 'Referencia visual', valor: p.refVisual, tono: 'accion', icono: ICONOS.play, accion: true })
  return paradas
}

const CLASE_TONO: Record<Parada['tono'], string> = {
  texto: 'text-texto',
  accion: 'text-accion',
  oro: 'text-[color:var(--oro)]',
}

function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const alCambiar = () => setReducido(mq.matches)
    mq.addEventListener?.('change', alCambiar)
    return () => mq.removeEventListener?.('change', alCambiar)
  }, [])
  return reducido
}

export function ExerciseSlotMachine(props: ExerciseSlotMachineProps) {
  const { index, total, categoria, rango, autoSpin = true, paused = false, onRefTap } = props
  const { nombre, patron, clase, tecnica, refVisual } = props
  // Las dependencias son los CAMPOS, no el objeto `props`: su identidad cambia
  // en cada render, y con ella `girarA` y el efecto de montaje — cuya limpieza
  // cancelaba el giro antes de que llegara a aterrizar.
  const paradas = useMemo(
    () => construirParadas({ ...props, nombre, patron, clase, tecnica, refVisual }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo los campos que crean paradas
    [nombre, patron, clase, tecnica, refVisual],
  )
  const reducido = useMovimientoReducido()

  const [catIdx, setCatIdx] = useState(0)
  const [rOff, setROff] = useState(0)
  const [rSpin, setRSpin] = useState(false)
  const [rSnap, setRSnap] = useState(false)
  const [flash, setFlash] = useState(false)
  const [leverDown, setLeverDown] = useState(false)
  const relojes = useRef<number[]>([])

  const limpiarRelojes = useCallback(() => {
    relojes.current.forEach((r) => clearTimeout(r))
    relojes.current = []
  }, [])

  const programar = useCallback((fn: () => void, ms: number) => {
    relojes.current.push(window.setTimeout(fn, ms))
  }, [])

  /**
   * La física del giro, en cuatro tiempos: snap sin transición, giro a ciegas,
   * frenada con un solo rebote, y destello del marco al aterrizar.
   */
  const girarA = useCallback(
    (destino: number) => {
      if (paradas.length < 2) return
      const objetivo = ((destino % paradas.length) + paradas.length) % paradas.length
      limpiarRelojes()

      if (reducido) {
        setCatIdx(objetivo)
        setROff(objetivo)
        return
      }

      setRSnap(true)
      setRSpin(true)
      // Se cuentan PASOS, no reloj de pared: 900 ms a 62 ms por paso son 15.
      // Contar el tiempo con `Date.now()` deja el giro a merced de que el
      // navegador —o un test— tenga el reloj congelado.
      let restantes = PASOS_GIRO
      const paso = () => {
        setROff((o) => o + 1)
        restantes -= 1
        if (restantes > 0) programar(paso, PASO_MS)
        else {
          setRSpin(false)
          setRSnap(false)
          setCatIdx(objetivo)
          setROff((o) => {
            // Aterriza en la vuelta siguiente para que nunca retroceda.
            const restante = ((objetivo - (o % paradas.length)) + paradas.length) % paradas.length
            return o + restante + paradas.length
          })
          setFlash(true)
          programar(() => setFlash(false), DESTELLO_MS)
        }
      }
      programar(paso, PASO_MS)
    },
    [limpiarRelojes, paradas.length, programar, reducido],
  )

  /**
   * Al entrar, un giro de bienvenida.
   *
   * No hace falta un efecto por cambio de ejercicio: `SesionPage` monta la
   * tarjeta con `key={ejercicio.id}`, así que al cambiar de ejercicio este
   * componente se remonta entero y vuelve a pasar por aquí.
   *
   * El giro se PROGRAMA, no se lanza en el cuerpo del efecto: llamar a `girarA`
   * aquí sería un `setState` síncrono dentro de un efecto, que es un error de
   * lint en este repo y encadena renders.
   */
  useEffect(() => {
    // Va por `programar` a propósito: si el asesorado tira de la palanca antes
    // de que arranque, `limpiarRelojes` lo cancela. Con un `setTimeout` suelto
    // sobrevivía y pisaba el tirón un segundo después.
    programar(() => girarA(0), PASO_MS)
    return limpiarRelojes
  }, [girarA, limpiarRelojes, programar])

  // El giro automático. Se detiene con la celebración, la sesión terminada y
  // la pestaña sin foco: nadie mira una tragamonedas que gira sola en segundo
  // plano, y con `reduce` no arranca nunca.
  // La parada actual, espejada en un ref para que el temporizador no se
  // recree cada vez que cambia. Se escribe en un efecto, nunca en el render.
  const catIdxRef = useRef(0)
  useEffect(() => {
    catIdxRef.current = catIdx
  }, [catIdx])
  useEffect(() => {
    if (!autoSpin || paused || reducido || paradas.length < 2) return
    const tic = window.setInterval(() => {
      if (document.visibilityState === 'visible') girarA(catIdxRef.current + 1)
    }, AUTO_MS)
    return () => clearInterval(tic)
  }, [autoSpin, paused, reducido, paradas.length, girarA])

  const tirar = () => {
    setLeverDown(true)
    window.setTimeout(() => setLeverDown(false), 260)
    girarA(catIdx + 1)
  }

  const visible = paradas[catIdx] ?? paradas[0]
  const pos = paradas.length > 0 ? ((rOff % paradas.length) + paradas.length) % paradas.length : 0

  return (
    <div
      className="rounded-[19px] p-[1.5px] transition-shadow duration-300"
      style={{
        backgroundImage: 'var(--metal-grad)',
        boxShadow: flash ? 'var(--glow-accion)' : undefined,
      }}
    >
      <div className="rounded-[17.5px] bg-ink-800 px-3 pb-2.5 pt-2">
        <FilaSuperior index={index} total={total} categoria={categoria} rango={rango} />
        <Marquesina />

        <div className="mt-2 flex items-stretch gap-2">
          <span className="w-[7px] shrink-0 rounded-full" style={{ backgroundImage: 'var(--metal-grad)' }} aria-hidden="true" />

          <Ventana
            paradas={paradas}
            pos={pos}
            rSpin={rSpin}
            rSnap={rSnap}
            reducido={reducido}
            flash={flash}
            onRefTap={onRefTap}
          />

          <Palanca abajo={leverDown} onTirar={tirar} />
        </div>

        <Paginador paradas={paradas} catIdx={catIdx} onIr={girarA} />
      </div>

      {/* El nombre completo, siempre, aunque el tambor esté en otra parada. */}
      <span className="sr-only">{props.nombre}</span>
      <span className="sr-only" aria-live="polite">
        {visible ? `${visible.etiqueta}: ${visible.valor}` : ''}
      </span>
    </div>
  )
}

function FilaSuperior({ index, total, categoria, rango }: { index: number; total: number; categoria: string; rango: string }) {
  const dos = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="cifras shrink-0 text-[9.5px] font-bold text-tenue">
          Ejercicio {dos(index + 1)} / {dos(total)}
        </span>
        <span className="h-2.5 w-px shrink-0 bg-linea" aria-hidden="true" />
        <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.16em] text-accion">{categoria}</span>
      </span>
      <span className="cifras shrink-0 text-[9.5px] font-bold text-tenue">Rango ({rango})</span>
    </div>
  )
}

function Marquesina() {
  return (
    <div className="mt-1.5 flex justify-between px-1" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className="h-[5px] w-[5px] rounded-full bg-accion"
          style={{ animation: `bombilla-tragamonedas 1.6s ease-in-out ${i * 130}ms infinite` }}
        />
      ))}
    </div>
  )
}

function Ventana({
  paradas, pos, rSpin, rSnap, reducido, flash, onRefTap,
}: {
  paradas: Parada[]
  pos: number
  rSpin: boolean
  rSnap: boolean
  reducido: boolean
  flash: boolean
  onRefTap?: () => void
}) {
  const transicion = rSnap
    ? 'none'
    : reducido
      ? 'opacity 160ms ease-out'
      : 'transform 420ms cubic-bezier(.14,1.06,.32,1)'

  return (
    <div
      className="relative flex-1 overflow-hidden rounded-xl border bg-ink-900"
      style={{
        height: ALTO,
        borderColor: flash ? 'var(--accion)' : 'rgb(var(--accion-rgb) / 0.3)',
        boxShadow: 'var(--inset-top-light)',
      }}
    >
      <MarcasDeLinea lado="left" />
      <MarcasDeLinea lado="right" />

      <div
        style={{
          transform: reducido ? undefined : `translateY(-${pos * ALTO}px)`,
          transition: transicion,
          filter: rSpin ? 'blur(1.1px)' : undefined,
        }}
      >
        {paradas.map((parada, i) => (
          <div key={parada.etiqueta} style={{ height: ALTO }}>
            <FilaParada parada={parada} oculta={reducido && i !== pos} onRefTap={onRefTap} />
            {!reducido && <FilaSimbolos indice={i} />}
          </div>
        ))}
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,9,10,.82), transparent 34%, transparent 66%, rgba(8,9,10,.82))',
        }}
      />
    </div>
  )
}

function MarcasDeLinea({ lado }: { lado: 'left' | 'right' }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute top-1/2 flex -translate-y-1/2 flex-col gap-1 ${lado === 'left' ? 'left-0' : 'right-0'}`}
    >
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} className="h-[3px] w-[22px] rounded-full bg-accion/45" />
      ))}
    </span>
  )
}

function FilaParada({ parada, oculta, onRefTap }: { parada: Parada; oculta: boolean; onRefTap?: () => void }) {
  const contenido = (
    <>
      <span className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl bg-surface-2 ${CLASE_TONO[parada.tono]}`}>
        {parada.icono}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="cifras block text-[8.5px] font-bold uppercase tracking-[0.14em] text-tenue">
          {parada.etiqueta}
        </span>
        <span
          className={`mt-0.5 block leading-tight ${CLASE_TONO[parada.tono]} ${
            parada.etiqueta === 'Ejercicio' ? 'text-[19px] font-black' : 'text-[13.5px] font-semibold'
          }`}
        >
          {parada.valor}
        </span>
      </span>
    </>
  )

  const clases = 'flex h-full w-full items-center gap-3 px-3'
  if (parada.accion && onRefTap) {
    return (
      <button type="button" onClick={onRefTap} className={`press ${clases}`} style={{ opacity: oculta ? 0 : 1 }}>
        {contenido}
      </button>
    )
  }
  return (
    <div className={clases} style={{ opacity: oculta ? 0 : 1 }} aria-hidden={oculta}>
      {contenido}
    </div>
  )
}

/**
 * La fila de símbolos que va entre parada y parada. Solo se percibe durante el
 * giro: es lo que hace que parezca una tragamonedas y no un carrusel.
 */
function FilaSimbolos({ indice }: { indice: number }) {
  return (
    <div className="flex h-full items-center justify-around px-6 text-tenue opacity-50" aria-hidden="true">
      {SIMBOLOS.map((s, i) => (
        <span key={i} className={i === indice % SIMBOLOS.length ? 'text-accion' : undefined}>
          {s}
        </span>
      ))}
    </div>
  )
}

function Palanca({ abajo, onTirar }: { abajo: boolean; onTirar: () => void }) {
  return (
    <div className="flex w-[44px] shrink-0 flex-col items-center justify-center gap-1">
      <button
        type="button"
        onClick={onTirar}
        aria-label="Girar información del ejercicio"
        className="flex flex-col items-center"
        style={{
          transform: abajo ? 'rotate(26deg)' : 'rotate(0deg)',
          transformOrigin: 'bottom center',
          transition: 'transform 260ms cubic-bezier(.14,1.06,.32,1)',
        }}
      >
        <span className="h-[22px] w-[22px] rounded-full bg-accion" style={{ boxShadow: 'var(--glow-accion)' }} />
        <span className="h-8 w-[6px] rounded-b-full" style={{ backgroundImage: 'var(--metal-grad)' }} />
      </button>
      <span className="cifras text-[8px] font-bold tracking-[0.12em] text-tenue">TIRAR</span>
    </div>
  )
}

function Paginador({ paradas, catIdx, onIr }: { paradas: Parada[]; catIdx: number; onIr: (i: number) => void }) {
  return (
    <div className="mt-2 flex items-center justify-center gap-1.5">
      {paradas.map((parada, i) => (
        <button
          key={parada.etiqueta}
          type="button"
          onClick={() => onIr(i)}
          aria-label={`Ver ${parada.etiqueta.toLowerCase()}`}
          aria-current={i === catIdx}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === catIdx ? 22 : 6,
            background: i === catIdx ? 'var(--accion)' : 'var(--linea)',
          }}
        />
      ))}
    </div>
  )
}
