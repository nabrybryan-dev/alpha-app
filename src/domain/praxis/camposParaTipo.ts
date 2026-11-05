// Ruta con «.ts» en lo que importa: la Edge Function `praxis-registro` (Deno) usa este módulo en sombra.
import type { TipoPregunta } from './enrutarPraxis.ts'

/**
 * F6 (4-nov-2026): según el TIPO de pregunta, qué CAMPO de la pieza aprobada se muestra, en texto y sin
 * redactar nada con un modelo. Criterio firmado por Bryan el 3-nov (CRITERIO-RESPUESTA-ENTIENDE-LA-PREGUNTA,
 * punto 2): cantidad y momento → respuesta; razón → estudios + criterio de práctica + de qué depende;
 * permiso y comparación → respuesta + de qué depende; definición → respuesta; método → las piezas no tienen
 * ese campo: no se inventa, Praxis lo dice y anota la duda.
 * `mi_caso` el criterio no lo fija: aquí se eligió respuesta + de qué depende (elección de quien lo construyó,
 * pendiente de confirmar por Bryan).
 *
 * Qué piezas se pueden mostrar: la tabla `praxis_conceptos` solo tiene `estado` ('borrador' | 'aprobada'); el
 * `estado_uso` ('revisar' | 'reserva_hasta_encoder') vive en el archivo local de las piezas y ahí 'revisar'
 * también lo llevan piezas aprobadas, así que NO se usa para excluir; sí se excluye `reserva_hasta_encoder`
 * si llega. `bandera_salud` es de `fichas_respuesta`: si llega en true, no se muestra nada.
 */

export type CampoDePieza = 'respuesta' | 'estudios' | 'criterio_de_practica' | 'de_que_depende'

/** Lo que este módulo necesita de una fila de `praxis_conceptos`. */
export interface PiezaParaCampos {
  respuesta: string
  estudios?: string | null
  criterio_de_practica?: string | null
  de_que_depende?: readonly string[] | null
  estado?: string
  estado_uso?: string
  bandera_salud?: boolean
}

export type CamposParaTipo =
  | { hay: true; secciones: { campo: CampoDePieza; titulo: string; texto: string }[]; texto: string }
  | { hay: false; motivo: 'sin_campo' | 'no_aprobada' | 'salud' | 'vacia' | 'sin_tipo' }

const TITULOS: Record<CampoDePieza, string> = {
  respuesta: 'Respuesta',
  estudios: 'Estudios',
  criterio_de_practica: 'En la práctica',
  de_que_depende: 'De qué depende',
}

/** Los campos de cada tipo, en orden de lectura. `metodo` va vacío a propósito: no hay campo que mostrar. */
export const CAMPOS_POR_TIPO: Record<TipoPregunta, readonly CampoDePieza[]> = {
  cantidad: ['respuesta'],
  momento: ['respuesta'],
  razon: ['estudios', 'criterio_de_practica', 'de_que_depende'],
  permiso: ['respuesta', 'de_que_depende'],
  comparacion: ['respuesta', 'de_que_depende'],
  definicion: ['respuesta'],
  metodo: [],
  mi_caso: ['respuesta', 'de_que_depende'],
}

function textoDe(p: PiezaParaCampos, campo: CampoDePieza): string {
  if (campo === 'de_que_depende') {
    return (p.de_que_depende ?? [])
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => `- ${x}`)
      .join('\n')
  }
  return (p[campo] ?? '').trim()
}

export function camposParaTipo(pieza: PiezaParaCampos, tipo: TipoPregunta | undefined): CamposParaTipo {
  if (pieza.bandera_salud === true) return { hay: false, motivo: 'salud' }
  if (pieza.estado !== 'aprobada' || pieza.estado_uso === 'reserva_hasta_encoder') return { hay: false, motivo: 'no_aprobada' }
  if (!tipo) return { hay: false, motivo: 'sin_tipo' }
  const campos = CAMPOS_POR_TIPO[tipo]
  if (campos.length === 0) return { hay: false, motivo: 'sin_campo' }
  const secciones = campos.map((campo) => ({ campo, titulo: TITULOS[campo], texto: textoDe(pieza, campo) })).filter((s) => s.texto !== '')
  if (secciones.length === 0) return { hay: false, motivo: 'vacia' }
  return { hay: true, secciones, texto: secciones.map((s) => `${s.titulo}\n${s.texto}`).join('\n\n') }
}

/** Para `meta.campos_por_tipo` en sombra: solo los NOMBRES de campo del tipo, nunca texto de la pieza. */
export function nombresDeCamposParaMeta(tipo: TipoPregunta | undefined): { tipo: TipoPregunta; campos: CampoDePieza[]; hueco?: 'metodo' } | undefined {
  if (!tipo) return undefined
  return { tipo, campos: [...CAMPOS_POR_TIPO[tipo]], ...(tipo === 'metodo' ? { hueco: 'metodo' as const } : {}) }
}
