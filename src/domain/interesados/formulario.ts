/**
 * El formulario de los interesados que llegan por un creador: las 3 preguntas de encaje
 * y la autorización de datos sensibles. Lógica pura: sin React y sin I/O.
 *
 * Fuentes (repo `alpha-estudio/bola-de-nieve`):
 *   - `embudo/PREGUNTAS-ENCAJE.md` — las 3 preguntas y el código de cada opción.
 *   - `legal/AUTORIZACION-DATOS-SENSIBLES.md` v0.4 — casillas A–E (§10) y registro de la
 *     prueba (§11). La D va con la redacción neutra de Bryan, al pie de la letra. La E
 *     (v0.4, 28-sep) autoriza leer del teléfono los seis datos de la Fase A de salud.
 *   - `embudo/PASO-A-PASO.md` — «Puerta del campo libre»: NINGÚN campo de texto libre.
 *
 * Las dos garantías que viven aquí, y no en la pantalla, para que ninguna pantalla futura
 * se las pueda saltar:
 *   1. `construirEnvio` solo acepta las claves y los códigos de opción de este archivo.
 *      Una clave de más (un comentario, un «otro, ¿cuál?», una lesión) rechaza el envío
 *      entero: no se recorta en silencio, porque recortar esconde el fallo de quien lo
 *      mandó.
 *   2. Este formulario NO pide ningún dato de salud, marque lo que marque. Las casillas
 *      A–C y E autorizan a PREGUNTAR (o a leer del teléfono) después, fuera de aquí;
 *      `puedePedirSalud` es la puerta que tiene que consultar quien lo pregunte.
 */

export const VERSION_AUTORIZACION = '0.4'
export const FECHA_VERSION_AUTORIZACION = '2026-09-28'

export interface Opcion<C extends string = string> {
  codigo: C
  etiqueta: string
}

export const DIAS = [
  { codigo: '1', etiqueta: '1 día' },
  { codigo: '2', etiqueta: '2 días' },
  { codigo: '3', etiqueta: '3 días' },
  { codigo: '4_o_mas', etiqueta: '4 o más días' },
] as const satisfies readonly Opcion[]

export const HORARIOS = [
  { codigo: 'fijos', etiqueta: 'Mis horarios son fijos' },
  { codigo: 'cambian', etiqueta: 'Mis horarios cambian' },
] as const satisfies readonly Opcion[]

export const LUGARES = [
  { codigo: 'gimnasio', etiqueta: 'Gimnasio' },
  { codigo: 'casa con equipo', etiqueta: 'Casa con algo de equipo, como mancuernas o bandas' },
  { codigo: 'casa sin equipo', etiqueta: 'Casa sin equipo' },
  { codigo: 'parque u otro', etiqueta: 'Parque u otro' },
] as const satisfies readonly Opcion[]

export const MODALIDADES = [
  { codigo: 'en línea', etiqueta: 'Acompañamiento en línea' },
  { codigo: 'presencial', etiqueta: 'Entrenador presencial a mi lado' },
] as const satisfies readonly Opcion[]

export const EXPECTATIVAS = [
  { codigo: 'constancia', etiqueta: 'Ser constante y no dejarlo a las pocas semanas' },
  { codigo: 'organizarme', etiqueta: 'Organizarme para entrenar con mis horarios' },
  { codigo: 'fuerza', etiqueta: 'Ganar fuerza' },
  { codigo: 'aprender', etiqueta: 'Aprender a entrenar bien' },
  { codigo: 'energia', etiqueta: 'Sentirme con más energía' },
  { codigo: 'resultado_garantizado', etiqueta: 'Un resultado garantizado en un plazo' },
  {
    codigo: 'plan_profesional_salud',
    etiqueta: 'Una dieta o un plan hecho por un profesional de la salud',
  },
] as const satisfies readonly Opcion[]

type CodigoDe<T extends readonly Opcion[]> = T[number]['codigo']

export interface RespuestasEncaje {
  p1Dias: CodigoDe<typeof DIAS>
  p1Horarios: CodigoDe<typeof HORARIOS>
  p2Lugar: CodigoDe<typeof LUGARES>
  p2Modalidad: CodigoDe<typeof MODALIDADES>
  p3Expectativa: CodigoDe<typeof EXPECTATIVAS>
}

/** Pregunta → sus opciones. Lo que ata la pantalla, la validación y la tabla. */
export const OPCIONES_ENCAJE: { [K in keyof RespuestasEncaje]: readonly Opcion[] } = {
  p1Dias: DIAS,
  p1Horarios: HORARIOS,
  p2Lugar: LUGARES,
  p2Modalidad: MODALIDADES,
  p3Expectativa: EXPECTATIVAS,
}

export const CLAVES_ENCAJE = Object.keys(OPCIONES_ENCAJE) as (keyof RespuestasEncaje)[]

