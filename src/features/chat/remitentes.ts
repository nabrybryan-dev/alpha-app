import type { Usuario } from '../../domain/types'

/**
 * Con quién puede hablar un asesorado desde la pantalla del chat.
 *
 * Es el equipo, no «el coach»: la nutricionista escribe con su propia firma y
 * tiene su propio hilo. Por eso se filtra por ROL y no por un id fijo, que era
 * lo que hacía `ChatPage` antes del 10-sep.
 *
 * Dos reglas que no son obvias:
 *
 * 1. **Nadie se ve a sí mismo.** La nutricionista del equipo también entrena
 *    con el plan, así que abre esta misma pantalla como asesorada; sin este
 *    filtro se ofrecería un hilo consigo misma.
 * 2. **El coach va primero**, aunque en la base venga después. El orden de la
 *    lista de usuarios es el de la nube y cambia solo; la pantalla no puede
 *    depender de él.
 */
export function remitentesDe(usuarios: Usuario[], yoId: string): Usuario[] {
  const peso = (u: Usuario) => (u.rol === 'coach' ? 0 : 1)
  return usuarios
    .filter((u) => u.rol === 'coach' || u.rol === 'nutricionista')
    .filter((u) => u.id !== yoId)
    .sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre))
}

/** Cómo se llama ese hilo en la pantalla. El nombre de pila basta y cabe. */
export function tituloDe(usuario: Usuario): string {
  const pila = usuario.nombre.split(' ')[0]
  return usuario.rol === 'coach' ? `Coach ${pila}` : `Nutrición · ${pila}`
}
