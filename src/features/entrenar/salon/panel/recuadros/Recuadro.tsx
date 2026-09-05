import { useId, useState, type ReactNode } from 'react'

/**
 * UNA SECCIÓN DE LA HOJA. Antes era una caja; ahora es un tramo.
 *
 * Bajaban doce `rounded-[14px] border border-ink-500 bg-ink-800` apilados: doce tarjetas
 * de aplicación una encima de otra. Bryan lo señaló el 2026-09-03 —«extraído de la
 * aplicación y pegado literal»— y aquí seguía sin tocar. El panel NO es una pared, es un
 * cajón que sube y se lee de cerca, así que la HOJA sí tiene cuerpo; lo que se quita es
 * que cada bloque sea un objeto suelto con su propio marco.
 *
 * Lo que queda: un número corrido, un rótulo serigrafiado y una junta de luz separando
 * tramos. Las tres cosas viven en `tokens.css` bajo `LA HOJA DEL SALÓN`.
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
  /**
   * LA CIFRA DEL TRAMO, a la derecha del título.
   *
   * Nace con los bloques de la Ruta y resuelve un problema suyo: cada uno traía su
   * propia fila de cabecera —título repetido a la izquierda, número a la derecha—, así
   * que quitarle el título repetido dejaba el número huérfano. Sube aquí, y de paso
   * gana algo que antes no tenía: **el número sobrevive al plegado**. Un tramo cerrado
   * seguía diciendo «Cómo llegas esta semana» y nada más; ahora sigue diciendo 88.
   *
   * Va como nodo y no como texto porque el color lo pone el dato —el tono de
   * recuperación es verde, ámbar o plata— y esa decisión no es de la hoja.
   */
  cifra?: ReactNode
  children: ReactNode
}

export function Recuadro({ clave, titulo, pie, cifra, children }: RecuadroProps) {
  const [abierto, setAbierto] = useState(true)
  const idContenido = useId()

  return (
    <section data-recuadro={clave}>
      <h3>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idContenido}
          onClick={() => setAbierto((v) => !v)}
          className="press flex w-full items-baseline gap-3 py-0.5 text-left"
        >
          {/* EL NÚMERO. Es lo único de la cabecera que lleva color de marca, y lleva el
              peso de la jerarquía: en una hoja larga, el número es por dónde vas. Sale de
              un contador de CSS y no de una prop — tres de los doce recuadros son
              condicionales, y un índice pasado desde fuera numeraría 01, 02, 04. */}
          <span
            className="hoja-numero cifras shrink-0 text-[11px] font-bold leading-none text-accion"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase leading-none tracking-[0.22em] text-silver-500">
              {titulo}
            </span>
            {pie && <span className="mt-1.5 block text-[11.5px] leading-snug text-silver-400">{pie}</span>}
          </span>
          {cifra !== undefined && (
            <span className="cifras shrink-0 self-center text-[13px] font-bold leading-none">
              {cifra}
            </span>
          )}
          {/* El acuse de plegado va con MATERIA y no con un semáforo: una flecha que
              gira. `aria-hidden` porque el estado ya lo dice `aria-expanded` del botón;
              anunciarlo dos veces es ruido para quien navega con lector.
              Sin círculo: en la hoja el chevron va suelto, porque una pastilla con borde
              alrededor de cada título son doce pastillas — la caja que se acaba de
              quitar, devuelta por la puerta de atrás. */}
          <span
            aria-hidden="true"
            className="shrink-0 self-center text-silver-500 transition-transform duration-base ease-salida"
            style={{ transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </h3>

      {abierto && (
        <div id={idContenido} className="mt-3">
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
