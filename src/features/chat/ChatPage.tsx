import { useSesion } from '../../app/SessionProvider'
import { db, idCoach } from '../../data/dbInstance'
import { Conversacion } from './Conversacion'

export default function ChatPage() {
  const { usuario } = useSesion()
  const coach = db.usuarios.byId(idCoach())

  return (
    <div className="flex flex-col gap-3">
      <section className="entrada entrada-1 flex items-center gap-3 pt-2">
        <span className="glass grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-sm text-rojo">
          {coach?.avatarIniciales ?? 'C'}
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight text-texto">
            {coach ? `Coach ${coach.nombre.split(' ')[0]}` : 'Tu coach'}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-tenue">
            <span className="h-1.5 w-1.5 rounded-full bg-verde" aria-hidden="true" />
            Línea directa
          </p>
        </div>
      </section>
      <Conversacion yoId={usuario.id} otroId={idCoach()} />
    </div>
  )
}
