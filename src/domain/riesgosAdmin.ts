/**
 * Riesgos de la empresa para Administración (pedido de Bryan, 29-sep): financieros, operativos y de
 * estrategia. El tablero de la migración 0102 NO tiene una sección «riesgos»; por eso no se inventa
 * ninguno: se muestran las FILAS ROJAS de secciones que sí existen.
 *
 *   · financieros → filas rojas de «finanzas»,
 *   · operativos  → filas rojas de «desvios» (lo que se sale de lo estandarizado),
 *   · de estrategia → filas rojas de «plan» (el plan de 90 días y la operación).
 *
 * Una sección sin corte o con datos inválidos NO es «sin riesgos»: se dice FALTA o dato no válido.
 * Si el exportador agrega la sección 'riesgos' (propuesta en el PR), esto se reemplaza por ella.
 *
 * Sin React, sin red.
 */
import { nombreDueno, type FilaDetalle, type Seccion, type SeccionLeida } from './adminTablero'

export const CLASES_RIESGO = ['financiero', 'operativo', 'estrategia'] as const
export type ClaseRiesgo = (typeof CLASES_RIESGO)[number]

export const NOMBRE_CLASE_RIESGO: Record<ClaseRiesgo, string> = {
  financiero: 'Riesgos financieros',
  operativo: 'Riesgos operativos',
  estrategia: 'Riesgos de estrategia',
}

/** De qué sección del tablero sale cada clase. */
export const SECCION_DE_RIESGO: Record<ClaseRiesgo, Seccion> = {
  financiero: 'finanzas',
  operativo: 'desvios',
  estrategia: 'plan',
}

export interface Riesgo {
  id: string
  titulo: string
  cifra: string
  detalle: string
  queHacer: string
  dueno: string
  fuente: string | null
}

export type GrupoRiesgo =
  | { clase: ClaseRiesgo; estado: 'falta' }
  | { clase: ClaseRiesgo; estado: 'invalida'; motivo: string }
  | { clase: ClaseRiesgo; estado: 'sin_rojos'; corte: string }
  | { clase: ClaseRiesgo; estado: 'con_riesgos'; corte: string; riesgos: Riesgo[] }

export function riesgoDeFila(f: FilaDetalle): Riesgo {
  const archivo = f.fuente.archivo.trim()
  return {
    id: f.id,
    titulo: f.titulo,
    cifra: f.cifra,
    detalle: f.detalle,
    queHacer: f.queHacer,
    dueno: nombreDueno(f.dueno),
    fuente: archivo === '' ? null : `${archivo}${f.fuente.corte.trim() ? ` · ${f.fuente.corte.trim()}` : ''}`,
  }
}

/** Los tres grupos, en orden, a partir de las secciones ya leídas del tablero. */
export function riesgosDeSecciones(secciones: readonly SeccionLeida[]): GrupoRiesgo[] {
  return CLASES_RIESGO.map((clase): GrupoRiesgo => {
    const s = secciones.find((x) => x.seccion === SECCION_DE_RIESGO[clase])
    if (!s || s.estado === 'sin_corte') return { clase, estado: 'falta' }
    if (s.estado === 'invalida') return { clase, estado: 'invalida', motivo: s.motivo }
    const riesgos = s.datos.filas.filter((f) => f.semaforo === 'rojo').map(riesgoDeFila)
    return riesgos.length === 0 ? { clase, estado: 'sin_rojos', corte: s.corte } : { clase, estado: 'con_riesgos', corte: s.corte, riesgos }
  })
}

/** Cuántos riesgos en rojo hay en total (para la frase de la tarjeta). */
export function contarRiesgos(grupos: readonly GrupoRiesgo[]): number {
  return grupos.reduce((n, g) => n + (g.estado === 'con_riesgos' ? g.riesgos.length : 0), 0)
}
