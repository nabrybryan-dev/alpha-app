import { useMemo } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { puedeVerPraxis } from '../../domain/praxis/acceso'
import { crearConexionPraxis } from './conexionReal'
import type { Trato } from './motor/entorno'
import { PraxisCosmos } from './PraxisCosmos'

/**
 * La ruta /praxis.
 *
 * Desde el 1-oct-2026 es la pantalla CONECTADA: lee los datos reales de la persona con
 * sesión (por la lista blanca), manda lo que se escribe al registrador y guarda solo lo
 * confirmado. Sigue siendo SOLO para el staff: el interruptor de `domain/praxis/acceso.ts`
 * no se tocó. Un asesorado que llegue aquí —por el enlace, escribiendo la dirección o con
 * cualquier parámetro— vuelve a su portada sin que la escena llegue a montarse y sin que se
 * lea nada suyo.
 *
 * La guarda de arriba es de PANTALLA. La de datos ya no vive solo aquí: lo que la persona
 * puede leer lo decide la RLS (lee con su JWT), y lo que Praxis puede decirle lo decide la
 * lista blanca de `domain/praxis/plan/listaBlanca.ts`.
 */
export default function PraxisPage() {
  const { usuario } = useSesion()
  const [parametros] = useSearchParams()

  if (!puedeVerPraxis(usuario.rol)) return <Navigate to="/" replace />

  // El trato lo elegirá la persona al inscribirse; mientras solo la vea el staff, se cambia con ?trato=usted.
  const trato: Trato = parametros.get('trato')?.toLowerCase() === 'usted' ? 'usted' : 'tu'
  // El coach no llena check-in: su ruta /bienestar lo devuelve a su panel, así que a él no se le ofrece el formulario.
  const esCoach = usuario.rol === 'coach'
  return <PraxisConectada usuarioId={usuario.id} trato={trato} salida={esCoach ? '/coach' : '/'} conFormulario={!esCoach} />
}

/** Va aparte para que la conexión solo se cree DESPUÉS de pasar la guarda. */
function PraxisConectada({ usuarioId, trato, salida, conFormulario }: { usuarioId: string; trato: Trato; salida: string; conFormulario: boolean }) {
  const navegar = useNavigate()
  // Estable entre renders: si cambiara, la escena se remontaría y la conversación se perdería.
  const conexion = useMemo(() => crearConexionPraxis(usuarioId, conFormulario ? () => navegar('/bienestar') : null), [usuarioId, navegar, conFormulario])
  return <PraxisCosmos trato={trato} salida={salida} conexion={conexion} />
}
