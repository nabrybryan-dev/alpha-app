// Edge Function guion-llamada: la validación del cuerpo. Módulo puro, sin red ni base.
//
// Va aparte de index.ts para probarlo con vitest (src/domain/guionLlamadaFuncion.test.ts) sin
// levantar Deno, igual que avisos-plan/decidir.ts. No importa nada: se entrega copiando la carpeta.
//
// Qué se exige y qué no:
//   · El CUERPO es estricto: solo usuario_id, guion, dia_preferido y franja_preferida. Una clave
//     de más es un error de quien llama, y se le dice cuál.
//   · El GUION es tolerante hacia adelante: claves desconocidas se guardan tal cual (la landing
//     puede añadir campos antes de que la app los pinte), pero las conocidas tienen que tener su
//     forma. Lo único obligatorio es `version`, entero positivo: es la mitad de la clave del upsert.
//   · Tope de tamaño sobre el cuerpo entero en bytes, antes de parsear nada.
//
// Los mensajes de error son códigos cortos y fijos: nunca repiten lo que llegó (ni un nombre ni un
// trozo del guion), así que no hay dato personal que se filtre por un error.

export const TOPE_BYTES = 32 * 1024
export const VERSION_MAXIMA = 1_000_000
export const FRANJAS = ['manana', 'tarde', 'noche'] as const
export type FranjaPreferida = (typeof FRANJAS)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const CLAVES_CUERPO = new Set(['usuario_id', 'guion', 'dia_preferido', 'franja_preferida'])
const TEXTOS_GUION = ['apertura', 'cierre'] as const
const LISTAS_GUION = ['dolores', 'que_mostrar', 'avisos'] as const

export interface GuionValido {
  usuarioId: string
  guion: Record<string, unknown>
  version: number
  diaPreferido: string | null
  franjaPreferida: FranjaPreferida | null
}

export type Validacion = { ok: true; valor: GuionValido } | { ok: false; error: string }

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

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

function esListaDeTextos(v: unknown): boolean {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function esListaDeObjeciones(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every((o) => esObjeto(o) && typeof o.objecion === 'string' && typeof o.respuesta === 'string')
  )
}

/** La alerta de salud puede venir como texto, como sí/no o como objeto con su motivo. */
function esAlertaValida(v: unknown): boolean {
  return v === null || typeof v === 'string' || typeof v === 'boolean' || esObjeto(v)
}

/** Primer campo conocido del guion con forma equivocada, o `null` si todos están bien. */
function campoMalFormado(guion: Record<string, unknown>): string | null {
  for (const k of TEXTOS_GUION) if (k in guion && guion[k] !== null && typeof guion[k] !== 'string') return k
  for (const k of LISTAS_GUION) if (k in guion && guion[k] !== null && !esListaDeTextos(guion[k])) return k
  if ('persona' in guion && guion.persona !== null && !esObjeto(guion.persona)) return 'persona'
  if ('alerta_salud' in guion && !esAlertaValida(guion.alerta_salud)) return 'alerta_salud'
  if ('objeciones_probables' in guion && guion.objeciones_probables !== null && !esListaDeObjeciones(guion.objeciones_probables)) {
    return 'objeciones_probables'
  }
  return null
}

function validarPreferencia(cuerpo: Record<string, unknown>): { error: string } | { dia: string | null; franja: FranjaPreferida | null } {
  const dia = cuerpo.dia_preferido ?? null
  if (dia !== null && (typeof dia !== 'string' || !esFechaReal(dia))) return { error: 'dia_preferido invalido' }
  const franja = cuerpo.franja_preferida ?? null
  if (franja !== null && !(FRANJAS as readonly unknown[]).includes(franja)) return { error: 'franja_preferida invalida' }
  return { dia, franja: franja as FranjaPreferida | null }
}

/**
 * Del texto crudo de la petición a lo que se inserta. Recibe el TEXTO, no el JSON ya parseado,
 * para medir el tamaño real antes de gastar en parsearlo.
 */
export function validarCuerpo(texto: string): Validacion {
  if (bytesDe(texto) > TOPE_BYTES) return { ok: false, error: 'cuerpo demasiado grande' }
  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    return { ok: false, error: 'json invalido' }
  }
  if (!esObjeto(cuerpo)) return { ok: false, error: 'cuerpo invalido' }
  const sobrante = Object.keys(cuerpo).find((k) => !CLAVES_CUERPO.has(k))
  // El nombre de la clave solo se repite si parece un nombre de campo: nunca un texto libre.
  if (sobrante) return { ok: false, error: /^[a-z_]{1,40}$/.test(sobrante) ? `campo no esperado: ${sobrante}` : 'campo no esperado' }
  if (typeof cuerpo.usuario_id !== 'string' || !UUID.test(cuerpo.usuario_id)) return { ok: false, error: 'usuario_id invalido' }
  if (!esObjeto(cuerpo.guion)) return { ok: false, error: 'guion invalido' }
  const version = cuerpo.guion.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > VERSION_MAXIMA) {
    return { ok: false, error: 'version invalida' }
  }
  const malo = campoMalFormado(cuerpo.guion)
  if (malo) return { ok: false, error: `campo mal formado: ${malo}` }
  const preferencia = validarPreferencia(cuerpo)
  if ('error' in preferencia) return { ok: false, error: preferencia.error }
  return {
    ok: true,
    valor: {
      usuarioId: cuerpo.usuario_id.toLowerCase(),
      guion: cuerpo.guion,
      version,
      diaPreferido: preferencia.dia,
      franjaPreferida: preferencia.franja,
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
