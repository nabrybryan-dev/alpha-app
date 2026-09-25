import { useEffect, useState } from 'react'
import { Badge } from '../../../../components/ui/Badge'
import { Card } from '../../../../components/ui/Card'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { ordenesRecientes, type Orden } from '../../../../data/consola/ordenes'
import { planVigente, type PlanEstrategico } from '../../../../data/consola/planesEstrategicos'
import { db, useDbVersion } from '../../../../data/dbInstance'
import { desviacionRir, resumenMicrociclo } from '../../../../domain/cumplimiento'
import { compararMicrociclos } from '../../../../domain/consolaCoach/diffMicrociclo'
import { leerPlanLegible } from '../../../../domain/consolaCoach/planLegible'
import { pRatio } from '../../../../domain/consolaCoach/pRatio'
import { esAlFallo } from '../../../../domain/objetivoDeIntensidad'
import type { Microciclo } from '../../../../domain/types'
import { ResponderComoStaff } from '../ResponderComoStaff'

/**
 * Módulo 3: adherencia, progreso de cargas, RIR prescrito/real, composición
 * corporal con P-ratio y nutrición. Todo de lectura sobre lo que ya baja el
 * repositorio (`db.perfiles`, `db.microciclos`, `db.nutricion`).
 */

function microcicloAnterior(historial: Microciclo[], activo: Microciclo | undefined): Microciclo | undefined {
  if (!activo) return undefined
  return historial.find((m) => m.numero === activo.numero - 1)
}

function SeccionAdherencia({ activo }: { activo: Microciclo | undefined }) {
  if (!activo) {
    return (
      <Card>
        <p className="kicker">Adherencia</p>
        <p className="mt-2 text-sm text-tenue">Sin microciclo activo que medir.</p>
      </Card>
    )
  }
  const r = resumenMicrociclo(activo)
  return (
    <Card>
      <p className="kicker">Adherencia · M{activo.numero}</p>
      <p className="mt-1 cifras text-2xl font-bold text-texto">{r.pctRegistrado}%</p>
      <p className="text-xs text-tenue">
        {r.sesionesRegistradas} de {r.sesionesTotales} sesiones prescritas, hechas
      </p>
    </Card>
  )
}

