import type { Rol } from '../../domain/types'

/**
 * ¿Puede quien mira abrir el hilo de este asesorado desde Equipo? (decisión de Bryan, 30-sep)
 *
 * Solo una nutricionista con la capacidad `responder_por_asesorado`, y solo con un asesorado
 * distinto de ella: nunca con el coach ni con otro miembro del equipo. El hilo que se abre es el
 * SUYO con el asesorado (ella y él); la base (RLS de `mensajes`, 0001/0067) solo deja leer y
 * escribir los mensajes donde ella es emisora o destinataria, así que esta regla de la app no
 * abre nada que la base no abra ya: solo evita ofrecer lo que no se debe.
 */
export function puedeAbrirHilo(
  yo: { id: string; rol: Rol },
  tieneCapacidad: boolean,
  otro: { id: string; rol: Rol } | undefined,
): boolean {
  if (!tieneCapacidad || yo.rol !== 'nutricionista') return false
  return otro !== undefined && otro.rol === 'asesorado' && otro.id !== yo.id
}

export const rutaHiloAsesorado = (asesoradoId: string) => `/equipo/mensajes/${asesoradoId}`
