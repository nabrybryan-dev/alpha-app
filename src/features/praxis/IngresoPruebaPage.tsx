import { Navigate, useSearchParams } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import type { TurnoId } from '../../domain/praxis/ingreso/guion'
import { puedeVerPraxis } from '../../domain/praxis/acceso'
import { extraerIngreso } from '../../data/praxis/registrador'
import { sesionDeFunciones } from '../../data/supabase'
import { IngresoPrueba } from './ingreso/IngresoPrueba'
import type { Trato } from './motor/entorno'

/**
 * La ruta /praxis/ingreso-prueba: la prueba con cronómetro del cuestionario de ingreso, hablando contra
 * escribiendo (Bryan, 2-oct-2026).
 *
 * SOLO para el equipo, con el MISMO interruptor que /praxis (`domain/praxis/acceso.ts`): un asesorado que llegue
 * aquí vuelve a su portada sin que la pantalla llegue a montarse. Nada se guarda: lo único que sale del teléfono
 * es el texto de cada turno hablado, hacia la función `praxis-registro` (`accion: 'ingreso'`), que ni lo guarda.
 */
const extraer = async (turno: TurnoId, texto: string) => extraerIngreso(await sesionDeFunciones(), { turno, texto })

export default function IngresoPruebaPage() {
  const { usuario } = useSesion()
  const [parametros] = useSearchParams()
  if (!puedeVerPraxis(usuario.rol)) return <Navigate to="/" replace />
  const trato: Trato = parametros.get('trato')?.toLowerCase() === 'usted' ? 'usted' : 'tu'
  return <IngresoPrueba trato={trato} salida={usuario.rol === 'coach' ? '/coach' : '/'} extraer={extraer} />
}
