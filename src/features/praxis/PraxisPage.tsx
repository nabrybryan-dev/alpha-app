import { useMemo } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { usePuestoCoach } from '../coach/consola/usePuestoCoach'
import { puedeVerPraxis } from '../../domain/praxis/acceso'
import { CAPACIDADES, type Capacidad } from '../../data/consola/capacidadesStaff'
import type { PerfilAcceso } from '../../app/rutas'
import { CUENTAS_DE_PRUEBA_ORGANIZAR, organizarEncendidoPara } from '../../domain/praxis/rapidezLocal'
import { ComprobandoAcceso } from './ComprobandoAcceso'
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
  const { esCoach: ocupaElPuesto, cargando } = usePuestoCoach(usuario.rol)
  const [parametros] = useSearchParams()

  // Quien ocupa el puesto de coach (la cuenta personal de Bryan) entra; mientras se sabe, no se decide nada.
  if (usuario.rol === 'asesorado' && cargando) return <ComprobandoAcceso />
  if (!puedeVerPraxis(usuario.rol, undefined, ocupaElPuesto)) return <Navigate to="/" replace />

  // El trato lo elegirá la persona al inscribirse; mientras solo la vea el staff, se cambia con ?trato=usted.
  const trato: Trato = parametros.get('trato')?.toLowerCase() === 'usted' ? 'usted' : 'tu'
  // El coach no llena check-in: su ruta /bienestar lo devuelve a su panel, así que a él no se le ofrece el formulario.
  const esCoach = usuario.rol === 'coach'
  return <PraxisConectada usuarioId={usuario.id} nombre={usuario.nombre} trato={trato} salida={esCoach ? '/coach' : '/'} conFormulario={!esCoach} />
}

/** Va aparte para que la conexión solo se cree DESPUÉS de pasar la guarda. */
function PraxisConectada({ usuarioId, nombre, trato, salida, conFormulario }: { usuarioId: string; nombre: string; trato: Trato; salida: string; conFormulario: boolean }) {
  const navegar = useNavigate()
  const { usuario } = useSesion()
  const { cargando, tiene } = usePuestoCoach(usuario.rol)
  // Solo con organizar encendido (la bandera, o las cuentas de prueba de Bryan). Apagado, `perfil` es siempre `undefined` y la
  // conexión no cambia entre renders (si cambiara, la escena se remontaría). Mientras se saben las capacidades no se ofrece organizar.
  // Las cuentas de prueba ven el menú de un ASESORADO («tal cual lo verá un asesorado», Bryan 11-nov).
  const encendido = organizarEncendidoPara(usuarioId)
  const comoAsesorado = CUENTAS_DE_PRUEBA_ORGANIZAR.has(usuarioId)
  const capacidadesTexto = CAPACIDADES.filter((c) => tiene(c)).join(',')
  const perfil = useMemo<PerfilAcceso | undefined>(
    () => (!encendido || cargando ? undefined
      : comoAsesorado ? { rol: 'asesorado', capacidades: new Set<Capacidad>() }
        : { rol: usuario.rol, capacidades: new Set(capacidadesTexto ? (capacidadesTexto.split(',') as Capacidad[]) : []) }),
    [encendido, comoAsesorado, cargando, usuario.rol, capacidadesTexto],
  )
  // Estable entre renders: si cambiara, la escena se remontaría y la conversación se perdería.
  const conexion = useMemo(
    () => crearConexionPraxis(usuarioId, conFormulario ? () => navegar('/bienestar') : null, nombre, undefined, perfil ? { perfil, navegar: (ruta) => navegar(ruta) } : undefined, encendido),
    [usuarioId, nombre, navegar, conFormulario, perfil, encendido],
  )
  return <PraxisCosmos trato={trato} salida={salida} conexion={conexion} />
}
