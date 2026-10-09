import { esHora } from '../../domain/nutricion/pauta'
import type { PlanNutricional, TipoDia } from '../../domain/types'

/**
 * La versión de una sola pantalla: toda la comida de la semana en orden, con
 * botones de texto en vez de iconos — sin pestañas, sin «kcal/P/C/G», sin el
 * botón de intercambios.
 *
 * Mismo `plan` que `MiPlan`, mismo `onRegistrar` (manda al diario ya
 * escrito). Lo único que cambia es cómo se pinta. Pedida por Bryan el
 * 8-oct-2026 para Karin Better.
 */

/** Cómo se le dice a alguien un `TipoDia`, sin la palabra técnica. */
const EN_PALABRAS: Record<TipoDia, string> = {
  ALTO: 'Los días que entrenas',
  BAJO: 'Los días de descanso',
  CHEAT: 'Tu día libre de la semana',
}

export function MiPlanSimple({
  plan,
  onRegistrar,
  onVolver,
}: {
  plan: PlanNutricional
  onRegistrar: (linea: string, tituloComida: string) => void
  onVolver: () => void
}) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver"
          className="press h-9 w-9 shrink-0 rounded-full border border-linea bg-surface-2 text-tenue"
        >
          ←
        </button>
        <h1 className="font-display text-xl text-texto">Lo que comes esta semana</h1>
      </header>

      {plan.menus.map((menu) => (
        <section key={menu.tipoDia} className="flex flex-col gap-2">
          <p className="font-display text-base text-texto">
            {EN_PALABRAS[menu.tipoDia] ?? menu.nombre}
          </p>

          {menu.comidas.map((comida) => (
            <div key={comida.titulo} className="rounded-2xl border border-linea bg-surface-1 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-sm text-texto">{comida.titulo}</h3>
                <span className="cifras shrink-0 text-[11px] text-tenue">{comida.hora}</span>
              </div>

              <ul className="mt-2 flex flex-col gap-2">
                {comida.alimentos
                  .filter((a) => !esHora(a))
                  .map((alimento) => (
                    <li key={alimento} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 text-sm leading-snug text-texto">
                        {alimento}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRegistrar(alimento, comida.titulo)}
                        className="press shrink-0 rounded-full border border-accion/50 bg-accion/10 px-3 py-1.5 text-[12px] font-semibold text-accion"
                      >
                        Ya comí esto
                      </button>
                    </li>
                  ))}
              </ul>

              {comida.nota && (
                <p className="mt-2 text-[11px] leading-snug text-tenue">{comida.nota}</p>
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
    </div>
  )
}
