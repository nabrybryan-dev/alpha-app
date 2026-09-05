import type { TextoDePanel } from '../../paredes/contenidoPared'
import type { EjercicioPrescrito, ItemMarcable } from '../../../../../domain/types'
import { SinDatos } from './Recuadro'
import { lecturaDeLaPrescripcion, type LecturaDePrescripcion } from '../lecturaDeLaPrescripcion'
import { LecturaLarga } from './LecturaLarga'

/**
 * LO QUE LAS PAREDES NO PUDIERON LLEVAR, íntegro.
 *
 * `contenidoPared()` reparte cada campo del ejercicio en dos: la versión de pared, de 42
 * caracteres o menos, y —si el original no cabía— el texto COMPLETO, que baja aquí. Este
 * recuadro es el otro extremo de esa invariante. Sin él, recortar a 42 caracteres sería
 * tirar texto; con él, es solo moverlo a un dedo de distancia.
 *
 * Aquí no se recorta NADA y no hay tope: es el único hueco del salón con `topeDeTexto: 0`
 * y esa es su razón de ser. Si alguna vez aparece un `slice`, un `line-clamp` o un
 * `truncate` en este archivo, el salón habrá empezado a perder información.
 *
 * ## La huella, a la vista
 *
 * Cada texto sale con su `data-huella`. Es la huella FNV-1a que `contenidoPared()` ya
 * calculó, y está en el DOM para que se pueda comprobar desde fuera —sin leer los
 * textos, sin comparar prosa— que el conjunto que entró es el conjunto que se pintó.
 * Comparar dos listas de huellas dice si algo desapareció por el camino; leer doce
 * párrafos a ojo, no.
 */
export interface RecuadroEjercicioProps {
  /**
   * El ejercicio en curso. De él sale LA LECTURA LARGA: las cuatro prescripciones con su
   * qué, su por qué y su señal.
   *
   * Va antes que `alPanel` y no lo sustituye. Son dos cosas distintas: `alPanel` es el
   * texto ÍNTEGRO que la pared tuvo que recortar —lo que hace honesto el recorte— y la
   * lectura es lo que alguien baja a buscar entre series. Sin la primera, recortar sería
   * perder; sin la segunda, el panel es un sobrante.
   */
  ejercicio?: EjercicioPrescrito
  /** Los textos completos que `contenidoPared()` mandó abajo. */
  alPanel: readonly TextoDePanel[]
  /**
   * Los bloques de cardio de la sesión, cuando es metabólica.
   *
   * No pasan por `contenidoPared()` —no son un ejercicio prescrito, son `ItemMarcable`—
   * pero son el contenido íntegro de una sesión sin sujeto, y en el salón sin sujeto las
   * paredes solo pueden llevar el titular. Van enteros aquí por el mismo motivo que todo
   * lo demás.
   */
  bloquesCardio?: readonly ItemMarcable[]
  /** La prescripción que el asesorado tocó en el salón. Sube a primera fila. */
  foco?: LecturaDePrescripcion['id']
}

export function RecuadroEjercicio({
  ejercicio,
  alPanel,
  bloquesCardio = [],
  foco,
}: RecuadroEjercicioProps) {
  const lecturas = lecturaDeLaPrescripcion(ejercicio)

  if (lecturas.length === 0 && alPanel.length === 0 && bloquesCardio.length === 0) {
    return (
      <SinDatos motivo="Todo lo prescrito de este ejercicio cabía entero en las paredes: aquí no queda nada por ampliar." />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* LO PRIMERO: las cuatro prescripciones explicadas. Es a lo que se baja. */}
      <LecturaLarga lecturas={lecturas} foco={foco} />

      {/* SIN CAJAS DENTRO DE LA CAJA.
          =============================================================================
          Cada texto era un `rounded-[10px] border border-ink-500 bg-ink-700`: tarjetas
          dentro del recuadro, que a su vez era una tarjeta. Tres marcos para leer un
          párrafo. Aquí es lo que es —un rótulo y su texto— con aire entre ellos: el
          espacio dice dónde acaba uno, que es lo que hacía el borde y sin cobrar peso
          visual. Es la misma regla de la hoja, un nivel más adentro. */}
      {alPanel.map((t) => (
        <article
          key={`${t.campo ?? 'extra'}-${t.huella}`}
          data-huella={t.huella}
          data-campo={t.campo}
        >
          <p className="text-[9.5px] font-bold uppercase leading-none tracking-[0.22em] text-silver-500">
            {t.titulo}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-silver-200">{t.texto}</p>
        </article>
      ))}

      {bloquesCardio.length > 0 && (
        <div>
          <p className="text-[9.5px] font-bold uppercase leading-none tracking-[0.22em] text-silver-500">
            Los bloques de la sesión
          </p>
          {/* El bloque se marca con su NÚMERO en rojo, no con un filete de acento a la
              izquierda. Un contenedor redondeado con una barra de color al costado es el
              tic visual más repetido que hay, y además el número informa: dice por cuál
              vas. La barra solo decoraba. */}
          <ol className="mt-3 flex flex-col gap-3.5">
            {bloquesCardio.map((b, i) => (
              <li key={b.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="cifras shrink-0 pt-[1px] text-[11px] font-bold leading-none text-accion"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold leading-snug text-silver-100">
                    {b.titulo}
                  </span>
                  {b.indicaciones && (
                    <span className="mt-1.5 block text-[12.5px] leading-relaxed text-silver-400">
                      {b.indicaciones}
                    </span>
                  )}
                  {b.duracionMin !== undefined && (
                    <span className="cifras mt-1.5 block text-[11px] text-silver-500">
                      {b.duracionMin} min
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
