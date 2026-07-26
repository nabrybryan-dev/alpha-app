// Edge Function: responder-chat
// Se pega tal cual en el panel de Supabase (Edge Functions -> Via Editor).
// La copia de referencia y con control de versiones es este archivo del repo.

/**
 * Minúsculas, sin tildes, espacios colapsados. Base de toda comparación léxica.
 *
 * El rango [\u0300-\u036f] (marcas diacríticas combinantes) va escrito con
 * escapes a propósito: son caracteres invisibles en un editor y este archivo
 * se entrega copiándolo y pegándolo en el panel de Supabase. Si esos bytes se
 * dañaran al pegar, `normalizar` dejaría de quitar tildes sin que se note, y
 * la detección de crisis fallaría en silencio con cualquier mensaje acentuado
 * ("quiero hacerme daño"). Con escapes eso no puede pasar.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Frases inequívocas. Cada una se comprobó contra su uso coloquial en Colombia
// para que no salte con exageraciones ("me quiero morir de agujetas").
const CRISIS = [
  'no quiero vivir',
  'no quiero seguir viviendo',
  'quiero morirme',
  'quiero morir',
  'quitarme la vida',
  'acabar con mi vida',
  'matarme',
  'suicid',
  'hacerme dano',
  'lastimarme',
  'no vale la pena vivir',
]

// "me quiero morir de X" / "me muero de X" son exageraciones, no crisis.
const EXAGERACION = /\b(me quiero morir|me muero|muerto|muerta)\s+(de|del|por)\b/

export function esCrisis(mensaje: string): boolean {
  const t = normalizar(mensaje)
  if (EXAGERACION.test(t)) return false
  return CRISIS.some((f) => t.includes(f))
}

// Léxico de salud. Se marca al coach en rojo. El sesgo es marcar de más:
// una alerta sobrante cuesta un vistazo; una que falta cuesta un asesorado.
const SALUD = [
  // dolor y lesión
  'duele', 'dolor', 'punza', 'molestia', 'lesion', 'lesione', 'fractura',
  'esguince', 'desgarr', 'hernia', 'tendon', 'inflamad', 'hinchad',
  // urgencia
  'mareo', 'maree', 'desmay', 'sin aire', 'falta de aire', 'no puedo respirar',
  'pecho', 'palpitacion', 'taquicardia', 'opresion',
  // enfermedad
  'fiebre', 'gripa', 'gripe', 'infeccion', 'vomit', 'diarrea', 'medicament',
  // salud femenina
  'regla', 'menstrua', 'periodo', 'sangrado', 'embaraz', 'postparto',
  'orina', 'incontinencia', 'suelo pelvico', 'anticonceptiv',
  // angustia ambigua: no es crisis, pero el coach debe verlo pronto
  'ya no puedo mas', 'no aguanto', 'ansiedad', 'deprimid', 'sin ganas de nada',
]

export function esTemaDeSalud(mensaje: string): boolean {
  const t = normalizar(mensaje)
  return SALUD.some((p) => t.includes(p))
}

// Umbrales MEDIDOS el 2026-07-26 con las 50 fichas reales y 15 preguntas de
// prueba: coincidencias verdaderas 0,507-0,779; falsas 0,264-0,379.
// Los valores anteriores del spec (0,80/0,60) eran conjetura y estaban por
// encima de la escala real del modelo: ninguna ficha habria respondido nunca.
export const UMBRAL_ALTO = 0.5
export const UMBRAL_BAJO = 0.42

export type Via = 'ficha' | 'ficha_tentativa' | 'ia_vivo' | 'escalado'

export function decidirVia(similitud: number | null): Via {
  if (similitud === null || similitud < UMBRAL_BAJO) return 'escalado'
  if (similitud < UMBRAL_ALTO) return 'ficha_tentativa'
  return 'ficha'
}
