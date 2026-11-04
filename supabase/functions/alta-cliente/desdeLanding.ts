/**
 * De la encuesta de inscripción de la landing a la ficha (`perfiles.datos`) y al cribado.
 *
 * QUÉ RESUELVE. Quien paga en la landing ya contestó una encuesta larga: PAR-Q, medidas,
 * días, objetivo. Al recibir su cuenta en la app, volver a pedirle todo eso es la forma
 * más rápida de que abandone. `alta-cliente` llama aquí y deja la ficha y el cribado
 * escritos en la misma operación que crea la cuenta.
 *
 * LA REGLA QUE MANDA: NO SE INVENTA NADA CLÍNICO. Es la de la 0058: `ausente` es «se le
 * preguntó y no tiene» y la ausencia del campo es «no se le preguntó». Por eso:
 *   - Solo se traducen las preguntas que la landing hace con el MISMO sentido que la app
 *     (los tres `parq_*` que comparten nombre, y los síntomas con esfuerzo, que en la app
 *     son exactamente la unión de las tres preguntas de pecho y mareo de la landing).
 *   - El texto libre (enfermedades, medicamentos, lesiones) NO decide el estado. Una
 *     negación literal («no», «ninguna») sí es un «no»; cualquier otro texto viaja tal
 *     cual a `detalle` y el campo se queda sin poner. «Tomo vitamina D» no es una
 *     medicación crónica hasta que la persona o el coach lo digan.
 *   - Lo que la landing no pregunta (quién la lleva, autorización, nivel funcional…) se
 *     queda sin poner, y la app se lo pregunta al abrir la pantalla de salud.
 *
 * La fila sale con `fuente = 'encuesta'`, que la 0058 ya admite y que no está atada al
 * CHECK de completitud de las filas `app`.
 *
 * SIN IMPORTS A PROPÓSITO: este archivo lo compila Deno al desplegar la función y lo
 * importa Vitest en los tests. Los rangos de `MEDIDAS_CERRADAS` repiten los de
 * `src/domain/medidas.ts`; un test compara las dos tablas para que no se separen.
 */

export type Respuestas = Record<string, unknown>

type Estado = 'presente' | 'ausente'

export interface FilaCribadoEncuesta {
  fuente: 'encuesta'
  diagnostico: Estado | null
  medicacion_cronica: Estado | null
  sintomas_con_esfuerzo: Estado | null
  parq_enfermedad_cardiaca: boolean | null
  parq_medicamento_presion: boolean | null
  parq_huesos_articulaciones: boolean | null
  detalle: Record<string, string>
}

export interface MedidaDeEncuesta {
  fecha: string
  pesoKg?: number
  alturaCm: number
  perimetros: Record<string, number>
  cuerpo?: Record<string, number>
}

/** Mismas claves y mismos valores neutros que `perfilVacio` en la app. */
export interface PerfilDeEncuesta {
  usuarioId: string
  objetivos: string
  edad: number
  diasEntrenamiento: number
  tiempoSesionMin: number
  somatotipo: string
  volumenSemanal: Record<string, never>
  medidas: MedidaDeEncuesta[]
}

/** Las medidas cerradas de la ficha que la landing toma con la misma definición. */
export const MEDIDAS_CERRADAS = {
  cuelloCm: { desde: 'medida_cuello_cm', minimo: 20, maximo: 60 },
  // La app: «punto más estrecho entre la última costilla y la cresta». La landing:
  // «punto más angosto entre costillas y ombligo». La del ombligo es otra medida.
  cinturaCm: { desde: 'medida_cintura_natural_cm', minimo: 40, maximo: 200 },
  // La app: «parte más ancha de los glúteos». La landing: «parte más saliente del
  // glúteo». Su «cadera» es la ósea, que es otra cosa y va a `perimetros`.
  caderasCm: { desde: 'medida_gluteo_cm', minimo: 50, maximo: 200 },
  anchoClavicularCm: { desde: 'medida_clavicular_cm', minimo: 24, maximo: 57 },
} as const

/**
 * El resto de perímetros, a la lista abierta con su nombre. `medida_hombros_cm` NO entra:
 * unos asesorados midieron contorno y otros anchura, y el cuestionario no lo distingue;
 * meterlo en la ficha sería guardar un número que no se puede comparar.
 */
