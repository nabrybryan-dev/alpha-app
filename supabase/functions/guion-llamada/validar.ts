// Edge Function guion-llamada: la validación del cuerpo. Módulo puro, sin red ni base.
//
// Va aparte de index.ts para probarlo con vitest (src/domain/guionLlamadaFuncion.test.ts) sin
// levantar Deno, igual que avisos-plan/decidir.ts. No importa nada: se entrega copiando la carpeta.
//
// El contrato es el esquema `guion-llamada-v1` de la landing
// (alpha-praxis-chat: products/web/apps/landing/src/lib/praxis/guion-llamada.ts). La landing ya lo
// valida entero antes de mandarlo (`guionParaApp`), incluidas las reglas de redacción; aquí se
// vuelve a comprobar la FORMA, que es lo que la app necesita para pintarlo, no el estilo.
//
// Qué se exige y qué no:
//   · El CUERPO es estricto: `{ person_id, usuario_id?, guion }` y nada más. Una clave de más es un
//     error de quien llama, y se le dice cuál. `person_id` es el id de la persona en la LANDING
//     (`people.id`): el guion llega al reservar la llamada, ANTES de que exista su cuenta en la app.
//     `usuario_id` (de `usuarios_app`) solo viene cuando ya la hay (tras `alta-cliente`); ausente o
//     null significa «todavía sin cuenta».
//   · `guion.version` tiene que ser exactamente 'guion-llamada-v1': el esquema dice que un
//     consumidor RECHAZA una versión que no conoce (una v2 se pintaría mal en silencio).
//   · Dentro del guion, las claves desconocidas se guardan tal cual; las conocidas, con su forma.
//     Los valores de `tema` y `tipo` se aceptan como texto cualquiera: si la landing añade un tema,
//     la app lo pinta igual.
//   · La REVISIÓN (entero del upsert) no la manda nadie: se deriva de `generado_en`, en
//     milisegundos. Reenviar el mismo guion da la misma revisión; uno rehecho, una mayor.
//   · Día y franja de la llamada salen de `guion.reserva`: una sola fuente. La franja es siempre
//     'tarde' (Manuela llama de lunes a viernes, en la tarde: HORARIO_LLAMADA de la landing).
//   · Tope de tamaño sobre el cuerpo entero en bytes, antes de parsear nada.
//
// Los mensajes de error son códigos cortos y fijos: nunca repiten lo que llegó (ni un nombre, ni
// un correo, ni un trozo del guion), así que no hay dato personal que se filtre por un error.

export const TOPE_BYTES = 32 * 1024
export const VERSION_GUION = 'guion-llamada-v1'
export const ZONA_RESERVA = 'America/Bogota'
export const FRANJA_LLAMADA = 'tarde'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const CLAVES_CUERPO = new Set(['person_id', 'usuario_id', 'guion'])
const TEXTOS_PERSONA = ['nombre', 'email', 'whatsapp', 'edad_tramo', 'objetivo', 'decision', 'pasos_al_dia', 'dias_de_fuerza', 'experiencia', 'lugar']
const NUMEROS_PERSONA = ['edad', 'gasto_diario_kcal', 'grasa_estimada_pct']

export interface GuionValido {
  personId: string
  /** `null` = la persona aún no tiene cuenta en la app. */
  usuarioId: string | null
  guion: Record<string, unknown>
  /** Milisegundos de `guion.generado_en`. */
  revision: number
  diaPreferido: string
  franjaPreferida: typeof FRANJA_LLAMADA
}

export type Validacion = { ok: true; valor: GuionValido } | { ok: false; error: string }

type Objeto = Record<string, unknown>

function esObjeto(v: unknown): v is Objeto {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
const esTexto = (v: unknown): v is string => typeof v === 'string'
const textoONulo = (v: unknown) => v === null || v === undefined || esTexto(v)
const numeroONulo = (v: unknown) => v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v))

function bytesDe(texto: string): number {
  return new TextEncoder().encode(texto).length
}

/** `2026-02-31` no es una fecha aunque tenga la forma: se comprueba que el día exista. */
export function esFechaReal(texto: string): boolean {
  const m = FECHA_ISO.exec(texto)
  if (!m) return false
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const f = new Date(Date.UTC(anio, mes - 1, dia))
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia
}

/** La revisión: los milisegundos de un ISO 8601 con zona. Sin zona sería la hora de quien lo lea. */
export function revisionDe(generadoEn: unknown): number | null {
  if (!esTexto(generadoEn) || !/^\d{4}-\d{2}-\d{2}T.+(Z|[+-]\d{2}:?\d{2})$/.test(generadoEn)) return null
  const ms = Date.parse(generadoEn)
  return Number.isFinite(ms) && ms > 0 ? ms : null
}

/** Lista de objetos donde cada clave pedida es texto (o, si se permite, null). */
function listaDe(v: unknown, textos: string[], nulos: string[] = []): boolean {
  return (
    Array.isArray(v) &&
    v.every((x) => esObjeto(x) && textos.every((k) => esTexto(x[k]) || (nulos.includes(k) && x[k] === null)))
  )
}

