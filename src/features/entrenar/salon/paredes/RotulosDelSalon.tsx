import { Fragment } from 'react'
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
  enCuadro,
  children,
}: {
  lado: 'izquierda' | 'derecha'
  className?: string
  /**
   * `true` cuando el rótulo ya cuelga de un `CuadroDePared`.
   *
   * Entonces suelta TODO lo suyo: el marco, el fondo, la perspectiva y el escorzo. Los
   * pone el cuadro, que además los saca de la cámara real del salón en vez de un ángulo
   * fijo. Dejarlos puestos daría una caja dentro de otra caja y dos escorzos peleándose:
   * el del cuadro, que es el bueno porque sale de la escena, y el de aquí, que era una
   * aproximación de cuando estos rótulos vivían pegados al borde de la pantalla.
   */
  enCuadro?: boolean
  children: React.ReactNode
}) {
  if (enCuadro) return <div className={lado === 'derecha' ? 'text-right' : ''}>{children}</div>

  return (
    <div
      style={{
        perspective: `${ESCORZO_DE_PARED.perspectiva}px`,
        perspectiveOrigin: lado === 'izquierda' ? 'right center' : 'left center',
      }}
      className={className}
    >
      <div
        // Sin marco y sin fondo: `.muro-derrame` es luz sin canto. Y sin desenfoque, por
        // lo mismo que los campos del ejercicio — esto cuelga sobre el lienzo del sujeto,
        // que se está animando, y un `backdrop-filter` obligaría a remuestrear la región
        // en cada fotograma.
        className={`muro-derrame px-2.5 py-1.5 ${
          lado === 'izquierda' ? 'origin-left text-left' : 'origin-right text-right'
        }`}
        style={{ transform: giro(lado) }}
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
  enCuadro,
}: {
  microciclo: Microciclo
  sesion: Sesion | undefined
  className?: string
  /** `true` si ya cuelga de un `CuadroDePared`: el marco lo pone el cuadro. */
  enCuadro?: boolean
}) {
  return (
    <Rotulo lado="izquierda" className={className} enCuadro={enCuadro}>
      {/* LA CABECERA NO COMPITE CON EL EJERCICIO. A 1,15em «UPPER B» y «PRESS INCLINADO
          EN MULTIPOWER» tenían el mismo peso y se leían como un solo bloque de texto: el
          ojo no sabía cuál era el titular. La cabecera dice DE QUIÉN es la sesión —se lee
          una vez al entrar—; el ejercicio se lee en cada serie. Así que va en una línea,
          pequeña y en plata, con el microciclo delante en vez de encima. */}
      <p className="flex items-baseline gap-[0.5em] leading-none">
        <span className="muro-rotulo text-[0.56em] text-accion">M{microciclo.numero}</span>
        <span className="font-display text-[0.82em] uppercase tracking-[0.08em] text-silver-400">
          {sesion?.nombre ?? 'Sin sesión hoy'}
        </span>
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
export function RotuloCronometro({ sesionId, className, enCuadro }: { sesionId: string; className?: string
  /** `true` si ya cuelga de un `CuadroDePared`: el marco lo pone el cuadro. */
  enCuadro?: boolean }) {
  return (
    <Rotulo lado="derecha" className={className} enCuadro={enCuadro}>
      {/* El cronómetro pasa a la letra del marcador: es una CIFRA de la pared, no un
          número de interfaz. Las variantes alcanzan a los hijos —no se toca el
          componente, que es el mismo que corre en la pantalla de sesión— y ganan por
          especificidad sin forzar nada. */}
      {/* En el tablón el reloj NO puede gritar más que el ejercicio. A 2,4em lo hacía: la
          hora era lo primero que se leía de la pared, y lo primero es qué toca. Baja a
          1,45em y la coletilla «toca para pausar» se esconde — el botón conserva su
          `aria-label`, así que no se pierde para quien lo necesita, y en una pared una
          instrucción de interfaz es ruido: un reloj de gimnasio no lleva escrito cómo se
          usa. El rótulo también se esconde: al lado del nombre del día, «cronómetro de
          sesión» sobre unas cifras que cuentan no informa a nadie. */}
      <div className="text-right [&_.kicker]:hidden [&_button]:muro-cifra [&_button]:text-[1.45em] [&_p:last-child]:hidden [&>div]:py-0">
        <CronometroSesion sesionId={sesionId} />
      </div>
    </Rotulo>
  )
}

/**
 * El color con el que la marquesina acusa cómo se va de tiempo.
 *
 * `acelerado` era AZUL, y el 2026-09-03 Bryan lo señaló sin nombrarlo: la marquesina era
 * lo único de la pantalla que no parecía de esta sala. No lo parecía porque no lo es —el
 * salón es negro mate con acento carmín y la escala de plata; el azul es un color de la
 * app, y en el muro se leía como una notificación pegada—. Ir acelerado no es un error,
 * así que tampoco puede ir en carmín: se dice en plata clara, que es como se dice todo lo
 * que informa sin urgir. El ámbar se queda donde estaba, que es donde sí hay que aflojar.
 */
const TINTE = {
  acelerado: 'text-silver-100',
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
    <div className={`overflow-hidden py-[0.3em] ${className ?? ''}`}>
      {/* Una junta de luz arriba y otra abajo en vez de dos bordes: el aviso pasa por una
          RANURA del muro, no por una banda pegada encima. */}
      <hr className="muro-junta mb-[0.3em]" aria-hidden="true" />
      <span className={`ticker-pista text-[0.82em] font-medium ${TINTE[avisos.estado]}`}>
        <span>{tira}</span>
        <span aria-hidden="true">{tira}</span>
      </span>
      <hr className="muro-junta mt-[0.3em]" aria-hidden="true" />
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
  enCuadro,
}: {
  ejercicio: EjercicioPrescrito
  className?: string
  /** `true` si ya cuelga de un `CuadroDePared`: el marco lo pone el cuadro. */
  enCuadro?: boolean
}) {
  const pendientes = Math.max(0, ejercicio.sets - ejercicio.series.length)
  return (
    <Rotulo lado="derecha" className={className} enCuadro={enCuadro}>
      <p className="muro-rotulo text-[0.62em]">Series registradas</p>
      <ul className="mt-[0.4em] flex flex-col gap-[0.28em]">
        {ejercicio.series.map((serie) => (
          <li
            key={serie.orden}
            className="cifras flex items-baseline justify-end gap-[0.5em] text-[0.9em] leading-none"
          >
            {/* El número de serie va en rojo encendido y el resto en luz fría: es el
                mismo reparto de color que los dígitos de siete segmentos que la sala
                construye en geometría, para que las dos cosas se lean como una. */}
            <span className="muro-cifra text-[1em]">{serie.orden}</span>
            <span className="muro-dato font-semibold">
              {String(serie.cargaKg).replace('.', ',')} kg
            </span>
            <span className="text-silver-400">× {serie.reps}</span>
            <span className="text-silver-500">RIR {serie.rir}</span>
          </li>
        ))}
        {/* Las que faltan se quedan como peldaños apagados —igual que los segmentos que
            no encienden en un display— y no se esconden: ver los huecos es lo que dice
            cuánto queda. */}
        {Array.from({ length: pendientes }, (_, i) => (
          <li
            key={`pendiente-${i}`}
            className="cifras flex items-baseline justify-end gap-[0.5em] text-[0.9em] leading-none text-silver-500/55"
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
  enCuadro,
}: {
  ejercicios: readonly EjercicioPrescrito[]
  className?: string
  /** `true` si ya cuelga de un `CuadroDePared`: el marco lo pone el cuadro. */
  enCuadro?: boolean
  style?: React.CSSProperties
}) {
  if (ejercicios.length === 0) return null
  const visibles = ejercicios.slice(0, 3)
  const resto = ejercicios.length - visibles.length

  return (
    <div
      style={style}
      className={
        enCuadro
          ? 'flex flex-col items-start gap-[0.35em]'
          : `flex items-center gap-1.5 overflow-hidden ${className ?? ''}`
      }
    >
      <span className="muro-rotulo shrink-0 text-[0.62em]">A continuación</span>
      {/* SIN PASTILLAS. Cada ejercicio era una cápsula con borde y fondo —tres tarjetas
          diminutas colgadas de un muro—. Aquí son líneas de luz separadas por una junta:
          una cola escrita en la pared, que es lo que es. */}
      {visibles.map((ejercicio, i) => (
        <Fragment key={ejercicio.id}>
          {enCuadro && i > 0 && <hr className="muro-junta w-full" aria-hidden="true" />}
          <span className="muro-dato min-w-0 truncate text-[0.86em] leading-[1.25]">
            {ejercicio.nombre}
            <span className="muro-cifra ml-[0.5em] text-[0.92em]">
              {ejercicio.sets}×{ejercicio.repsDiana} {textoDeObjetivo(ejercicio.rirObjetivo)}
            </span>
          </span>
        </Fragment>
      ))}
      {resto > 0 && (
        <span className="muro-rotulo shrink-0 text-[0.62em]">y {resto} más</span>
      )}
    </div>
  )
}
