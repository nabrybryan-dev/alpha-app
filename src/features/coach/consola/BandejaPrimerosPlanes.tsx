import { useEffect, useState, type CSSProperties } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { db } from '../../../data/dbInstance'
import {
  decidirPrimerPlan,
  planPropuesto,
  primerosPlanesPendientes,
  type DecisionPrimerPlan,
  type PrimerPlan,
} from '../../../data/consola/primerosPlanes'
import {
  cuentaAtras,
  ordenarBandeja,
  queOcurreAlVencer,
  quienDecide,
  resumirPlanPropuesto,
  type RiesgoPrimerPlan,
  type SesionResumida,
} from '../../../domain/consolaCoach/primerPlan'
import { Esqueleto, Tarjeta } from './piezas'
import { useCapacidades } from './useCapacidades'

/**
 * «Primeros planes por aprobar» (migración 0086, decisión de Bryan del 26-sep-2026).
 *
 * El primer plan de un cliente nuevo (el que llega por la cola de la landing) espera aquí
 * a que alguien con `aprobar_primer_plan` lo apruebe o lo rechace. Solo se ve con esa
 * capacidad. La confirmación es EN SITIO, nunca `confirm()`/`prompt()`: rechazar pide el
 * motivo en un cuadro dentro de la tarjeta y aprobar pide un segundo clic explícito.
 *
 * Lo que el servidor rechazaría (riesgo alto sin `autorizar_excepcion`) no se ofrece: el
 * botón sale deshabilitado con el porqué al lado. La base lo vuelve a comprobar igual.
 */

const MS_RELOJ = 30_000

const TONO_RIESGO: Record<RiesgoPrimerPlan, 'verde' | 'ambar' | 'rojo'> = { bajo: 'verde', medio: 'ambar', alto: 'rojo' }
const PUNTO_RIESGO: Record<RiesgoPrimerPlan, string> = { bajo: 'bg-verde', medio: 'bg-ambar', alto: 'bg-rojo' }

