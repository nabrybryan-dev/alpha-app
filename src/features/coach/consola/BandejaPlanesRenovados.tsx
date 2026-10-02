import { useEffect, useState, type CSSProperties } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { db } from '../../../data/dbInstance'
import {
  borradorYVigente,
  decidirPlanEstrategico,
  planesRenovadosPendientes,
  type BorradorYVigente,
  type DecisionPlanRenovado,
  type PlanRenovado,
} from '../../../data/consola/planesRenovados'
import { leerPlanLegible } from '../../../domain/consolaCoach/planLegible'
import {
  diferenciaPlanes,
  leerJustificacion,
  leerPreguntasParaBryan,
  queOcurreAlVencerPlan,
  quienDecidePlan,
  type RiesgoPlanRenovado,
} from '../../../domain/consolaCoach/planRenovado'
import { cuentaAtras, ordenarBandeja } from '../../../domain/consolaCoach/primerPlan'
import { Esqueleto, FalloBandeja, Tarjeta } from './piezas'
import { useCapacidades } from './useCapacidades'

/**
 * «Planes estratégicos por aprobar» (migración 0087, decisión de Bryan del 26-sep-2026).
 *
 * El plan estratégico RENOVADO que escribe el agente de renovación espera aquí, como el
 * primer plan (BandejaPrimerosPlanes): quien tenga `aprobar_plan_estrategico` lo aprueba o
 * lo rechaza, con confirmación EN SITIO. Se ve el borrador legible, qué cambia respecto del
 * vigente (filas y reglas), el riesgo, lo clínico, la justificación y las preguntas para
 * Bryan. Aprobar lo publica en el acto: el vigente pasa a reemplazado.
 *
 * Lo que el servidor rechazaría (clínico o riesgo alto sin `autorizar_excepcion`) no se
 * ofrece; la base lo vuelve a comprobar igual.
 */

const MS_RELOJ = 30_000

const TONO_RIESGO: Record<RiesgoPlanRenovado, 'verde' | 'ambar' | 'rojo'> = { bajo: 'verde', medio: 'ambar', alto: 'rojo' }
const PUNTO_RIESGO: Record<RiesgoPlanRenovado, string> = { bajo: 'bg-verde', medio: 'bg-ambar', alto: 'bg-rojo' }

