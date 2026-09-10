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

/**
 * EL CÓDIGO DE SALA: una línea diminuta y nada más.
 *
 * ## Qué decía antes y por qué sobraba
 *
 * Decía el microciclo y el nombre de la sesión —«M22 FULL C»—, y desde que existe la banda
 * de arriba eso estaba escrito dos veces en la misma pantalla, a cuatro centímetros.
 * Después dijo el grupo del ejercicio —«M22 DOMINANTE DE RODILLA»— y entonces partía en
 * dos líneas, que en un muro es peor: el rótulo pequeño se convertía en un párrafo.
 *
 * ## Lo que dice ahora
 *
 * El número de la sala. Se lee de un vistazo, no compite con el nombre del ejercicio y no
 * repite nada de lo que ya está en pantalla. Es lo que lleva escrito una sala de verdad
 * encima de la puerta: cuál es, y punto.
 *
 * Va en letra de máquina, en gris de marca y con el espaciado muy abierto, que es como se
 * rotula un número de sala y no como se escribe un titular. La letra MÍNIMA es el encargo:
 * lo que tiene que verse en esta pantalla es la sala, no lo que está escrito en ella.
 */
export function RotuloDelDia({
  numeroDeSala,
  className,
  enCuadro,
}: {
  /** El número de sala. Sale del orden de la sesión en la semana, no de un contador. */
  numeroDeSala: number
  className?: string
  /** `true` si ya cuelga de un `CuadroDePared`: el marco lo pone el cuadro. */
  enCuadro?: boolean
}) {
  return (
    <Rotulo lado="izquierda" className={className} enCuadro={enCuadro}>
      <p className="muro-rotulo text-[0.5em] text-gris-marca">
        Sala {String(numeroDeSala).padStart(2, '0')}
      </p>
    </Rotulo>
  )
}

export function RotuloCronometro({ sesionId, className, enCuadro }: { sesionId: string; className?: string
  /** `true` si ya cuelga de un `CuadroDePared`: el marco lo pone el cuadro. */
  enCuadro?: boolean }) {
  return (
    <Rotulo lado="derecha" className={className} enCuadro={enCuadro}>
      {/* EL RELOJ VA EN TRAZO, como el nombre del ejercicio que tiene al lado. Era la
          única mancha sólida que quedaba en el muro, y una mancha es lo que tapa la sala.

          Encima, su etiqueta diminuta: sin ella la cifra no dice QUÉ cuenta, y el mando
          puede cambiarlo a descanso o a excéntrico — la regla del salón es que todo lo que
          cambia se lee en la pared, así que la pared tiene que decir qué está contando.

          El componente es el mismo que corre en la pantalla de sesión: se monta, no se
          reescribe. Lo que cambia son las variantes que alcanzan a sus hijos —la cifra a
          trazo, el rótulo propio a la vista y la coletilla «toca para pausar» escondida—.
          En una pared, una instrucción de interfaz es ruido: un reloj de gimnasio no lleva
          escrito cómo se usa, y el botón conserva su `aria-label` para quien lo necesita. */}
      <div className="text-right">
        <p className="muro-rotulo text-[0.5em] text-gris-marca">Sesión</p>
        <div className="mt-[0.1em] [&_.kicker]:hidden [&_button]:muro-reloj [&_button]:text-[1.45em] [&_p:last-child]:hidden [&>div]:py-0">
          <CronometroSesion sesionId={sesionId} />
        </div>
        <span className="muro-filete-reloj" aria-hidden="true" />
      </div>
    </Rotulo>
  )
}

