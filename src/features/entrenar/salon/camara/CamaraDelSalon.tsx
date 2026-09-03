import { useState } from 'react'
import type { EjercicioPrescrito } from '../../../../domain/types'
import { IconoCamara } from '../../../../components/ui/Icono'
import { HojaMedicion } from '../../encoder/HojaMedicion'
import { leerBorrador } from '../registro/borrador'

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
    <div
      data-testigo="camara"
      style={style}
      className={`pointer-events-auto flex flex-col gap-[0.45em] ${className}`}
    >
      {/* LA CABECERA DEL REFLECTOR: el trípode en silueta y el rótulo, dentro del cono.

          El trípode no se cambia —es lo que dice que esto es un aparato del salón y no un
          botón—, pero deja de ir junto a una etiqueta de interfaz y pasa a ir junto a un
          rótulo serigrafiado en el muro. El punto rojo del testigo de grabación late: es
          lo que hace que el reflector parezca encendido y no dibujado. */}
      <div className="flex items-center gap-[0.5em]">
        <svg
          viewBox="0 0 24 26"
          aria-hidden="true"
          className="h-[2.1em] w-[1.9em] shrink-0 text-accion"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 0.35em rgb(var(--accion-rgb) / 0.5))' }}
        >
          <path d="M12 12v6" />
          <path d="M12 18 6 25M12 18l6 7M12 18v7" />
          <rect x="4" y="4" width="12" height="8" rx="1.5" />
          <path d="m16 7 4-2v6l-4-2" />
        </svg>
        <p className="muro-rotulo text-[0.62em]">Cámara del encuadre</p>
        <span className="punto-vivo ml-auto h-[0.42em] w-[0.42em] shrink-0 rounded-full bg-accion" aria-hidden="true" />
      </div>

      {/* LOS CUATRO CAMPOS DEL ENCUADRE YA NO ESTÁN AQUÍ, y no se han perdido: bajaron al
          panel, a «El encuadre de hoy».

          Estaban en la pared y no pertenecen a la lista amarilla del §1 de `SEMANA-2.md`
          —ahí solo entra «medir con la cámara»—. Puestos aquí ocupaban, con el estante del
          material enfrente, el 98 % del ancho a la altura de las piernas del sujeto: la
          captura del 2-sep enseña once paneles opacos y del cuerpo una astilla. Los
          implementos 3D aportaban 36 píxeles no porque no se dibujaran, sino porque esto
          los tapaba. */}
      {/* EL MANDO. Lo único de este módulo que se toca, y por eso lo único con cuerpo.

          Materia de aparato —canto de 2 px, filo de luz arriba, sombra proyectada
          abajo— y no la tarjeta redondeada de antes. La regla de la capa: lo que se lee
          es luz sobre el muro, lo que se toca es materia. Si el botón tuviera el mismo
          aspecto que el rótulo de encima, tocar dejaría de ser evidente. */}
      <hr className="muro-junta muro-junta-viva" aria-hidden="true" />
      <button
        type="button"
        onClick={() => setMidiendo(true)}
        className="press muro-mando flex items-center justify-center gap-[0.5em] py-[0.62em] text-[0.72em] font-bold uppercase tracking-[0.16em] text-silver-100"
      >
        <IconoCamara className="h-[1.35em] w-[1.35em] shrink-0 text-accion" />
        Medir con la cámara
      </button>

      {/* La hoja de medición es la MISMA que abre el registro de la sesión: mismo encoder,
          mismos criterios, misma tanda. Se monta cerrada y solo entonces arranca WebGL. */}
      <HojaMedicion
        abierto={midiendo}
        onCerrar={() => setMidiendo(false)}
        ejercicio={ejercicio.nombre}
        cargaKg={borrador.cargaKg}
        reps={borrador.reps}
      />
    </div>
  )
}
