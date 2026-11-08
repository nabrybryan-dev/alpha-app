/**
 * Anotaciones del cuaderno de la persona (decisión de Bryan, 8-nov-2026; tabla `praxis_anotaciones_persona`, migración 0175).
 * Dos frases no llenan ningún campo del check-in pero dicen algo que vale revisar más adelante:
 *   · «estoy molida de las piernas»            -> recuperación tardía de esa zona.
 *   · «me sentí pesada después del almuerzo»   -> cómo reacciona su organismo a esa comida (patrón).
 * Puro: solo PROPONE. Se guarda cuando la persona toca la tarjeta. El alimento no se saca de las palabras (queda vacío
 * para que la persona lo añada): adivinar «qué comió» de una frase suelta daría anotaciones falsas.
 */
import { normalizarTexto } from './numeros.ts'

/** Zonas que se anotan. Las articulaciones (rodilla, codo, tobillo) NO: «molida de la rodilla» es clínico. */
export const ZONAS_DEL_CUERPO = 'pierna|brazo|espalda|pecho|hombro|gluteo|abdomen|cuadricep|isquio|gemelo|pantorrilla|triceps|biceps|cuello|cadera|musculo'

export type MomentoDeComida = 'desayuno' | 'almuerzo' | 'cena' | 'merienda' | 'otro'

export interface Anotacion {
  tipo: 'recuperacion_zona' | 'reaccion_comida'
  zona?: string
  momento?: MomentoDeComida
  cita: string
}

const MOLIDA_DE_ZONA = new RegExp(`\\bmolid[oa]s?\\b.*?\\b(${ZONAS_DEL_CUERPO})(e?s)?\\b`)
const SINTIO_PESADO = /\b(senti|siento|sentia|cayo|cayeron|cae|caen|quede|estoy|estuve)\b.*\bpesad[oa]s?\b|\bpesad[oa]s?\b.*\b(despues|luego)\b/
const MOMENTOS: [RegExp, MomentoDeComida][] = [
  [/\bdesayun/, 'desayuno'], [/\balmuerz/, 'almuerzo'], [/\bcena\b/, 'cena'], [/\b(merienda|onces)\b/, 'merienda'],
]
const COMIDA = /\b(comi|comer|comiendo|comida|digest\w*|desayun\w*|almuerz\w*|cena|merienda|onces)\b/

/** Lo habitual («siempre me cae pesado el almuerzo») es del perfil, no de hoy. */
const HABITUAL = /\b(siempre|normalmente|por lo general|generalmente|suelo|todos los dias)\b/

/** Anotaciones de un trozo (frase). `esClinico` lo pone el llamador: un trozo clínico no se anota por aquí. */
export function anotacionDeTrozo(cita: string, esClinico: (c: string) => boolean): Anotacion | null {
  const n = normalizarTexto(cita)
  if (esClinico(cita) || HABITUAL.test(n)) return null
  const z = MOLIDA_DE_ZONA.exec(n)
  if (z) return { tipo: 'recuperacion_zona', zona: `${z[1]}${z[2] ?? ''}`, cita }
  if (SINTIO_PESADO.test(n) && COMIDA.test(n)) {
    const momento = MOMENTOS.find(([re]) => re.test(n))?.[1] ?? 'otro'
    return { tipo: 'reaccion_comida', momento, cita }
  }
  return null
}