function formatoHora(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

interface BandejaProps {
  onVerPersona?: (usuarioId: string) => void
}

export function BandejaPlanesRenovados({ onVerPersona }: BandejaProps) {
  const { cargando, tiene } = useCapacidades()
  const puedeVer = !cargando && tiene('aprobar_plan_estrategico')
  const [planes, setPlanes] = useState<PlanRenovado[] | null>(null)
  // Por qué no se pudo leer la bandeja; `null` si no falló. Un fallo no es «no hay» (APP-F01).
  const [fallo, setFallo] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (!puedeVer) return
    let vivo = true
    planesRenovadosPendientes().then((lectura) => {
      if (!vivo) return
      if (lectura.ok) {
        setPlanes(lectura.datos)
        setFallo(null)
      } else {
        setPlanes(null)
        setFallo(lectura.error)
      }
    })
    const reloj = setInterval(() => setAhora(Date.now()), MS_RELOJ)
    return () => {
      vivo = false
      clearInterval(reloj)
    }
  }, [puedeVer, intento])

  const reintentar = () => {
    setFallo(null)
    setIntento((n) => n + 1)
  }

  if (!puedeVer) return null

  const permisos = { aprobarPlanEstrategico: true, autorizarExcepcion: tiene('autorizar_excepcion') }
  const actualizar = (plan: PlanRenovado) => setPlanes((previos) => (previos ?? []).map((p) => (p.id === plan.id ? plan : p)))
  const pendientes = planes ? planes.filter((p) => p.estado === 'propuesto' || p.estado === 'espera_bryan').length : 0

  return (
    <Tarjeta
      titulo="Planes estratégicos por aprobar"
      destacada
      extra={<span className="cifras text-lg font-bold text-texto">{planes ? pendientes : fallo !== null ? '—' : '…'}</span>}
    >
      <p className="mb-2.5 text-[12.5px] text-tenue">
        Renovaciones del plan estratégico que propone el agente. Si nadie decide antes del plazo, solo pasa el riesgo
        bajo, no clínico y sin preguntas; lo demás espera a Bryan.
      </p>
      {fallo !== null ? (
        <FalloBandeja error={fallo} onReintentar={reintentar} />
      ) : planes === null ? (
        <Esqueleto lineas={2} />
      ) : planes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linea px-3 py-2.5 text-[12.5px] text-tenue">
          No hay planes renovados esperando. Aparecen aquí cuando el agente de renovación deja un borrador.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordenarBandeja(planes).map((plan, i) => (
            <FilaPlanRenovado
              key={plan.id}
              i={i}
              plan={plan}
              ahora={ahora}
              permisos={permisos}
              onVerPersona={onVerPersona}
              onDecidido={actualizar}
            />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

interface FilaProps {
  i: number
  plan: PlanRenovado
  ahora: number
  permisos: { aprobarPlanEstrategico: boolean; autorizarExcepcion: boolean }
  onVerPersona?: (usuarioId: string) => void
  onDecidido: (plan: PlanRenovado) => void
}

function FilaPlanRenovado({ i, plan, ahora, permisos, onVerPersona, onDecidido }: FilaProps) {
  const [abierta, setAbierta] = useState<DecisionPlanRenovado | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const [verPlan, setVerPlan] = useState(false)

  const nombre = db.usuarios.byId(plan.usuarioId)?.nombre ?? 'Asesorado'
  const reloj = cuentaAtras(plan.plazoHasta, ahora)
  const decide = quienDecidePlan(plan, permisos)
  const justificacion = leerJustificacion(plan.justificacion)
  const preguntas = leerPreguntasParaBryan(plan.preguntasParaBryan)
  const idMotivo = `motivo-plan-renovado-${plan.id}`

  const abrir = (decision: DecisionPlanRenovado) => {
    setError(null)
    setMotivo('')
    setAbierta(decision)
  }

  const confirmar = async () => {
    if (!abierta) return
    if (abierta === 'rechazar' && !motivo.trim()) {
      setError('Escribe el motivo del rechazo.')
      return
    }
    setEnviando(true)
    setError(null)
    const resultado = await decidirPlanEstrategico(plan.id, abierta, motivo)
    setEnviando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setHecho(`${abierta === 'aprobar' ? 'Aprobado: ya es el plan vigente' : 'Rechazado'} · ${formatoHora(Date.now())}`)
    setAbierta(null)
    setMotivo('')
    onDecidido(resultado.plan)
  }

  return (
    <li
      className="consola-tarjeta rounded-tarjeta border border-linea bg-surface-2/70 p-3"
      style={{ '--i': i } as CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO_RIESGO[plan.riesgo]}`} aria-hidden="true" />
        <span className="text-sm font-bold text-texto">{nombre}</span>
        <Badge tono={TONO_RIESGO[plan.riesgo]}>Riesgo {plan.riesgo}</Badge>
        {plan.clinico && <Badge tono="rojo">Clínico</Badge>}
        {plan.estado === 'espera_bryan' && <Badge tono="rojo">Espera a Bryan</Badge>}
        <span
          className={`cifras ml-auto text-[12px] font-bold ${reloj.urgente ? 'text-rojo' : 'text-tenue'}`}
          aria-label={`Plazo: ${reloj.texto}`}
        >
          {reloj.texto}
        </span>
      </div>

      {plan.motivoRiesgo && <p className="mt-1.5 text-[12.5px] text-texto/90">{plan.motivoRiesgo}</p>}
      {plan.dudasPendientes.length > 0 && (
        <ul className="mt-1.5 list-disc pl-5 text-[12px] text-ambar">
          {plan.dudasPendientes.map((duda) => (
            <li key={duda}>{duda}</li>
          ))}
        </ul>
      )}

      {preguntas.length > 0 && (
        <section aria-label="Preguntas para Bryan" className="mt-2 rounded-lg border border-ambar/40 bg-ambar/5 p-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-ambar">Preguntas para Bryan</h4>
          <ul className="mt-1 flex flex-col gap-1 text-[12.5px]">
            {preguntas.map((p, n) => (
              <li key={`${p.pregunta}-${n}`}>
                <span className="text-texto">{p.pregunta}</span>
                {p.opciones.length > 0 && (
                  <span className="block text-[11.5px] text-tenue">
                    {p.opciones.map((o, k) => (k === 0 ? `${o} (recomendada)` : o)).join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.motivoEspera && <p className="mt-1.5 text-[12px] text-tenue">{plan.motivoEspera}</p>}
      <p className="mt-1.5 text-[11.5px] text-tenue">{queOcurreAlVencerPlan(plan)}</p>

      {hecho && (
        <p
          role="status"
          className="consola-confirmacion mt-2 inline-flex items-center gap-1.5 rounded-full border border-verde/40 bg-verde/10 px-2.5 py-0.5 text-[11.5px] font-bold text-texto"
        >
          <span aria-hidden="true">✓</span> {hecho}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {onVerPersona && (
          <button
            type="button"
            className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto"
            onClick={() => onVerPersona(plan.usuarioId)}
          >
            Ver ficha
          </button>
        )}
        <button
          type="button"
          aria-expanded={verPlan}
          className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto"
          onClick={() => setVerPlan((v) => !v)}
        >
          {verPlan ? 'Ocultar el borrador' : 'Ver el borrador y qué cambia'}
        </button>
        {!abierta && decide.puedeRechazar && (
          <>
            <button
              type="button"
              className="tecla-3d rounded-lg bg-verde px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!decide.puedeAprobar}
              onClick={() => abrir('aprobar')}
            >
              Aprobar
            </button>
            <button
              type="button"
              className="tecla-3d rounded-lg border border-rojo/50 bg-rojo/10 px-3 py-1.5 text-xs font-bold text-rojo"
              onClick={() => abrir('rechazar')}
            >
              Rechazar
            </button>
            {decide.motivoNoAprobar && <span className="text-[11px] text-tenue">— {decide.motivoNoAprobar}</span>}
          </>
        )}
      </div>

      {abierta && (
        <div className="consola-confirmacion mt-2 rounded-lg border border-dashed border-linea bg-surface-1 p-2.5">
          <p className="text-[12.5px] text-texto">
            {abierta === 'aprobar'
              ? `¿Aprobar el plan estratégico renovado de ${nombre}? Reemplaza al vigente en cuanto confirmes.`
              : `Rechazar el plan renovado de ${nombre}: el vigente sigue igual y el agente tendrá que proponer otro.`}
          </p>
          <label className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-tenue" htmlFor={idMotivo}>
            {abierta === 'aprobar' ? 'Nota (opcional)' : 'Motivo del rechazo (obligatorio)'}
          </label>
          <textarea
            id={idMotivo}
            className="mt-1 w-full rounded-lg border border-linea bg-surface-1 p-2 text-sm text-texto"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {error && <p className="mt-1 text-xs text-rojo">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={`tecla-3d rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${
                abierta === 'aprobar' ? 'bg-verde' : 'bg-rojo'
              }`}
              disabled={enviando}
              onClick={() => void confirmar()}
            >
              {enviando ? 'Enviando…' : abierta === 'aprobar' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
            </button>
            <button
              type="button"
              className="rounded-lg border border-linea px-3 py-1.5 text-xs font-bold text-tenue"
              disabled={enviando}
              onClick={() => setAbierta(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {verPlan && (
        <VistaBorrador
          usuarioId={plan.usuarioId}
          planId={plan.planId}
          justificacion={justificacion}
          supuestos={plan.supuestos}
        />
      )}
    </li>
  )
}

type EstadoVista = { estado: 'cargando' } | { estado: 'error'; error: string } | { estado: 'listo'; datos: BorradorYVigente }

interface VistaProps {
  usuarioId: string
  planId: string
  justificacion: ReturnType<typeof leerJustificacion>
  supuestos: string[]
}

/** El borrador legible y su diferencia con el vigente. Se lee al abrirlo, no al montar. */
function VistaBorrador({ usuarioId, planId, justificacion, supuestos }: VistaProps) {
  const [vista, setVista] = useState<EstadoVista>({ estado: 'cargando' })

  useEffect(() => {
    let vivo = true
    borradorYVigente(usuarioId, planId).then((r) => {
      if (!vivo) return
      setVista(r.ok ? { estado: 'listo', datos: r.datos } : { estado: 'error', error: r.error })
    })
    return () => {
      vivo = false
    }
  }, [usuarioId, planId])

  return (
    <div className="consola-panel-entra mt-2 flex flex-col gap-2.5 rounded-lg border border-linea bg-surface-1 p-2.5" style={{ '--consola-dx': 0 } as CSSProperties}>
      {vista.estado === 'cargando' && <Esqueleto lineas={3} />}
      {vista.estado === 'error' && <p className="text-xs text-rojo">{vista.error}</p>}
      {vista.estado === 'listo' && <ContenidoBorrador datos={vista.datos} />}

      {justificacion.length > 0 && (
        <section aria-label="Justificación">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-tenue">Justificación</h4>
          <ul className="mt-1 flex flex-col gap-1 text-[12.5px]">
            {justificacion.map((j, n) => (
              <li key={`${j.decision}-${n}`}>
                <span className="text-texto">{j.decision}</span>
                {j.evidencia && <span className="block text-[11.5px] text-tenue">{j.evidencia}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {supuestos.length > 0 && (
        <section aria-label="Supuestos">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-tenue">Supuestos</h4>
          <ul className="mt-1 list-disc pl-5 text-[12px] text-texto/85">
            {supuestos.map((s, n) => (
              <li key={`${s}-${n}`}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ContenidoBorrador({ datos }: { datos: BorradorYVigente }) {
  const legible = leerPlanLegible(datos.borrador.contenido)
  const dif = diferenciaPlanes(datos.vigente?.contenido ?? null, datos.borrador.contenido)
  const hayCambiosDeFilas = dif.filasAnadidas.length + dif.filasCambiadas.length + dif.filasQuitadas.length > 0

  return (
    <>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-tenue">
          Borrador · versión {datos.borrador.version}
          {datos.vigente ? ` (reemplazaría a la ${datos.vigente.version})` : ' (sin plan vigente)'}
        </p>
        {legible.objetivo && <p className="mt-0.5 text-[14px] font-bold leading-snug text-texto">{legible.objetivo}</p>}
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-tenue">
          {legible.metricaPrincipal && <span>Métrica principal: {legible.metricaPrincipal}</span>}
          {legible.horizonte && <span>Horizonte: {legible.horizonte}</span>}
        </div>
        {!legible.reconocido && (
          <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-2 text-[11px] text-tenue">
            {JSON.stringify(datos.borrador.contenido, null, 2)}
          </pre>
        )}
      </div>

      {dif.campos.length > 0 && !dif.sinVigente && (
        <section aria-label="Cambios de objetivo, métrica u horizonte">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-tenue">Cambia respecto del vigente</h4>
          <ul className="mt-1 flex flex-col gap-0.5 text-[12.5px]">
            {dif.campos.map((c) => (
              <li key={c.campo}>
                <span className="font-bold text-texto">{c.campo}:</span>{' '}
                <span className="text-tenue line-through">{c.antes ?? '—'}</span> → <span className="text-texto">{c.despues ?? '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Filas del plan">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-tenue">Filas</h4>
        {!hayCambiosDeFilas ? (
          <p className="mt-1 text-[12px] text-tenue">Sin cambios en la tabla de microciclos.</p>
        ) : (
          <div className="mt-1 overflow-x-auto rounded-lg border border-linea">
            <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="bg-surface-2 text-[10px] uppercase tracking-wider text-tenue">
                  <th className="px-2 py-1 font-bold">Cambio</th>
                  {dif.cabecera.map((c) => (
                    <th key={c} className="px-2 py-1 font-bold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dif.filasAnadidas.map((f) => (
                  <tr key={`a-${f.numero}`} className="border-t border-linea bg-verde/5 align-top">
                    <td className="px-2 py-1 font-bold text-verde">Añadida</td>
                    {f.celdas.map((c, n) => (
                      <td key={n} className="px-2 py-1 text-texto/90">
                        {c || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {dif.filasCambiadas.map((f) => (
                  <tr key={`c-${f.numero}`} className="border-t border-linea bg-ambar/5 align-top">
                    <td className="px-2 py-1 font-bold text-ambar">Cambia</td>
                    {f.celdas.map((c, n) => (
                      <td key={n} className="px-2 py-1 text-texto/90">
                        {c !== f.antes[n] && f.antes[n] ? (
                          <>
                            <span className="block text-tenue line-through">{f.antes[n]}</span>
                            {c || '—'}
                          </>
                        ) : (
                          c || '—'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {dif.filasQuitadas.map((f) => (
                  <tr key={`q-${f.numero}`} className="border-t border-linea bg-rojo/5 align-top">
                    <td className="px-2 py-1 font-bold text-rojo">Quitada</td>
                    {f.celdas.map((c, n) => (
                      <td key={n} className="px-2 py-1 text-tenue line-through">
                        {c || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Reglas">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-tenue">
          Reglas · {dif.reglasMantenidas} se mantienen
        </h4>
        {dif.reglasAnadidas.length === 0 && dif.reglasDerogadas.length === 0 && dif.reglasPerdidas.length === 0 && (
          <p className="mt-1 text-[12px] text-tenue">Sin reglas nuevas ni derogadas.</p>
        )}
        <ul className="mt-1 flex flex-col gap-1 text-[12.5px]">
          {dif.reglasAnadidas.map((r, n) => (
            <li key={`ra-${n}`} className="flex gap-2">
              <span className="shrink-0 text-[10.5px] font-bold uppercase text-verde">Añadida</span>
              <span className="text-texto/90">{r}</span>
            </li>
          ))}
          {dif.reglasDerogadas.map((r, n) => (
            <li key={`rd-${n}`} className="flex gap-2">
              <span className="shrink-0 text-[10.5px] font-bold uppercase text-rojo">Derogada</span>
              <span>
                <span className="text-tenue line-through">{r.texto}</span>
                {r.sustitucion && <span className="block text-[11.5px] text-texto/85">Sustituye: {r.sustitucion}</span>}
              </span>
            </li>
          ))}
          {dif.reglasPerdidas.map((r, n) => (
            <li key={`rp-${n}`} className="flex gap-2">
              <span className="shrink-0 text-[10.5px] font-bold uppercase text-ambar">Desaparece sin derogar</span>
              <span className="text-texto/90">{r}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
