import { useState } from 'react'
import { ARTICULACIONES, NOMBRE_DE_TIPO } from '../../../domain/patrones/articulaciones'
import {
  demostracionesDe,
  DEMOSTRACIONES,
  DEMOSTRACION_POR_ID,
  type Demostracion,
} from '../../../domain/patrones/demostraciones'
import { VisorPatron } from './VisorPatron'

/**
 * El sujeto, aislado, ejerciendo una acción cada vez.
 *
 * Un ejercicio mezcla varias articulaciones a la vez y eso es lo que hay que
 * entender al final. Pero antes hace falta ver **una sola cosa moviéndose**: el
 * codo doblándose y nada más, desde el plano en el que ese movimiento ocurre.
 *
 * Aquí no hay escenario a propósito. Al estudiar una articulación el suelo y la
 * bahía son ruido, y además estas demostraciones no se apoyan en nada: el
 * sujeto flota para que nada distraiga del segmento que se mueve.
 */
export interface ExploradorAnatomicoProps {
  /**
   * Por dónde abrir. Se llega aquí desde un ejercicio concreto, así que empezar
   * por la articulación que ese ejercicio mueve ahorra buscar lo que se venía a
   * ver. Un id que no existe cae en el arranque por defecto en vez de dejar la
   * pantalla en blanco: viene de fuera y no se puede confiar en él.
   */
  articulacionInicial?: string
}

export function ExploradorAnatomico({ articulacionInicial }: ExploradorAnatomicoProps = {}) {
  // Por defecto el codo: es la bisagra más clara y su límite —el olécranon
  // topando con su fosa— explica de una vez qué significa un grado de libertad.
  const [elegida, setElegida] = useState<Demostracion>(
    () =>
      (articulacionInicial ? demostracionesDe(articulacionInicial)[0] : undefined) ??
      DEMOSTRACION_POR_ID['demo-codo-codoFlex'] ??
      DEMOSTRACIONES[0],
  )
  const hermanas = demostracionesDe(elegida.articulacion.id)

  return (
    <div className="flex flex-col gap-3">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ambar">
          El sujeto y sus acciones
        </p>
        <h2 className="font-display text-xl uppercase leading-none tracking-tight text-texto">
          {elegida.articulacion.nombre}
        </h2>
        <p className="mt-1 text-[11px] text-silver-400">
          {NOMBRE_DE_TIPO[elegida.articulacion.tipo]} ·{' '}
          {elegida.articulacion.ejes.length === 1
            ? 'un grado de libertad'
            : `${elegida.articulacion.ejes.length} grados de libertad`}
          {/* Un rango de referencia no es una medida acordada, y quien mira esto
              tiene que poder distinguirlo: el recorrido que se enseña decide
              hasta dónde se cree que se puede llegar. */}
          {elegida.eje.provisional && (
            <span className="ml-1.5 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-silver-500">
              recorrido por confirmar
            </span>
          )}
        </p>
      </header>

      {/* Las articulaciones, en orden de la cadena y no alfabético. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ARTICULACIONES.map((a) => {
          const activa = a.id === elegida.articulacion.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setElegida(demostracionesDe(a.id)[0])}
              aria-pressed={activa}
              className={`press shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                activa
                  ? 'border-ambar/45 bg-ambar/15 text-ambar'
                  : 'border-ink-500 text-silver-400'
              }`}
            >
              {a.nombre}
            </button>
          )
        })}
      </div>

      {/* Los ejes de la elegida: solo si tiene más de uno, o no dice nada. */}
      {hermanas.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {hermanas.map((d) => {
            const activa = d.id === elegida.id
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setElegida(d)}
                aria-pressed={activa}
                className={`press rounded-lg border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] ${
                  activa ? 'border-silver-400 text-silver-100' : 'border-ink-500 text-silver-500'
                }`}
              >
                {d.eje.positivo} / {d.eje.negativo}
              </button>
            )
          })}
        </div>
      )}

      {/* `key` fuerza el remontaje al cambiar de acción: el visor calcula el
          encuadre y la traza al montarse, y sin esto se quedaría con los de la
          articulación anterior. */}
      <VisorPatron key={elegida.id} patron={elegida.patron} conEscenario={false} />
    </div>
  )
}
