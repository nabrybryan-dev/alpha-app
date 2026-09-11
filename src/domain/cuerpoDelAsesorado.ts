import { estaturaVigente } from './patrones/estatura'
import type { ProporcionesDelCuerpo } from './patrones/huellaArticular'
import type { Microciclo, Perfil } from './types'

/**
 * CÓMO ES EL CUERPO DE ESTA PERSONA, en un solo sitio.
 *
 * El sujeto del salón dejó de ser el del atlas en dos pasos, y cada uno saca su dato de un
 * lado distinto de la app:
 *
 * - **El TAMAÑO**, de la ficha: `alturaCm` de la medida más reciente. Está en centímetros y
 *   lo tomó alguien con una cinta, así que es el único número en metros que hay.
 * - **LAS PROPORCIONES**, de sus vídeos: la pista de pose que el encoder importa trae los
 *   puntos en píxeles, y de ahí salen las razones entre segmentos (`proporcionesDePista`).
 *   Sin escala, que es lo que las hace utilizables: una razón vale igual en píxeles que en
 *   metros.
 *
 * Los dos son opcionales por separado y eso importa: con estatura y sin proporciones el
 * muñeco tiene su talla con la forma del atlas; con las dos, tiene su cuerpo; sin ninguna,
 * es el de siempre. **Ninguno se rellena con una estimación cuando falta.**
 *
 * ## De dónde salen las proporciones, y por qué se busca en las series
 *
 * Porque la pista de pose NO se guarda: se importa, se lee y se tira. Lo único que queda de
 * ella es la huella, y la huella vive dentro de la medición de una serie. Así que para
 * saber cómo es el cuerpo de alguien hay que ir a mirar sus series.
 *
 * Se toma la ÚLTIMA que traiga proporciones, no la primera ni un promedio, por lo mismo que
 * con la estatura: lo que hay que dibujar es lo último que se sabe de la persona. Y se
 * recorre en el orden en que están —microciclos por número, sesiones y series por su
 * orden—, que es el orden en que ocurrieron.
 */

/** Lo que hace falta para dibujar a alguien: su talla y su forma. Los dos pueden faltar. */
export interface CuerpoDelAsesorado {
  estaturaCm?: number
  proporciones?: ProporcionesDelCuerpo
}

/**
 * Las proporciones más recientes que alguien haya dejado en una serie medida.
 *
 * `undefined` cuando nadie ha importado una pista suya, que hoy es lo normal: casi nadie
 * graba. No es «proporciones normales» — es que no se sabe, y entonces el muñeco conserva
 * la forma del atlas.
 */
export function proporcionesDeSusSeries(
  microciclos: readonly Microciclo[] | undefined,
): ProporcionesDelCuerpo | undefined {
  let ultima: ProporcionesDelCuerpo | undefined
  for (const micro of [...(microciclos ?? [])].sort((a, b) => a.numero - b.numero)) {
    for (const sesion of micro.sesiones ?? []) {
      for (const ejercicio of sesion.ejercicios ?? []) {
        for (const serie of ejercicio.series ?? []) {
          const p = serie.velocidad?.huella?.proporciones
          if (p) ultima = p
        }
      }
    }
  }
  return ultima
}

/** El cuerpo de una persona: lo que la ficha sabe de su talla y lo que sus vídeos saben de su forma. */
export function cuerpoDelAsesorado(
  perfil: Perfil | undefined,
  microciclos: readonly Microciclo[] | undefined,
): CuerpoDelAsesorado {
  return {
    estaturaCm: estaturaVigente(perfil?.medidas),
    proporciones: proporcionesDeSusSeries(microciclos),
  }
}
