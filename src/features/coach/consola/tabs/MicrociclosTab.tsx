import { useState, type CSSProperties } from 'react'
import { Badge } from '../../../../components/ui/Badge'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { esAlFallo } from '../../../../domain/objetivoDeIntensidad'
import { armarSemana } from '../../../../domain/rutaEntrenamiento'
import type { Sesion } from '../../../../domain/types'
import { adherenciaPorMicrociclo, fechaCorta, tablaDelPlan } from '../../../../domain/consolaCoach/perfilCompleto'
import { SeccionAdherenciaHistorial } from '../ficha/SeccionPlan'
import { Esqueleto, Falta, Tarjeta } from '../piezas'
import { usePersona } from '../usePersona'

/**
 * Módulo 4: la semana vigente (cuadrícula de siete días), lo que el plan estratégico
 * pide para ESTA semana, y el historial de microciclos con su adherencia. Solo para ver:
 * «pedir semana», «editar antes de publicar» y «crear a mano» escriben y no son de esta
 * fase (DISENO-CONSOLA-V2.md §2.4).
 */
/**
 * LA RUTINA DEL DÍA (Bryan, 2026-10-15: «vemos los días de entrenamiento pero no las rutinas»).
 * Lo pautado de cada ejercicio, lo que la persona ya anotó al lado, y el cardio con sus
 * indicaciones. Solo lectura: desde la consola no se cambia nada del plan.
 */
