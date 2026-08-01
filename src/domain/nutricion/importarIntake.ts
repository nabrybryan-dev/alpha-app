import type { Respuestas } from './encuesta'

/**
 * De la encuesta de captación de atletaalpha.com a las respuestas de la app.
 *
 * QUÉ RESUELVE. Quien llega nuevo ya contestó una encuesta larga. Volver a
 * pedirle peso, altura y perímetros es la forma más rápida de que abandone
 * antes de empezar. De ese JSON sale casi todo: quedan DOS preguntas, y las dos
 * porque el intake no las hace —los pasos diarios y si tiene báscula de
 * cocina—. Diecinueve preguntas menos dos.
 *
 * LO QUE NO SE TRADUCE SOLO. Las alergias vienen en texto libre y ahí no hay
 * nada que un programa pueda leer bien: "no soy alérgica a nada, pero me caen
 * mal las harinas y creo que un poco los lácteos, aunque sí tomo yogurt griego"
 * lleva dentro una alergia declarada (ninguna), una intolerancia percibida, una
 * excepción, una sospecha y otra excepción. Interpretarlo automáticamente
 * restringiría de más o se saltaría algo. El texto viaja entero y lo codifica la
 * nutricionista.
 */

/** El JSON tal como lo exporta el panel. Solo lo que se usa. */
export interface IntakeCrudo {
  person?: { id?: string; name?: string; email?: string }
  client_intake?: {
    status?: string
    answers?: Record<string, unknown>
  }
}

export interface ResultadoImportacion {
  /** El id del asesorado en el panel. Sin él no se puede asociar a nadie. */
  personaId: string | null
  respuestas: Respuestas
  /** El texto de alergias tal cual, para que lo codifique la nutricionista. */
  alergiasEnTexto: string | null
  /** Lo que sigue faltando y habrá que preguntar en la app. */
  faltan: string[]
  /** Por qué esta persona necesita que alguien mire antes de enseñar cifras. */
  senales: string[]
}

const numero = (valor: unknown): number | null => {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : Number(valor)
  return Number.isFinite(n) && n > 0 ? n : null
}

const texto = (valor: unknown): string | null =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : null

/** "Femenino" / "Masculino" a lo que esperan las fórmulas. */
function generoDeIntake(valor: unknown): 'M' | 'H' | null {
  const limpio = texto(valor)?.toLowerCase()
  if (!limpio) return null
  if (limpio.startsWith('fem') || limpio.startsWith('muj')) return 'M'
  if (limpio.startsWith('mas') || limpio.startsWith('hom')) return 'H'
  return null
}

const CICLOS: Record<string, string> = {
  regular: 'regular',
  irregular: 'irregular',
  ausente: 'ausente',
  'no aplica': 'prefiere_no_decir',
}

function cicloDeIntake(valor: unknown): string | null {
  const limpio = texto(valor)?.toLowerCase()
  return limpio ? (CICLOS[limpio] ?? null) : null
}

/** "Cocino la mayoría de mis comidas" → casi_siempre. */
function cocinaDeIntake(valor: unknown): string | null {
  const limpio = texto(valor)?.toLowerCase()
  if (!limpio) return null
  if (limpio.includes('mayoría') || limpio.includes('mayoria')) return 'casi_siempre'
  if (limpio.includes('mitad') || limpio.includes('veces')) return 'a_veces'
  if (limpio.includes('compro') || limpio.includes('domicilio')) return 'casi_nunca'
  return null
}

/**
 * Qué cintura usar.
 *
 * La US Navy pide la cintura NATURAL —la parte más estrecha— en mujeres y la
 * del ombligo en hombres. El intake pregunta las dos; usar la que no toca
 * desplaza el porcentaje de grasa varios puntos hacia arriba o hacia abajo.
 */
