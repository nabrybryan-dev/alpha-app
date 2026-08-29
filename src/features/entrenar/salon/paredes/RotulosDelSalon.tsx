import type { EjercicioPrescrito, Microciclo, Sesion } from '../../../../domain/types'
import { textoDeObjetivo } from '../../../../domain/objetivoDeIntensidad'
import { ESCORZO_DE_PARED } from '../huecos'
import { CronometroSesion } from '../../CronometroSesion'
import type { AvisosDelSalon } from './avisosDelSalon'

/**
 * LOS RÓTULOS DEL MURO: lo que Bryan marcó en amarillo.
 *
 * Microciclo y nombre del día, cronómetro de sesión, duración estimada con el bloque y el
 * ejercicio n de N, la marquesina de avisos, la tabla de series ya registradas y lo que
 * viene a continuación. Seis piezas, todas al borde del cuadro y todas escorzadas con los
 * mismos grados que los campos del ejercicio: `ESCORZO_DE_PARED`, que vive en `huecos.ts`
 * porque es el muro del salón y no puede tener dos inclinaciones distintas.
 *
 * ## Por qué escorzado y no plano
 *
 * Un rótulo plano pegado al borde se lee como una etiqueta encima de la imagen: eso era el
 * dashboard. El mismo rótulo girado hacia el centro se lee como algo colgado de una pared
 * que está detrás del sujeto. No es un adorno — es la diferencia entre información SOBRE
 * la pantalla e información DENTRO de la habitación, que es literalmente el encargo.
 *
 * ## Ninguno recibe el puntero
 *
 * Salvo el cronómetro, que se pausa tocándolo. Todo lo demás es para leer mientras la
 * cámara orbita, y el gesto de orbitar nace en el borde: un rótulo que capturase el dedo
 * se comería el arrastre justo donde empieza.
 */

/** El giro del muro, según el lado. Sale de `huecos.ts` y no se escribe aquí. */
function giro(lado: 'izquierda' | 'derecha'): string {
  return `rotateY(${lado === 'izquierda' ? ESCORZO_DE_PARED.grados : -ESCORZO_DE_PARED.grados}deg)`
}

/** La caja común de todos los rótulos: fondo opaco, borde fino y escorzo del muro. */
function Rotulo({
  lado,
  className = '',
  children,
}: {
  lado: 'izquierda' | 'derecha'
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        perspective: `${ESCORZO_DE_PARED.perspectiva}px`,
        perspectiveOrigin: lado === 'izquierda' ? 'right center' : 'left center',
      }}
      className={className}
    >
      <div
        // Sin desenfoque, por lo mismo que los campos del ejercicio: esto cuelga sobre el
        // lienzo del sujeto, que se está animando, y un `backdrop-filter` obligaría a
        // remuestrear la región en cada fotograma.
        className={`rounded-[9px] border border-white/10 bg-ink-900/85 px-2.5 py-1.5 ${
          lado === 'izquierda' ? 'origin-left text-left' : 'origin-right text-right'
        }`}
        style={{ transform: giro(lado), boxShadow: '0 6px 18px -12px rgba(0,0,0,.9)' }}
      >
        {children}
      </div>
    </div>
  )
}

/** MICROCICLO Y NOMBRE DEL DÍA. El primero de los rótulos amarillos. */
export function RotuloDelDia({
  microciclo,
  sesion,
  className,
}: {
  microciclo: Microciclo
  sesion: Sesion | undefined
  className?: string
}) {
  return (
    <Rotulo lado="izquierda" className={className}>
      <p className="text-[7.5px] font-bold uppercase leading-none tracking-[0.2em] text-accion">
        Microciclo M{microciclo.numero}
      </p>
      <p className="mt-0.5 font-display text-[15px] uppercase leading-none text-silver-100">
        {sesion?.nombre ?? 'Sin sesión hoy'}
      </p>
    </Rotulo>
  )
}

/**
 * EL CRONÓMETRO DE SESIÓN, colgado del muro derecho.
 *
 * Es el MISMO componente que corre en la pantalla de sesión: el mismo estado, la misma
 * clave de almacenamiento y la misma pausa al tocarlo. Un segundo cronómetro para el salón
 * daría dos duraciones de la misma sesión, y esa duración acaba subiendo con el test post.
 *
 * Lo único que cambia es el tamaño: en la sesión ocupa el ancho de la pantalla y aquí
 * cuelga de una pared, así que la cifra baja de `text-6xl` a algo que quepa en el muro. Se
 * hace desde fuera con variantes que alcanzan a los hijos —no se toca el componente— y por
 * eso el selector es de dos niveles: gana por especificidad sin necesidad de forzar nada.
 */
export function RotuloCronometro({ sesionId, className }: { sesionId: string; className?: string }) {
  return (
    <Rotulo lado="derecha" className={className}>
      <div className="[&_.kicker]:text-[7.5px] [&_.kicker]:tracking-[0.2em] [&_button]:text-[26px] [&_p:last-child]:text-[7px] [&_p:last-child]:tracking-[0.14em] [&>div]:py-0">
        <CronometroSesion sesionId={sesionId} />
      </div>
    </Rotulo>
  )
}

