/**
 * Los TRES SOMBREROS del equipo (maqueta 7, paso 9 del plan 14).
 *
 * La misma persona hace entrenamiento, nutrición y administración el mismo día. El diseño
 * decidió no cambiar de modo —un modo que esconde trabajo esconde alarmas—: se ven juntos y
 * se filtran. Este módulo es la parte pura: qué cuenta cada chip, qué deja ver el filtro y
 * cómo se llaman. La seguridad (dolor del check-in) NO es un sombrero y no se filtra nunca;
 * de eso se ocupa `seguridad.ts`.
 *
 * Sin React y sin I/O: lo usan la Bandeja, el Hoy del equipo, Equipo y Empresa.
 */

/** Los tres sombreros de verdad. «Todo» es el estado de partida, no un cuarto sombrero. */
export type Sombrero = 'entreno' | 'nutricion' | 'administracion'

/** Lo que se puede elegir en la fila de chips: ver todo, o un sombrero. */
export type FiltroSombrero = 'todo' | Sombrero

export const SOMBREROS: readonly FiltroSombrero[] = ['todo', 'entreno', 'nutricion', 'administracion']

export const NOMBRE_SOMBRERO: Record<FiltroSombrero, string> = {
  todo: 'Todo',
  entreno: 'Entreno',
  nutricion: 'Nutrición',
  administracion: 'Administración',
}

/** Cualquier cosa que se pueda colgar de un sombrero: una firma, una tarea, una herramienta. */
export interface ConSombrero {
  sombrero: Sombrero
}

/** Cuántos pendientes tiene cada sombrero, más el total. Siempre las cuatro claves. */
export function contarPorSombrero<T extends ConSombrero>(
  items: readonly T[],
): Record<FiltroSombrero, number> {
  const cuenta: Record<FiltroSombrero, number> = {
    todo: items.length,
    entreno: 0,
    nutricion: 0,
    administracion: 0,
  }
  for (const item of items) cuenta[item.sombrero] += 1
  return cuenta
}

/** Los del sombrero elegido. «Todo» devuelve una copia: nadie ordena la lista original por accidente. */
export function filtrarPorSombrero<T extends ConSombrero>(
  items: readonly T[],
  filtro: FiltroSombrero,
): T[] {
  return filtro === 'todo' ? [...items] : items.filter((item) => item.sombrero === filtro)
}
