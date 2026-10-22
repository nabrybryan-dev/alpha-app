import type { Area } from './enrutador'
import type { DatoQueFalta, LoQuePraxisVe } from './plan/listaBlanca'

/**
 * Paso 2 del diseño operativo (DISENO-OPERATIVO-PRAXIS-20261017.md): qué parte de lo que Praxis
 * ya ve de UNA persona (la lista blanca, `LoQuePraxisVe`) lee cada área. Es nivel L0, solo lectura.
 *
 * El aislamiento por persona NO se decide aquí: `loQuePraxisVe` se arma para una sola persona y
 * este módulo solo recorta esa vista por área, nunca trae datos de nadie más. Nada nuevo se
 * lee de la base: lo que la lista blanca no expone (cribado, medidas, notas del staff) no puede
 * aparecer aquí porque este módulo solo nombra claves de `LoQuePraxisVe`.
 *
 * EL MAPA ES PROVISIONAL, de Claude, sin firma de Bryan. `avisos` y `chat` no leen datos de la
 * persona: los avisos son del staff y el chat es la conversación misma.
 */

type ClaveDeDatos = Exclude<keyof LoQuePraxisVe, 'falta'>

export const FUENTES_POR_AREA: Readonly<Record<Area, readonly ClaveDeDatos[]>> = {
  entrenar: ['activo', 'cerrados'],
  nutricion: ['comida', 'adherencias', 'hidratacionHoyMl'],
  plan: ['activo', 'perfil'],
  hoy: ['activo', 'checkins', 'adherencias', 'hidratacionHoyMl'],
  progreso: ['cerrados', 'checkins'],
  bienestar: ['checkins'],
  // Solo lo que la persona ya anotó (ánimo, estrés, comentarios del check-in). No deduce nada: el contenido clínico espera a un psicólogo.
  relacion: ['checkins'],
  avisos: [],
  chat: [],
}

/** Qué clave de datos cubre cada «falta» de la lista blanca. */
const CLAVE_DE_LA_FALTA: Readonly<Record<DatoQueFalta, ClaveDeDatos>> = {
  plan_activo: 'activo',
  perfil: 'perfil',
  checkins: 'checkins',
  plan_de_comida: 'comida',
}

export type LecturaDeArea = Partial<Omit<LoQuePraxisVe, 'falta'>> & { falta: DatoQueFalta[] }

/** Recorta la vista de una persona a lo que esa área lee. Devuelve una copia superficial. */
export function leerPorArea(area: Area, vista: LoQuePraxisVe): LecturaDeArea {
  const claves = FUENTES_POR_AREA[area]
  const lectura: Record<string, unknown> = {}
  for (const clave of claves) lectura[clave] = vista[clave]
  const falta = vista.falta.filter((f) => claves.includes(CLAVE_DE_LA_FALTA[f]))
  return { ...lectura, falta } as LecturaDeArea
}
