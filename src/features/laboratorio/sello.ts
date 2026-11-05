/**
 * Sello del laboratorio e interruptor `laboratorioVisible` (pieza B3 del plan de subir el diseño).
 *
 * Reglas, copiadas de la maqueta (`3q-v10-sello.js`, prueba `t17.mjs`):
 *  - Un dato sin sello conocido o sin fuente NO se dibuja.
 *  - El interruptor solo enciende con hoja firmada Y revisión legal; hoy ambas son falsas.
 *  - Apagado: el asesorado no ve nada del laboratorio.
 *  - Encendido: el asesorado solo ve «evidencia publicada».
 *  - Nada del laboratorio entra a una prescripción mientras esté apagado.
 *
 * Puro: sin datos, sin base, sin conexión a ninguna pantalla.
 */

export type SelloLaboratorio = 'evidencia' | 'simulado' | 'estimado' | 'no_afirmable'
export type RolLaboratorio = 'equipo' | 'asesorado'

export const SELLOS: Record<SelloLaboratorio, { nombre: string; quien: 'todos' | 'equipo' }> = {
  evidencia: { nombre: 'evidencia publicada, no es tu medida', quien: 'todos' },
  simulado: { nombre: 'simulado', quien: 'equipo' },
  estimado: { nombre: 'estimado', quien: 'equipo' },
  no_afirmable: { nombre: 'no afirmable', quien: 'equipo' },
}

export interface DatoLaboratorio {
  ejercicio?: string
  region?: string
  texto?: string
  sello?: string
  fuente?: string
}

/** Condiciones para encender. Hoy ambas son falsas: nada se enciende. */
export interface CondicionesLaboratorio {
  hojaFirmada: boolean
  revisionLegal: boolean
}

export const CONDICIONES_HOY: CondicionesLaboratorio = { hojaFirmada: false, revisionLegal: false }

/** Valor por omisión del interruptor: siempre apagado. */
export const LABORATORIO_VISIBLE = false

export function puedeEncender(c: CondicionesLaboratorio): boolean {
  return c.hojaFirmada === true && c.revisionLegal === true
}

/** El interruptor pedido solo se concede si se puede encender. */
export function interruptorEfectivo(pedido: boolean, c: CondicionesLaboratorio): boolean {
  return pedido === true && puedeEncender(c)
}

export function datoValido(d: DatoLaboratorio | null | undefined): boolean {
  return (
    !!d &&
    typeof d.sello === 'string' &&
    Object.prototype.hasOwnProperty.call(SELLOS, d.sello) &&
    typeof d.fuente === 'string' &&
    d.fuente.trim().length > 0
  )
}

/** Lo que ve cada rol. El equipo ve lo válido con su sello; el asesorado, nada si está apagado. */
export function filtraPorRol(
  datos: ReadonlyArray<DatoLaboratorio | null | undefined> | null | undefined,
  rol: RolLaboratorio,
  visible: boolean,
): DatoLaboratorio[] {
  return (datos ?? []).filter((d): d is DatoLaboratorio => {
    if (!datoValido(d)) return false
    if (rol === 'equipo') return true
    return visible && SELLOS[d!.sello as SelloLaboratorio].quien === 'todos'
  })
}

/** Falso mientras el interruptor esté apagado; encendido, solo la evidencia publicada. */
export function labPrescribe(d: DatoLaboratorio | null | undefined, visible: boolean): boolean {
  return visible && datoValido(d) && d!.sello === 'evidencia'
}
