import { Navigate, useSearchParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { usePuestoCoach } from '../coach/consola/usePuestoCoach'
import { puedeVerPraxis } from '../../domain/praxis/acceso'
import type { Trato } from './motor/entorno'
import { PraxisCosmos } from './PraxisCosmos'

/**
 * /praxis/ejemplo: la maqueta cosmos aprobada el 28-sep, COMPLETA y con sus datos de ejemplo
 * —el check-in guiado de cuatro turnos, el pentagrama, la firma del día, el eco—, que la
 * pantalla conectada todavía no puede montar (el registrador no guarda un check-in a
 * medias, P2). Sirve para seguir viendo el diseño entero mientras tanto.
 *
 * Misma guarda que /praxis (solo el equipo) y sin conexión: no lee ni escribe nada de nadie,
 * y lo dice a la vista con su sello «Datos de ejemplo». Su Quieta todavía dice «Bryan ya
 * recibió tu frase»; lleva el sello de ejemplo justo para que nadie lo tome por cierto.
 */
export default function PraxisEjemploPage() {
  const { usuario } = useSesion()
  const { esCoach, cargando } = usePuestoCoach(usuario.rol)
  const [parametros] = useSearchParams()
  // Quien ocupa el puesto de coach (la cuenta personal de Bryan) entra; mientras se sabe, no se decide nada.
  if (usuario.rol === 'asesorado' && cargando) return null
  if (!puedeVerPraxis(usuario.rol, undefined, esCoach)) return <Navigate to="/" replace />
  const trato: Trato = parametros.get('trato')?.toLowerCase() === 'usted' ? 'usted' : 'tu'
  return <PraxisCosmos trato={trato} salida="/praxis" />
}
