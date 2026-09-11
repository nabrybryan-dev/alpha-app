import type { ReactNode } from 'react'
import {
  estiloDeCuadro,
  proyectarCuadro,
  type CamaraDelSalon,
  type SitioDePared,
} from './geometriaDeCuadro'

/**
 * UN CUADRO COLGADO DE LA PARED DEL SALÓN.
 *
 * Bryan lo pidió con un símil el 2026-09-02: «como si fuera un cuadro puesto cuando uno lo
 * tiene en la sala». Hasta entonces los datos del ejercicio eran tarjetas pegadas a los
 * bordes de la pantalla —«no me gusta que esté ahí como en los lados»— y el centro nunca
 * llegaba a quedar despejado.
 *
 * Esto los convierte en objetos DEL salón: cada uno cuelga de un muro, a un azimut y a una
 * altura, y cuando la cámara orbita se desplaza, se escorza y se sale de cuadro como se
 * saldría un cuadro de verdad. La posición y el giro salen de `proyectarCuadro`, que usa
 * la MISMA cámara que dibuja la escena.
 *
 * ## Lo que hace que se lea como colgado y no como pegado
 *
 * - **El escorzo.** El giro es la diferencia entre el azimut del muro y el de la cámara.
 *   Un muro de frente no gira; el mismo muro desde un lado se escorza, y ese escorzo es la
 *   mitad de lo que dice «esto está en la pared».
 * - **La escala.** El ancho va en METROS y se multiplica por los píxeles-por-metro de esa
 *   profundidad. Acercarse lo agranda; alejarse, lo encoge. Un panel con ancho en píxeles
 *   se delata al primer pellizco.
 * - **El apilado por profundidad.** Lo lejano va detrás. Sin eso, un cuadro del muro de
 *   enfrente se pintaría encima de uno del muro de al lado y el orden delataría que no
 *   están en el espacio.
 * - **El marco.** Un borde y una sombra pegada al muro. Un rectángulo sin marco flotando
 *   sobre una pared no se lee como cuadro: se lee como interfaz.
 *
 * ## Qué NO hace
 *
 * No recorta textos ni decide qué va dentro. Recibe hijos y los coloca. Quién cuelga de
 * qué muro lo decide `ParedesDelSalon`, que es quien sabe qué más hay en la sala.
 */
export interface CuadroDeParedProps {
  sitio: SitioDePared
  camara: CamaraDelSalon
  /** El lienzo, en píxeles CSS. De él salen la focal y el centro del cuadro. */
  lienzo: { ancho: number; alto: number }
  /** Si el cuadro admite el dedo. Los de solo lectura, no: se orbita sobre ellos. */
  interactivo?: boolean
  /** Para poder contarlos y encontrarlos desde el testigo. */
  clave: string
  children: ReactNode
}

export function CuadroDePared({
  sitio,
  camara,
  lienzo,
  interactivo = false,
  clave,
  children,
}: CuadroDeParedProps) {
  const c = proyectarCuadro(sitio, camara, lienzo.ancho, lienzo.alto)
  // Un cuadro que ya no toca la pantalla no se monta: no se paga su render ni su texto.
  if (!c.visible) return null

  const estilo = estiloDeCuadro(c, sitio)
  // El tamaño del texto acompaña a la escala del cuadro, porque un cuadro que se acerca
  // acerca lo que lleva escrito. Se acota por abajo para que nunca baje de legible y por
  // arriba para que al pegarse a la pared no se coma la sala.
  const cuerpo = Math.max(7, Math.min(15, sitio.ancho * c.escala * 0.052))

  return (
    <div
      data-cuadro={clave}
      // EL TOPE DE ALTO QUE ESTE CUADRO PROMETE, en píxeles de esta pantalla.
      //
      // `sitio.alto` es un tope declarado en metros, y de él sale la altura a la que se
      // cuelga (`asentarEnLaBanda`). Si el contenido crece por encima, el cuadro se sale
      // por arriba y el cálculo sigue diciendo que cabe — un tope escrito y no medido se
      // separa del contenido a la primera. Sacándolo aquí, `testigo/cuadros-en-pantalla.mjs`
      // compara el alto de VERDAD con el prometido y lo dice en voz alta.
      data-alto-tope={Math.round(sitio.alto * c.escala)}
      style={{ ...estilo, fontSize: `${cuerpo}px`, pointerEvents: interactivo ? 'auto' : 'none', maxWidth: `${sitio.ancho * c.escala}px` }}
    >
      {/* SIN CAJA, y es lo que separa esto de un dashboard.

          Aquí hubo un marco de 1 px, un fondo `ink-900/80` y unas esquinas de 6 px. Con
          eso, cada dato del salón era una tarjeta de la app re-colgada de una pared —lo
          que Bryan describió el 2026-09-03 como «extraído de la aplicación y pegado
          literal en las paredes»—. Un dato no es un objeto: es luz que cae sobre el
          hormigón, y la luz no tiene canto. Lo que la sustituye es `.muro-derrame`, que
          se sale del bloque por los cuatro lados justamente para no tener filo.

          El que SÍ conserva cuerpo es el interactivo, y no por variar: lo que se aprieta
          con el dedo tiene que parecer un aparato. Es la regla entera de esta capa —lo
          que se lee es luz, lo que se toca es materia— y está escrita en `tokens.css`. */}
      {/* `muro-entra`: el cuadro SUBE Y SE ASIENTA al montarse, con el peso de
          protagonista —lo pesado no rebota—. Se dispara solo, sin efecto ni estado:
          un cuadro que sale de la ventana se desmonta y al volver a entrar vuelve a
          encenderse, que es lo que hace una luz cuando la miras. */}
      <div
        className={`muro-entra ${interactivo ? 'muro-reflector px-[0.7em] py-[0.55em]' : 'muro-derrame px-[0.7em] py-[0.5em]'}`}
      >
        {children}
      </div>
    </div>
  )
}
