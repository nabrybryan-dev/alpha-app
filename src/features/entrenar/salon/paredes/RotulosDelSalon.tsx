import type { Microciclo, Sesion } from '../../../../domain/types'
import { ESCORZO_DE_PARED } from '../huecos'
import { CronometroSesion } from '../../CronometroSesion'

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