/** DURACIÓN ESTIMADA, BLOQUE EN CURSO Y EJERCICIO N DE N, en una línea del muro. */
export function RotuloDeRitmo({ linea, className }: { linea: string; className?: string }) {
  return (
    <Rotulo lado="izquierda" className={className}>
      <p className="text-[7.5px] font-bold uppercase leading-none tracking-[0.2em] text-silver-500">
        Ritmo de la sesión
      </p>
      <p className="cifras mt-0.5 text-[10.5px] font-semibold leading-none text-silver-200">
        {linea}
      </p>
    </Rotulo>
  )
}

/** El color con el que la marquesina acusa cómo se va de tiempo. */
const TINTE = {
  acelerado: 'text-azul',
  'en-ritmo': 'text-silver-200',
  lento: 'text-ambar',
} as const

/**
 * LA MARQUESINA DE AVISOS: una banda que cruza el muro y va pasando.
 *
 * El texto se duplica y la pista se desplaza un 50 %, que es como el bucle no tiene
 * costura. `ticker-pista` es la clase del sistema: con movimiento reducido se queda
 * quieta, y entonces lo que se ve es el primer aviso, que es el que más urge.
 */
export function Marquesina({ avisos, className }: { avisos: AvisosDelSalon; className?: string }) {
  const tira = `${avisos.frases.join('  ·  ')}  ·  `
  return (
    <div className={`overflow-hidden border-y border-white/10 bg-ink-900/70 py-1 ${className ?? ''}`}>
      <span className={`ticker-pista text-[10px] font-medium ${TINTE[avisos.estado]}`}>
        <span>{tira}</span>
        <span aria-hidden="true">{tira}</span>
      </span>
    </div>
  )
}

/**
 * LA TABLA DE SERIES YA REGISTRADAS.
 *
 * Es la memoria de la sesión colgada de la pared: qué se levantó, cuántas veces y con
 * cuánto en reserva. Sin ella, la serie en curso no tiene contra qué compararse y hay que
 * abrir otra pantalla para saber si la anterior fue a 85 o a 80.
 *
 * Las series que faltan salen como peldaños apagados, no se esconden: ver los tres huecos
 * es lo que dice cuánto queda.
 */
export function TablaDeSeries({
  ejercicio,
  className,
}: {
  ejercicio: EjercicioPrescrito
  className?: string
}) {
  const pendientes = Math.max(0, ejercicio.sets - ejercicio.series.length)
  return (
    <Rotulo lado="derecha" className={className}>
      <p className="text-[7.5px] font-bold uppercase leading-none tracking-[0.2em] text-silver-500">
        Series registradas
      </p>
      <ul className="mt-1 flex flex-col gap-[3px]">
        {ejercicio.series.map((serie) => (
          <li
            key={serie.orden}
            className="cifras flex items-baseline justify-end gap-1.5 text-[10px] leading-none text-silver-200"
          >
            <span className="text-silver-500">{serie.orden}</span>
            <span className="font-semibold">{String(serie.cargaKg).replace('.', ',')} kg</span>
            <span className="text-silver-400">× {serie.reps}</span>
            <span className="text-silver-500">RIR {serie.rir}</span>
          </li>
        ))}
        {Array.from({ length: pendientes }, (_, i) => (
          <li
            key={`pendiente-${i}`}
            className="cifras flex items-baseline justify-end gap-1.5 text-[10px] leading-none text-silver-500/60"
          >
            <span>{ejercicio.series.length + i + 1}</span>
            <span aria-hidden="true">— · —</span>
          </li>
        ))}
      </ul>
    </Rotulo>
  )
}

/**
 * A CONTINUACIÓN: los ejercicios que faltan.
 *
 * Va en horizontal y a lo ancho del muro del fondo, no en columna a un lado: una cola es
 * una cosa que avanza, y en columna volvía a ser una tarjeta. Se enseñan los tres
 * siguientes y se cuenta el resto — no porque el resto no importe, sino porque la lista
 * entera está en el panel de abajo y aquí lo que hace falta es saber qué viene ahora.
 */
export function AContinuacion({
  ejercicios,
  className,
  style,
}: {
  ejercicios: readonly EjercicioPrescrito[]
  className?: string
  style?: React.CSSProperties
}) {
  if (ejercicios.length === 0) return null
  const visibles = ejercicios.slice(0, 3)
  const resto = ejercicios.length - visibles.length

  return (
    <div style={style} className={`flex items-center gap-1.5 overflow-hidden ${className ?? ''}`}>
      <span className="shrink-0 text-[7.5px] font-bold uppercase leading-none tracking-[0.2em] text-silver-500">
        A continuación
      </span>
      {visibles.map((ejercicio) => (
        <span
          key={ejercicio.id}
          className="min-w-0 truncate rounded-full border border-white/10 bg-ink-900/85 px-2 py-1 text-[9.5px] leading-none text-silver-300"
        >
          {ejercicio.nombre}
          <span className="ml-1 text-silver-500">
            {ejercicio.sets}×{ejercicio.repsDiana} {textoDeObjetivo(ejercicio.rirObjetivo)}
          </span>
        </span>
      ))}
      {resto > 0 && (
        <span className="shrink-0 rounded-full border border-white/10 bg-ink-900/85 px-2 py-1 text-[9.5px] leading-none text-silver-500">
          +{resto}
        </span>
      )}
    </div>
  )
}
