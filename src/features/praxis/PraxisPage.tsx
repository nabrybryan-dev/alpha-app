import { Navigate, useSearchParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { puedeVerPraxis } from '../../domain/praxis/acceso'
import { PraxisCosmos } from './PraxisCosmos'

/**
 * La ruta /praxis.
 *
 * Publicada el 29-sep-2026 como excepción firmada por Bryan, pero SOLO para el staff: lo
 * que enseña son datos de ejemplo y el cerebro de Praxis no está desplegado. Un asesorado
 * que llegue aquí —por el enlace, escribiendo la dirección o con cualquier parámetro—
 * vuelve a su portada sin que la escena llegue a montarse.
 *
 * La guarda es de pantalla, no de datos: aquí no hay datos que proteger, porque la escena
 * no lee nada de la base. El día que los lea, la protección va en RLS, no en este archivo.
 */
export default function PraxisPage() {
  const { usuario } = useSesion()
  const [parametros] = useSearchParams()

  if (!puedeVerPraxis(usuario.rol)) return <Navigate to="/" replace />

  // En la app el trato lo elegirá la persona al inscribirse; mientras sea una demostración
  // para el staff, se cambia con ?trato=usted.
  const trato = parametros.get('trato')?.toLowerCase() === 'usted' ? 'usted' : 'tu'
  return <PraxisCosmos trato={trato} salida={usuario.rol === 'coach' ? '/coach' : '/'} />
}
