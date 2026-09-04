import { useState } from 'react'
import type { EjercicioPrescrito } from '../../../../domain/types'
import { IconoCamara } from '../../../../components/ui/Icono'
import { HojaMedicion } from '../../encoder/HojaMedicion'
import { anotarVelocidadEnBorrador, leerBorrador } from '../registro/borrador'

/**
 * LA CÁMARA DEL ENCUADRE, DENTRO DEL SALÓN: el punto 4 de los cinco del encargo.
 *
 * «La cámara a un lado», y visible sin scroll. Va al pie del muro izquierdo, sobre el
 * rodapié que traza la arquitectura de la sala, que es donde estaría un trípode montado en
 * una sala de grabación: fuera del paso, mirando al centro.
 *
 * ## Aquí hay DOS cámaras y las dos son la misma
 *
 * El trípode de verdad ya está dentro de la escena tridimensional: `escena/tripode.ts` lo
 * construye y el visor lo monta con la colocación que propone `SALA.estacion`. Eso es lo
 * que se ve en el lienzo, en perspectiva y a la distancia de la estación.
 *
 * Este módulo es su mando y su ficha: la silueta que dice dónde está, los cuatro campos
 * del encuadre —desde dónde mira, a qué distancia, qué palanca y qué velocidad— y el botón
 * que abre la hoja de medición. Los cuatro campos son los mismos `data-campo` que antes
 * colgaban del muro derecho: no se han duplicado ni reescrito, se han mudado a donde se
 * usan. Un ajuste de encuadre leído junto al trípode es un ajuste; leído en la esquina
 * opuesta de la pantalla es un dato suelto.
 *
 * ## Lo que se mide es lo que se está levantando
 *
 * La toma se etiqueta con la carga y las repeticiones **del borrador de la serie en
 * curso**, leídas de la misma clave que escribe el registro del suelo (`registro/borrador`).
 * Si se etiquetara con la prescripción, una serie en la que se bajó el peso quedaría
 * archivada con los kilos que no se movieron.
 *
 * Se leen al pulsar y no en cada repintado a propósito: el borrador cambia con cada toque
 * del `stepper`, y suscribirse a él aquí repintaría el módulo de la cámara mientras alguien
 * ajusta los kilos, sin que nada de lo que se ve cambie hasta que abra la hoja.
 */

export interface CamaraDelSalonProps {
  /** `true` si ya cuelga de un `CuadroDePared`: la colocación la pone el cuadro. */
  enCuadro?: boolean
  ejercicio: EjercicioPrescrito
  microcicloId: string
  className?: string
  /** Dónde se apoya en el suelo. Lo decide quien monta las paredes, no este módulo. */
  style?: React.CSSProperties
}

export function CamaraDelSalon({
  ejercicio,
  microcicloId,
  className = '',
  style,
}: CamaraDelSalonProps) {
  const [midiendo, setMidiendo] = useState(false)
  const orden = ejercicio.series.length + 1
  const borrador = leerBorrador(microcicloId, ejercicio, orden)

  return (
    <div data-testigo="camara" style={style} className={`pointer-events-auto ${className}`}>
      {/* UN MANDO DESNUDO, y nada más.

          Aquí había un reflector: un cono de luz sobre el muro con la silueta del trípode,
          el rótulo «CÁMARA DEL ENCUADRE», un testigo rojo latiendo y una pastilla negra
          que decía «MEDIR CON LA CÁMARA». Estaba bien resuelto y era, al final, lo más
          parecido a un recorte de aplicación que quedaba en pantalla — y ocupaba media
          pared a la altura de las piernas del sujeto.

          El encargo del 2026-09-04 es que la letra sea MÍNIMA y que no haya textos
          interrumpiendo la sala. Así que la cámara se dice como se dicen los mandos de
          este salón: un disco de 52 px con su icono y su nombre en la etiqueta, hermano
          del mando del reloj. No se pierde nada —abre la misma hoja de medición, con el
          mismo encoder y la misma tanda— y se recupera media pared.

          EL TRÍPODE DE VERDAD SIGUE EN LA SALA. Lo dibuja el motor, en su sitio y con su
          cono de tolerancia: lo que se ha quitado es el dibujo del trípode EN LA PARED,
          que era la copia. La estación se sigue viendo porque está construida. */}
      <button
        type="button"
        onClick={() => setMidiendo(true)}
        aria-label="Medir esta serie con la cámara"
        className="press grid h-[52px] w-[52px] place-items-center rounded-full border"
        style={{
          borderColor: 'rgb(var(--accion-rgb) / 0.55)',
          background: 'rgb(var(--ink-1000-rgb) / 0.6)',
          color: 'var(--accion)',
        }}
      >
        <IconoCamara className="h-5 w-5" />
      </button>

      {/* La hoja de medición es la MISMA que abre el registro de la sesión: mismo encoder,
          mismos criterios, misma tanda. Se monta cerrada y solo entonces arranca WebGL. */}
      <HojaMedicion
        abierto={midiendo}
        onCerrar={() => setMidiendo(false)}
        ejercicio={ejercicio.nombre}
        cargaKg={borrador.cargaKg}
        reps={borrador.reps}
        // La medida va al borrador de ESTA serie: cuando se guarde, viajará con ella.
        onMedida={(velocidad) => anotarVelocidadEnBorrador(microcicloId, ejercicio, orden, velocidad)}
      />
    </div>
  )
}
