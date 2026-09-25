import { Badge } from '../../../../components/ui/Badge'
import { Card } from '../../../../components/ui/Card'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { db, useDbVersion } from '../../../../data/dbInstance'
import { sesionCompleta } from '../../../../domain/cumplimiento'
import { DIAS_SEMANA } from '../../../../domain/consolaCoach/diffMicrociclo'

/**
 * Módulo 4: la cuadrícula de la semana vigente, solo para ver. Nada de
 * "Pedir semana a la cadena" ni "Editar antes de publicar" ni "Crear a
 * mano" en esta entrega — esos botones escriben, y esta fase es de solo
 * lectura (DISENO-CONSOLA-V2.md §2.4).
 */
export function MicrociclosTab({ usuarioId }: { usuarioId: string }) {
  useDbVersion()
  const microciclo = db.microciclos.byUsuario(usuarioId).find((m) => m.estado === 'activo')

  if (!microciclo) {
    return <EmptyState titulo="Sin microciclo activo" detalle="Esta persona no tiene semana vigente." />
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="solo-lectura-nota text-[11px] text-tenue">
        Solo lectura · M{microciclo.numero} · empieza {microciclo.fechaInicio}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DIAS_SEMANA.map((dia) => {
          const sesion = microciclo.sesiones.find((s) => s.dia === dia)
          return (
            <Card key={dia} className="!p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-tenue">{dia}</p>
              {sesion ? (
                <>
                  <p className="mt-1 text-sm font-bold text-texto">{sesion.nombre}</p>
                  <p className="mt-0.5 text-[11px] text-tenue">
                    {sesion.ejercicios.length} ejercicio{sesion.ejercicios.length === 1 ? '' : 's'}
                  </p>
                  <Badge tono={sesionCompleta(sesion) ? 'verde' : 'neutro'}>
                    {sesionCompleta(sesion) ? 'Registrada' : 'Sin registrar'}
                  </Badge>
                </>
              ) : (
                <p className="mt-2 text-xs italic text-tenue">Descanso</p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