export const ENUNCIADOS = {
  p1: '1. ¿Cuántos días a la semana puedes entrenar de verdad, y tus horarios cambian de una semana a otra?',
  p2: '2. ¿Dónde vas a entrenar y qué tienes a la mano?',
  p3: '3. ¿Qué te gustaría que fuera distinto dentro de 3 meses? (elige una)',
  sinSalud:
    'No te pedimos datos de salud en este formulario. Si hacen falta, te los pedimos después, con tu autorización.',
} as const

// ─── La autorización (v0.4, §10) ────────────────────────────────────────────

export type LetraCasilla = 'A' | 'B' | 'C' | 'D' | 'E'
export type Casilla = 'si' | 'no'

export interface DefinicionCasilla {
  letra: LetraCasilla
  texto: string
  /** A, B, C y E autorizan datos de SALUD; D solo el procesamiento por proveedores. */
  esDeSalud: boolean
  /** Lo que se muestra junto a la casilla (la D y la E lo tienen en v0.4). */
  alcance?: string
}

/**
 * La casilla E, entera. Vive aquí para que el formulario de interesados y la pantalla de
 * Bienestar (donde la persona ya con cuenta la otorga o la revoca) muestren EXACTAMENTE el
 * mismo texto, que es el que quedó firmado en la versión 0.4.
 */
export const DATOS_CASILLA_E = [
  'pasos',
  'sueño',
  'frecuencia cardiaca en reposo',
  'variabilidad de la frecuencia cardiaca',
  'minutos de ejercicio',
  'peso',
] as const

export const TEXTO_CASILLA_E =
  'Leer desde mi teléfono (Apple Salud, con un atajo, o Health Connect, con la app de Alpha) mis pasos, mi sueño, mi frecuencia cardiaca en reposo, mi variabilidad de la frecuencia cardiaca, mis minutos de ejercicio y mi peso, para que Alpha y mi coach ajusten mis recomendaciones de estilo de vida y entrenamiento'

export const ALCANCE_CASILLA_E =
  'Solo guardamos un resumen por día de esos seis datos: nunca tu ubicación, tus rutas ni las mediciones sueltas. Lo ven tu coach y el equipo de Alpha con acceso a entrenamiento. Es voluntario: si marcas «No», recibes el mismo servicio y anotas tu check-in a mano. Puedes revocarla cuando quieras, en la app (Bienestar, Salud del celular): tu código deja de funcionar al instante y, si lo pides, borramos lo que ya enviaste. Los proveedores tecnológicos solo reciben estos datos si además marcas la D.'

export const CASILLAS: readonly DefinicionCasilla[] = [
  {
    letra: 'A',
    esDeSalud: true,
    texto:
      'Usar mis lesiones, patologías y medicación para adaptar mi plan de entrenamiento',
  },
  {
    letra: 'B',
    esDeSalud: true,
    texto:
      'Usar mi alimentación, medidas y datos de salud para preparar un plan de nutrición individualizado revisado por un/a nutricionista habilitado/a',
  },
  {
    letra: 'C',
    esDeSalud: true,
    texto:
      'Tratar mis fotos corporales y medidas para seguir mi progreso (si también marco B, el/la nutricionista puede verlas)',
  },
  {
    letra: 'D',
    esDeSalud: false,
    // Redacción neutra de Bryan (v0.3, 27-sep; sin cambios en la v0.4). NO se parafrasea:
    // es el texto aceptado.
    texto:
      'Para preparar y hacer seguimiento a tu plan usamos proveedores tecnológicos que procesan tus datos por encargo nuestro; algunos tienen sus servidores fuera de Colombia. ¿Lo autorizas?',
    alcance:
      'Son los proveedores de la sección 6 marcados «requiere D»; solo reciben, sin tu nombre, los datos de las finalidades que marcaste y los planes derivados, nunca fotos; marcar «Sí» es tu autorización expresa para esa transferencia fuera de Colombia (Ley 1581, art. 26 lit. a). Si marcas «No», recibes el mismo servicio sin esos proveedores.',
  },
  {
    // La E (v0.4, 28-sep): una sola casilla, específica, para los seis datos de la Fase A de
    // salud del celular (COSTOS-APP-NATIVA-Y-SALUD.md §5.1). Es la que la app vuelve a
    // pedir, ya con la cuenta, antes de generar el código del atajo (`salud_consentimientos`).
    letra: 'E',
    esDeSalud: true,
    texto: TEXTO_CASILLA_E,
    alcance: ALCANCE_CASILLA_E,
  },
]

export const DECLARACION =
  'Declaro que: me informaron que responder sobre datos sensibles es voluntario; que leí para qué se usan, quién los ve, a qué proveedores y países van, cuánto tiempo se guardan y cómo ejercer mis derechos; y que soy mayor de 18 años.'

export type Casillas = Record<LetraCasilla, Casilla>

/**
 * Qué dato de salud cubre cada casilla (mapa de datos §4). Solo para la puerta de
 * `puedePedirSalud`: este formulario no pide ninguno de ellos.
 */
