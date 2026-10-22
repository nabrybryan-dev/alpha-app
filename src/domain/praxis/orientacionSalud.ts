import type { Trato } from './plan/responder.ts'

/** Códigos de presentación, no diagnósticos ni un permiso para rebajar riesgo. */
export const ORIENTACIONES_SALUD = ['preguntar_zona', 'preguntar_funcion', 'preguntar_general', 'atencion_hoy'] as const
export type OrientacionSalud = (typeof ORIENTACIONES_SALUD)[number]
export type PreguntaSalud = Exclude<OrientacionSalud, 'atencion_hoy'>
export function leerOrientacionSalud(x: unknown): OrientacionSalud | null {
  return typeof x === 'string' && (ORIENTACIONES_SALUD as readonly string[]).includes(x) ? x as OrientacionSalud : null
}
const normal = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const ZONA = /\b(pecho|torax|muslo|pierna|rodilla|pantorrilla|pie|pies|brazo|hombro|codo|mano|espalda|cuello|cabeza|abdomen)\b/
const FUNCION_DICHA = /\b(?:no puedo|puedo|me impide|no me impide)\s+(?:apoyar|caminar|mover(?:me|lo|la)?)(?:\b|\s)/

/** Solo elige qué información falta DESPUÉS de que el filtro/modelo ya marcó salud. */
export function preguntaDeSalud(frase: string, general = false): PreguntaSalud | null {
  const n = normal(frase.replace(/^Pregunta de Praxis:.*$/gmi, ''))
  const respuesta = normal(frase).match(/aclaracion de la persona:\s*(.*)$/)?.[1]
  if (respuesta && /Pregunta de Praxis:.*(?:impide apoyar|sigue pasando)/i.test(frase) && /^(?:si|no|normal|sin problema)\b/.test(respuesta)) return null
  if (/\bpresion\b/.test(n) && !/\b(?:presion arterial|presion alta|presion baja|tension)\b/.test(n)) {
    if (!ZONA.test(n)) return 'preguntar_zona'
    if (/\b(?:muslo|pierna|rodilla|pantorrilla|pie|pies)\b/.test(n) && !FUNCION_DICHA.test(n)) return 'preguntar_funcion'
  }
  return general && !respuesta ? 'preguntar_general' : null
}

/** Sensación física explícita: una aclaración breve, nunca una autorización clínica. */
export function preguntaLocalPorSensacion(frase: string): PreguntaSalud | null {
  const n = normal(frase)
  if (!/\b(?:senti|siento|sentia|note|noto)\s+(?:(?:una|algo de|un poco de)\s+)?presion\b/.test(n)) return null
  if (/\bno\s+(?:senti|siento|sentia|note|noto)\b|\bpresion\s+(?:para|social|laboral|de grupo)\b/.test(n)) return null
  if (!ZONA.test(n) && !/\b(?:en|durante)\s+la\s+prensa\b|\bal entrenar\b/.test(n)) return null
  return preguntaDeSalud(frase)
}

export function textoOrientacionSalud(o: OrientacionSalud, trato: Trato): string {
  const usted = trato === 'usted'
  switch (o) {
    case 'preguntar_zona': return usted
      ? 'Si la presión es en el pecho o tiene dificultad para respirar ahora, llame al 123. ¿En qué parte del cuerpo sintió esa presión? No lo registro como un dato de entrenamiento.'
      : 'Si la presión es en el pecho o tienes dificultad para respirar ahora, llama al 123. ¿En qué parte del cuerpo sentiste esa presión? No lo registro como un dato de entrenamiento.'
    case 'preguntar_funcion': return usted
      ? '¿Le impide apoyar la pierna o moverse como siempre? No intente hacerlo para comprobarlo. No lo registro como un dato de entrenamiento.'
      : '¿Te impide apoyar la pierna o moverte como siempre? No intentes hacerlo para comprobarlo. No lo registro como un dato de entrenamiento.'
    case 'preguntar_general': return usted
      ? '¿Qué le ocurrió y sigue pasando ahora? No puedo decirle qué es ni autorizarle a entrenar. Si es urgente, llame al 123; no espere una respuesta de su coach.'
      : '¿Qué te ocurrió y sigue pasando ahora? No puedo decirte qué es ni autorizarte a entrenar. Si es urgente, llama al 123; no esperes una respuesta de tu coach.'
    case 'atencion_hoy': return usted
      ? 'Busque atención médica urgente hoy, sin esperar una respuesta de su coach. No fuerce la zona lesionada. Si hay deformidad, pérdida de sensibilidad o la extremidad está fría o cambia de color, llame al 123 ahora.'
      : 'Busca atención médica urgente hoy, sin esperar una respuesta de tu coach. No fuerces la zona lesionada. Si hay deformidad, pérdida de sensibilidad o la extremidad está fría o cambia de color, llama al 123 ahora.'
  }
}

export interface AclaracionSaludPendiente { frase: string; pregunta: PreguntaSalud }
/** Memoria de UNA aclaración. El motor la descarta al salir; no se guarda ni se añade al hilo de charla. */
export function continuarAclaracionSalud(p: AclaracionSaludPendiente | null, respuesta: string): string | null {
  if (!p || !respuesta.trim() || respuesta.length > 240) return null
  const n = normal(respuesta)
  if (/\b(?:otra cosa|cambiando de tema|olvida eso|olvidalo|anota|hice|series|repeticiones|kilos|kg|dormi|tome|me toca|mi plan|rutina|rir)\b/.test(n)) return null
  const pertinente = p.pregunta === 'preguntar_zona'
    ? ZONA.test(n) || /^(?:no se|no estoy segur[oa]|otra parte)[.!?]*$/.test(n)
    : p.pregunta === 'preguntar_funcion'
      ? /^(?:si|no|normal|sin problema|me cuesta)(?:\b|[.!?])/.test(n) || FUNCION_DICHA.test(n) || /\b(?:apoyar|caminar|mover|duele|hinchad[oa]|dormid[oa])\b/.test(n)
      : ZONA.test(n) || /\b(?:ahora|sigue|ya paso|ya no|dolor|respirar|apoyar|caminar)\b/.test(n)
  if (!pertinente) return null
  const pregunta = p.pregunta === 'preguntar_zona' ? '¿En qué parte del cuerpo sintió esa presión?'
    : p.pregunta === 'preguntar_funcion' ? '¿Le impide apoyar la pierna o moverse como siempre?'
    : '¿Qué ocurrió y sigue pasando ahora?'
  // La relación presión → pecho queda explícita, sin depender de la distancia entre turnos
  // ni del modelo. Solo para una ubicación torácica afirmativa y completa; nunca quitar negaciones.
  const pechoConfirmado = p.pregunta === 'preguntar_zona' && /\bpresion\b/.test(normal(p.frase))
    && !/\bno\s+(?:senti|siento|sentia|note|noto)\b/.test(normal(p.frase))
    && /^(?:en (?:el|mi) )?(?:pecho|torax)[.!?]*$/.test(n)
  return `${pechoConfirmado ? 'Dato aclarado: presión en el pecho.\n' : ''}${p.frase}\nPregunta de Praxis: ${pregunta}\nAclaración de la persona: ${respuesta.trim()}`
}