function RutinaDelDia({ sesion, etiqueta }: { sesion: Sesion | undefined; etiqueta: string }) {
  return (
    <section aria-label={`Rutina del ${etiqueta}`} className="mt-3 rounded-tarjeta border border-linea bg-surface-2 p-3">
      {!sesion ? (
        <p className="text-sm italic text-tenue">Descanso: este día no tiene sesión.</p>
      ) : (
        <>
          <p className="text-sm font-bold text-texto">{sesion.nombre}</p>
          {sesion.ejercicios.length > 0 && (
            <ol className="mt-2 flex flex-col gap-2">
              {sesion.ejercicios.map((e) => {
                const objetivo = esAlFallo(e.rirObjetivo) ? 'al fallo' : `RIR ${e.rirObjetivo}`
                const kg = e.cargaKg !== undefined && e.cargaKg !== null ? ` · ${e.cargaKg} kg` : ''
                const reps = e.rango || e.repsDiana
                return (
                  <li key={e.id} className="border-t border-linea/60 pt-2 first:border-0 first:pt-0">
                    <p className="text-[13px] font-bold text-texto">{e.nombre}</p>
                    <p className="text-[12px] text-tenue">
                      {e.sets} series · {reps} reps{kg} · {objetivo}
                    </p>
                    {e.series.length > 0 && (
                      <ul className="mt-0.5 flex flex-col text-[12px] text-verde">
                        {e.series.map((s) => (
                          <li key={s.orden}>
                            Anotado: {s.cargaKg} kg × {s.reps ?? '—'}
                            {s.rir !== undefined ? ` · RIR ${s.rir}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          {(sesion.bloquesCardio ?? []).length > 0 && (
            <ul className="mt-2 flex flex-col gap-2 border-t border-linea pt-2">
              {(sesion.bloquesCardio ?? []).map((b, n) => (
                <li key={b.id || n}>
                  <p className="text-[13px] font-bold text-texto">
                    {b.titulo}
                    {b.duracionMin ? <span className="font-normal text-tenue"> · {b.duracionMin} min</span> : null}
                    {b.hechoEn ? <span className="font-normal text-verde"> · hecho</span> : null}
                  </p>
                  {b.indicaciones && <p className="text-[12px] text-tenue">{b.indicaciones}</p>}
                </li>
              ))}
            </ul>
          )}
          {sesion.ejercicios.length === 0 && (sesion.bloquesCardio ?? []).length === 0 && (
            <p className="mt-1 text-xs italic text-tenue">La sesión no trae ejercicios ni cardio.</p>
          )}
        </>
      )}
    </section>
  )
}

export function MicrociclosTab({ usuarioId }: { usuarioId: string }) {
  const datos = usePersona(usuarioId)
  const microciclo = datos.activo
  const semana = microciclo ? armarSemana(microciclo, datos.hoy) : []
  const porDefecto = (semana.find((d) => d.esHoy && d.sesionId) ?? semana.find((d) => d.sesionId))?.fechaIso
  const [elegido, setElegido] = useState<string | undefined>(undefined)
  const diaElegido = semana.find((d) => d.fechaIso === (elegido ?? porDefecto))

  const filaPlan =
    datos.plan.estado === 'listo' && datos.plan.valor
      ? tablaDelPlan(datos.plan.valor.contenido, microciclo?.numero)
      : undefined
  const actual = filaPlan?.filas.find((f) => f.actual)

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      {!microciclo ? (
        <div className="xl:col-span-12">
          <EmptyState titulo="Sin microciclo activo" detalle="Esta persona no tiene semana vigente." />
        </div>
      ) : (
        <Tarjeta
          titulo={`Semana vigente · M${microciclo.numero}`}
          i={0}
          className="xl:col-span-12"
          extra={
            <span className="solo-lectura-nota text-[11px] text-tenue">
              Solo lectura · empieza {microciclo.fechaInicio} · {microciclo.cadenciaDias} días
            </span>
          }
        >
          {/* La MISMA rejilla que ve la persona en su Ruta (`armarSemana`): reparte por
              nombre de día y, las sesiones D1…Dn sin día, por orden. Pintar solo las que
              traen `dia` dejaba la semana entera en «Descanso» para quien no lo tiene. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {semana.map((d, n) => {
              const sesion = d.sesionId ? microciclo.sesiones.find((s) => s.id === d.sesionId) : undefined
              const hecha = d.estado === 'completada'
              const esElegido = d.fechaIso === diaElegido?.fechaIso
              const Caja = sesion ? 'button' : 'div'
              return (
                <Caja
                  key={d.fechaIso}
                  {...(sesion
                    ? { type: 'button' as const, onClick: () => setElegido(d.fechaIso), 'aria-pressed': esElegido }
                    : {})}
                  className={`consola-tarjeta rounded-tarjeta border p-2.5 text-left ${
                    !sesion ? 'border-dashed border-linea' : hecha ? 'border-verde/45 bg-verde/10' : 'border-linea bg-surface-2'
                  } ${d.esHoy ? 'ring-2 ring-rojo/60' : ''} ${esElegido ? 'outline outline-2 outline-texto/60' : ''}`}
                  style={{ '--i': n } as CSSProperties}
                >
                  <p className="flex items-baseline justify-between text-[10px] font-bold uppercase tracking-wide text-tenue">
                    <span>{d.abreviatura}</span>
                    <span className={`cifras ${d.esHoy ? 'text-rojo' : ''}`}>{d.esHoy ? 'hoy' : d.numero}</span>
                  </p>
                  {sesion ? (
                    <>
                      <p className="mt-1 text-sm font-bold leading-tight text-texto">{sesion.nombre}</p>
                      <p className="mt-0.5 text-[11px] text-tenue">
                        {sesion.ejercicios.length} ejercicio{sesion.ejercicios.length === 1 ? '' : 's'}
                        {sesion.bloquesCardio?.length ? ` · ${sesion.bloquesCardio.length} cardio` : ''}
                      </p>
                      <span className="mt-1.5 inline-block">
                        <Badge tono={hecha ? 'verde' : 'neutro'}>{hecha ? 'Registrada' : 'Sin registrar'}</Badge>
                      </span>
                    </>
                  ) : (
                    <p className="mt-2 text-xs italic text-tenue">Descanso</p>
                  )}
                </Caja>
              )
            })}
          </div>
          {diaElegido && (
            <RutinaDelDia
              sesion={diaElegido.sesionId ? microciclo.sesiones.find((s) => s.id === diaElegido.sesionId) : undefined}
              etiqueta={`${diaElegido.abreviatura} ${diaElegido.numero}`}
            />
          )}
        </Tarjeta>
      )}

      <Tarjeta titulo="Lo que pide el plan para esta semana" i={1} className="xl:col-span-5">
        {datos.plan.estado === 'cargando' ? (
          <Esqueleto lineas={4} />
        ) : !filaPlan ? (
          <Falta
            que="Sin plan estratégico con tabla de microciclos"
            como="Lo escribe la cadena (② Planificación) en planes_estrategicos."
          />
        ) : !actual ? (
          <Falta
            que={microciclo ? `El plan no tiene fila para M${microciclo.numero}` : 'Sin semana en curso'}
            como={`Filas del plan: ${filaPlan.filas.map((f) => `M${f.numero}`).join(', ')}.`}
          />
        ) : (
          <dl className="flex flex-col gap-1.5 text-[13px]">
            {filaPlan.cabecera.map((c, n) => (
              <div key={c} className="flex justify-between gap-3 border-t border-linea/60 pt-1.5 first:border-0 first:pt-0">
                <dt className="shrink-0 text-tenue">{c}</dt>
                <dd className="m-0 text-right font-bold text-texto">{actual.celdas[n] || '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </Tarjeta>

      <SeccionAdherenciaHistorial datos={datos} i={2} className="xl:col-span-7" />

      <Tarjeta titulo="Historial de microciclos" i={3} className="xl:col-span-12">
        {datos.historial.estado === 'cargando' ? (
          <Esqueleto lineas={5} />
        ) : (
          (() => {
            const lista = adherenciaPorMicrociclo(datos.historial.estado === 'listo' ? datos.historial.valor : []).reverse()
            if (lista.length === 0) {
              return <Falta que="Sin microciclos" como="El primero llega con la carga del lunes." />
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[12.5px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-tenue">
                      <th className="py-1 pr-2 font-bold">Micro</th>
                      <th className="py-1 pr-2 font-bold">Desde</th>
                      <th className="py-1 pr-2 font-bold">Estado</th>
                      <th className="py-1 pr-2 font-bold">Sesiones</th>
                      <th className="w-2/5 py-1 font-bold">Adherencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((m) => (
                      <tr key={m.id} className={`border-t border-linea ${m.estado === 'activo' ? 'font-bold' : ''}`}>
                        <td className="cifras py-1.5 pr-2 text-texto">M{m.numero}</td>
                        <td className="py-1.5 pr-2 text-tenue">{fechaCorta(m.fechaInicio)}</td>
                        <td className="py-1.5 pr-2">
                          <Badge tono={m.estado === 'activo' ? 'azul' : 'neutro'}>{m.estado === 'activo' ? 'En curso' : 'Cerrado'}</Badge>
                        </td>
                        <td className="cifras py-1.5 pr-2 text-tenue">
                          {m.registradas}/{m.totales}
                        </td>
                        <td className="py-1.5">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                              <span
                                className={`barra-crece block h-full rounded-full ${m.pct >= 80 ? 'bg-verde' : m.pct >= 50 ? 'bg-ambar' : 'bg-rojo'}`}
                                style={{ width: `${m.pct}%` }}
                              />
                            </span>
                            <span className="cifras w-9 text-right text-texto">{m.pct}%</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })()
        )}
      </Tarjeta>
    </div>
  )
}
