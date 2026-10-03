import { Link, Navigate, useParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { db, useDbVersion } from '../../data/dbInstance'
import { Conversacion } from '../chat/Conversacion'
import { Cargando } from '../plan/comun'
import { puedeAbrirHilo } from './hiloAsesorado'
import { useCapacidadesVigentes } from './useCapacidadesVigentes'

/**
 * Hilo de Manuela con un asesorado (`/equipo/mensajes/:asesoradoId`; decisión de Bryan, 30-sep).
 * Es SU hilo (ella y el asesorado), no el del coach: la base solo deja leer y escribir los
 * mensajes donde ella es emisora o destinataria. Exige `responder_por_asesorado` (vigente, sin
 * caché) y que el otro sea un asesorado; si no, vuelve a Equipo sin montar nada.
 */
export default function HiloAsesoradoPage() {
  const { usuario } = useSesion()
  const { asesoradoId = '' } = useParams()
  useDbVersion()
  const { cargando, tiene } = useCapacidadesVigentes()

  if (usuario.rol !== 'nutricionista') return <Navigate to="/" replace />
  if (cargando) return <Cargando texto="Cargando tus permisos…" />
  const otro = db.usuarios.byId(asesoradoId)
  if (!puedeAbrirHilo(usuario, tiene('responder_por_asesorado'), otro) || !otro) {
    return <Navigate to="/equipo" replace />
  }

  return (
    <div className="flex flex-col gap-3">
      <Link to="/equipo" className="press inline-flex min-h-[44px] items-center text-sm font-bold text-tenue">
        ← Equipo
      </Link>
      <h2 className="font-display text-xl text-texto">{otro.nombre}</h2>
      <Conversacion yoId={usuario.id} otroId={otro.id} titulo={`Conversación con ${otro.nombre.split(' ')[0]}`} />
    </div>
  )
}
