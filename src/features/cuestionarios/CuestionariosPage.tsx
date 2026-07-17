import { useState } from 'react'
import { useSesion } from '../../app/SessionProvider'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Sheet } from '../../components/ui/Sheet'
import { db, useDbVersion } from '../../data/dbInstance'
import { XP_POR_ACCION } from '../../domain/gamification'
import type { Cuestionario } from '../../domain/types'
import { ResponderCuestionario } from './ResponderCuestionario'

export default function CuestionariosPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const [abierto, setAbierto] = useState<Cuestionario | undefined>()

  const asignados = db.cuestionarios.asignadosA(usuario.id)
  const respuestas = db.cuestionarios.respuestasDe(usuario.id)
  const pendientes = asignados.filter((q) => !respuestas.some((r) => r.cuestionarioId === q.id))
  const respondidos = asignados.filter((q) => respuestas.some((r) => r.cuestionarioId === q.id))

  return (
    <div className="flex flex-col gap-4">
      <section>
        <p className="kicker">Testeos del coach</p>
        <h2 className="font-display text-3xl text-texto">Cuestionarios</h2>
        <p className="mt-1 text-sm text-tenue">
          Cada respuesta alimenta tu programación. +{XP_POR_ACCION.respuesta} XP por cuestionario.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <p className="kicker">Pendientes</p>
        {pendientes.length === 0 ? (
          <EmptyState titulo="Todo al día" detalle="No tienes cuestionarios pendientes." />
        ) : (
          pendientes.map((q) => (
            <button key={q.id} type="button" onClick={() => setAbierto(q)} className="text-left">
              <Card destacada className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base text-texto">{q.titulo}</h3>
                  <p className="mt-0.5 text-xs text-tenue">{q.descripcion}</p>
                </div>
                <Badge tono="rojo">{q.preguntas.length} preguntas</Badge>
              </Card>
            </button>
          ))
        )}
      </section>

      {respondidos.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="kicker">Respondidos</p>
          {respondidos.map((q) => (
            <Card key={q.id} className="flex items-center justify-between gap-3 opacity-75">
              <h3 className="font-display text-base text-texto">{q.titulo}</h3>
              <Badge tono="verde">✓ Enviado</Badge>
            </Card>
          ))}
        </section>
      )}

      <Sheet abierto={abierto !== undefined} titulo={abierto?.titulo ?? ''} onCerrar={() => setAbierto(undefined)}>
        {abierto && (
          <ResponderCuestionario
            cuestionario={abierto}
            onEnviar={(valores) => {
              db.cuestionarios.responder(abierto.id, usuario.id, valores)
              setAbierto(undefined)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
