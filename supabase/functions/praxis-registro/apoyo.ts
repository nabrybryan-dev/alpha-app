// Dos decisiones chicas sacadas de `manejar` y `proponer` (index.ts) para no engordarlos: sin cambios de comportamiento.
import { puedeVerPraxis, type Rol } from '../../../src/domain/praxis/acceso.ts'
import { caminoRapido, type ContextoRegistro } from '../../../src/domain/praxis/registro/index.ts'

/** ¿Esta cuenta entra a Praxis? Un rol desconocido (no se pudo leer) se cierra, igual que antes. */
export function puedeEntrar(rol: string | undefined, ocupaElPuesto: boolean): boolean {
  const conocido = rol === 'asesorado' || rol === 'coach' || rol === 'nutricionista'
  return conocido && puedeVerPraxis(rol as Rol, undefined, ocupaElPuesto)
}

/** El camino rápido (3-oct), salvo que `PRAXIS_CAMINO_RAPIDO=0` lo apague. Ante cualquier fallo, `null` y se llama al modelo. */
export function intentarCaminoRapido(interruptor: string | undefined, frase: string, ctx: ContextoRegistro): { bruto: unknown } | null {
  if (interruptor === '0') return null
  try { return caminoRapido(frase, ctx) } catch { return null }
}
