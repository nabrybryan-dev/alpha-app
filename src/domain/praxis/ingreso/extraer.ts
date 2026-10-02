/**
 * De un turno HABLADO a los campos del cuestionario de ingreso, con Haiku, CITANDO.
 *
 * Es el mismo contrato del registrador (`registro/esquema.ts`):
 *  - el modelo ETIQUETA y CITA; no calcula ni completa. Cada valor viene con el fragmento LITERAL de lo que
 *    la persona dijo. Un valor sin cita, o con una cita que no está en la frase, se DESCARTA (falla cerrando);
 *  - lo no dicho queda vacío: el campo simplemente no aparece;
 *  - los números los convierte el código a partir de la cita, no el modelo.
 *
 * Y la REGLA DURA del ingreso: la salud no se rellena desde la voz. El esquema de salida no tiene ningún
 * campo de salud, y aunque el modelo invente uno, `validarIngreso` lo descarta y lo convierte en una MARCA
 * (`salud[]`) que el guion traduce en la pregunta de toque que corresponde (`toquesPorTemas`). Una segunda
 * red, determinista y sin modelo, repasa el texto con el filtro clínico del registrador y con una lista de
 * palabras de salud propia del ingreso.
 *
 * Nada de aquí llama a la red: el prompt y la validación son puros. Quien llama (la Edge Function, o el
 * banco de `scripts/banco-ingreso/`) pone el modelo.
 */
import { esSubcadenaLiteral } from '../registro/esquema.ts'
import { filtrarClinico } from '../registro/filtroClinico.ts'
import { escanearNumeros, normalizarTexto, valorDeCita } from '../registro/numeros.ts'
import {
  CAMPOS_INGRESO, TEMAS_SALUD, TURNOS_VOZ, campoPorId, toquesPorTemas,
  type CampoIngreso, type TemaSalud, type TurnoId,
} from './guion.ts'

export const VERSION_PROMPT_INGRESO = 'ingreso-prompt-2026-10-02.1'

export type MotivoDescarte =
  | 'salud' // el modelo intentó rellenar un campo de salud
  | 'desconocido'
  | 'fuera_de_turno'
  | 'cita_invalida' // la cita no es un fragmento de lo dicho
  | 'sin_cita'
  | 'opcion_invalida'
  | 'numero_ilegible'
  | 'numero_ambiguo' // la cita trae dos cifras: no se sabe cuál es
  | 'fuera_de_rango'
  | 'texto_clinico' // el texto libre trae dolor, lesión, medicamento...

export interface Descartado {
  campo: string
  motivo: MotivoDescarte
  detalle?: string
}

export interface ValorIngreso {
  campo: string
  /** Número ya convertido por el código, o la opción elegida, o el texto citado. */
  valor: string | number
  cita: string
}

export interface MarcaSalud {
  tema: TemaSalud
  /** Del modelo: fragmento literal. Del diccionario: SOLO la palabra que disparó. */
  cita: string
  origen: 'modelo' | 'diccionario'
}

