import { esStaff, type Rol } from '../acceso'

/**
 * El sello de procedencia de lo que Praxis muestra del laboratorio (paso 5 «N3», filas B1 y B2 de
 * CONEXIONES-OPERATIVAS-PRAXIS; maqueta 3q-v10-sello.js).
 *
 * Regla de fondo: un dato del laboratorio sin sello conocido y sin fuente NO se dibuja, ni siquiera
 * «de ejemplo»: en una pantalla, un número inventado se confunde con uno real.
 *
 * Decisión de Bryan (4-nov-2026): con el laboratorio apagado el asesorado NO ve nada del laboratorio,
 * ni lo marcado «evidencia publicada». El equipo sí lo ve, siempre con su sello.
 */
export type Sello = 'evidencia' | 'simulado' | 'estimado' | 'no_afirmable'

export const SELLOS: readonly Sello[] = ['evidencia', 'simulado', 'estimado', 'no_afirmable']

/** Texto en español sencillo de cada sello (el de `evidencia` aclara que no es una medida de la persona). */
export const TEXTO_DEL_SELLO: Record<Sello, string> = {
  evidencia: 'Evidencia publicada, no es tu medida',
  simulado: 'Simulado',
  estimado: 'Estimado',
  no_afirmable: 'No afirmable',
}

/** Quién puede verlo cuando el laboratorio está encendido. Solo la evidencia publicada llega al asesorado. */
const VISIBLE_AL_ASESORADO: Record<Sello, boolean> = {
  evidencia: true,
  simulado: false,
  estimado: false,
  no_afirmable: false,
}

/**
 * Las dos condiciones para poder encender el laboratorio. Ninguna existe hoy.
 * Son constantes de código: cambiarlas es un cambio con su PR, a propósito; no hay forma de
 * encenderlas desde fuera (igual que `PRAXIS_ABIERTA_A_ASESORADOS`).
 *
 *  - hoja firmada: la hoja del laboratorio, firmada por Bryan;
 *  - revisión legal: P8 (Ley 1581, datos de salud) revisada por el abogado.
 */
export const LABORATORIO_HOJA_FIRMADA: boolean = false
export const LABORATORIO_REVISION_LEGAL: boolean = false

/** Solo se puede encender con las dos condiciones a la vez. */
export function laboratorioPuedeEncenderse(
  hojaFirmada: boolean = LABORATORIO_HOJA_FIRMADA,
  revisionLegal: boolean = LABORATORIO_REVISION_LEGAL,
): boolean {
  return hojaFirmada && revisionLegal
}

/** El interruptor `laboratorioVisible`. Nace apagado y se deriva de las dos condiciones. */
export const LABORATORIO_VISIBLE: boolean = laboratorioPuedeEncenderse()

/** Lo mínimo que se le pide a un dato del laboratorio para poder dibujarlo. */
export interface DatoConProcedencia {
  sello?: string | null
  fuente?: string | null
}

export interface OpcionesDeVista {
  /** El interruptor. Por omisión, el de código. */
  laboratorioVisible?: boolean
  /** Cuenta personal de Bryan: es `asesorado` pero ocupa el puesto de coach (mira `puedeVerPraxis`). */
  ocupaElPuesto?: boolean
}

export function esSelloConocido(valor: unknown): valor is Sello {
  return typeof valor === 'string' && (SELLOS as readonly string[]).includes(valor)
}

/** Sello conocido y fuente no vacía. Sin las dos cosas, no se dibuja. */
export function tieneSelloYFuente(dato: DatoConProcedencia | null | undefined): boolean {
  if (!dato) return false
  return esSelloConocido(dato.sello) && typeof dato.fuente === 'string' && dato.fuente.trim().length > 0
}

/**
 * ¿Se puede dibujar este dato del laboratorio para esta persona?
 *  - sin sello conocido o sin fuente: nunca;
 *  - equipo: sí, con su sello (aunque el laboratorio esté apagado);
 *  - asesorado: nunca con el laboratorio apagado; encendido, solo «evidencia publicada».
 */
export function puedeDibujarse(
  dato: DatoConProcedencia | null | undefined,
  rol: Rol,
  opciones: OpcionesDeVista = {},
): boolean {
  if (!dato || !esSelloConocido(dato.sello) || !tieneSelloYFuente(dato)) return false
  if (esStaff(rol) || opciones.ocupaElPuesto === true) return true
  if (!(opciones.laboratorioVisible ?? LABORATORIO_VISIBLE)) return false
  return VISIBLE_AL_ASESORADO[dato.sello]
}

export function filtrarDibujables<T extends DatoConProcedencia>(
  datos: readonly T[] | null | undefined,
  rol: Rol,
  opciones: OpcionesDeVista = {},
): T[] {
  return (datos ?? []).filter((d) => puedeDibujarse(d, rol, opciones))
}

/**
 * Nada del laboratorio entra a una prescripción con el interruptor apagado; encendido, solo la
 * evidencia publicada con fuente.
 */
export function puedeEntrarAPrescripcion(
  dato: DatoConProcedencia | null | undefined,
  laboratorioVisible: boolean = LABORATORIO_VISIBLE,
): boolean {
  return laboratorioVisible && tieneSelloYFuente(dato) && dato?.sello === 'evidencia'
}
