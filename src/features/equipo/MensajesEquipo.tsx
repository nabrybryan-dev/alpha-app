import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db, idCoach, useDbVersion } from '../../data/dbInstance'

/**
 * Tarjeta «Mensajes» de Equipo con pestañas (maqueta «Espacios de Alpha», 28-sep): con quién
 * se habla. Solo enseña lo que la app SABE:
 *
 *   · Asesorados: quiénes le escribieron y no ha leído (`noLeidosDe`, la misma cuenta del chat).
 *   · Creadores: la app todavía no tiene mensajería con creadores (el contacto lo lleva Bryan
 *     por fuera), así que la pestaña lo dice en vez de inventar una bandeja.
 *   · Bryan: la conversación con el coach, con sus no leídos.
 *
 * Nunca se muestra el TEXTO de un mensaje aquí (puede traer salud): solo quién y cuántos.
 */

type Pestana = 'asesorados' | 'creadores' | 'bryan'

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: 'asesorados', nombre: 'Asesorados' },
  { id: 'creadores', nombre: 'Creadores' },
  { id: 'bryan', nombre: 'Bryan' },
]

export function MensajesEquipo({ usuarioId }: { usuarioId: string }) {
  useDbVersion()
  const [pestana, setPestana] = useState<Pestana>('asesorados')
  const coachId = idCoach()
  const deAsesorados = db.usuarios
    .entrenan()
    .filter((u) => u.id !== usuarioId && u.id !== coachId)
    .map((u) => ({ id: u.id, nombre: u.nombre, n: db.mensajes.noLeidosDe(usuarioId, u.id) }))
    .filter((f) => f.n > 0)
  const deBryan = db.mensajes.noLeidosDe(usuarioId, coachId)
  const total = db.mensajes.noLeidosPara(usuarioId)

  return (
    <section
      aria-label="Mensajes"
      className="entrada entrada-3 flex flex-col gap-2.5 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Mensajes</span>
        {total > 0 ? (
          <span className="cifras text-xs font-bold text-rojo">
            {total} {total === 1 ? 'nuevo' : 'nuevos'}
          </span>
        ) : (
          <span className="text-xs text-tenue">al día</span>
        )}
      </div>

      <div role="tablist" aria-label="Con quién" className="grid grid-cols-3 gap-1.5">
        {PESTANAS.map((p) => {
          const activa = pestana === p.id
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`mensajes-tab-${p.id}`}
              aria-selected={activa}
              aria-controls="mensajes-panel"
              onClick={() => setPestana(p.id)}
              className={`press min-h-[44px] rounded-[10px] text-[13px] ${
                activa ? 'bg-texto font-extrabold text-bg' : 'border border-linea font-semibold text-tenue'
              }`}
            >
              {p.nombre}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id="mensajes-panel" aria-labelledby={`mensajes-tab-${pestana}`} className="flex flex-col">
        {pestana === 'asesorados' &&
          (deAsesorados.length === 0 ? (
            <p className="border-t border-linea py-3 text-sm text-tenue">Ningún asesorado te ha escrito sin leer.</p>
          ) : (
            <ul>
              {deAsesorados.map((f) => (
                <li key={f.id}>
                  <Link
                    to="/chat"
                    aria-label={`${f.nombre}: ${f.n} ${f.n === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}. Abrir el chat`}
                    className="press flex min-h-[56px] items-center gap-3 border-t border-linea"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-texto">{f.nombre}</span>
                    <span className="cifras shrink-0 text-xs font-bold text-rojo">
                      {f.n} {f.n === 1 ? 'nuevo' : 'nuevos'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}

        {pestana === 'creadores' && (
          <p className="border-t border-linea py-3 text-sm text-tenue">
            La app todavía no tiene mensajes con creadores: el contacto lo lleva Bryan por fuera. Lo que se decida
            sobre ellos queda en «Decisiones compartidas».
          </p>
        )}

        {pestana === 'bryan' && (
          <Link
            to="/chat"
            className="press flex min-h-[56px] items-center justify-between gap-3 border-t border-linea"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-texto">Conversación con el coach</span>
              <span className="text-xs text-tenue">Abrir el chat</span>
            </span>
            {deBryan > 0 ? (
              <span className="cifras shrink-0 text-xs font-bold text-rojo">
                {deBryan} {deBryan === 1 ? 'nuevo' : 'nuevos'}
              </span>
            ) : (
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rojo/15 text-base text-rojo">
                →
              </span>
            )}
          </Link>
        )}
      </div>
    </section>
  )
}
