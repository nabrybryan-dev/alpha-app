import { useSesion } from '../../app/SessionProvider'
import { Conversacion } from './Conversacion'

export default function ChatPage() {
  const { usuario } = useSesion()

  return (
    <div className="flex flex-col gap-3">
      <section>
        <p className="kicker">Línea directa</p>
        <h2 className="font-display text-2xl text-texto">Chat con tu coach</h2>
      </section>
      <Conversacion yoId={usuario.id} otroId="u-bryan" />
    </div>
  )
}
