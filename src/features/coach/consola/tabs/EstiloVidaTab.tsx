import { Card } from '../../../../components/ui/Card'
import { db, useDbVersion } from '../../../../data/dbInstance'
import { PendienteDeCadena } from '../PendienteDeCadena'

/**
 * Módulo 6: adherencia nutricional (real) como la única señal de estilo de
 * vida que hoy existe en esta capa de datos. La prescripción de estilo de
 * vida propiamente dicha (el agente con fuentes citadas), los mensajes
 * automáticos y la ondulación flexible son del agente de fase 2 — honesto
 * vacío, nunca inventado.
 */
export function EstiloVidaTab({ usuarioId }: { usuarioId: string }) {
  useDbVersion()
  const adherencias = [...db.nutricion.adherenciasByUsuario(usuarioId)].reverse().slice(0, 14)

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <p className="kicker">Adherencia nutricional reciente</p>
        {adherencias.length === 0 ? (
          <p className="mt-2 text-sm text-tenue">Sin registros de adherencia todavía.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1">
            {adherencias.map((a) => (
              <span
                key={a.id}
                title={`${a.fecha}${a.comentario ? ` — ${a.comentario}` : ''}`}
                className={`h-6 w-6 rounded ${
                  a.estado === 'si' ? 'bg-verde' : a.estado === 'parcial' ? 'bg-ambar' : 'bg-rojo'
                }`}
              />
            ))}
          </div>
        )}
      </Card>

      <PendienteDeCadena
        titulo="Prescripción de estilo de vida, mensajes automáticos y ondulación flexible"
        detalle="El agente de estilo de vida (fuentes citadas, nunca quita entrenamiento) y sus mensajes automáticos son de la fase 2. Llega cuando la cadena sincronice."
      />
    </div>
  )
}
