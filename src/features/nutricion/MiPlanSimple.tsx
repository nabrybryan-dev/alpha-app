import { esHora } from '../../domain/nutricion/pauta'
import type { MenuDia, PlanNutricional } from '../../domain/types'

/**
 * La versión de una sola pantalla: toda la comida de la semana en orden, con
 * botones de texto en vez de iconos — sin pestañas, sin «kcal/P/C/G», sin el
 * botón de intercambios por alimento.
 *
 * Mismo `plan` que `MiPlan`, mismo `onRegistrar` (manda al diario ya
 * escrito). Lo único que cambia es cómo se pinta. Pedida por Bryan el
 * 8-oct-2026 para Karin Better.
 *
 * Qué trae y qué no:
 * - Cada bloque se titula con lo que el PLAN dice (`menu.nombre`, o la
 *   etiqueta del día del plan, o «Menú N»). La primera versión traducía el
 *   tipo de día con un diccionario fijo y rotuló al revés el plan real de
 *   Karin: su CHEAT es un «REFEED · domingo (mantenimiento)» que NO es un día
 *   libre, y su BAJO incluye el jueves, que sí entrena. La app no decide qué
 *   significa un tipo de día.
 * - El botón de cada alimento dice «Anotar» porque eso hace: abre el buscador
 *   del diario con el alimento escrito; quien confirma es la persona. «Ya comí
 *   esto» prometía un registro que no ocurría.
 * - Al simplificar se quedaron fuera el mercado, los suplementos y el cambio de
 *   un alimento que no se tiene. Para que no sean un callejón, el pie lleva una
 *   salida a la vista completa (`onVerCompleto`), que `MiPlan` resuelve.
 */

/**
 * Lo que dice el plan sobre este bloque, en orden de preferencia: el nombre del
 * menú; si está vacío, la etiqueta de su tipo de día; y si tampoco, un texto
 * neutro por posición, que no afirma nada sobre entrenar ni descansar.
 */
function tituloDelMenu(plan: PlanNutricional, menu: MenuDia, posicion: number): string {
  // `?.` aunque el tipo diga `string`: el plan viaja como jsonb y uno cargado a mano puede
  // traer el menú sin nombre; eso es «vacío», no un error que tumbe la pantalla.
  const nombre = menu.nombre?.trim()
  if (nombre) return nombre
  const etiqueta = plan.etiquetasDia?.[menu.tipoDia]?.trim()
  if (etiqueta) return etiqueta
  return `Menú ${posicion + 1}`
}

export function MiPlanSimple({
  plan,
  onRegistrar,
  onVolver,
  onVerCompleto,
}: {
  plan: PlanNutricional
  onRegistrar: (linea: string, tituloComida: string) => void
  onVolver: () => void
  /** Abre la vista completa (mercado, suplementos, cambios de alimentos). */
  onVerCompleto: () => void
}) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver"
          className="press h-11 w-11 shrink-0 rounded-full border border-linea bg-surface-2 text-tenue"
        >
          ←
        </button>
        <h1 className="font-display text-xl text-texto">Lo que comes esta semana</h1>
      </header>

      {plan.menus.map((menu, posicion) => (
        <section key={menu.tipoDia} className="flex flex-col gap-2">
          <p className="font-display text-base text-texto">{tituloDelMenu(plan, menu, posicion)}</p>

          {menu.comidas.map((comida) => (
            <div key={comida.titulo} className="rounded-2xl border border-linea bg-surface-1 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-sm text-texto">{comida.titulo}</h3>
                <span className="cifras shrink-0 text-xs text-tenue">{comida.hora}</span>
              </div>

              <ul className="mt-2 flex flex-col gap-2">
                {comida.alimentos
                  .filter((a) => !esHora(a))
                  .map((alimento) => (
                    <li key={alimento} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 text-sm leading-snug text-texto">
                        {alimento}
                      </span>
                      {/* El alimento va en el nombre accesible: con 50 botones que solo dicen
                          «Anotar», un lector de pantalla no distingue uno de otro. */}
                      <button
                        type="button"
                        onClick={() => onRegistrar(alimento, comida.titulo)}
                        aria-label={`Anotar ${alimento}`}
                        className="press min-h-[44px] shrink-0 rounded-full border border-accion/50 bg-accion/10 px-4 text-xs font-semibold text-accion"
                      >
                        Anotar
                      </button>
                    </li>
                  ))}
              </ul>

              {comida.nota && (
                <p className="mt-2 text-xs leading-snug text-tenue">{comida.nota}</p>
              )}
            </div>
          ))}
        </section>
      ))}

      {plan.seccionesEspeciales.map((especial) => (
        <section key={especial.titulo} className="rounded-2xl border border-linea bg-surface-1 p-4">
          <h2 className="font-display text-base text-texto">{especial.titulo}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-tenue">
            {especial.contenido}
          </p>
        </section>
      ))}

      <button
        type="button"
        onClick={onVerCompleto}
        className="press min-h-[44px] self-center px-3 text-sm font-semibold text-accion underline underline-offset-4"
      >
        Ver mercado, suplementos y cambios de alimentos
      </button>
    </div>
  )
}
