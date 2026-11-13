// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).
import { piezaMostrada, type PiezaDeLaBiblioteca, type RespuestaCharla } from './pedidoCharla.ts'

/**
 * Decisión de salida y respaldo sin modelo. PURO.
 *
 * FALLA CERRADO: la frase llega al modelo SOLO si el lector de riesgo dijo, explícitamente, «sin riesgo». Si dijo
 * otra cosa, falló o tardó más del tope, la frase va al coach y NO se llama al modelo.
 */
export type LecturaDeRiesgo =
  | { tipo: 'sin_riesgo' }
  | { tipo: 'riesgo'; nivel: string }
  | { tipo: 'falla' }
  | { tipo: 'tarda' }

export type DecisionDeSalida =
  | { salida: 'modelo' }
  | { salida: 'coach'; motivo: 'riesgo' | 'lector_falla' | 'lector_tarda' | 'lector_no_claro' }

export function decidirSalida(lectura: LecturaDeRiesgo | null | undefined): DecisionDeSalida {
  if (!lectura) return { salida: 'coach', motivo: 'lector_no_claro' }
  switch (lectura.tipo) {
    case 'sin_riesgo':
      return { salida: 'modelo' }
    case 'riesgo':
      return { salida: 'coach', motivo: 'riesgo' }
    case 'falla':
      return { salida: 'coach', motivo: 'lector_falla' }
    case 'tarda':
      return { salida: 'coach', motivo: 'lector_tarda' }
    default:
      return { salida: 'coach', motivo: 'lector_no_claro' }
  }
}

/** El nivel que el lector con modelo llama «sin riesgo». Cualquier otro (o ninguno) NO lo es. */
export const NIVEL_SIN_RIESGO = 'NINGUNO'

export function lecturaDesdeNivel(nivel: string | null | undefined): LecturaDeRiesgo {
  if (nivel === NIVEL_SIN_RIESGO) return { tipo: 'sin_riesgo' }
  if (typeof nivel === 'string' && nivel) return { tipo: 'riesgo', nivel }
  return { tipo: 'falla' }
}

export type ResultadoConTope<T> = { ok: true; valor: T } | { ok: false; motivo: 'tarda' | 'falla' }

/** Espera la promesa hasta `ms`. Nunca lanza: devuelve «tarda» o «falla». */
export async function conTope<T>(trabajo: () => Promise<T>, ms: number): Promise<ResultadoConTope<T>> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<'tarda'>((res) => {
    reloj = setTimeout(() => res('tarda'), ms)
  })
  try {
    const r = await Promise.race([trabajo().then((valor) => ({ valor })), limite])
    if (r === 'tarda') return { ok: false, motivo: 'tarda' }
    return { ok: true, valor: r.valor }
  } catch {
    return { ok: false, motivo: 'falla' }
  } finally {
    if (reloj) clearTimeout(reloj)
  }
}

/** Frase fija cuando no hay ninguna pieza que conteste. PROVISIONAL: la aprueba el dueño con las demás frases de la interfaz. */
export const SIN_PIEZA_PROVISIONAL = 'Eso no lo tengo en mis piezas aprobadas. Se lo dejo a tu coach.'

/**
 * Respaldo sin modelo: la pieza tal cual (su `respuesta`, sin retocar), con sus bloques separados. Nunca vacío.
 */
export function respaldoSinModelo(piezas: readonly PiezaDeLaBiblioteca[]): RespuestaCharla {
  const primera = piezas.find((p) => p.respuesta.trim())
  if (!primera) return { respuesta: SIN_PIEZA_PROVISIONAL, piezas_usadas: [], piezas: [], origen: 'respaldo' }
  return {
    respuesta: primera.respuesta,
    piezas_usadas: piezas.map((p) => p.id),
    piezas: piezas.map(piezaMostrada),
    origen: 'respaldo',
  }
}
