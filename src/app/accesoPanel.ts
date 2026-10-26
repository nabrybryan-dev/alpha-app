import type { Capacidad } from '../data/consola/capacidadesStaff'

/**
 * Las puertas del panel, en UN solo sitio (revisión ciega de la zona 4, 25-oct).
 *
 * `CoachLayout` decide con estas funciones si deja entrar, y `EmpresaPage` decide con las
 * mismas qué enlaces ofrece. Antes cada pantalla escribía su propia lista de capacidades y
 * se separaron: Empresa ofrecía Estrategias a quien tuviera `decisiones_compartidas`, y la
 * puerta de `/coach/estrategias` lo devolvía a la portada. Un enlace que lleva a una
 * pantalla que te echa es una promesa falsa; con una sola función no puede volver a pasar.
 */

/** La forma mínima que necesitan las puertas: lo que devuelve `usePuestoCoach`. */
export interface PuestoDePanel {
  esCoach: boolean
  cargando: boolean
  tiene: (capacidad: Capacidad) => boolean
}

/** La consola: el coach, o el staff con `leer_entrenamiento`. */
export function puedeVerConsola({ esCoach, cargando, tiene }: PuestoDePanel): boolean {
  return esCoach || (!cargando && tiene('leer_entrenamiento'))
}

/** Estrategias: el coach entra siempre; el resto, con mercadeo o creadores. */
export function puedeVerEstrategias({ esCoach, tiene }: PuestoDePanel): boolean {
  return esCoach || tiene('responder_mercadeo') || tiene('revisar_creadores')
}

/**
 * Administración: al coach se le pide `ver_administracion` (sin ella ve «sin permiso»); al
 * resto le vale cualquiera de las tres capacidades que ya abrían la pantalla.
 */
export function puedeVerAdministracion({ esCoach, cargando, tiene }: PuestoDePanel): boolean {
  if (cargando) return false
  if (esCoach) return tiene('ver_administracion')
  return tiene('organizar_plan') || tiene('decisiones_compartidas') || tiene('ver_administracion')
}

/** Creadores: el coach entra siempre; el resto, con `revisar_creadores`. */
export function puedeVerCreadores({ esCoach, cargando, tiene }: PuestoDePanel): boolean {
  return esCoach || (!cargando && tiene('revisar_creadores'))
}