export interface ResultadoIngreso {
  turno: TurnoId
  campos: Record<string, ValorIngreso>
  salud: MarcaSalud[]
  /** Los toques de salud que hay que hacer sí o sí por lo que se oyó (ya sin repetir). */
  toques: string[]
  descartados: Descartado[]
  /** 'alta' si el filtro clínico vio crisis, síntoma urgente o conducta alimentaria: la pantalla aplica su flujo de riesgo. */
  urgencia: 'alta' | null
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const lista = (xs: readonly string[]) => xs.map((x) => `«${x}»`).join(' · ')

export const PROMPT_SISTEMA_INGRESO = `Eres el etiquetador del cuestionario de ingreso de Alpha Athletics (coaching de fuerza y nutrición en Colombia). Una persona contesta POR VOZ, en español, como habla; recibes la transcripción de UN turno y los campos que ese turno puede llenar. Tu único trabajo es ETIQUETAR lo que dijo. No hablas con la persona.

REGLAS DE ORO
1. CITAS LITERALES. Cada campo lleva "cita": un fragmento EXACTO y contiguo de la transcripción (mismas letras, sin corregir, sin traducir, sin unir pedazos que en la frase no están juntos). Si no puedes copiarlo de la transcripción, NO pongas el campo.
2. LO NO DICHO SE QUEDA FUERA. Si la persona no dijo un dato, el campo no aparece. No rellenes con lo que "suele" ser, no deduzcas, no uses la pregunta del turno como fuente, no completes. Un campo ausente es una respuesta correcta; uno inventado es el peor error.
3. NÚMEROS: la cita es solo el tramo de ese dato («treinta y un años», «uno sesenta y seis», «55 kilos», «como 72»). No conviertas, no redondees, no calcules. Si la persona se corrige, cita lo último que dijo.
4. OPCIONES: en "opcion" pon EXACTAMENTE una de las opciones listadas (copiada tal cual) y en "cita" el fragmento que la sostiene. Solo si lo dicho la sostiene sin ambigüedad; si dudas entre dos, no pongas el campo.
5. TEXTO LIBRE: la cita ES el valor. Elige el tramo más corto que lo expresa, con sus palabras.
6. SALUD, NUNCA EN UN CAMPO. Dolor, molestia, lesión, cirugía, enfermedad, corazón, presión, medicamento, alergia, ciclo menstrual, problemas con la comida: no van en ningún campo, ni siquiera dentro de una cita de texto libre. Si la persona lo menciona, regístralo SOLO en "salud" con su tema y la cita literal. Tampoco deduzcas ni contestes tú si tiene o no un problema de salud: eso lo contesta ella con un toque.
7. No aconsejes, no interpretes, no hables con la persona.

SALIDA: únicamente un objeto JSON, sin texto antes ni después:
{"campos":{"<id>":{"cita":"<fragmento literal>","opcion":null o "<opción exacta>"}},"salud":[{"tema":"lesion|dolor|medicacion|cardiaco|alimentario|alergia|ciclo|otro","cita":"<fragmento literal>"}]}
Solo aparecen los campos dichos. Si no hay nada, {"campos":{},"salud":[]}. En "opcion" va null para los campos de número y de texto.

EJEMPLOS (campos del turno entre corchetes)
[ciudad texto, edad número, altura_cm número, peso_actual_kg número]
Transcripción: «Pues soy de Cali, eh, tengo treinta y un años y mido uno sesenta y seis»
{"campos":{"ciudad":{"cita":"Cali","opcion":null},"edad":{"cita":"treinta y un años","opcion":null},"altura_cm":{"cita":"uno sesenta y seis","opcion":null}},"salud":[]}
[objetivo_principal opción, parte_a_mejorar texto, peso_objetivo_kg número]
Transcripción: «Quiero bajar de grasa, sobre todo la barriga, y me duele la rodilla izquierda cuando bajo escaleras»
{"campos":{"objetivo_principal":{"cita":"bajar de grasa","opcion":"Pérdida de grasa"},"parte_a_mejorar":{"cita":"la barriga","opcion":null}},"salud":[{"tema":"dolor","cita":"me duele la rodilla izquierda cuando bajo escaleras"}]}
[tipo_trabajo opción, dia_tipo_alimentacion texto]
Transcripción: «Ay, trabajo en una oficina, sentado todo el día, pues como nueve horas»
{"campos":{"tipo_trabajo":{"cita":"trabajo en una oficina, sentado todo el día","opcion":"oficina sentado 9 h"}},"salud":[]}`

/** Cómo se le describe un campo al modelo. */
function describirCampo(c: CampoIngreso): string {
  const tipo = c.tipo === 'numero' ? `número${c.unidad ? ` en ${c.unidad}` : ''}` : c.tipo === 'opcion' ? 'opción' : 'texto'
  const op = c.tipo === 'opcion' && c.opciones ? ` — opciones: ${lista(c.opciones)}` : ''
  const ayuda = c.ayuda ? ` — ${c.ayuda}` : ''
  return `- ${c.id} (${tipo})${ayuda}${op}`
}

/** El mensaje de usuario: los campos de ESTE turno y la transcripción. */
export function armarMensajeIngreso(turno: TurnoId, texto: string): string {
  const t = TURNOS_VOZ.find((x) => x.id === turno)
  if (!t) throw new Error(`turno desconocido: ${turno}`)
  const campos = t.campos.map((id) => campoPorId(id)).filter((c): c is CampoIngreso => !!c)
  return `Campos de este turno:\n${campos.map(describirCampo).join('\n')}\n\nTranscripción:\n«${texto}»`
}

// ---------------------------------------------------------------------------
// Salud: la segunda red, sin modelo
// ---------------------------------------------------------------------------

/** Palabras de salud propias del ingreso que el filtro clínico del registrador no cubre (ya normalizadas). */
const SALUD_EXTRA: { tema: TemaSalud; re: RegExp }[] = [
  // Cómo se dice el dolor hablando y el filtro clínico no lo trae («me pincha la rodilla», «me da corrientazos»).
  { tema: 'dolor', re: /\b(me pincha\w*|pinchan|corrientazo\w*|me tira\w*|me fastidia\w*|se me (inflama|hincha)\w*|crujid\w*|me falla(n)? (la|el|los|las) (rodilla|hombro|espalda|codo|cadera|tobillo|muneca)\w*)\b/ },
  { tema: 'cardiaco', re: /\b(corazon|cardiac\w*|cardiolog\w*|infarto|arritmia|hipertens\w*|presion (alta|arterial|baja)|tension (alta|arterial))\b/ },
  { tema: 'medicacion', re: /\b(betabloq\w*|enalapril|losartan|metoprolol|bisoprolol|atenolol|\d+ ?mg|tratamiento medico)\b/ },
  { tema: 'lesion', re: /\b(cirugia|operacion|operad[oa]|artrosis|artritis|escoliosis|osteoporosis|ligamento|menisco|manguito|protrusion|espondilo\w*|condromalacia|epicondilitis|tendinopatia|rotuliana)\b/ },
  { tema: 'alergia', re: /\b(alergi\w*|intolerancia|intolerante|celiac\w*|lactosa|gluten)\b/ },
  { tema: 'alimentario', re: /\b(anorexia|bulimia|atracon\w*|trastorno alimentari\w*)\b/ },
  { tema: 'ciclo', re: /\b(menstru\w*|ciclo menstrual|me baja la regla)\b/ },
  { tema: 'otro', re: /\b(diabet\w*|asma|epilepsia|tiroid\w*|cancer|embaraz\w*|lactancia)\b/ },
]

const TEMA_DE_FILTRO: Record<string, TemaSalud> = {
  dolor: 'dolor', lesion: 'lesion', medicamento: 'medicacion', sintoma: 'otro',
  conducta_alimentaria: 'alimentario', crisis: 'otro', animo: 'otro',
}

/** Todo lo de salud que el texto trae según el diccionario (filtro clínico + lista del ingreso). */
export function marcarSaludPorDiccionario(texto: string): { marcas: MarcaSalud[]; urgencia: 'alta' | null } {
  const marcas: MarcaSalud[] = []
  const visto = new Set<TemaSalud>()
  const poner = (tema: TemaSalud, cita: string) => {
    if (visto.has(tema)) return
    visto.add(tema)
    marcas.push({ tema, cita, origen: 'diccionario' })
  }
  const f = filtrarClinico(texto)
  if (f) poner(TEMA_DE_FILTRO[f.filtro] ?? 'otro', f.marca)
  const n = normalizarTexto(texto)
  for (const { tema, re } of SALUD_EXTRA) {
    const m = n.match(re)
    if (m) poner(tema, m[0])
  }
  return { marcas, urgencia: f?.urgencia === 'alta' ? 'alta' : null }
}

const traeSalud = (texto: string): boolean => marcarSaludPorDiccionario(texto).marcas.length > 0

/** Tema de salud al que apunta un campo de salud que el modelo intentó rellenar. */
const TEMA_DE_CAMPO_SALUD: Record<string, TemaSalud> = {
  parq_enfermedad_cardiaca: 'cardiaco',
  parq_medicamento_presion: 'medicacion',
  parq_huesos_articulaciones: 'lesion',
  lesiones: 'lesion',
  ejercicios_limitados: 'lesion',
  medicacion: 'medicacion',
  alergias_restricciones: 'alergia',
  tca_historia: 'alimentario',
  solo_mujeres_ciclo: 'ciclo',
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/** Altura en cm desde cómo se dice: «1,66», «uno sesenta y seis», «metro setenta y cinco», «166». */
export function alturaDeCita(cita: string): number | null {
  const n = normalizarTexto(cita)
  const m = n.match(/\b(\d)[.,](\d{1,2})\b/)
  if (m) return Math.round(parseFloat(`${m[1]}.${m[2]}`) * 100)
  const resto = n.match(/\b(?:uno|un metro|metro|1)\s+(?:con\s+|y\s+)?(.+)$/)
  if (resto) {
    const v = valorDeCita(resto[1])
    if (v !== null && v >= 1 && v < 100) return 100 + v
  }
  const v = valorDeCita(cita)
  if (v === null) return null
  return v < 3 ? Math.round(v * 100) : v
}

/** El número de una cita, o el motivo por el que no vale. Nunca adivina entre dos cifras. */
function numeroDeIngreso(c: CampoIngreso, cita: string): { valor: number } | { motivo: MotivoDescarte } {
  let v: number | null
  if (c.id === 'altura_cm') {
    v = alturaDeCita(cita)
  } else {
    if (escanearNumeros(cita).length > 1) return { motivo: 'numero_ambiguo' }
    v = valorDeCita(cita)
  }
  if (v === null || !Number.isFinite(v)) return { motivo: 'numero_ilegible' }
  const [min, max] = c.rango ?? [0, Infinity]
  if (v < min || v > max) return { motivo: 'fuera_de_rango' }
  return { valor: Math.round(v * 100) / 100 }
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}
const cadena = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x.trim() : null)

/**
 * Normaliza la salida cruda del modelo y deja pasar SOLO lo que se puede rastrear a lo dicho. Nunca lanza.
 * `texto` es la transcripción del turno tal como la oyó el modelo.
 */
export function validarIngreso(turno: TurnoId, texto: string, bruto: unknown): ResultadoIngreso {
  const raiz = esObjeto(bruto) ? bruto : {}
  const descartados: Descartado[] = []
  const campos: Record<string, ValorIngreso> = {}
  const salud: MarcaSalud[] = []
  const temasVistos = new Set<TemaSalud>()
  const marcar = (m: MarcaSalud) => {
    if (temasVistos.has(m.tema)) return
    temasVistos.add(m.tema)
    salud.push(m)
  }
  const descartar = (campo: string, motivo: MotivoDescarte, detalle?: string) =>
    descartados.push({ campo, motivo, ...(detalle ? { detalle } : {}) })

  const turnoDef = TURNOS_VOZ.find((t) => t.id === turno)
  const brutoCampos = esObjeto(raiz.campos) ? raiz.campos : {}

  for (const [id, entrada] of Object.entries(brutoCampos)) {
    const def = campoPorId(id)
    const e = esObjeto(entrada) ? entrada : {}
    const cita = cadena(e.cita)

    // Un campo de salud NUNCA se rellena por voz. Si el modelo lo intentó, queda como marca para el toque.
    if (def?.salud) {
      descartar(id, 'salud')
      if (cita && esSubcadenaLiteral(texto, cita)) marcar({ tema: TEMA_DE_CAMPO_SALUD[id] ?? 'otro', cita, origen: 'modelo' })
      continue
    }
    if (!def) { descartar(id, 'desconocido'); continue }
    if (def.modo !== 'voz' || !turnoDef?.campos.includes(id)) { descartar(id, 'fuera_de_turno'); continue }
    if (!cita) { descartar(id, 'sin_cita'); continue }
    if (!esSubcadenaLiteral(texto, cita)) { descartar(id, 'cita_invalida', cita); continue }

    if (def.tipo === 'opcion') {
      const op = cadena(e.opcion)
      const valida = op && def.opciones?.find((o) => normalizarTexto(o) === normalizarTexto(op))
      if (!valida) { descartar(id, 'opcion_invalida', op ?? undefined); continue }
      campos[id] = { campo: id, valor: valida, cita }
    } else if (def.tipo === 'numero') {
      const r = numeroDeIngreso(def, cita)
      if ('motivo' in r) { descartar(id, r.motivo, cita); continue }
      campos[id] = { campo: id, valor: r.valor, cita }
    } else {
      // Texto libre: la cita es el valor, y no puede llevar salud dentro.
      if (traeSalud(cita)) {
        descartar(id, 'texto_clinico', cita)
        for (const m of marcarSaludPorDiccionario(cita).marcas) marcar(m)
        continue
      }
      campos[id] = { campo: id, valor: cita, cita }
    }
  }

  // Marcas de salud que el modelo declaró aparte.
  const brutoSalud = Array.isArray(raiz.salud) ? raiz.salud : []
  for (const s of brutoSalud) {
    if (!esObjeto(s)) continue
    const cita = cadena(s.cita)
    if (!cita || !esSubcadenaLiteral(texto, cita)) { descartar('salud', 'cita_invalida', cita ?? undefined); continue }
    const tema = TEMAS_SALUD.find((t) => t === s.tema) ?? 'otro'
    marcar({ tema, cita, origen: 'modelo' })
  }

  // La segunda red: el diccionario revisa el texto entero, diga lo que diga el modelo.
  const dic = marcarSaludPorDiccionario(texto)
  for (const m of dic.marcas) marcar(m)

  return {
    turno,
    campos,
    salud,
    toques: toquesPorTemas(salud.map((m) => m.tema)),
    descartados,
    urgencia: dic.urgencia,
  }
}

/** Parte de la salida de `claude -p` el objeto JSON que haya dentro, o `null`. */
export function leerSalidaIngreso(salida: string): unknown {
  const m = salida.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    return null
  }
}

/** El formulario que ve la persona en la revisión: lo que salió de la voz, por campo. */
export function juntarTurnos(resultados: readonly ResultadoIngreso[]): {
  valores: Record<string, ValorIngreso>
  toquesPrioritarios: string[]
  urgencia: 'alta' | null
} {
  const valores: Record<string, ValorIngreso> = {}
  const toques = new Set<string>()
  let urgencia: 'alta' | null = null
  for (const r of resultados) {
    Object.assign(valores, r.campos)
    for (const t of r.toques) toques.add(t)
    if (r.urgencia) urgencia = r.urgencia
  }
  return { valores, toquesPrioritarios: [...toques], urgencia }
}

/** Ids de los campos que la voz puede llenar (para pruebas y para el banco). */
export const IDS_DE_VOZ: readonly string[] = CAMPOS_INGRESO.filter((c) => c.modo === 'voz').map((c) => c.id)