const PERIMETROS_ABIERTOS: Record<string, string> = {
  medida_pecho_cm: 'Pecho',
  medida_bicep_derecho_cm: 'Bíceps derecho',
  medida_bicep_izquierdo_cm: 'Bíceps izquierdo',
  medida_antebrazo_derecho_cm: 'Antebrazo derecho',
  medida_antebrazo_izquierdo_cm: 'Antebrazo izquierdo',
  medida_cintura_ombligo_cm: 'Cintura al ombligo',
  medida_abdomen_bajo_cm: 'Abdomen bajo',
  medida_cadera_cm: 'Cadera ósea',
  medida_muslo_derecho_cm: 'Muslo derecho',
  medida_muslo_izquierdo_cm: 'Muslo izquierdo',
  medida_pantorrilla_derecha_cm: 'Pantorrilla derecha',
  medida_pantorrilla_izquierda_cm: 'Pantorrilla izquierda',
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function numero(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

function enRango(v: unknown, minimo: number, maximo: number): number | null {
  const n = numero(v)
  return n !== null && n >= minimo && n <= maximo ? n : null
}

/** «Sí»/«No» de la landing. Cualquier otra cosa es «no contestó». */
export function siNo(v: unknown): boolean | null {
  if (v === true || v === false) return v
  const t = texto(v)?.toLowerCase()
  if (t === 'sí' || t === 'si') return true
  if (t === 'no') return false
  return null
}

/** Una negación literal, sin interpretar nada más. Vacío NO es negación: es no contestar. */
export function esNegacionLiteral(v: string): boolean {
  const limpio = v.toLowerCase().replace(/[.\s!]/g, '')
  return ['no', 'ninguna', 'ninguno', 'nada', 'na', 'n/a', '-', 'notengo', 'noaplica'].includes(limpio)
}

/** Las respuestas, vengan como `answers` sueltas o envueltas como las exporta el panel. */
export function respuestasDe(intake: unknown): Respuestas | null {
  if (!intake || typeof intake !== 'object' || Array.isArray(intake)) return null
  const o = intake as Record<string, unknown>
  for (const envoltura of [o.answers, (o.client_intake as Record<string, unknown> | undefined)?.answers]) {
    if (envoltura && typeof envoltura === 'object' && !Array.isArray(envoltura)) return envoltura as Respuestas
  }
  return o
}

function estadoDeTexto(
  v: unknown,
  clave: string,
  detalle: Record<string, string>,
): Estado | null {
  const t = texto(v)
  if (!t) return null
  if (esNegacionLiteral(t)) return 'ausente'
  detalle[clave] = `Encuesta de inscripción: ${t}`
  return null
}

const SINTOMAS: readonly [string, string][] = [
  ['parq_dolor_pecho_actividad', 'dolor en el pecho al hacer actividad física'],
  ['parq_dolor_pecho_reposo', 'dolor en el pecho en reposo en el último mes'],
  ['parq_mareo_conciencia', 'pérdida de conciencia o de equilibrio tras un mareo'],
]

/**
 * El cribado de la encuesta, o `null` si la encuesta no trae ni una respuesta de salud
 * (una fila vacía haría creer a la app que ya se contestó).
 */
export function cribadoDesdeEncuesta(a: Respuestas): FilaCribadoEncuesta | null {
  const detalle: Record<string, string> = {}

  const sintomas = SINTOMAS.map(([k]) => siNo(a[k]))
  let sintomas_con_esfuerzo: Estado | null = null
  if (sintomas.some((s) => s === true)) {
    sintomas_con_esfuerzo = 'presente'
    detalle.sintomas_con_esfuerzo =
      'Encuesta de inscripción: ' +
      SINTOMAS.filter((_, i) => sintomas[i] === true).map(([, d]) => d).join('; ')
  } else if (sintomas.every((s) => s === false)) {
    sintomas_con_esfuerzo = 'ausente'
  }

  const parq_enfermedad_cardiaca = siNo(a.parq_enfermedad_cardiaca)
  const parq_medicamento_presion = siNo(a.parq_medicamento_presion)
  const parq_huesos_articulaciones = siNo(a.parq_huesos_articulaciones)

  const lesiones = texto(a.lesiones)
  if (parq_huesos_articulaciones === true && lesiones && !esNegacionLiteral(lesiones)) {
    detalle.parq_huesos_articulaciones = `Encuesta de inscripción (lesiones): ${lesiones}`
  }
  // No equivale a ninguna pregunta de la app: no fija estado, solo deja constancia.
  if (siNo(a.parq_otra_razon_medica) === true) {
    detalle.parq_otra_razon_medica =
      'Encuesta de inscripción: dijo que sí conoce una razón por la que no debería hacer ejercicio sin supervisión.'
  }

  const diagnostico = estadoDeTexto(a.enfermedades_diagnosticadas, 'diagnostico', detalle)
  const medicacion_cronica = estadoDeTexto(a.medicamentos, 'medicacion_cronica', detalle)

  const fila: FilaCribadoEncuesta = {
    fuente: 'encuesta',
    diagnostico,
    medicacion_cronica,
    sintomas_con_esfuerzo,
    parq_enfermedad_cardiaca,
    parq_medicamento_presion,
    parq_huesos_articulaciones,
    detalle,
  }
  const algo =
    [diagnostico, medicacion_cronica, sintomas_con_esfuerzo].some((x) => x !== null) ||
    [parq_enfermedad_cardiaca, parq_medicamento_presion, parq_huesos_articulaciones].some((x) => x !== null) ||
    Object.keys(detalle).length > 0
  return algo ? fila : null
}

/** Años cumplidos a `hoyIso`. Sin fecha válida o fuera de 10–100, 0 (= no consta). */
export function edadA(fechaNacimiento: unknown, hoyIso: string): number {
  const f = texto(fechaNacimiento)
  if (!f || !FECHA.test(f) || !FECHA.test(hoyIso)) return 0
  const [a, m, d] = f.split('-').map(Number)
  const [ha, hm, hd] = hoyIso.split('-').map(Number)
  const edad = ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
  return edad >= 10 && edad <= 100 ? edad : 0
}

function medidaDesdeEncuesta(a: Respuestas, hoyIso: string): MedidaDeEncuesta | null {
  const alturaCm = enRango(a.altura_cm, 100, 250)
  if (alturaCm === null) return null
  const fechaMedidas = texto(a.fecha_medidas)
  const medida: MedidaDeEncuesta = {
    fecha: fechaMedidas && FECHA.test(fechaMedidas) && fechaMedidas <= hoyIso ? fechaMedidas : hoyIso,
    alturaCm,
    perimetros: {},
  }
  const peso = enRango(a.peso_actual_kg, 25, 350)
  if (peso !== null) medida.pesoKg = peso

  const cuerpo: Record<string, number> = {}
  for (const [clave, def] of Object.entries(MEDIDAS_CERRADAS)) {
    const n = enRango(a[def.desde], def.minimo, def.maximo)
    if (n !== null) cuerpo[clave] = n
  }
  if (Object.keys(cuerpo).length > 0) medida.cuerpo = cuerpo

  for (const [campo, etiqueta] of Object.entries(PERIMETROS_ABIERTOS)) {
    const n = enRango(a[campo], 5, 250)
    if (n !== null) medida.perimetros[etiqueta] = n
  }
  return medida
}

function minutosDeSesion(v: unknown): number {
  const m = texto(v)?.match(/^(\d{2,3})\s*min/i)
  return m ? Number(m[1]) : 0
}

function objetivosDe(a: Respuestas): string {
  const principal = texto(a.objetivo_principal)
  const detalle = texto(a.objetivo_detalle)
  return [principal, detalle].filter(Boolean).join(' — ')
}

/**
 * La ficha desde la encuesta. Lo que no consta queda con el valor neutro de
 * `perfilVacio` (0, '', []), que en la app ya significa «sin dato».
 *
 * `somatotipo` se deja vacío a propósito: el de la landing es autopercibido y la propia
 * pregunta dice que no es un diagnóstico. El sexo tampoco se toca: es una columna aparte
 * que fija el coach (0056).
 */
export function perfilDesdeEncuesta(usuarioId: string, a: Respuestas, hoyIso: string): PerfilDeEncuesta {
  const dias = numero(a.dias_por_semana)
  const medida = medidaDesdeEncuesta(a, hoyIso)
  return {
    usuarioId,
    objetivos: objetivosDe(a),
    edad: edadA(a.fecha_nacimiento, hoyIso),
    diasEntrenamiento: dias !== null && Number.isInteger(dias) && dias <= 7 ? dias : 0,
    tiempoSesionMin: minutosDeSesion(a.tiempo_por_sesion),
    somatotipo: '',
    volumenSemanal: {},
    medidas: medida ? [medida] : [],
  }
}

/**
 * `true` = la ficha que ya hay la llenó alguien y NO se toca. `false` = no hay nada que
 * proteger: no existe, o es la ficha vacía que deja `crear_ficha_si_falta` (solo
 * `usuarioId` y `medidas: []`), y la encuesta puede ocupar su sitio.
 */
export function fichaSeQuedaSinTocar(datos: unknown): boolean {
  if (datos === null || datos === undefined) return false
  if (typeof datos !== 'object' || Array.isArray(datos)) return true
  const d = datos as Record<string, unknown>
  const claves = Object.keys(d).filter((k) => k !== 'usuarioId')
  if (claves.length === 0) return false
  return !(claves.length === 1 && Array.isArray(d.medidas) && d.medidas.length === 0)
}