const esListaDeTextos = (v: unknown) => Array.isArray(v) && v.every(esTexto)

function personaMalFormada(p: unknown): boolean {
  if (!esObjeto(p)) return true
  if (!TEXTOS_PERSONA.every((k) => textoONulo(p[k]))) return true
  if (!NUMEROS_PERSONA.every((k) => numeroONulo(p[k]))) return true
  return p.molestias !== undefined && !esListaDeTextos(p.molestias)
}

function alertaMalFormada(a: unknown): boolean {
  return !esObjeto(a) || !['hay', 'requiere_aval', 'menor_de_edad'].every((k) => typeof a[k] === 'boolean')
}

function reservaMalFormada(r: unknown): boolean {
  if (!esObjeto(r) || !esTexto(r.fecha) || !esFechaReal(r.fecha)) return true
  if (!(r.hora === null || r.hora === undefined || (esTexto(r.hora) && HORA.test(r.hora)))) return true
  return r.zona !== ZONA_RESERVA || !textoONulo(r.en_claro)
}

/** Primer campo del guion con forma equivocada, o `null` si todos están bien. */
function campoMalFormado(g: Objeto): string | null {
  const reglas: Array<[string, boolean]> = [
    ['origen', g.origen !== undefined && g.origen !== 'modelo' && g.origen !== 'reglas'],
    ['reserva', reservaMalFormada(g.reserva)],
    ['persona', personaMalFormada(g.persona)],
    ['alerta_salud', alertaMalFormada(g.alerta_salud)],
    ['apertura', !textoONulo(g.apertura)],
    ['cierre', !textoONulo(g.cierre)],
    ['dolores', g.dolores !== undefined && !listaDe(g.dolores, ['texto', 'fuente'])],
    ['que_mostrar', g.que_mostrar !== undefined && !listaDe(g.que_mostrar, ['tema', 'titulo', 'dato', 'como_decirlo'], ['dato'])],
    ['objeciones_probables', g.objeciones_probables !== undefined && !listaDe(g.objeciones_probables, ['tipo', 'objecion', 'respuesta'])],
    ['avisos', g.avisos !== undefined && !esListaDeTextos(g.avisos)],
    ['recomendaciones_praxis', g.recomendaciones_praxis !== undefined && !esListaDeTextos(g.recomendaciones_praxis)],
  ]
  return reglas.find(([, malo]) => malo)?.[0] ?? null
}

function parsear(texto: string): { ok: true; cuerpo: Objeto } | { ok: false; error: string } {
  if (bytesDe(texto) > TOPE_BYTES) return { ok: false, error: 'cuerpo demasiado grande' }
  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    return { ok: false, error: 'json invalido' }
  }
  return esObjeto(cuerpo) ? { ok: true, cuerpo } : { ok: false, error: 'cuerpo invalido' }
}

/**
 * Del texto crudo de la petición a lo que se inserta. Recibe el TEXTO, no el JSON ya parseado,
 * para medir el tamaño real antes de gastar en parsearlo.
 */
export function validarCuerpo(texto: string): Validacion {
  const leido = parsear(texto)
  if (!leido.ok) return leido
  const cuerpo = leido.cuerpo
  const sobrante = Object.keys(cuerpo).find((k) => !CLAVES_CUERPO.has(k))
  // El nombre de la clave solo se repite si parece un nombre de campo: nunca un texto libre.
  if (sobrante) return { ok: false, error: /^[a-z_]{1,40}$/.test(sobrante) ? `campo no esperado: ${sobrante}` : 'campo no esperado' }
  if (!esTexto(cuerpo.person_id) || !UUID.test(cuerpo.person_id)) return { ok: false, error: 'person_id invalido' }
  const usuario = cuerpo.usuario_id
  const sinCuenta = usuario === undefined || usuario === null
  if (!sinCuenta && (!esTexto(usuario) || !UUID.test(usuario))) return { ok: false, error: 'usuario_id invalido' }
  const guion = cuerpo.guion
  if (!esObjeto(guion)) return { ok: false, error: 'guion invalido' }
  if (guion.version !== VERSION_GUION) return { ok: false, error: 'version no soportada' }
  const revision = revisionDe(guion.generado_en)
  if (revision === null) return { ok: false, error: 'generado_en invalido' }
  const malo = campoMalFormado(guion)
  if (malo) return { ok: false, error: `campo mal formado: ${malo}` }
  return {
    ok: true,
    valor: {
      personId: cuerpo.person_id.toLowerCase(),
      usuarioId: sinCuenta ? null : (usuario as string).toLowerCase(),
      guion,
      revision,
      diaPreferido: (guion.reserva as Objeto).fecha as string,
      franjaPreferida: FRANJA_LLAMADA,
    },
  }
}

/** Comparación en tiempo constante (misma que alta-cliente): una clave vacía nunca pasa. */
export function igualesSeguro(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
