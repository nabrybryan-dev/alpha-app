import { useState } from 'react'
import { accionesPrincipales } from '../../../domain/patrones/acciones'
import type { Patron } from '../../../domain/patrones/catalogo'
import type { DatosDeSerie } from '../../../domain/escenario/sala'
import { ExploradorAnatomico } from './ExploradorAnatomico'
import { VisorPatron } from './VisorPatron'

/**
 * Las dos formas de mirar un ejercicio, y el camino de una a la otra.
 *
 * **El ejercicio** es el gesto entero: varias articulaciones a la vez, que es
 * como se entrena. **Una articulación** es el mismo cuerpo haciendo una sola
 * cosa, sin escenario ni carga, para entender qué significa la línea que el
 * desglose acaba de decir.
 *
 * Se abre por el ejercicio porque es a lo que se venía: quien está entre serie
 * y serie quiere ver cómo se hace, no un curso de anatomía. Lo otro está a un
 * toque para quien tenga la pregunta.
 */
export interface EstudioDelPatronProps {
  patron: Patron
  /**
   * Los números de la serie en curso. Van al visor del ejercicio, que es donde
   * levantan la sala y los marcadores; la vista de una articulación no los usa
   * porque ahí no hay escenario que rotular.
   */
  datos?: DatosDeSerie
}

type Vista = 'ejercicio' | 'articulacion'

/**
 * La articulación por la que se abre el estudio: la que más recorre en este
 * ejercicio. Entrar por el codo —el arranque por defecto— en una sentadilla
 * sería enseñar lo que no viene a cuento.
 */
function articulacionProtagonista(patron: Patron): string | undefined {
  const principales = accionesPrincipales(patron)
  // `accionesPrincipales` ya ordena por rol y por recorrido, así que la primera
  // es la que manda. Se prefiere una que se mueva a una que solo sujete.
  const mueve = principales.find((r) => r.rol === 'motor')
  return (mueve ?? principales[0])?.articulacion.id
}

export function EstudioDelPatron({ patron, datos }: EstudioDelPatronProps) {
  const [vista, setVista] = useState<Vista>('ejercicio')

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex gap-1 rounded-xl border border-ink-500 p-1"
        role="group"
        aria-label="Qué mirar"
      >
        {(
          [
            ['ejercicio', 'El ejercicio'],
            ['articulacion', 'Una articulación'],
          ] as [Vista, string][]
        ).map(([v, texto]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            aria-pressed={vista === v}
            className={`press flex-1 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] ${
              vista === v ? 'bg-ambar/15 text-ambar' : 'text-silver-400'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {/* Se monta una u otra, no las dos ocultas: cada una arranca su propio
          contexto WebGL, y dos a la vez es el doble de trabajo por cuadro en un
          móvil que además está grabando la serie. */}
      {vista === 'ejercicio' ? (
        <VisorPatron patron={patron} datos={datos} />
      ) : (
        <ExploradorAnatomico articulacionInicial={articulacionProtagonista(patron)} />
      )}
    </div>
  )
}
