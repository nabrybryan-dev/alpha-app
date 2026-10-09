import { useId, useMemo, useState } from 'react'
import type { PlanEstrategico } from '../../../data/consola/planesEstrategicos'
import { tablaDelPlan } from '../../../domain/consolaCoach/perfilCompleto'
import { leerPlanLegible } from '../../../domain/consolaCoach/planLegible'
import { nombreDelMicrociclo } from '../../../domain/palabrasLlanas'
import { mapaDelPlan, type SituacionCasilla } from '../../../domain/presentacionAsesorado'
import type { EstadoDato } from '../consola/datoConsola'
import { Esqueleto } from '../consola/piezas'
import { RespaldoSiFalla } from './RespaldoSiFalla'
import { VistaWebGLMapa } from './VistaWebGLMapa'
import { useModoDeEscena } from './webgl'

interface Props {
  plan: EstadoDato<PlanEstrategico | null>
  /** El número del microciclo en curso, si lo hay. */
  numeroActual: number | undefined
  /** El número del último microciclo cerrado: hasta ahí llega «hecho» si no hay uno en curso. */
  ultimoCerrado: number | undefined
}

const TEXTO_SITUACION: Record<SituacionCasilla, string> = {
  hecha: 'ya pasó',
  actual: 'es esta, la de ahora',
  viene: 'viene',
}

const ESTILO_CASILLA: Record<SituacionCasilla, string> = {
  hecha: 'border-linea bg-surface-3 text-texto',
  actual: 'border-rojo bg-rojo text-white shadow-halo',
  viene: 'border-dashed border-linea bg-transparent text-tenue',
}

/**
 * EL MAPA DEL PLAN: todos los microciclos del plan estratégico vigente como una rejilla de
 * casillas numeradas — las que ya pasaron, la de ahora (resaltada) y las que vienen. Al
 * tocar una se abre debajo lo que el plan dice de ella: las columnas de su fila, tal cual
 * las escribe el coach (con el Markdown ya quitado por `tablaDelPlan`, el mismo lector que
 * usa la ficha de la consola).
 *
 * Sin plan vigente lo dice en una frase y no se rompe.
 */
export function SeccionMapaDelPlan({ plan, numeroActual, ultimoCerrado }: Props) {
  const [abierta, setAbierta] = useState<number | null>(null)
  const idDetalle = useId()
  const { modo, avisarFallo } = useModoDeEscena()

  const valor = plan.estado === 'listo' ? plan.valor : null
  const { casillas, objetivo } = useMemo(() => {
    if (!valor) return { casillas: [], objetivo: undefined }
    return {
      casillas: mapaDelPlan(tablaDelPlan(valor.contenido, numeroActual), numeroActual, ultimoCerrado),
      objetivo: leerPlanLegible(valor.contenido).objetivo,
    }
  }, [valor, numeroActual, ultimoCerrado])

  if (plan.estado === 'cargando') return <Esqueleto lineas={3} />

  if (!valor) {
    return <p className="text-[15px] text-tenue">Todavía no hay un plan de largo plazo cargado para mostrar.</p>
  }

  const elegida = casillas.find((c) => c.numero === abierta)

  const alternar = (numero: number) => setAbierta(abierta === numero ? null : numero)

  /** La rejilla de casillas de siempre: es el mapa sin WebGL, el respaldo si la 3D falla y la lista plegada de la 3D. */
  const rejilla = (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-5 gap-2 min-[440px]:grid-cols-6 sm:grid-cols-8" aria-label="Las semanas del plan">
        {casillas.map((c, i) => (
          <li key={c.numero}>
            <button
              type="button"
              aria-pressed={abierta === c.numero}
              aria-current={c.situacion === 'actual' ? 'step' : undefined}
              aria-controls={idDetalle}
              aria-label={`${nombreDelMicrociclo(c.numero, true)}, ${TEXTO_SITUACION[c.situacion]}`}
              onClick={() => alternar(c.numero)}
              className={`pres-entra cifras flex h-11 w-full items-center justify-center rounded-boton border text-sm font-bold ${ESTILO_CASILLA[c.situacion]} ${
                abierta === c.numero ? 'ring-2 ring-texto ring-offset-2 ring-offset-surface-1' : ''
              }`}
              style={{ animationDelay: `${Math.min(i, 30) * 25}ms` }}
            >
              {c.numero}
            </button>
          </li>
        ))}
      </ul>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tenue">
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-surface-3 align-middle" aria-hidden="true" />
          ya pasó
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rojo align-middle" aria-hidden="true" />
          la de ahora
        </span>
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-tenue align-middle" aria-hidden="true" />
          viene
        </span>
      </p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {objetivo && <p className="text-[15px] font-bold leading-snug text-texto">{objetivo}</p>}

      {casillas.length === 0 ? (
        <p className="text-[15px] text-tenue">El plan está cargado, pero todavía no trae el detalle semana a semana.</p>
      ) : (
        <>
          {modo === '3d' ? (
            <RespaldoSiFalla respaldo={rejilla} alFallar={avisarFallo}>
              <VistaWebGLMapa casillas={casillas} abierta={abierta} onElegir={alternar} onFallo={avisarFallo} rejilla={rejilla} />
            </RespaldoSiFalla>
          ) : (
            rejilla
          )}

          <div id={idDetalle} aria-live="polite">
            {elegida ? (
              <div key={elegida.numero} className="pres-entra rounded-2xl border border-linea bg-surface-2 p-4">
                <p className="kicker !text-[12px]">
                  {nombreDelMicrociclo(elegida.numero, true)} · {TEXTO_SITUACION[elegida.situacion]}
                </p>
                {elegida.detalle.length === 0 ? (
                  <p className="mt-2 text-sm text-tenue">El plan no escribió nada para esta semana.</p>
                ) : (
                  <dl className="mt-2 flex flex-col gap-2">
                    {elegida.detalle.map((d) => (
                      <div key={d.titulo}>
                        <dt className="text-xs font-bold uppercase tracking-wide text-tenue">{d.titulo}</dt>
                        <dd className="text-[15px] leading-snug text-texto">{d.texto}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ) : (
              <p className="text-sm text-tenue">Toca una semana para ver lo que dice el plan.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