function SeccionProgresoCargas({
  historial,
  activo,
}: {
  historial: Microciclo[]
  activo: Microciclo | undefined
}) {
  const anterior = microcicloAnterior(historial, activo)
  const diff = compararMicrociclos(anterior, activo)
  return (
    <Card>
      <p className="kicker">Progreso de cargas frente al microciclo anterior</p>
      {diff.cargas.length === 0 ? (
        <p className="mt-2 text-sm text-tenue">
          {anterior ? 'Sin cambios de carga detectados.' : 'Sin microciclo anterior con el que comparar.'}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {diff.cargas.map((c) => (
            <li key={c.nombre} className="flex items-center justify-between gap-2">
              <span className="text-texto/90">{c.nombre}</span>
              <span className={`cifras font-bold ${c.direccion === 'sube' ? 'text-verde' : 'text-rojo'}`}>
                {c.cargaAntesKg} → {c.cargaDespuesKg} kg {c.direccion === 'sube' ? '▲' : '▼'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function SeccionRir({ activo }: { activo: Microciclo | undefined }) {
  const filas = (activo?.sesiones ?? [])
    .flatMap((s) => s.ejercicios)
    .filter((e) => e.series.length > 0)
    .map((e) => ({ nombre: e.nombre, objetivo: e.rirObjetivo, desviacion: desviacionRir(e.rirObjetivo, e.series) }))

  return (
    <Card>
      <p className="kicker">RIR prescrito frente a real</p>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-tenue">Sin series registradas todavía en el microciclo activo.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-tenue">
                <th className="py-1 pr-2 font-bold">Ejercicio</th>
                <th className="py-1 pr-2 font-bold">Objetivo</th>
                <th className="py-1 font-bold">Desviación</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.nombre} className="border-t border-linea">
                  <td className="py-1.5 pr-2 font-bold text-texto">{f.nombre}</td>
                  <td className="py-1.5 pr-2 text-tenue">{esAlFallo(f.objetivo) ? 'FALLO' : `RIR ${f.objetivo}`}</td>
                  <td className="py-1.5">
                    {f.desviacion === undefined ? (
                      <span className="text-tenue">—</span>
                    ) : (
                      <Badge tono={Math.abs(f.desviacion) <= 0.5 ? 'verde' : Math.abs(f.desviacion) <= 1.5 ? 'ambar' : 'rojo'}>
                        {f.desviacion > 0 ? `+${f.desviacion}` : f.desviacion}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function SeccionComposicion({ usuarioId }: { usuarioId: string }) {
  const perfil = db.perfiles.byUsuario(usuarioId)
  const medidas = [...(perfil?.medidas ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha))

  if (medidas.length < 2) {
    return (
      <Card>
        <p className="kicker">Composición corporal · P-ratio</p>
        <p className="mt-2 text-sm text-tenue">
          Hacen falta al menos dos medidas para calcular el P-ratio; hoy hay {medidas.length}.
        </p>
      </Card>
    )
  }

  const antes = medidas[medidas.length - 2]
  const despues = medidas[medidas.length - 1]
  const resultado = pRatio(antes, despues)

  return (
    <Card>
      <p className="kicker">Composición corporal · P-ratio</p>
      <p className="mt-1 text-xs text-tenue">
        {antes.fecha} ({antes.pesoKg ?? '—'} kg) → {despues.fecha} ({despues.pesoKg ?? '—'} kg)
      </p>
      {resultado === undefined ? (
        <p className="mt-2 text-sm font-bold text-tenue">No interpretable</p>
      ) : (
        <p className="mt-2 cifras text-2xl font-bold text-texto">{resultado}</p>
      )}
      <p className="mt-1 text-[11px] text-tenue">
        Fracción del cambio de peso que fue masa magra (0 = todo grasa, 1 = todo masa magra). «No
        interpretable» cuando falta el % de masa magra o el cambio de peso es menor que el umbral —
        misma causa que <span className="cifras">composicion.py::p_ratio</span> en cerebro-alpha-agentes.
      </p>
    </Card>
  )
}

function SeccionPlanEstrategico({ usuarioId }: { usuarioId: string }) {
  // `undefined` = todavía no llegó nada de la base; `null` = llegó y no hay plan vigente.
  const [plan, setPlan] = useState<PlanEstrategico | null | undefined>(undefined)

  useEffect(() => {
    let vivo = true
    planVigente(usuarioId).then((p) => {
      if (vivo) setPlan(p)
    })
    return () => {
      vivo = false
    }
  }, [usuarioId])

  if (plan === undefined) {
    return (
      <Card>
        <p className="kicker">Plan estratégico</p>
        <p className="mt-2 text-sm text-tenue">Cargando…</p>
      </Card>
    )
  }

  if (!plan) {
    return (
      <Card>
        <p className="kicker">Plan estratégico</p>
        <p className="mt-2 text-sm text-tenue">Sin plan estratégico vigente todavía.</p>
      </Card>
    )
  }

  const legible = leerPlanLegible(plan.contenido)

  return (
    <Card>
      <p className="kicker">Plan estratégico · versión {plan.version}</p>
      {legible.objetivo && <p className="mt-2 text-sm text-texto/90">{legible.objetivo}</p>}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-tenue">
        {legible.metricaPrincipal && <span>Métrica principal: {legible.metricaPrincipal}</span>}
        {legible.horizonte && <span>Horizonte: {legible.horizonte}</span>}
      </div>
      {legible.reglas.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5 text-sm">
          {legible.reglas.map((regla, i) => (
            <li key={i} className="text-texto/90">
              {regla}
            </li>
          ))}
        </ul>
      )}
      {legible.reglasDerogadas.length > 0 && (
        <details className="mt-2 text-xs text-tenue">
          <summary className="cursor-pointer font-bold">Reglas derogadas ({legible.reglasDerogadas.length})</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {legible.reglasDerogadas.map((regla, i) => (
              <li key={i}>{regla}</li>
            ))}
          </ul>
        </details>
      )}
      {!legible.reconocido && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-2 text-[11px] text-tenue">
          {JSON.stringify(plan.contenido, null, 2)}
        </pre>
      )}
    </Card>
  )
}

function SeccionNutricion({ usuarioId }: { usuarioId: string }) {
  const plan = db.nutricion.planByUsuario(usuarioId)
  const adherencias = db.nutricion.adherenciasByUsuario(usuarioId)

  return (
    <Card>
      <p className="kicker">Nutrición</p>
      {!plan ? (
        <p className="mt-2 text-sm text-tenue">Sin plan nutricional cargado.</p>
      ) : (
        <p className="mt-2 text-sm text-texto/90">{plan.analisis || 'Plan cargado sin análisis escrito.'}</p>
      )}
      {adherencias.length > 0 && (
        <p className="mt-2 text-xs text-tenue">
          {adherencias.filter((a) => a.estado === 'si').length} cumplidos ·{' '}
          {adherencias.filter((a) => a.estado === 'parcial').length} parciales ·{' '}
          {adherencias.filter((a) => a.estado === 'no').length} no cumplidos (últimos {adherencias.length}{' '}
          registros)
        </p>
      )}
    </Card>
  )
}

/**
 * Aviso de riesgo reportado (encargo, punto 3): lee `ordenes` tipo `reportar_riesgo` de
 * esta persona y lo muestra como aviso para el coach — no detiene nada por sí solo.
 */
function SeccionRiesgoReportado({ usuarioId }: { usuarioId: string }) {
  const [ordenes, setOrdenes] = useState<Orden[] | undefined>(undefined)

  useEffect(() => {
    let vivo = true
    ordenesRecientes(['reportar_riesgo']).then((lista) => {
      if (vivo) setOrdenes(lista)
    })
    return () => {
      vivo = false
    }
  }, [])

  const propios = (ordenes ?? []).filter((o) => o.objetivo.usuario_id === usuarioId)
  if (propios.length === 0) return null

  const masReciente = propios[0]
  const nombreActor = db.usuarios.byId(masReciente.actorId)?.nombre ?? 'alguien del equipo'

  return (
    <Card className="border-ambar/50 bg-ambar/10">
      <p className="kicker">Riesgo reportado</p>
      <p className="mt-1 text-sm text-texto/90">
        {nombreActor} reportó un riesgo: <span className="font-bold">{String(masReciente.objetivo.motivo ?? '')}</span>
      </p>
      {propios.length > 1 && (
        <p className="mt-1 text-xs text-tenue">
          Y {propios.length - 1} {propios.length - 1 === 1 ? 'reporte más' : 'reportes más'} en el historial.
        </p>
      )}
    </Card>
  )
}

/**
 * Cuestionarios pendientes de esta persona (encargo, punto 4): los asignados sin
 * respuesta todavía, cada uno con «Responder como coach».
 */
function SeccionCuestionariosPendientes({ usuarioId }: { usuarioId: string }) {
  const asignados = db.cuestionarios.asignadosA(usuarioId)
  const respuestas = db.cuestionarios.respuestasDe(usuarioId)
  const idsRespondidos = new Set(respuestas.map((r) => r.cuestionarioId))
  const pendientes = asignados.filter((c) => !idsRespondidos.has(c.id))

  if (pendientes.length === 0) return null

  const nombre = db.usuarios.byId(usuarioId)?.nombre ?? 'esta persona'

  return (
    <Card>
      <p className="kicker">Cuestionarios pendientes</p>
      <ul className="mt-2 flex flex-col gap-2.5">
        {pendientes.map((c) => (
          <li key={c.id} className="rounded-lg border border-linea bg-surface-2 p-2.5 text-sm">
            <p className="font-bold text-texto">{c.titulo}</p>
            {c.descripcion && <p className="mt-0.5 text-xs text-tenue">{c.descripcion}</p>}
            <ResponderComoStaff cuestionarioId={c.id} nombrePersona={nombre} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function FichaAsesoradoTab({ usuarioId }: { usuarioId: string }) {
  useDbVersion()
  const usuario = db.usuarios.byId(usuarioId)
  const historial = db.microciclos.byUsuario(usuarioId)
  const activo = historial.find((m) => m.estado === 'activo')

  if (!usuario) {
    return <EmptyState titulo="Asesorado no encontrado" detalle="Elige a alguien de la cartera." />
  }

  return (
    <div className="flex flex-col gap-3">
      <SeccionRiesgoReportado usuarioId={usuarioId} />
      <SeccionPlanEstrategico usuarioId={usuarioId} />
      <SeccionAdherencia activo={activo} />
      <SeccionProgresoCargas historial={historial} activo={activo} />
      <SeccionRir activo={activo} />
      <SeccionComposicion usuarioId={usuarioId} />
      <SeccionNutricion usuarioId={usuarioId} />
      <SeccionCuestionariosPendientes usuarioId={usuarioId} />
    </div>
  )
}
