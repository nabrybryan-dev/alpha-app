import { enrutar, type Area, type Dependencias, type DecisionEnrutador, type EntradaEnrutador } from './enrutador'
import { esPregunta } from './plan/responder'
import { filtroDeRiesgo, sinTildes } from './riesgo'

/**
 * Las dos dependencias del enrutador con lo que YA existe, sin modelo y sin red.
 *
 * - Riesgo: el mismo `filtroDeRiesgo` que usa `decidirTurno`. Quieta y cuidado -> 'riesgo';
 *   salud -> 'salud'; sin marca -> 'ninguno'. Así el enrutador no puede ser más permisivo que
 *   la pantalla de hoy.
 * - Intención: un léxico de palabras por área. Es un primer paso por reglas y NO está medido
 *   (no hay frases marcadas por una persona por área); el selector entrenado lo reemplaza.
 */
export const leerRiesgoPorReglas: Dependencias['leerRiesgo'] = (frase) => {
  const marca = filtroDeRiesgo(frase)
  if (!marca) return 'ninguno'
  return marca.tipo === 'salud' ? 'salud' : 'riesgo'
}

const LEXICO: readonly (readonly [Area, RegExp])[] = [
  ['entrenar', /\b(rir|serie|series|reps?|repeticion(?:es)?|ejercicio|kg|press|sentadilla|peso muerto|entreno|entrenar|rutina|descanso)\b/],
  ['nutricion', /\b(comi|desayun\w*|almorc\w*|almuerz\w*|cena|cene|comida|proteina|calorias|arroz|pollo|receta|despensa|nevera|hambre)\b/],
  ['bienestar', /\b(animo|sueno|dormi|estres|cansancio|energia)\b/],
  ['progreso', /\b(progreso|avance|como voy|record|marca personal)\b/],
  ['plan', /\b(plan|microciclo|semana|meta|objetivo)\b/],
  ['hoy', /\b(hoy|manana|pendiente)\b/],
  ['avisos', /\b(aviso|avisos|recordatorio|notificacion)\b/],
  ['chat', /\b(coach|mensaje|nutricionista)\b/],
]
const PIDE_MIRAR = /\b(muestrame|ensename|resumen|como voy|que tengo|revisa)\b/

export const detectarIntencionPorReglas: Dependencias['detectarIntencion'] = (frase) => {
  const n = sinTildes(frase).toLowerCase()
  const hit = LEXICO.find(([, re]) => re.test(n))
  const area: Area = hit ? hit[0] : 'chat'
  if (PIDE_MIRAR.test(n)) return { area, accion: 'mirar', confianza: hit ? 0.8 : 0.5 }
  if (esPregunta(frase)) return { area, accion: 'explicar', confianza: hit ? 0.8 : 0.5 }
  return { area, accion: 'cambiar', confianza: hit ? 0.8 : 0.3 }
}

export function enrutarPorReglas(entrada: EntradaEnrutador): DecisionEnrutador {
  return enrutar(entrada, { leerRiesgo: leerRiesgoPorReglas, detectarIntencion: detectarIntencionPorReglas })
}
