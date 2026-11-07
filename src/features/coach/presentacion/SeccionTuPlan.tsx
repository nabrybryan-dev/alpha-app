import { useMemo } from 'react'
import type { PlanEstrategico } from '../../../data/consola/planesEstrategicos'
import { sinMarkdown, tablaDelPlan } from '../../../domain/consolaCoach/perfilCompleto'
import { leerPlanLegible } from '../../../domain/consolaCoach/planLegible'
import { nombreDelMicrociclo } from '../../../domain/palabrasLlanas'
import { mapaDelPlan } from '../../../domain/presentacionAsesorado'
import type { EstadoDato } from '../consola/datoConsola'
import { Esqueleto } from '../consola/piezas'

interface Props {
  plan: EstadoDato<PlanEstrategico | null>
  /** La semana que de verdad está en curso; `undefined` si la persona aún no empieza. */
  numeroActual: number | undefined
}

/**
 * TU PLAN: la estrategia completa de una sola vez, para presentarla en la llamada: objetivo, cómo
 * se mide el avance, fechas y todas las semanas abiertas, sin tocar casilla por casilla.
 *
 * Las reglas van plegadas: están escritas para el equipo, y quien presenta decide cuándo abrirlas.
 * Lee las mismas funciones que el mapa y la ficha, así que las tres pantallas dicen lo mismo.
 */
export function SeccionTuPlan({ plan, numeroActual }: Props) {
  const valor = plan.estado === 'listo' ? plan.valor : null
  const { legible, semanas } = useMemo(() => {
    if (!valor) return { legible: undefined, semanas: [] }
    return {
      legible: leerPlanLegible(valor.contenido),
      semanas: mapaDelPlan(tablaDelPlan(valor.contenido, numeroActual), numeroActual, undefined),
    }
  }, [valor, numeroActual])

  if (plan.estado === 'cargando') return <Esqueleto lineas={3} />
  if (!legible) {
    return <p className="text-[15px] text-tenue">Todavía no hay un plan de largo plazo cargado para mostrar.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-3">
        {legible.objetivo && <Dato titulo="Objetivo" texto={legible.objetivo} destacado />}
        {legible.metricaPrincipal && <Dato titulo="Cómo medimos el avance" texto={legible.metricaPrincipal} />}
        {legible.horizonte && <Dato titulo="Fechas" texto={legible.horizonte} />}
      </dl>

      {semanas.length === 0 ? (
        <p className="text-[15px] text-tenue">El plan está cargado, pero todavía no trae el detalle semana a semana.</p>
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Cómo se desarrolla el plan">
          {semanas.map((s) => (
            <li
              key={s.numero}
              className={`rounded-2xl border bg-surface-2 p-4 ${s.situacion === 'actual' ? 'border-rojo' : 'border-linea'}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-display text-[17px] leading-tight text-texto">{nombreDelMicrociclo(s.numero, true)}</p>
                {s.situacion === 'actual' && (
                  <span className="rounded-full bg-rojo px-2.5 py-0.5 text-xs font-bold text-white">la de ahora</span>
                )}
              </div>
              {s.detalle.length > 0 && (
                <dl className="mt-2 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
                  {s.detalle.map((d) => (
                    <Dato key={d.titulo} titulo={d.titulo} texto={d.texto} />
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ol>
      )}

      {legible.reglas.length > 0 && (
        <details className="rounded-2xl border border-linea bg-surface-2">
          <summary className="flex min-h-[44px] cursor-pointer items-center px-4 py-2 text-[15px] font-bold text-texto">
            Reglas del plan ({legible.reglas.length})
          </summary>
          <ol className="flex flex-col gap-2 border-t border-linea px-4 py-3">
            {legible.reglas.map((regla, n) => (
              <li key={n} className="flex gap-2 text-[14px] leading-snug text-texto">
                <span className="cifras mt-0.5 shrink-0 text-xs font-bold text-rojo">{n + 1}</span>
                <span>{sinMarkdown(regla)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function Dato({ titulo, texto, destacado = false }: { titulo: string; texto: string; destacado?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-tenue">{titulo}</dt>
      <dd className={`leading-snug text-texto ${destacado ? 'text-[17px] font-bold' : 'text-[15px]'}`}>{texto}</dd>
    </div>
  )
}
