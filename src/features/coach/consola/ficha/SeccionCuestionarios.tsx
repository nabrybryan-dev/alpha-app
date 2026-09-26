import { Badge } from '../../../../components/ui/Badge'
import { db } from '../../../../data/dbInstance'
import { ResponderComoStaff } from '../ResponderComoStaff'
import { Falta, Tarjeta } from '../piezas'

/**
 * Cuestionarios de la persona: los pendientes (con «Responder como coach») y los ya
 * respondidos, con cada respuesta junto a su pregunta — no un JSON de claves.
 */
export function SeccionCuestionarios({ usuarioId, i, className = '' }: { usuarioId: string; i: number; className?: string }) {
  const asignados = db.cuestionarios.asignadosA(usuarioId)
  const respuestas = [...db.cuestionarios.respuestasDe(usuarioId)].sort((a, b) => b.fechaIso.localeCompare(a.fechaIso))
  const idsRespondidos = new Set(respuestas.map((r) => r.cuestionarioId))
  const pendientes = asignados.filter((c) => !idsRespondidos.has(c.id))
  const nombre = db.usuarios.byId(usuarioId)?.nombre ?? 'esta persona'

  return (
    <Tarjeta
      titulo="Cuestionarios"
      i={i}
      className={className}
      extra={
        pendientes.length > 0 ? <Badge tono="ambar">{pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}</Badge> : undefined
      }
    >
      {asignados.length === 0 && respuestas.length === 0 && (
        <Falta
          que="Ningún cuestionario asignado ni respondido"
          como="Los asigna el coach, o la cadena cuando le falta un dato (origen «cadena»)."
        />
      )}

      {pendientes.length > 0 && (
        <>
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-tenue">Cuestionarios pendientes</p>
          <ul className="mt-1.5 flex flex-col gap-2">
            {pendientes.map((c) => (
              <li key={c.id} className="rounded-lg border border-linea bg-surface-2 p-2.5 text-sm">
                <p className="font-bold text-texto">
                  {c.titulo} {c.origen === 'cadena' && <Badge tono="azul">de la cadena</Badge>}
                </p>
                {c.descripcion && <p className="mt-0.5 text-xs text-tenue">{c.descripcion}</p>}
                <ResponderComoStaff cuestionarioId={c.id} nombrePersona={nombre} />
              </li>
            ))}
          </ul>
        </>
      )}

      {respuestas.length > 0 && (
        <div className={pendientes.length > 0 ? 'mt-3 border-t border-linea pt-2.5' : ''}>
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-tenue">Respondidos ({respuestas.length})</p>
          <ul className="mt-1.5 flex flex-col gap-2">
            {respuestas.map((r) => {
              const c = asignados.find((q) => q.id === r.cuestionarioId)
              return (
                <li key={r.id} className="rounded-lg border border-linea p-2.5 text-[13px]">
                  <details>
                    <summary className="flex cursor-pointer items-center justify-between gap-2 font-bold text-texto">
                      <span>{c?.titulo ?? 'Cuestionario'}</span>
                      <span className="cifras text-[11px] font-normal text-tenue">{r.fechaIso.slice(0, 10)}</span>
                    </summary>
                    <dl className="desplegar mt-2 flex flex-col gap-1.5">
                      {Object.entries(r.valores).map(([clave, valor]) => (
                        <div key={clave}>
                          <dt className="text-[11px] text-tenue">{c?.preguntas.find((p) => p.id === clave)?.enunciado ?? clave}</dt>
                          <dd className="m-0 text-texto/90">{valor || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Tarjeta>
  )
}