function cinturaDeIntake(respuestas: Record<string, unknown>, genero: 'M' | 'H' | null) {
  const natural = numero(respuestas.medida_cintura_natural_cm)
  const ombligo = numero(respuestas.medida_cintura_ombligo_cm)
  return genero === 'M' ? (natural ?? ombligo) : (ombligo ?? natural)
}

/** Si el texto es una negación clara ("no", "ninguna", "-"). */
function esNegacion(valor: string | null): boolean {
  if (!valor) return true
  const limpio = valor.trim().toLowerCase().replace(/[.\s]/g, '')
  return ['no', 'ninguna', 'ninguno', 'nada', '-', 'na'].includes(limpio)
}

export function importarIntake(crudo: IntakeCrudo): ResultadoImportacion {
  const a = crudo.client_intake?.answers ?? {}
  const genero = generoDeIntake(a.genero)

  const respuestas: Respuestas = {}
  const poner = (clave: keyof Respuestas, valor: string | number | string[] | null) => {
    if (valor !== null && valor !== undefined) respuestas[clave] = valor
  }

  poner('genero', genero)
  poner('fechaNacimiento', texto(a.fecha_nacimiento))
  poner('pesoKg', numero(a.peso_actual_kg))
  poner('alturaCm', numero(a.altura_cm))
  poner('cuelloCm', numero(a.medida_cuello_cm))
  poner('cinturaCm', cinturaDeIntake(a, genero))
  if (genero === 'M') poner('caderaCm', numero(a.medida_cadera_cm))
  poner('diasEntreno', numero(a.dias_por_semana))
  poner('frecuenciaCocina', cocinaDeIntake(a.cocina_o_compra))
  if (genero === 'M') poner('cicloMenstrual', cicloDeIntake(a.solo_mujeres_ciclo))

  /**
   * Las alergias entran como "otra" + el texto, nunca interpretadas.
   *
   * Marcarlas así hace dos cosas a la vez: la app no se las vuelve a preguntar
   * -ya las contestó- y la nutricionista ve que hay un texto suyo esperando a
   * ser traducido. Dejarlo vacío habría hecho que la app se las pidiera otra
   * vez; adivinarlas habría sido peor.
   */
  const alergias = texto(a.alergias_restricciones)
  const alergiasEnTexto = esNegacion(alergias) ? null : alergias
  poner('alergias', alergiasEnTexto ? ['otra'] : ['ninguna'])

  const senales: string[] = []
  if (texto(a.tca_historia)?.toLowerCase().startsWith('s')) {
    senales.push('antecedente de conducta alimentaria en la encuesta de captación')
    // Viaja en las respuestas para que la app lo vea sin volver a leer el JSON.
    respuestas.antecedenteTca = 'si'
  }
  if (respuestas.cicloMenstrual === 'irregular' || respuestas.cicloMenstrual === 'ausente') {
    senales.push('ciclo menstrual irregular o ausente')
  }

  /**
   * Lo que el intake no pregunta y no se puede deducir.
   *
   * Los pasos porque entre 8.000 y 11.000 hay 230 kcal de diferencia en la
   * misma persona, y la báscula porque decide el margen de todo su registro
   * (±5 % pesando, ±25 % estimando). Suponer cualquiera de las dos falsearía
   * una cifra que después se lee como medida.
   */
  const faltan = ['pasosDiarios', 'tieneBascula']
  for (const [clave, etiqueta] of [
    ['genero', 'sexo'],
    ['fechaNacimiento', 'fecha de nacimiento'],
    ['pesoKg', 'peso'],
    ['alturaCm', 'altura'],
    ['cuelloCm', 'perímetro del cuello'],
    ['cinturaCm', 'perímetro de la cintura'],
  ] as const) {
    if (respuestas[clave] === undefined) faltan.push(etiqueta)
  }
  if (genero === 'M' && respuestas.caderaCm === undefined) faltan.push('perímetro de la cadera')

  return {
    personaId: texto(crudo.person?.id),
    respuestas,
    alergiasEnTexto,
    faltan,
    senales,
  }
}
