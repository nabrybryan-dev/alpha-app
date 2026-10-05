import { leerPlanLegible } from '../../../../domain/consolaCoach/planLegible'
import { adherenciaPorMicrociclo, fechaCorta, tablaDelPlan } from '../../../../domain/consolaCoach/perfilCompleto'
import { GraficaBarras } from '../graficas'
import { Esqueleto, Falta, Tarjeta } from '../piezas'
import type { DatosPersona } from '../usePersona'

/**
 * El plan estratégico vigente, legible: objetivo, métrica, horizonte, la tabla de
 * microciclos con la fila del actual resaltada, y sus reglas.
 */
export function SeccionPlanEstrategico({ datos, i, className = '' }: { datos: DatosPersona; i: number; className?: string }) {
  const { plan } = datos

  if (plan.estado === 'cargando') {
    return (
      <Tarjeta titulo="Plan estratégico" i={i} className={className}>
        <Esqueleto lineas={4} />
      </Tarjeta>
    )
  }

  if (plan.estado === 'fallo' || !plan.valor) {
    return (
      <Tarjeta titulo="Plan estratégico" i={i} className={className}>
        <p className="text-sm text-tenue">Sin plan estratégico vigente todavía.</p>
        <p className="mt-1 text-[11.5px] text-tenue">
          Lo escribe la cadena (paso ② Planificación) en planes_estrategicos y llega con la sincronización de cada 20 min.
        </p>
      </Tarjeta>
    )
  }

  const p = plan.valor
  const legible = leerPlanLegible(p.contenido)
  const tabla = tablaDelPlan(p.contenido, datos.activo?.numero)
  const filaActual = tabla?.filas.find((f) => f.actual)

  return (
    <Tarjeta
      titulo={`Plan estratégico · versión ${p.version}`}
      i={i}
      className={className}
      extra={<span className="text-[11px] text-tenue">Creado {p.creadoEn.slice(0, 10)}</span>}
    >
      {legible.objetivo && <p className="text-[15px] font-bold leading-snug text-texto">{legible.objetivo}</p>}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-tenue">
        {legible.metricaPrincipal && <span>Métrica principal: {legible.metricaPrincipal}</span>}
        {legible.horizonte && <span>Horizonte: {legible.horizonte}</span>}
      </div>

      {tabla && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-linea">
          <table className="w-full min-w-[560px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="bg-surface-2 text-[10px] uppercase tracking-wider text-tenue">
                {tabla.cabecera.map((c) => (
                  <th key={c} className="px-2.5 py-1.5 font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((f) => (
                <tr
                  key={f.numero}
                  aria-current={f.actual ? 'true' : undefined}
                  className={`border-t border-linea align-top transition-colors duration-base ${
                    f.actual ? 'bg-rojo/10 font-bold text-texto shadow-[inset_3px_0_0_rgb(var(--rojo-rgb))]' : 'text-texto/85 hover:bg-surface-2'
                  }`}
                >
                  {f.celdas.map((celda, n) => (
                    <td key={n} className="px-2.5 py-1.5">
                      {celda || <span className="text-tenue">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tabla && (
        <p className="mt-1.5 text-[11px] text-tenue">
          {filaActual
            ? `Resaltada la fila del microciclo en curso (M${filaActual.numero}).`
            : datos.activo
              ? `El microciclo en curso (M${datos.activo.numero}) no tiene fila en este plan.`
              : 'Sin microciclo activo que resaltar.'}
        </p>
      )}

      {legible.reglas.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-linea pt-2.5 text-[13px]">
          {legible.reglas.map((regla, n) => (
            <li key={n} className="flex gap-2 text-texto/90">
              <span className="cifras mt-0.5 shrink-0 text-[10.5px] font-bold text-rojo">R{n + 1}</span>
              <span>{regla}</span>
            </li>
          ))}
        </ul>
      )}
      {legible.reglasDerogadas.length > 0 && (
        <details className="mt-2 text-xs text-tenue">
          <summary className="cursor-pointer font-bold">Reglas derogadas ({legible.reglasDerogadas.length})</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {legible.reglasDerogadas.map((regla, n) => (
              <li key={n}>{regla}</li>
            ))}
          </ul>
        </details>
      )}
      {!legible.reconocido && !tabla && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-2 text-[11px] text-tenue">
          {JSON.stringify(p.contenido, null, 2)}
        </pre>
      )}
    </Tarjeta>
  )
}

/** Adherencia de cada microciclo: una barra por semana, la actual resaltada. */
export function SeccionAdherenciaHistorial({ datos, i, className = '' }: { datos: DatosPersona; i: number; className?: string }) {
  const { historial } = datos
  return (
    <Tarjeta titulo="Adherencia por semana" i={i} className={className}>
      {historial.estado === 'cargando' ? (
        <Esqueleto alto={132} />
      ) : (
        (() => {
          const lista = adherenciaPorMicrociclo(historial.estado === 'listo' ? historial.valor : [])
          if (lista.length === 0) {
            return (
              <Falta
                que="Sin microciclos que medir"
                como="La adherencia sale de las sesiones registradas de cada microciclo; llega con la primera semana cargada."
              />
            )
          }
          const ultimas = lista.slice(-12)
          const media = Math.round(ultimas.reduce((s, m) => s + m.pct, 0) / ultimas.length)
          return (
            <>
              <GraficaBarras
                barras={ultimas.map((m) => ({
                  clave: m.id,
                  etiqueta: `M${m.numero}`,
                  valor: m.pct,
                  destacada: m.estado === 'activo',
                  titulo: `M${m.numero} · desde ${m.fechaInicio} · ${m.registradas} de ${m.totales} sesiones (${m.pct} %)`,
                }))}
                maximo={100}
                sufijo="%"
                descripcion={`Adherencia de los últimos ${ultimas.length} microciclos; media ${media} %.`}
              />
              <p className="mt-2 text-[11px] text-tenue">
                Media de {ultimas.length} microciclo{ultimas.length === 1 ? '' : 's'}: <span className="cifras font-bold text-texto">{media} %</span>
                {' · '}desde {fechaCorta(ultimas[0].fechaInicio)}. Una sesión cuenta si está registrada entera.
              </p>
            </>
          )
        })()
      )}
    </Tarjeta>
  )
}
