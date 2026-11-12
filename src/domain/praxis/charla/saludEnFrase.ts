// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).
import { filtroDeRiesgo, sinTildes } from '../riesgo.ts'

/**
 * Salud EN LA FRASE de la persona (11-nov-2026), para la ruta provisional. PURO.
 *
 * Medido con DeepSeek real (examen B): 2 de 18 respuestas que pasaron el filtro de salida daban consejo sobre un síntoma
 * («pinchazo en el codo», «agujetas fuertes») que el filtro local de la app no atajó. El filtro de salida mira lo que DICE
 * el modelo; esto mira lo que PREGUNTA la persona, ANTES de llamar a DeepSeek: cualquier coincidencia va al coach.
 *
 * Es un léxico propio de la charla. NO copia ni toca `riesgo.ts` (solo lo llama): los términos de riesgo de vida y el filtro
 * clínico siguen siendo de `filtroDeRiesgo`, que se aplica primero.
 * Se bloquea por exceso: «me molesta que…» o «dolor de cabeza de planear» también van al coach (cuesta poco, y el coach la ve).
 */
const LEXICO: readonly (readonly [string, RegExp])[] = [
  ['pinchazo', /\bpinchazos?\b|\bpinch(?:a|o|an|ando)\b/],
  ['punzada', /\bpunzadas?\b|\bpunz(?:a|an|ando)\b/],
  ['molestia', /\bmolestias?\b|\bmolest(?:a|an|ando)\b/],
  ['dolor', /\bdolor(?:es)?\b|\bdoloros\w*|\bduel(?:e|en|a|an|ia|ian)\b|\bdoliendo\b/],
  ['tiron', /\btirones?\b|\btiron\b/],
  ['lesion', /\blesion(?:es)?\b|\blesionad\w*|\blesionar\w*/],
  ['inflamacion', /\binflamacion(?:es)?\b|\binflamad\w*/],
  ['hinchazon', /\bhinchazon(?:es)?\b|\bhinchad\w*|\bse me hincha\w*/],
  ['hormigueo', /\bhormigue\w*/],
  ['adormecimiento', /\badormecimiento\w*|\badormecid\w*|\bse me duerme\w*/],
  ['mareo', /\bmare(?:o|os|ado|ada|ar|an|a)\b/],
  ['desmayo', /\bdesmay\w*/],
  ['agujetas fuertes', /\bagujetas?\s+(?:muy\s+)?(?:fuertes?|intensas?|terribles?|brutales?)\b|\b(?:fuertes?|intensas?)\s+agujetas\b/],
  ['es grave', /\bes\s+(?:muy\s+|algo\s+)?grave\b|\bser\s+grave\b|\bsera\s+grave\b|\bes\s+serio\b/],
  ['embarazo con complicacion', /\bembaraz\w*\b[^.?!]*\bcomplicaci\w+|\bcomplicaci\w+[^.?!]*\bembaraz\w*/],
  ['medicacion', /\bmedicacion(?:es)?\b|\bmedicament\w*|\bmedicad\w*|\bmedicin\w*/],
  ['pastillas', /\bpastill\w+|\bpildora\w*/],
  ['receta', /\brecet(?:a|as|ado|ada|o)\b/],
  ['diagnostico', /\bdiagnostic\w*/],
]

/** El término del léxico que la frase trae, o null. Sin tildes ni mayúsculas. */
export function saludEnFrase(frase: string): string | null {
  const n = sinTildes(frase).toLowerCase()
  for (const [termino, re] of LEXICO) if (re.test(n)) return termino
  return null
}

export type MotivoSaludAntes = 'filtro_local' | 'salud_en_frase'

/**
 * Lo que se mira ANTES de llamar a DeepSeek en la ruta provisional: primero el filtro local de salud que ya usa la app
 * (`filtroDeRiesgo`) y luego el léxico propio. Devuelve el motivo o null si la frase puede seguir. Recibe la frase CRUDA.
 */
export function saludAntesDeDeepseek(fraseCruda: string): MotivoSaludAntes | null {
  if (filtroDeRiesgo(fraseCruda)) return 'filtro_local'
  return saludEnFrase(fraseCruda) ? 'salud_en_frase' : null
}
