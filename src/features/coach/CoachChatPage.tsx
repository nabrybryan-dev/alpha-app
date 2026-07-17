import { useState } from 'react'
import { useSesion } from '../../app/SessionProvider'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { db, useDbVersion } from '../../data/dbInstance'
import { Conversacion } from '../chat/Conversacion'

export default function CoachChatPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const [abiertoId, setAbiertoId] = useState<string | undefined>()

  const asesorados = db.usuarios.asesorados()
  const hilos = asesorados
    .map((a) => {
      const hilo = db.mensajes.hilo(usuario.id, a.id)
      return {
        asesorado: a,
        ultimo: hilo[hilo.length - 1],
        noLeidos: db.mensajes.noLeidosDe(usuario.id, a.id),
      }
    })
    .sort((x, y) => y.noLeidos - x.noLeidos)

  const abierto = asesorados.find((a) => a.id === abiertoId)

  if (abierto) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setAbiertoId(undefined)} className="text-left text-sm font-bold text-tenue">
          ← Bandeja
        </button>
        <h2 className="font-display text-xl text-texto">{abierto.nombre}</h2>
        <Conversacion yoId={usuario.id} otroId={abierto.id} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <p className="kicker">Mensajes</p>
        <h2 className="font-display text-3xl text-texto">Bandeja</h2>
      </section>
      <section className="flex flex-col gap-2">
        {hilos.map(({ asesorado, ultimo, noLeidos }) => (
          <button key={asesorado.id} type="button" onClick={() => setAbiertoId(asesorado.id)} className="text-left">
            <Card className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold text-texto">
                {asesorado.avatarIniciales}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm text-texto">{asesorado.nombre}</p>
                <p className="truncate text-xs text-tenue">{ultimo?.texto ?? 'Sin mensajes aún'}</p>
              </div>
              {noLeidos > 0 && <Badge tono="rojo">{noLeidos}</Badge>}
            </Card>
          </button>
        ))}
      </section>
    </div>
  )
}
