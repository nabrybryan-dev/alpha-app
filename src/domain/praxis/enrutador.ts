import { PRAXIS_ABIERTA_A_ASESORADOS, puedeVerPraxis, type Rol } from './acceso'
import type { Trato } from './plan/responder'

/**
 * Enrutador de Praxis (diseño del 17-oct-2026, DISENO-OPERATIVO-PRAXIS-20261017.md).
 * Contrato con sus pruebas en `enrutador.test.ts` (escritas primero). Hoy solo lo usa la observación de
 * `atender()`: no decide lo que ve la persona.
 */

export type Area = 'entrenar' | 'nutricion' | 'plan' | 'hoy' | 'progreso' | 'bienestar' | 'relacion' | 'avisos' | 'chat'
export type Nivel = 'L0' | 'L1' | 'L2'
export type Ruta = 'bloqueada' | 'riesgo' | 'salud' | 'responder' | 'proponer' | 'aclarar'

export type EntradaEnrutador = {
  frase: string
  rol: Rol
  personaId: string
  abiertaAAsesorados?: boolean
  /** Es la respuesta a una pregunta de salud de Praxis: como en `decidirTurno`, sigue por la ruta de salud aunque la frase no tenga marca. */
  aclaracionSalud?: boolean
}

export type Dependencias = {
  /** Diccionario + modelo de riesgo: 'ninguno', 'salud' (síntoma/urgencia) o 'riesgo' (vida, violencia, ánimo). */
  leerRiesgo: (frase: string) => 'ninguno' | 'salud' | 'riesgo'
  /** Selector de intención: qué área toca y si pide leer, explicar o cambiar algo. */
  detectarIntencion: (frase: string) => { area: Area; accion: 'mirar' | 'explicar' | 'cambiar'; confianza: number }
}

export type DecisionEnrutador = {
  ruta: Ruta
  area?: Area
  nivel?: Nivel
  /** El enrutador NUNCA escribe: a lo sumo propone, y la escritura (L3) ocurre solo tras confirmar. */
  escribe: false
  requiereConfirmacion: boolean
  personaId?: string
}

/** Áreas donde hoy ya existe escritura (RIR, serie, ejercicio, comida). */
export const AREAS_CON_ESCRITURA: readonly Area[] = ['entrenar', 'nutricion']
export const UMBRAL_CONFIANZA = 0.6

/**
 * Cuando el enrutador no sabe de qué área habla la frase (confianza bajo el umbral), NO adivina ni cae
 * en «chat» por defecto: la ruta es `aclarar` y Praxis pregunta de qué área se trata. Nace de la medición
 * del 21-oct (30 frases marcadas por Bryan): 9 eran ambiguas y el léxico acertaba el área en 6 de 21.
 * Las tres áreas son las que Bryan nombró (entrenar, nutrición, estilo de vida / relación consigo mismo);
 * provisional, sin firma. La pregunta es una sola, sin promesas y sin tocar nada.
 */
export const AREAS_A_ACLARAR: readonly Area[] = ['entrenar', 'nutricion', 'bienestar', 'relacion']
export const PREGUNTA_ACLARAR: Record<Trato, string> = {
  tu: 'Para ayudarte bien, ¿tu pregunta es sobre tu entreno, tu comida, tus hábitos o cómo te sientes contigo mismo?',
  usted: 'Para ayudarle bien, ¿su pregunta es sobre su entreno, su comida, sus hábitos o cómo se siente consigo mismo?',
}

const SIN_ESCRIBIR = { escribe: false, requiereConfirmacion: false } as const

/**
 * Orden fijo (decision de Bryan, 17-oct): riesgo, puerta, intencion. El riesgo gana a todo, incluso
 * a la puerta: una frase de riesgo o de salud NUNCA se pierde en silencio, aunque venga de un rol sin
 * permiso o sin persona. Luego la puerta, y solo despues la intencion. El enrutador nunca escribe,
 * a lo sumo propone (L2) y pide confirmar.
 */
export function enrutar(entrada: EntradaEnrutador, deps: Dependencias): DecisionEnrutador {
  const conPersona = !!entrada.personaId?.trim()
  const personaId = conPersona ? entrada.personaId : undefined
  const de = (ruta: Ruta): DecisionEnrutador => ({ ruta, ...(personaId ? { personaId } : {}), ...SIN_ESCRIBIR })

  const riesgo = deps.leerRiesgo(entrada.frase)
  if (riesgo === 'riesgo') return de('riesgo')
  if (riesgo === 'salud') return de('salud')

  if (!conPersona || !puedeVerPraxis(entrada.rol, entrada.abiertaAAsesorados ?? PRAXIS_ABIERTA_A_ASESORADOS)) {
    return { ruta: 'bloqueada', ...SIN_ESCRIBIR }
  }
  if (entrada.aclaracionSalud) return de('salud')

  const { area, accion, confianza } = deps.detectarIntencion(entrada.frase)
  // `!(x >= umbral)` y no `x < umbral`: una confianza NaN o ausente también aclara, nunca responde sobre un área dudosa.
  if (!(confianza >= UMBRAL_CONFIANZA)) return de('aclarar')
  const puedeCambiar = accion === 'cambiar' && confianza >= UMBRAL_CONFIANZA && AREAS_CON_ESCRITURA.includes(area)
  if (puedeCambiar) return { ruta: 'proponer', area, nivel: 'L2', personaId, escribe: false, requiereConfirmacion: true }
  return { ruta: 'responder', area, nivel: accion === 'mirar' ? 'L0' : 'L1', personaId, ...SIN_ESCRIBIR }
}
