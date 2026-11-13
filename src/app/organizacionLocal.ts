import { PIEZAS_DE_HOY, PIEZAS_DE_OTRAS_PANTALLAS, type PiezaDeLaApp } from './catalogoDePiezas'
import type { AccionDeOrganizacion, EstadoDeOrganizacion } from './organizacionPraxis'

/**
 * LA ORGANIZACIÓN LOCAL de «Praxis a un toque»: lo que la persona ocultó, subió o fijó, y el historial para
 * deshacer. Funciones puras, sin React.
 *
 * VIVE SOLO EN MEMORIA de la sesión del navegador. La organización guardada (tabla `praxis_organizacion`, fases
 * O4 a O6 del diseño del 9-nov) NO existe todavía, y las pantallas (Hoy, Entrenar, Nutrición…) tampoco leen este
 * estado: aceptar una tarjeta cambia el esquema y el contador de Praxis, no lo que se ve en la pantalla. Es el
 * mínimo seguro para probar la gramática y los candados de punta a punta sin escribir nada en la base.
 */

export interface CambioDeOrganizacion {
  accion: AccionDeOrganizacion
  piezaId: string
  /** Lo que se le dice a la persona al deshacer («ocultar el agua»). */
  descripcion: string
  /** El estado completo de ANTES del cambio: deshacer lo restituye tal cual. */
  antes: EstadoLocal
}

export interface EstadoLocal {
  ocultas: readonly string[]
  /** Orden de ids por pantalla (clave: patrón de la pantalla; las pantallas mismas van bajo `PANTALLAS`). */
  orden: Readonly<Record<string, readonly string[]>>
  fijadas: readonly string[]
  historial: readonly CambioDeOrganizacion[]
}

export const CLAVE_DE_PANTALLAS = '__pantallas'

export const ESTADO_INICIAL: EstadoLocal = { ocultas: [], orden: {}, fijadas: [], historial: [] }

function claveDeOrden(p: PiezaDeLaApp): string {
  return p.tipo === 'pantalla' ? CLAVE_DE_PANTALLAS : p.pantalla
}

/** El orden de fábrica de las tarjetas de una pantalla: el del catálogo, que es el de la pantalla real. */
export function ordenDeFabrica(pantalla: string): string[] {
  return [...PIEZAS_DE_HOY, ...PIEZAS_DE_OTRAS_PANTALLAS].filter((p) => p.pantalla === pantalla).map((p) => p.id)
}

/** El orden vigente de una pantalla, con lo oculto fuera. */
export function ordenVisible(estado: EstadoLocal, pantalla: string): string[] {
  const base = estado.orden[pantalla] ?? ordenDeFabrica(pantalla)
  return base.filter((id) => !estado.ocultas.includes(id))
}

export function comoEstadoDeOrganizacion(estado: EstadoLocal): EstadoDeOrganizacion {
  return { ocultas: new Set(estado.ocultas), hayCambiosParaDeshacer: estado.historial.length > 0 }
}

/** Aplica un cambio YA confirmado por la persona. Devuelve un estado nuevo; no muta el recibido. */
export function aplicarCambio(estado: EstadoLocal, accion: AccionDeOrganizacion, pieza: PiezaDeLaApp, descripcion: string): EstadoLocal {
  const registro: CambioDeOrganizacion = { accion, piezaId: pieza.id, descripcion, antes: { ...estado, historial: [] } }
  const historial = [...estado.historial, registro]
  if (accion === 'ocultar') {
    return estado.ocultas.includes(pieza.id) ? estado : { ...estado, ocultas: [...estado.ocultas, pieza.id], historial }
  }
  if (accion === 'fijar') {
    return estado.fijadas.includes(pieza.id) ? estado : { ...estado, fijadas: [...estado.fijadas, pieza.id], historial }
  }
  const clave = claveDeOrden(pieza)
  const base = (estado.orden[clave] ?? (clave === CLAVE_DE_PANTALLAS ? [pieza.id] : ordenDeFabrica(pieza.pantalla))).filter((id) => id !== pieza.id)
  const nuevo = accion === 'mover_arriba' ? [pieza.id, ...base] : [...base, pieza.id]
  return { ...estado, orden: { ...estado.orden, [clave]: nuevo }, historial }
}

/** El último cambio, o `null` si no hay. */
export function ultimoCambio(estado: EstadoLocal): CambioDeOrganizacion | null {
  return estado.historial[estado.historial.length - 1] ?? null
}

/** Deshace el último cambio: el estado vuelve a como estaba antes de él, con el historial anterior. */
export function deshacerUltimo(estado: EstadoLocal): EstadoLocal {
  const ultimo = ultimoCambio(estado)
  if (!ultimo) return estado
  return { ...ultimo.antes, historial: estado.historial.slice(0, -1) }
}