export type DatoDeSalud =
  | 'lesiones'
  | 'patologias'
  | 'medicacion'
  | 'alimentacion'
  | 'medidas'
  | 'fotos'
  // Los seis de la casilla E (mismos códigos que `salud_muestras.tipo`, migración 0093).
  | 'pasos'
  | 'sueno'
  | 'fc_reposo'
  | 'vfc'
  | 'minutos_ejercicio'
  | 'peso'

const SALUD_POR_CASILLA: Record<'A' | 'B' | 'C' | 'E', readonly DatoDeSalud[]> = {
  A: ['lesiones', 'patologias', 'medicacion'],
  B: ['lesiones', 'patologias', 'medicacion', 'alimentacion', 'medidas'],
  C: ['fotos', 'medidas'],
  E: ['pasos', 'sueno', 'fc_reposo', 'vfc', 'minutos_ejercicio', 'peso'],
}

/**
 * ¿Se le puede PREGUNTAR (o leer del teléfono) este dato de salud? Solo si alguna casilla que
 * lo cubre está en «sí». Sin autorización (`undefined`: no la llenó) es «no» en las cinco
 * (PASO-A-PASO, paso 5). La D no abre ningún dato: solo decide por dónde se procesa lo ya
 * autorizado. Ojo con `peso`: solo lo abre la E; la B cubre las `medidas` del plan de nutrición.
 */
export function puedePedirSalud(casillas: Casillas | undefined, dato: DatoDeSalud): boolean {
  if (!casillas) return false
  return (['A', 'B', 'C', 'E'] as const).some(
    (letra) => casillas[letra] === 'si' && SALUD_POR_CASILLA[letra].includes(dato),
  )
}

// ─── El envío ───────────────────────────────────────────────────────────────

export interface EnvioInteresado {
  /** Generado en el navegador: ata la respuesta de encaje con su autorización. */
  envioId: string
  codigo: string | null
  clienteId: string | null
  encaje: RespuestasEncaje
  autorizacion: {
    version: string
    canal: 'formulario'
    casillas: Casillas
    declaracionAceptada: true
  }
}

/** Lo que llega de la pantalla: todo opcional hasta que se valida. */
export interface Borrador {
  encaje: Partial<Record<keyof RespuestasEncaje, string>>
  casillas: Partial<Record<LetraCasilla, string>>
  declaracion: boolean
}

export type ResultadoEnvio =
  | { ok: true; envio: EnvioInteresado }
  | { ok: false; faltan: string[]; rechazadas: string[] }

const LETRAS: readonly LetraCasilla[] = ['A', 'B', 'C', 'D', 'E']

function clavesDeMas(objeto: object, permitidas: readonly string[]): string[] {
  return Object.keys(objeto).filter((k) => !permitidas.includes(k))
}

/**
 * Valida el borrador y lo convierte en el envío. Rechaza (no recorta):
 *   - cualquier clave que no sea de las 5 respuestas, las 4 casillas o la declaración;
 *   - cualquier valor que no sea un código de opción (así no entra texto libre);
 * y exige las 5 respuestas, las 5 casillas con «sí» o «no» (nada viene marcado y el
 * silencio no autoriza) y la declaración.
 */
export function construirEnvio(
  borrador: Borrador,
  contexto: { envioId: string; codigo: string | null; clienteId: string | null },
): ResultadoEnvio {
  const faltan: string[] = []
  const rechazadas = [
    ...clavesDeMas(borrador, ['encaje', 'casillas', 'declaracion']),
    ...clavesDeMas(borrador.encaje ?? {}, CLAVES_ENCAJE).map((k) => `encaje.${k}`),
    ...clavesDeMas(borrador.casillas ?? {}, LETRAS).map((k) => `casillas.${k}`),
  ]

  for (const clave of CLAVES_ENCAJE) {
    const valor = borrador.encaje?.[clave]
    if (valor === undefined) faltan.push(clave)
    else if (!OPCIONES_ENCAJE[clave].some((o) => o.codigo === valor)) rechazadas.push(clave)
  }
  for (const letra of LETRAS) {
    const valor = borrador.casillas?.[letra]
    if (valor === undefined) faltan.push(`casilla ${letra}`)
    else if (valor !== 'si' && valor !== 'no') rechazadas.push(`casilla ${letra}`)
  }
  if (borrador.declaracion !== true) faltan.push('declaración')

  if (faltan.length > 0 || rechazadas.length > 0) return { ok: false, faltan, rechazadas }

  return {
    ok: true,
    envio: {
      envioId: contexto.envioId,
      codigo: contexto.codigo,
      clienteId: contexto.clienteId,
      encaje: Object.fromEntries(
        CLAVES_ENCAJE.map((k) => [k, borrador.encaje[k]]),
      ) as unknown as RespuestasEncaje,
      autorizacion: {
        version: VERSION_AUTORIZACION,
        canal: 'formulario',
        casillas: Object.fromEntries(
          LETRAS.map((l) => [l, borrador.casillas[l]]),
        ) as Casillas,
        declaracionAceptada: true,
      },
    },
  }
}
