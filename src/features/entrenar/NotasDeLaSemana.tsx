import type { ItemMarcable } from '../../domain/types'

/**
 * Los comentarios de la semana, con la anatomía de la «ficha forjada» del
 * handoff: panel ink-900, franjas separadas por hairline, eyebrow + display,
 * y cada nota como fila con barra de color a la izquierda.
 *
 * Antes eran un `ItemMarcable` más: casilla, título y una línea gris entre los
 * bloques de cardio. Un aviso que abre el microciclo no es una tarea que se
 * tacha, y puesto entre tareas se lee como una más.
 *
 * El handoff usa volt para el acento; aquí va el rojo Alpha (`--accion`), que
 * es la decisión de marca de este proyecto. La anatomía no cambia.
 */
export function NotasDeLaSemana({ notas }: { notas: ItemMarcable[] }) {
  if (notas.length === 0) return null

  return (
    <section className="overflow-hidden rounded-[20px] border border-ink-500 bg-ink-900 shadow-lg">
      <header className="border-b border-ink-600 bg-gradient-to-b from-white/[.05] to-transparent px-[18px] pb-4 pt-[18px]">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-silver-500">
          Notas de la semana
        </p>
        <h2 className="font-display mt-[7px] text-[21px] font-black leading-[1.04] tracking-[-0.015em] text-silver-100">
          LO QUE HAY QUE
          <br />
          SABER ANTES
        </h2>
      </header>

      {/* La escena en la lista, padre directo de las notas. */}
      <ul className="escena-prof flex flex-col gap-[13px] px-[18px] py-4">
        {notas.map((nota) => (
          <li
            key={nota.id}
            // Cada nota es una PLACA acuñada sobre el panel, no un renglón: es un
            // aviso que abre el microciclo y ya se decidió que no es una tarea que se
            // tacha. `--prof-relieve` es «acuñado sobre la placa: placas
            // secundarias». No es tocable, así que sube sin tocar el mínimo táctil.
            className="relieve-3d rounded-[10px] border border-ink-500 border-l-[3px] border-l-accion bg-ink-700 px-3 py-[10px]"
          >
            <p className="text-[13.5px] font-bold leading-snug text-silver-100">{nota.titulo}</p>
            {nota.indicaciones && (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-silver-400">{nota.indicaciones}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
