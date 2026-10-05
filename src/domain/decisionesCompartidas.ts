/**
 * Decisiones compartidas entre Bryan y Manuela (migración 0094; habilidad
 * `decisiones-compartidas`). Lógica pura: sin React y sin red.
 *
 * Las listas cerradas (áreas, palancas, direcciones) son las MISMAS del SQL; las pruebas las
 * comparan contra la 0094 para que no se separen en silencio. Y NUNCA datos de salud: en
 * entrenamiento y nutrición no hay texto libre, y donde sí lo hay pasa por `textoVetado`,
 * que refleja la lista de `decision_texto_limpio()` para avisar ANTES de enviar (la base
 * sigue siendo quien la hace cumplir).
 */

export const AREAS = ['entrenamiento', 'nutricion', 'creadores', 'finanzas'] as const
export type Area = (typeof AREAS)[number]

export const NOMBRE_AREA: Record<Area, string> = {
  entrenamiento: 'Entrenamiento',
  nutricion: 'Nutrición',
  creadores: 'Creadores',
  finanzas: 'Finanzas',
}

/** Las áreas donde puede haber texto libre y dinero; en las otras dos, solo enums y un puntero. */
export const AREAS_CON_TEXTO: readonly Area[] = ['creadores', 'finanzas']

export const PALANCAS_POR_AREA: Record<Area, readonly string[]> = {
  entrenamiento: ['volumen', 'frecuencia', 'intensidad', 'ejercicio', 'descarga', 'cardio', 'plan_nuevo', 'plan_renovado', 'pausa'],
  nutricion: ['energia', 'distribucion', 'alimento', 'plan_nuevo', 'plan_renovado', 'pausa'],
  creadores: [
    'puerta_nicho', 'puerta_idioma', 'volumen_contactos', 'estado_contacto', 'desempate',
    'microprueba', 'incorporacion', 'segmento', 'plantilla_mensaje', 'tarea_mensaje',
  ],
  finanzas: ['pago_equipo', 'gasto_fijo', 'precio', 'tope', 'reserva', 'comision', 'bono'],
}

export const NOMBRE_PALANCA: Record<string, string> = {
  volumen: 'volumen',
  frecuencia: 'frecuencia',
  intensidad: 'intensidad',
  ejercicio: 'ejercicio',
  descarga: 'descarga',
  cardio: 'cardio',
  plan_nuevo: 'plan nuevo',
  plan_renovado: 'plan renovado',
  pausa: 'pausa',
  energia: 'energía',
  distribucion: 'distribución',
  alimento: 'alimento',
  puerta_nicho: 'puerta de nicho',
  puerta_idioma: 'puerta de idioma',
  volumen_contactos: 'volumen de contactos',
  estado_contacto: 'estado del contacto',
  desempate: 'desempate',
  microprueba: 'microprueba',
  incorporacion: 'incorporación',
  segmento: 'segmento',
  plantilla_mensaje: 'plantilla de mensaje',
  tarea_mensaje: 'tarea de mensaje',
  pago_equipo: 'pago del equipo',
  gasto_fijo: 'gasto fijo',
  precio: 'precio',
  tope: 'tope',
  reserva: 'reserva',
  comision: 'comisión',
  bono: 'bono',
}

/** Las palancas cuyo dinero exige monto: sin él, la decisión queda incompleta. */
export const PALANCAS_CON_MONTO: readonly string[] = ['pago_equipo', 'gasto_fijo', 'precio', 'comision', 'bono']

/** Mientras H-02 siga abierta, esto solo lo anota el coach (la base lo hace cumplir). */
export const PALANCAS_SOLO_COACH: readonly string[] = ['incorporacion', 'microprueba']
export function soloElCoach(area: Area, palanca: string): boolean {
  return area === 'finanzas' || PALANCAS_SOLO_COACH.includes(palanca)
}

export const DIRECCIONES = ['sube', 'baja', 'mantiene', 'inicia', 'detiene', 'incluye', 'excluye', 'cambia'] as const
export type Direccion = (typeof DIRECCIONES)[number]

