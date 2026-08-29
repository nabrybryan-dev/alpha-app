import { useId, useState, type ReactNode } from 'react'

/**
 * EL RECUADRO: la caja en la que baja al panel cada uno de los bloques de la Ruta.
 *
 * Es una sola pieza y hace una sola cosa, pero esa cosa es la que sostiene una regla del
 * encargo: **cada recuadro lleva al menos un elemento interactivo real**. Aquí no es una
 * promesa que haya que ir comprobando bloque a bloque —y que se rompería el día que
 * alguien añada el recuadro trece—, es estructura: el título ES un `<button>` con
 * `aria-expanded` que pliega y despliega el recuadro. Un bloque que se monte dentro de
 * este armazón no puede quedarse en texto muerto.
 *
 * ## Por qué nace abierto
 *
 * `abiertoPorDefecto` vale `true` y no se pone a `false` en ninguna llamada. El panel es
 * el sitio donde vive ÍNTEGRO lo que las paredes recortaron: si los recuadros nacieran
 * plegados, abrir el panel enseñaría doce títulos y ninguna información, que es perder
 * el texto de la forma más silenciosa posible —está en el código, no en la pantalla—.
 * Plegar es una comodidad de quien ya leyó, no el estado de partida.
 *
 * ## `data-recuadro`
 *
 * Cada recuadro se marca con la clave del bloque de la Ruta del que viene. Es lo que
 * permite comprobar desde fuera, sin leer los textos, que los doce bloques siguen ahí.
 */
export interface RecuadroProps {
  /** La clave del bloque de la Ruta que baja aquí. Sale a la marca `data-recuadro`. */
  clave: string
  /** El encabezado. Es el texto del botón que pliega. */
  titulo: string
  /** Una línea de contexto bajo el título. Opcional. */
  pie?: string
  children: ReactNode
}

export function Recuadro({ clave, titulo, pie, children }: RecuadroProps) {
  const [abierto, setAbierto] = useState(true)
  const idContenido = useId()

  return (
    <section
      data-recuadro={clave}
      className="overflow-hidden rounded-[14px] border border-ink-500 bg-ink-800"
    >
      <h3>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idContenido}
          onClick={() => setAbierto((v) => !v)}
          className="press flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-silver-500">
              {titulo}
            </span>
            {pie && <span className="mt-1 block text-[11px] text-silver-400">{pie}</span>}
          </span>
          {/* El acuse de plegado va con MATERIA y no con un semáforo: una flecha que
              gira. `aria-hidden` porque el estado ya lo dice `aria-expanded` del botón;
              anunciarlo dos veces es ruido para quien navega con lector. */}
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink-400 text-silver-400 transition-transform duration-base ease-salida"
            style={{ transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </h3>

      {abierto && (
        <div id={idContenido} className="border-t border-ink-600 px-3.5 py-3.5">
          {children}
        </div>
      )}
    </section>
  )
}

/**
 * Lo que se pinta cuando un bloque no tiene nada que decir HOY.
 *
 * Los bloques de la Ruta se borran solos cuando les faltan datos: `CompetenciasEvaluadas`
 * devuelve `null` sin valoraciones, `RequisitosNivel` sin siguiente nivel, `NotasDeLaSemana`
 * sin notas. En una columna con scroll eso se lee como que la sección no existe. En el
 * panel se leería como que la información se PERDIÓ al mudarse al salón, que es justo la
 * acusación que este trabajo no puede permitirse.
 *
 * Así que el recuadro se queda y dice por qué está vacío. Es la diferencia entre «aquí no
 * hay nada» y «esto no se ve porque no hay de dónde sacarlo».
 */
export function SinDatos({ motivo }: { motivo: string }) {
  return <p className="text-[12px] leading-relaxed text-silver-400">{motivo}</p>
}
