import { useState } from 'react'
import { useSesion } from '../../app/SessionProvider'
import { db, useDbVersion } from '../../data/dbInstance'
import { CabeceraSemanal } from './CabeceraSemanal'
import { Conversacion } from './Conversacion'
import { remitentesDe, tituloDe } from './remitentes'
import { SelectorRemitente } from './SelectorRemitente'

/**
 * La pantalla del chat del asesorado: arriba su revisión de la semana, debajo
 * la conversación con quien elija del equipo.
 *
 * Ya NO clava el id del coach. Lo hizo hasta el 10-sep, y con eso la nutricionista
 * podía escribirle a un asesorado sin que el asesorado tuviera dónde
 * contestarle. Quién aparece lo decide `remitentes.ts`, por rol.
 */
export default function ChatPage() {
  useDbVersion()
  const { usuario } = useSesion()
  const [elegidoId, setElegidoId] = useState<string | null>(null)

  const remitentes = remitentesDe(db.usuarios.list(), usuario.id)
  // El elegido se resuelve en el render y no en un efecto: la lista llega de la
  // nube y puede aparecer después: quedarse con un id que ya no está sería un
  // hilo vacío sin explicación.
  const elegido = remitentes.find((r) => r.id === elegidoId) ?? remitentes[0]

  if (!elegido) {
    return (
      <div className="entrada entrada-1 pt-2">
        <h2 className="font-display text-xl leading-tight text-texto">Tu equipo</h2>
        <p className="mt-1 text-sm leading-relaxed text-tenue">
          Todavía no hay nadie del equipo asignado a tu cuenta. En cuanto lo haya, la
          conversación aparece aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <CabeceraSemanal />

      <section className="entrada entrada-1 flex items-center gap-3">
        <span className="glass grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-sm text-rojo">
          {elegido.avatarIniciales}
        </span>
        <div>
          <h2 className="font-display text-xl leading-tight text-texto">{tituloDe(elegido)}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accion">
            <span className="h-1.5 w-1.5 rounded-full bg-accion" aria-hidden="true" />
            {elegido.rol === 'coach' ? 'Línea directa' : 'Nutrición'}
          </p>
        </div>
      </section>

      <SelectorRemitente
        remitentes={remitentes}
        elegidoId={elegido.id}
        onElegir={setElegidoId}
      />

      <Conversacion
        key={elegido.id}
        yoId={usuario.id}
        otroId={elegido.id}
        titulo={
          elegido.rol === 'coach' ? 'Conversación con tu coach' : 'Conversación con tu nutricionista'
        }
      />
    </div>
  )
}
