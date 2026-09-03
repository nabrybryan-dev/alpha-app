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
      <div
        className="overflow-hidden rounded-[6px] border border-white/12 bg-ink-900/80 px-[0.7em] py-[0.55em] shadow-[0_0.5em_1.2em_-0.6em_rgba(0,0,0,0.9)]"
        // El marco por dentro: un filo claro arriba y sombra abajo, que es como se ve un
        // cuadro con luz cenital. Va en `style` y no en clases porque las medidas son
        // relativas al tamaño del cuadro, y ése cambia con la distancia.
        style={{ boxShadow: 'inset 0 0.08em 0 rgba(255,255,255,0.07), 0 0.5em 1.2em -0.6em rgba(0,0,0,0.9)' }}
      >
        {children}
      </div>
    </div>
  )
}
