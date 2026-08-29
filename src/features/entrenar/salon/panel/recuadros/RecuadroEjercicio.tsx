import type { TextoDePanel } from '../../paredes/contenidoPared'
import type { ItemMarcable } from '../../../../../domain/types'
import { SinDatos } from './Recuadro'

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
}

export function RecuadroEjercicio({ alPanel, bloquesCardio = [] }: RecuadroEjercicioProps) {
  if (alPanel.length === 0 && bloquesCardio.length === 0) {
    return (
      <SinDatos motivo="Todo lo prescrito de este ejercicio cabía entero en las paredes: aquí no queda nada por ampliar." />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {alPanel.map((t) => (
        <article
          key={`${t.campo ?? 'extra'}-${t.huella}`}
          data-huella={t.huella}
          data-campo={t.campo}
          className="rounded-[10px] border border-ink-500 bg-ink-700 px-3 py-2.5"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-silver-500">
            {t.titulo}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-silver-200">{t.texto}</p>
        </article>
      ))}

      {bloquesCardio.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-silver-500">
            Los bloques de la sesión
          </p>
          <ul className="flex flex-col gap-2">
            {bloquesCardio.map((b) => (
              <li
                key={b.id}
                className="rounded-[10px] border border-ink-500 border-l-[3px] border-l-accion bg-ink-700 px-3 py-2.5"
              >
                <p className="text-[12.5px] font-bold leading-snug text-silver-100">{b.titulo}</p>
                {b.indicaciones && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-silver-400">
                    {b.indicaciones}
                  </p>
                )}
                {b.duracionMin !== undefined && (
                  <p className="cifras mt-1.5 text-[11px] text-silver-500">{b.duracionMin} min</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
