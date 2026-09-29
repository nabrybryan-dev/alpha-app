import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FalloDeLectura } from '../../components/ui/FalloDeLectura'
import { useLectura } from '../../components/ui/useLectura'
import { planItems } from '../../data/consola/planItems'
import { isoLocal, lunesDe, type ItemPlan } from '../../domain/planOrganizador'
import { useCapacidades } from '../coach/consola/useCapacidades'
import { Cargando, Vacio, CLASE_ETIQUETA } from './comun'
import { useDuenoDelPlan } from './dueno'
import { HoyTab } from './HoyTab'
import { NoventaDiasTab } from './NoventaDiasTab'
import { SemanaTab } from './SemanaTab'

/**
 * «Mi plan» (organizador de Bryan y Manuela; migración 0098; ESPEC-ORGANIZADOR.md).
 *
 * Tres pestañas: Hoy (1 grande + 2 pequeñas, con temporizador), Semana (hitos, horas
 * planeadas contra hechas, intensidad) y 90 días (objetivos con barra). Cada quien ve y edita
 * lo suyo; Bryan además ve la carga de Manuela en solo lectura para no sobrecargarla.
 *
 * Estados honestos: cargando, error con «Reintentar» (un error NUNCA se pinta como «no hay
 * plan»), vacío confirmado. Nada se inventa: si no hay hitos ni tareas cargados, lo dice.
 */

const PESTANAS = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'semana', nombre: 'Semana' },
  { id: 'noventa', nombre: '90 días' },
] as const
type IdPestana = (typeof PESTANAS)[number]['id']

export default function MiPlanPage() {
  const dueno = useDuenoDelPlan()
  const { cargando, tiene } = useCapacidades()
  const { lectura, reintentar } = useLectura(planItems)
  // Tras escribir se relee sin vaciar la pantalla: se conserva lo último bueno mientras llega lo nuevo.
  const [ultimo, setUltimo] = useState<ItemPlan[] | null>(null)
  const [pestana, setPestana] = useState<IdPestana>('hoy')

  if (lectura?.ok && lectura.datos !== ultimo) setUltimo(lectura.datos)
  if (dueno === null) return <Navigate to="/" replace />

  const puede = dueno === 'bryan' || tiene('organizar_plan')
  const hoy = isoLocal(new Date())
  const items = lectura?.ok ? lectura.datos : ultimo

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        <p className={CLASE_ETIQUETA}>{dueno === 'bryan' ? 'Plan de Bryan' : 'Plan de Manuela'}</p>
        <h2 className="font-display text-3xl leading-none text-texto">Mi plan</h2>
      </header>

      {dueno === 'manuela' && cargando ? (
        <Cargando texto="Cargando tus permisos…" />
      ) : !puede ? (
        <Vacio>El plan se usa con el permiso de organizar el plan, y todavía no lo tienes. Pídeselo al coach.</Vacio>
      ) : (
        <>
          <div role="tablist" aria-label="Vistas del plan" className="flex gap-1 rounded-full border border-linea p-1">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`plan-tab-${p.id}`}
                aria-selected={pestana === p.id}
                aria-controls={`plan-panel-${p.id}`}
                onClick={() => setPestana(p.id)}
                className={`press min-h-[44px] flex-1 rounded-full text-xs font-bold uppercase tracking-[0.08em] ${
                  pestana === p.id ? 'bg-texto text-bg' : 'text-tenue'
                }`}
              >
                {p.nombre}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`plan-panel-${pestana}`} aria-labelledby={`plan-tab-${pestana}`} aria-busy={lectura === null}>
            {items === null ? (
              lectura !== null && !lectura.ok ? (
                <FalloDeLectura texto={`No se pudo leer el plan: ${lectura.error}`} onReintentar={reintentar} />
              ) : (
                <Cargando />
              )
            ) : (
              <>
                {lectura !== null && !lectura.ok && (
                  <div className="pb-3">
                    <FalloDeLectura texto={`No se pudo actualizar el plan: ${lectura.error}`} onReintentar={reintentar} />
                  </div>
                )}
                {pestana === 'hoy' && <HoyTab items={items} dueno={dueno} hoy={hoy} onCambio={reintentar} />}
                {pestana === 'semana' && (
                  <SemanaTab items={items} dueno={dueno} lunesActual={lunesDe(hoy)} verCargaAjena={dueno === 'bryan' ? 'manuela' : null} />
                )}
                {pestana === 'noventa' && (
                  <NoventaDiasTab items={items} dueno={dueno} verObjetivosAjenos={dueno === 'bryan' ? 'manuela' : null} />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
