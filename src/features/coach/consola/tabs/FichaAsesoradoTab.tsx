import { useEffect, useState } from 'react'
import { Badge } from '../../../../components/ui/Badge'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { ordenesRecientes, type Orden } from '../../../../data/consola/ordenes'
import { db } from '../../../../data/dbInstance'
import { desviacionRir } from '../../../../domain/cumplimiento'
import { compararMicrociclos } from '../../../../domain/consolaCoach/diffMicrociclo'
import { esAlFallo } from '../../../../domain/objetivoDeIntensidad'
import type { Microciclo } from '../../../../domain/types'
import { SeccionPeso, SeccionPerimetros, SeccionPRatio } from '../ficha/SeccionCuerpo'
import { SeccionCuestionarios } from '../ficha/SeccionCuestionarios'
import { SeccionAlimentacion, SeccionCribado, SeccionPerfil } from '../ficha/SeccionPerfil'
import { SeccionAdherenciaHistorial, SeccionPlanEstrategico } from '../ficha/SeccionPlan'
import { Falta, Tarjeta } from '../piezas'
import { usePersona } from '../usePersona'

/**
 * Módulo 3: el perfil completo de la persona. Rejilla de 12 columnas en escritorio para
 * que nada deje huecos: perfil y cribado arriba, el cuerpo en el tiempo (peso, perímetros,
 * P-ratio), la adherencia por semana, el plan estratégico con la fila del microciclo
 * actual, cargas y RIR, alimentación y cuestionarios.
 *
 * Todo de LECTURA sobre lo que ya baja el repositorio y las tablas de la cadena; ningún
 * control de aquí escribe salvo «Responder como coach», que pide confirmación.
 */

function microcicloAnterior(historial: Microciclo[], activo: Microciclo | undefined): Microciclo | undefined {
  if (!activo) return undefined
  return historial.find((m) => m.numero === activo.numero - 1)
}

function SeccionProgresoCargas({
  historial,
  activo,
  i,
}: {
  historial: Microciclo[]
  activo: Microciclo | undefined
  i: number
}) {
  const anterior = microcicloAnterior(historial, activo)
  const diff = compararMicrociclos(anterior, activo)
  return (
    <Tarjeta titulo="Progreso de cargas frente al microciclo anterior" i={i} className="xl:col-span-6">
      {diff.cargas.length === 0 ? (
        <Falta
          que={anterior ? 'Sin cambios de carga detectados.' : 'Sin microciclo anterior con el que comparar.'}
          como={
            anterior
              ? 'Compara la carga prescrita ejercicio a ejercicio entre esta semana y la anterior.'
              : 'Aparece desde la segunda semana cargada.'
          }
        />
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {diff.cargas.map((c) => (
            <li key={c.nombre} className="flex items-center justify-between gap-2 border-t border-linea/60 pt-1 first:border-0 first:pt-0">
              <span className="min-w-0 truncate text-texto/90">{c.nombre}</span>
              <span className={`cifras shrink-0 font-bold ${c.direccion === 'sube' ? 'text-verde' : 'text-rojo'}`}>
                {c.cargaAntesKg} → {c.cargaDespuesKg} kg {c.direccion === 'sube' ? '▲' : '▼'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

function SeccionRir({ activo, i }: { activo: Microciclo | undefined; i: number }) {
  const filas = (activo?.sesiones ?? [])
    .flatMap((s) => s.ejercicios)
    .filter((e) => e.series.length > 0)
    .map((e) => ({ nombre: e.nombre, objetivo: e.rirObjetivo, desviacion: desviacionRir(e.rirObjetivo, e.series) }))

  return (
    <Tarjeta titulo="RIR prescrito frente a real" i={i} className="xl:col-span-6">
      {filas.length === 0 ? (
        <Falta
          que="Sin series registradas todavía en el microciclo activo."
          como="Se llena cuando la persona registra sus series con el RIR que sintió."
        />
      ) : (
        <div className="overflow-x-auto">
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
    </Tarjeta>
  )
}

/**
 * Aviso de riesgo reportado: lee `ordenes` tipo `reportar_riesgo` de esta persona y lo
 * muestra como aviso para el coach — no detiene nada por sí solo.
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
    <div className="consola-confirmacion rounded-bloque border border-ambar/50 bg-ambar/10 p-3.5 xl:col-span-12">
      <p className="kicker">Riesgo reportado</p>
      <p className="mt-1 text-sm text-texto/90">
        {nombreActor} reportó un riesgo: <span className="font-bold">{String(masReciente.objetivo.motivo ?? '')}</span>
      </p>
      {propios.length > 1 && (
        <p className="mt-1 text-xs text-tenue">
          Y {propios.length - 1} {propios.length - 1 === 1 ? 'reporte más' : 'reportes más'} en el historial.
        </p>
      )}
    </div>
  )
}

export function FichaAsesoradoTab({ usuarioId }: { usuarioId: string }) {
  const datos = usePersona(usuarioId)

  if (!datos.usuario) {
    return <EmptyState titulo="Asesorado no encontrado" detalle="Elige a alguien de la cartera." />
  }

  const historial = datos.historial.estado === 'listo' ? datos.historial.valor : db.microciclos.byUsuario(usuarioId)

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <SeccionRiesgoReportado usuarioId={usuarioId} />
      <SeccionPerfil datos={datos} i={0} />
      <SeccionCribado datos={datos} i={1} />
      <SeccionPeso datos={datos} i={2} className="xl:col-span-7" />
      <SeccionPerimetros datos={datos} i={3} className="xl:col-span-5" />
      <SeccionAdherenciaHistorial datos={datos} i={4} className="xl:col-span-7" />
      <SeccionPRatio datos={datos} i={5} className="xl:col-span-5" />
      <SeccionPlanEstrategico datos={datos} i={6} className="xl:col-span-12" />
      <SeccionProgresoCargas historial={historial} activo={datos.activo} i={7} />
      <SeccionRir activo={datos.activo} i={8} />
      <SeccionAlimentacion datos={datos} i={9} className="xl:col-span-7" />
      <SeccionCuestionarios usuarioId={usuarioId} i={10} className="xl:col-span-5" />
    </div>
  )
}