/** «Hacia dónde lleva», en la voz de la pantalla. */
export const NOMBRE_DIRECCION: Record<Direccion, string> = {
  sube: 'sube',
  baja: 'baja',
  mantiene: 'se mantiene',
  inicia: 'inicia',
  detiene: 'se detiene',
  incluye: 'incluye',
  excluye: 'excluye',
  cambia: 'cambia',
}

export const PERIODICIDADES = ['unica', 'mensual', 'semanal'] as const
export type Periodicidad = (typeof PERIODICIDADES)[number]

export const ESTADOS = ['propuesta', 'vigente', 'incompleta', 'vencida', 'rechazada'] as const
export type EstadoDecision = (typeof ESTADOS)[number]

export const NOMBRE_ESTADO: Record<EstadoDecision, string> = {
  propuesta: 'Espera firma',
  vigente: 'Vigente',
  incompleta: 'Incompleta',
  vencida: 'Firma vencida',
  rechazada: 'Rechazada',
}

/** Las tareas de las áreas clínicas: lista cerrada (H-13), nada de texto libre. */
export const TAREAS_CLINICAS = ['cuadrar con el plan de nutrición', 'cuadrar con el plan de entrenamiento'] as const

/** Dónde puede apuntar la referencia a un plan de la app: solo la clave, nunca el contenido. */
export const TABLAS_REFERENCIA = ['microciclos', 'aprobaciones', 'mensajes', 'casos_firma'] as const

/** Seudónimos y palancas de negocio: nunca nombres. */
export const PATRON_SUJETO = /^(cli-\d+|ig:\d+|ent-\d+|equipo:(bryan|manuela)|negocio:[a-z_]+)$/

/**
 * ¿El texto trae algo que la base va a rechazar (esquema §2, «fin-vetadas»)? Es un aviso
 * temprano para no perder lo escrito: NO reemplaza el check de la base. Devuelve el motivo o null.
 */
export function textoVetado(texto: string): string | null {
  const t = texto.toLowerCase()
  if (/[0-9]+([.,][0-9]+)*\s*(kcal|cal|g|gr|kg|lb|ml|series?|reps?|rir|rpe)\b/.test(t)) return 'una cifra de carga o de comida'
  if (/[0-9]+\s*%\s*de\s+grasa/.test(t)) return 'un porcentaje de grasa'
  if (
    /(^|[^a-záéíóúñ])(dolor|lesión|lesion|diagnóstico|diagnostico|medicamento|peso corporal|grasa|glucosa|presión|presion|embarazo|rodilla|hombro|espalda|ansiedad|depresión|depresion)([^a-záéíóúñ]|$)/.test(
      t,
    )
  )
    return 'una palabra de salud'
  if (/@[a-z0-9_.]/i.test(texto)) return 'un @ o un correo'
  if (/(^|[^0-9-])(\+?57[ -]?)?3[0-9]{2}[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)/.test(texto)) return 'un teléfono'
  return null
}

export interface DecisionMinima {
  area: Area
  palanca: string
  direccion: Direccion
  resumen: string | null
}

/**
 * La frase de una decisión. Donde hay resumen (creadores y finanzas) es el que escribió la
 * persona; en entrenamiento y nutrición NO hay resumen (sería texto libre sobre salud) y la
 * frase se GENERA de los enums: «Nutrición · plan nuevo · inicia».
 */
export function fraseDeDecision(d: DecisionMinima): string {
  if (d.resumen) return d.resumen
  return `${NOMBRE_AREA[d.area]} · ${NOMBRE_PALANCA[d.palanca] ?? d.palanca} · ${NOMBRE_DIRECCION[d.direccion]}`
}

export function esArea(x: string): x is Area {
  return (AREAS as readonly string[]).includes(x)
}
export function esDireccion(x: string): x is Direccion {
  return (DIRECCIONES as readonly string[]).includes(x)
}
export function esEstado(x: string): x is EstadoDecision {
  return (ESTADOS as readonly string[]).includes(x)
}
