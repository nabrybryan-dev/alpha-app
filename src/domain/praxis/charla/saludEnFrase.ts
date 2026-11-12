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
  // 12-nov-2026: poblaciones sensibles, condiciones cronicas, farmacos/sustancias, TCA y edad (hallazgo medido C17: posparto a los
  // 3 meses paso el filtro y la respuesta dio luz verde clinica). Sobre-bloquea a proposito (falla seguro): «parto» tambien corta
  // «yo parto de cero», «anabolico» corta «ventana anabolica», «tengo 12 años entrenando» corta aunque no sea un menor.
  ['embarazo', /\bembaraz\w*|\bgestaci\w+|\bgestante\w*/],
  ['posparto', /\bpos?t?[- ]?parto\b|\bpuerper\w*|\bparto\b|\bpartos\b/],
  ['cesarea', /\bcesare\w*/],
  ['cirugia', /\bcirug\w+|\bquirurg\w*|\boperacion(?:es)?\b|\boperad[oa]s?\b|\boperaron\b|\bpos?t?[- ]?operat\w*|\bpos?t?[- ]?quirurg\w*/],
  ['lactancia', /\blactanc\w*|\blactand\w*|\bamamant\w*|\bdando\s+(?:el\s+)?(?:pecho|teta)\b/],
  ['menopausia', /\b(?:peri|post|pos)?menopaus\w*/],
  ['tiroides', /\btiroid\w*|\bhipotiroid\w*|\bhipertiroid\w*|\blevotiroxin\w*/],
  ['diabetes', /\bdiabet\w*|\binsulin\w*|\bglucemi\w*/],
  ['hipertension', /\bhipertens\w*|\b(?:presion|tension)\s+(?:arterial\s+)?alta\b|\balta\s+(?:presion|tension)\b/],
  ['anemia', /\banemi\w*/],
  ['asma', /\basma\b|\basmatic\w*/],
  ['anticonceptivo', /\banticonceptiv\w*|\banticoncep\w*/],
  ['farmaco de bajada de peso', /\bozempic\b|\bsemaglutid\w*|\bwegovy\b|\btirzepatid\w*/],
  ['sustancia', /\bclembuterol\b|\bquemagras\w*|\bquema\s+grasas?\b|\besteroid\w*|\banabolic\w*|\banabolizant\w*/],
  ['trastorno alimentario', /\banorexi\w*|\bbulimi\w*|\batrac(?:on|ones)\b|\bpurga\w*|\bpurgar\w*/],
  ['menor de edad', /\bmenor(?:es)?\s+de\s+edad\b|\bsoy\s+menor\b|\bmenor\s+de\s+18\b|\b(?:tengo|tiene|tenia|cumpli|cumplo|con)\s+(?:solo\s+|apenas\s+)?1[0-7]\s*anos\b/],
  ['mayor de 65', /\bmayor(?:es)?\s+de\s+(?:6[5-9]|[7-9]\d)\b|\bmas\s+de\s+65\b|\badult[oa]s?\s+mayor(?:es)?\b|\b(?:tengo|tiene|tenia|cumpli|cumplo|con)\s+(?:6[5-9]|[7-9]\d)\s*anos\b/],
  ['abuelo', /\b(?:mi|mis)\s+abuel[oa]s?\b|\bmi\s+abuelit[oa]\b/],
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
