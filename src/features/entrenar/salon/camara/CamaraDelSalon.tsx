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
      className={`pointer-events-auto flex flex-col gap-1 ${className}`}
    >
      {/* EL TRÍPODE, en silueta. Cuatro trazos: las tres patas, la columna y el cuerpo de
          la cámara mirando al centro del cuadro. Es lo que hace que el módulo se lea como
          un aparato apoyado en el suelo del salón y no como un botón más. */}
      <div className="flex items-center gap-1.5">
        <svg
          viewBox="0 0 24 26"
          aria-hidden="true"
          className="h-6 w-[22px] shrink-0 text-accion"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 12v6" />
          <path d="M12 18 6 25M12 18l6 7M12 18v7" />
          <rect x="4" y="4" width="12" height="8" rx="1.5" />
          <path d="m16 7 4-2v6l-4-2" />
        </svg>
        <p className="text-[7.5px] font-bold uppercase leading-none tracking-[0.2em] text-silver-500">
          Cámara del encuadre
        </p>
      </div>

      {/* LOS CUATRO CAMPOS DEL ENCUADRE YA NO ESTÁN AQUÍ, y no se han perdido: bajaron al
          panel, a «El encuadre de hoy».

          Estaban en la pared y no pertenecen a la lista amarilla del §1 de `SEMANA-2.md`
          —ahí solo entra «medir con la cámara»—. Puestos aquí ocupaban, con el estante del
          material enfrente, el 98 % del ancho a la altura de las piernas del sujeto: la
          captura del 2-sep enseña once paneles opacos y del cuerpo una astilla. Los
          implementos 3D aportaban 36 píxeles no porque no se dibujaran, sino porque esto
          los tapaba. */}
      <button
        type="button"
        onClick={() => setMidiendo(true)}
        className="press flex items-center justify-center gap-1.5 rounded-[9px] border border-white/15 bg-white/5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-silver-100"
      >
        <IconoCamara className="h-[15px] w-[15px] shrink-0" />
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
