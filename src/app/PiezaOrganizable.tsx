import type { ReactNode } from 'react'
import { useOrganizacionDeLaSesion } from './organizacionViva'

/**
 * Una parte de una pantalla que la persona puede esconder hablando con Praxis (0179). Si la escondió, no se pinta; si
 * no, se pinta igual que siempre. Para quien no tiene la prueba encendida no cambia nada.
 * El `id` es el de la pieza en `catalogoDePiezas.ts`; `piezaOrganizable.inventario.test.ts` exige que toda pieza que se
 * puede esconder esté envuelta, para que Praxis nunca diga «lo escondí» con la parte todavía a la vista.
 */
export function PiezaOrganizable({ id, children }: { id: string; children: ReactNode }) {
  const org = useOrganizacionDeLaSesion()
  return org.ocultas.has(id) ? null : <>{children}</>
}