function formatoHora(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

interface BandejaProps {
  onVerPersona?: (usuarioId: string) => void
}

export function BandejaPrimerosPlanes({ onVerPersona }: BandejaProps) {
  const { cargando, tiene } = useCapacidades()
  const puedeVer = !cargando && tiene('aprobar_primer_plan')
  const [planes, setPlanes] = useState<PrimerPlan[] | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (!puedeVer) return
    let vivo = true
    primerosPlanesPendientes().then((lista) => {
      if (vivo) setPlanes(lista)
    })
    const reloj = setInterval(() => setAhora(Date.now()), MS_RELOJ)
    return () => {
      vivo = false
      clearInterval(reloj)
    }
  }, [puedeVer])

  if (!puedeVer) return null

  const permisos = { aprobarPrimerPlan: true, autorizarExcepcion: tiene('autorizar_excepcion') }
  const actualizar = (plan: PrimerPlan) => setPlanes((previos) => (previos ?? []).map((p) => (p.id === plan.id ? plan : p)))
  const pendientes = planes ? planes.filter((p) => p.estado === 'propuesto' || p.estado === 'espera_bryan').length : 0

  return (
    <Tarjeta
      titulo="Primeros planes por aprobar"
      destacada
      extra={<span className="cifras text-lg font-bold text-texto">{planes ? pendientes : '…'}</span>}
    >
      <p className="mb-2.5 text-[12.5px] text-tenue">
        Clientes nuevos de la landing. Si nadie decide antes del plazo, solo pasa el riesgo bajo sin dudas; lo
        clínico espera siempre a Bryan.
      </p>
      {planes === null ? (
        <Esqueleto lineas={2} />
      ) : planes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-linea px-3 py-2.5 text-[12.5px] text-tenue">
          No hay primeros planes esperando. Aparecen aquí cuando la cola de la landing genera el plan de alguien nuevo.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordenarBandeja(planes).map((plan, i) => (
            <FilaPrimerPlan
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
  plan: PrimerPlan
  ahora: number
  permisos: { aprobarPrimerPlan: boolean; autorizarExcepcion: boolean }
  onVerPersona?: (usuarioId: string) => void
  onDecidido: (plan: PrimerPlan) => void
}

function FilaPrimerPlan({ i, plan, ahora, permisos, onVerPersona, onDecidido }: FilaProps) {
  const [abierta, setAbierta] = useState<DecisionPrimerPlan | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const [verPlan, setVerPlan] = useState(false)

  const nombre = db.usuarios.byId(plan.usuarioId)?.nombre ?? 'Persona nueva'
  const reloj = cuentaAtras(plan.plazoHasta, ahora)
  const decide = quienDecide(plan, permisos)
  const idMotivo = `motivo-primer-plan-${plan.id}`

  const abrir = (decision: DecisionPrimerPlan) => {
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
    const resultado = await decidirPrimerPlan(plan.id, abierta, motivo)
    setEnviando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setHecho(`${abierta === 'aprobar' ? 'Aprobado y publicado' : 'Rechazado'} · ${formatoHora(Date.now())}`)
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
      {plan.motivoEspera && <p className="mt-1.5 text-[12px] text-tenue">{plan.motivoEspera}</p>}
      <p className="mt-1.5 text-[11.5px] text-tenue">{queOcurreAlVencer(plan)}</p>

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
          {verPlan ? 'Ocultar el plan propuesto' : 'Ver el plan propuesto'}
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
              ? `¿Aprobar y publicar el primer plan de ${nombre}? Lo verá en su app en cuanto confirmes.`
              : `Rechazar el primer plan de ${nombre}: la cola tendrá que proponer otro.`}
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

      {verPlan && <VistaPlanPropuesto microcicloId={plan.microcicloId} />}
    </li>
  )
}

type EstadoVista = { estado: 'cargando' } | { estado: 'error'; error: string } | { estado: 'listo'; sesiones: SesionResumida[] }

/** El plan propuesto, en corto: sesiones y ejercicios con su prescripción. Se lee al
 *  abrirlo, no al montar la bandeja. */
function VistaPlanPropuesto({ microcicloId }: { microcicloId: string }) {
  const [vista, setVista] = useState<EstadoVista>({ estado: 'cargando' })

  useEffect(() => {
    let vivo = true
    planPropuesto(microcicloId).then((r) => {
      if (!vivo) return
      setVista(r.ok ? { estado: 'listo', sesiones: resumirPlanPropuesto(r.datos) } : { estado: 'error', error: r.error })
    })
    return () => {
      vivo = false
    }
  }, [microcicloId])

  return (
    <div className="consola-panel-entra mt-2 rounded-lg border border-linea bg-surface-1 p-2.5" style={{ '--consola-dx': 0 } as CSSProperties}>
      {vista.estado === 'cargando' && <Esqueleto lineas={3} />}
      {vista.estado === 'error' && <p className="text-xs text-rojo">{vista.error}</p>}
      {vista.estado === 'listo' && vista.sesiones.length === 0 && (
        <p className="text-[12px] text-tenue">El plan no trae sesiones legibles.</p>
      )}
      {vista.estado === 'listo' && vista.sesiones.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {vista.sesiones.map((s, n) => (
            <section key={`${s.nombre}-${n}`} aria-label={s.nombre} className="min-w-0">
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-tenue">{s.nombre}</h4>
              <ul className="mt-1 flex flex-col gap-0.5 text-[12.5px]">
                {s.ejercicios.map((e, k) => (
                  <li key={`${e.nombre}-${k}`} className="flex justify-between gap-2 border-t border-linea/60 pt-0.5">
                    <span className="truncate text-texto/90">{e.nombre}</span>
                    <span className="shrink-0 text-tenue">{e.detalle}</span>
                  </li>
                ))}
                {s.ejercicios.length === 0 && <li className="text-tenue">Sin ejercicios (cardio o hábito).</li>}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
