// Edge Function: salud-atajo
//
// Recibe el RESUMEN DIARIO de Salud que manda el Atajo de Apple del iPhone (Fase A de
// `vigia-codex/estilo-de-vida/COSTOS-APP-NATIVA-Y-SALUD.md`). La copia de referencia y con
// control de versiones es este archivo del repo; se pega tal cual en el panel de Supabase
// (Edge Functions -> Via Editor) igual que `responder-chat`. Es UN SOLO ARCHIVO, sin
// imports relativos, a propósito.
//
// DESPLIEGUE (lo hace Bryan, no está desplegada):
//   · Nombre `salud-atajo`, con «Verify JWT» APAGADO (`--no-verify-jwt`). El Atajo no tiene
//     sesión de Supabase: se identifica con su propio código, así que la puerta de entrada
//     ES la validación del código de esta función. Con el JWT apagado, cualquiera puede
//     llamarla (Supabase lo avisa); por eso el código se comprueba SIEMPRE antes de leer el
//     cuerpo y no hay ningún camino que lo salte.
//   · Necesita la migración 0093 aplicada. Usa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY,
//     que Supabase inyecta solo en las Edge Functions; no hay que crear ningún secreto.
//   · Después de pegarla, comparar con lo vivo (`get_edge_function`): el despliegue por el
//     MCP se come los escapes. Este archivo no usa ninguno a propósito (ni escapes Unicode
//     ni clases con barra invertida): las expresiones regulares usan clases como [0-9] y [.].
//
// CONTRATO.
//   POST  <url>/functions/v1/salud-atajo
//   cabecera   x-alpha-token: sa_<40 hexadecimales>     (el código de la persona; JAMÁS en la URL)
//   cuerpo     {"muestras":[{"fecha":"2026-09-28","tipo":"pasos","valor":8123}, ...]}
//   tipos      pasos | sueno | fc_reposo | vfc | minutos_ejercicio | peso
//   respuesta  200 {"ok":true,"guardadas":5,"descartadas":0}
//              401 token_invalido · 403 sin_consentimiento · 405 · 413 · 429 limite · 400/422
//
// GARANTÍAS.
//   1. El código llega como cabecera, se pasa a sha-256 AQUÍ y solo el hash viaja a la base.
//   2. Sin la casilla E vigente no se guarda nada (lo comprueba la base, en el mismo viaje).
//   3. Solo resúmenes diarios de los 6 tipos, con unidad y rango plausible. Ninguna otra
//      clave del cuerpo se guarda: no hay dónde meter texto libre.
//   4. Idempotente: reenviar el mismo día ACTUALIZA (upsert por persona+día+tipo+fuente).
//   5. Tope de tamaño (16 KB), de muestras por envío (120) y de frecuencia (20 envíos por
//      hora y código, contados en la base).
//   6. NUNCA se escriben en los registros los valores, el código, su hash ni el error de la
//      base (que puede repetir la fila que falló): solo estados y conteos.

// ---------------------------------------------------------------- constantes

export type TipoSalud = 'pasos' | 'sueno' | 'fc_reposo' | 'vfc' | 'minutos_ejercicio' | 'peso'

interface DefinicionTipo {
  unidad: string
  minimo: number
  maximo: number
  /** Decimales que se guardan. Con 0, un punto o una coma entre grupos de tres es de miles. */
  decimales: number
}

/**
 * Unidad y rango plausible de cada tipo. Son los MISMOS números que la CHECK de
 * `salud_muestras` (migración 0093); hay una prueba que los compara. Si la tabla fuera más
 * estrecha que esto, la función aceptaría algo que la base rechaza y el envío daría 500.
 */
export const RANGOS: Record<TipoSalud, DefinicionTipo> = {
  pasos: { unidad: 'pasos', minimo: 0, maximo: 100000, decimales: 0 },
  sueno: { unidad: 'h', minimo: 0, maximo: 20, decimales: 2 },
  fc_reposo: { unidad: 'lpm', minimo: 25, maximo: 140, decimales: 0 },
  vfc: { unidad: 'ms', minimo: 5, maximo: 300, decimales: 1 },
  minutos_ejercicio: { unidad: 'min', minimo: 0, maximo: 600, decimales: 0 },
  peso: { unidad: 'kg', minimo: 25, maximo: 300, decimales: 1 },
}

const TIPOS = Object.keys(RANGOS) as TipoSalud[]

export const MAX_BYTES = 16 * 1024
export const MAX_MUESTRAS = 120
/** El Atajo reenvía los últimos días para cubrir los que se perdieron; más viejo que esto no. */
export const MAX_DIAS_ATRAS = 14
/** Solo informativo: el límite real vive en `salud_atajo_autorizar` (20 por hora y código). */
export const LIMITE_POR_HORA = 20
/** La VFC del iPhone es SDNN. Ojo: no se toma del cuerpo, lo pone la función. */
export const METODO_VFC_ATAJO = 'sdnn'

// ---------------------------------------------------------------- lectura de valores

/**
 * Un número de un Atajo, que puede llegar como número o como texto con la coma o el punto
 * de la región (`7,5`, `8.123`, `1.234,5`). Devuelve `null` si no es un número plausible.
 *
 * El decimal sale del propio tipo: los que se guardan sin decimales (pasos, FC, minutos)
 * leen `8.123` y `8,123` como 8123 (separador de miles); los demás leen la coma como
 * decimal. Un negativo, un exponente o un texto con letras NO pasa.
 */
export function leerNumero(valor: unknown, decimales: number): number | null {
  let numero: number | null = null
  if (typeof valor === 'number') {
    numero = Number.isFinite(valor) ? valor : null
  } else if (typeof valor === 'string' && valor.length <= 24) {
    const s = Array.from(valor)
      .filter((c) => c.trim() !== '')
      .join('')
    const soloDigitos = /^[0-9]+$/
    const conPunto = /^[0-9]+[.][0-9]+$/
    const conComa = /^[0-9]+,[0-9]+$/
    const milesPunto = /^[0-9]{1,3}([.][0-9]{3})+$/
    const milesComa = /^[0-9]{1,3}(,[0-9]{3})+$/
    if (soloDigitos.test(s)) numero = Number(s)
    else if (decimales === 0 && (milesPunto.test(s) || milesComa.test(s))) numero = Number(s.split('.').join('').split(',').join(''))
    else if (conPunto.test(s)) numero = Number(s)
    else if (conComa.test(s)) numero = Number(s.replace(',', '.'))
  }
  if (numero === null || !Number.isFinite(numero) || numero < 0) return null
  const f = 10 ** decimales
  return Math.round(numero * f) / f
}

/** `AAAA-MM-DD`, o una fecha ISO (`2026-09-28T07:00:00-05:00`) de la que se toma el día del teléfono. */
export function leerFecha(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  const dia = t.length === 10 ? t : t.length > 10 && (t[10] === 'T' || t[10] === ' ') ? t.slice(0, 10) : ''
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dia)) return null
  const [a, m, d] = dia.split('-').map(Number)
  const control = new Date(Date.UTC(a, m - 1, d))
  const coincide = control.getUTCFullYear() === a && control.getUTCMonth() === m - 1 && control.getUTCDate() === d
  return coincide ? dia : null
}

function numeroDeDia(dia: string): number {
  const [a, m, d] = dia.split('-').map(Number)
  return Date.UTC(a, m - 1, d) / 86400000
}

// ---------------------------------------------------------------- validación

export interface FilaMuestra {
  fecha: string
  tipo: TipoSalud
  valor: number
  unidad: string
  metodo: string | null
}

export type Motivo =
  | 'no_es_objeto'
  | 'fecha_invalida'
  | 'fecha_futura'
  | 'fecha_antigua'
  | 'tipo_desconocido'
  | 'unidad_invalida'
  | 'valor_invalido'
  | 'fuera_de_rango'

export interface Descartada {
  indice: number
  motivo: Motivo
}

/**
 * Valida las muestras y las deja en la forma que guarda la base. Lo que no sirve se
 * DESCARTA con su motivo (sin el valor) y las buenas siguen: un dato fuera de rango no
 * debe costarle a la persona el resto del envío. Si el mismo (día, tipo) viene repetido, gana
 * el último. Solo se leen las claves `fecha`, `tipo`, `valor` y `unidad`: cualquier otra
 * (un comentario, un `metodo` inventado) se ignora y no se guarda.
 *
 * El sueño puede venir en horas (`h`) o en minutos (`min`); se guarda siempre en horas.
 */
export function validarMuestras(
  entrada: unknown[],
  ahora: Date,
): { filas: FilaMuestra[]; descartadas: Descartada[] } {
  const hoy = numeroDeDia(ahora.toISOString().slice(0, 10))
  const porClave = new Map<string, FilaMuestra>()
  const descartadas: Descartada[] = []

  entrada.forEach((item, indice) => {
    const descartar = (motivo: Motivo) => descartadas.push({ indice, motivo })
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return descartar('no_es_objeto')
    const m = item as Record<string, unknown>

    const fecha = leerFecha(m.fecha)
    if (!fecha) return descartar('fecha_invalida')
    // Un día de margen por delante: un teléfono al este de UTC ya está en «mañana».
    if (numeroDeDia(fecha) > hoy + 1) return descartar('fecha_futura')
    if (numeroDeDia(fecha) < hoy - MAX_DIAS_ATRAS) return descartar('fecha_antigua')

    const tipo = typeof m.tipo === 'string' ? m.tipo.trim().toLowerCase() : ''
    if (!TIPOS.includes(tipo as TipoSalud)) return descartar('tipo_desconocido')
    const def = RANGOS[tipo as TipoSalud]

    const unidadPedida = typeof m.unidad === 'string' ? m.unidad.trim().toLowerCase() : def.unidad
    const enMinutos = tipo === 'sueno' && unidadPedida === 'min'
    if (unidadPedida !== def.unidad && !enMinutos) return descartar('unidad_invalida')

    // En minutos el sueño es un entero: se lee así y luego se pasa a horas.
    const leido = leerNumero(m.valor, enMinutos ? 0 : def.decimales)
    if (leido === null) return descartar('valor_invalido')
    const f = 10 ** def.decimales
    const valor = enMinutos ? Math.round((leido / 60) * f) / f : leido
    if (valor < def.minimo || valor > def.maximo) return descartar('fuera_de_rango')

    // Se borra y se vuelve a poner para que el último quede al final, y solo uno por clave.
    const clave = `${fecha}|${tipo}`
    porClave.delete(clave)
    porClave.set(clave, {
      fecha,
      tipo: tipo as TipoSalud,
      valor,
      unidad: def.unidad,
      metodo: tipo === 'vfc' ? METODO_VFC_ATAJO : null,
    })
  })

  return { filas: Array.from(porClave.values()), descartadas }
}

// ---------------------------------------------------------------- el código (token)

/** El código de la persona: `sa_` y 40 hexadecimales. Se acepta en mayúsculas y con espacios. */
export function leerToken(cabecera: string | null): string | null {
  if (!cabecera) return null
  const t = cabecera.trim().toLowerCase()
  return /^sa_[0-9a-f]{40}$/.test(t) ? t : null
}

/** sha-256 en hexadecimal del texto UTF-8. Es el mismo cálculo que `salud_atajo_generar_token`. */
export async function hashDeToken(token: string): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------- la base

export type ResultadoAutorizar =
  | { estado: 'ok'; usuarioId: string }
  | { estado: 'token_invalido' | 'limite' | 'sin_consentimiento' }

/** Lo único que la función necesita de la base. Se sustituye por un doble en las pruebas. */
export interface Almacen {
  autorizar(hash: string): Promise<ResultadoAutorizar>
  guardar(usuarioId: string, filas: FilaMuestra[]): Promise<number>
}

/**
 * Fallo de la base. Lleva el estado HTTP y el código de Postgres, NADA MÁS: el mensaje de
 * PostgREST puede repetir la fila que violó una restricción, es decir, los valores de salud.
 */
export class ErrorDeAlmacen extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
  ) {
    super(`almacen ${estado} ${codigo}`)
  }
}

/** Almacén real: las dos funciones SQL de la migración 0093, por PostgREST y con service_role. */
export function almacenSupabase(
  url: string,
  claveDeServicio: string,
  peticion: typeof fetch = fetch,
): Almacen {
  const rpc = async (nombre: string, cuerpo: Record<string, unknown>): Promise<unknown> => {
    const r = await peticion(`${url}/rest/v1/rpc/${nombre}`, {
      method: 'POST',
      headers: {
        apikey: claveDeServicio,
        authorization: `Bearer ${claveDeServicio}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) {
      let codigo = ''
      try {
        const e = await r.json()
        if (e && typeof e.code === 'string') codigo = e.code.slice(0, 12)
      } catch {
        // Sin cuerpo legible: se queda solo con el estado.
      }
      throw new ErrorDeAlmacen(r.status, codigo)
    }
    return r.json()
  }

  return {
    async autorizar(hash) {
      const r = (await rpc('salud_atajo_autorizar', { p_hash: hash })) as { estado?: string; usuario_id?: string }
      if (r?.estado === 'ok' && typeof r.usuario_id === 'string') return { estado: 'ok', usuarioId: r.usuario_id }
      if (r?.estado === 'token_invalido' || r?.estado === 'limite' || r?.estado === 'sin_consentimiento') {
        return { estado: r.estado }
      }
      throw new ErrorDeAlmacen(502, 'estado')
    },
    async guardar(usuarioId, filas) {
      const n = await rpc('salud_atajo_guardar', { p_usuario: usuarioId, p_muestras: filas })
      return typeof n === 'number' ? n : filas.length
    },
  }
}

// ---------------------------------------------------------------- manejador

export interface Dependencias {
  almacen: Almacen
  ahora?: () => Date
}

const MENSAJES = {
  metodo: 'Este punto solo recibe POST.',
  token_invalido: 'El código no es válido o ya no está activo. Genera uno nuevo en la app de Alpha.',
  sin_consentimiento: 'Falta tu permiso: activa la casilla de salud del celular en la app de Alpha.',
  limite: 'Demasiados envíos seguidos. Vuelve a intentarlo en una hora.',
  demasiado_grande: 'El envío es demasiado grande.',
  cuerpo_invalido: 'El cuerpo debe ser JSON con una lista «muestras».',
  sin_muestras: 'No venía ninguna muestra.',
  todas_descartadas: 'Ninguna muestra es válida: revisa el tipo, la fecha y el valor.',
  servidor: 'No se pudo guardar. Vuelve a intentarlo más tarde.',
} as const

/**
 * Lo único que se escribe en los registros: un estado y conteos. Ni valores, ni el código,
 * ni su hash, ni el error de la base.
 */
function registrar(datos: { estado: number; motivo?: string; guardadas?: number; descartadas?: number }): void {
  console.log(JSON.stringify({ funcion: 'salud-atajo', ...datos }))
}

function responder(estado: number, cuerpo: Record<string, unknown>, cabeceras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cabeceras },
  })
}

function rechazar(estado: number, error: keyof typeof MENSAJES, cabeceras: Record<string, string> = {}): Response {
  registrar({ estado, motivo: error })
  return responder(estado, { ok: false, error, mensaje: MENSAJES[error] }, cabeceras)
}

/** Lee el cuerpo sin pasar de `max` bytes, aunque no venga `content-length`. `null` si se pasa. */
async function leerCuerpo(req: Request, max: number): Promise<string | null> {
  if (!req.body) return ''
  const lector = req.body.getReader()
  const trozos: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await lector.cancel().catch(() => {})
      return null
    }
    trozos.push(value)
  }
  const todo = new Uint8Array(total)
  let desde = 0
  for (const t of trozos) {
    todo.set(t, desde)
    desde += t.byteLength
  }
  return new TextDecoder().decode(todo)
}

export async function manejar(req: Request, deps: Dependencias): Promise<Response> {
  if (req.method !== 'POST') return rechazar(405, 'metodo', { allow: 'POST' })

  // 1. La puerta: el código, ANTES de leer el cuerpo.
  const token = leerToken(req.headers.get('x-alpha-token'))
  if (!token) return rechazar(401, 'token_invalido')

  const declarado = Number(req.headers.get('content-length'))
  if (Number.isFinite(declarado) && declarado > MAX_BYTES) return rechazar(413, 'demasiado_grande')

  let autorizacion: ResultadoAutorizar
  try {
    autorizacion = await deps.almacen.autorizar(await hashDeToken(token))
  } catch (e) {
    registrar({ estado: 500, motivo: e instanceof ErrorDeAlmacen ? `almacen_${e.estado}_${e.codigo}` : 'almacen' })
    return responder(500, { ok: false, error: 'servidor', mensaje: MENSAJES.servidor })
  }
  if (autorizacion.estado !== 'ok') {
    if (autorizacion.estado === 'sin_consentimiento') return rechazar(403, 'sin_consentimiento')
    if (autorizacion.estado === 'limite') return rechazar(429, 'limite', { 'retry-after': '3600' })
    return rechazar(401, 'token_invalido')
  }

  // 2. El cuerpo.
  const texto = await leerCuerpo(req, MAX_BYTES)
  if (texto === null) return rechazar(413, 'demasiado_grande')
  let cuerpo: unknown
  try {
    cuerpo = JSON.parse(texto)
  } catch {
    return rechazar(400, 'cuerpo_invalido')
  }
  const muestras = cuerpo && typeof cuerpo === 'object' ? (cuerpo as { muestras?: unknown }).muestras : undefined
  if (!Array.isArray(muestras)) return rechazar(400, 'cuerpo_invalido')
  if (muestras.length === 0) return rechazar(400, 'sin_muestras')
  if (muestras.length > MAX_MUESTRAS) return rechazar(413, 'demasiado_grande')

  // 3. Validar y guardar.
  const { filas, descartadas } = validarMuestras(muestras, (deps.ahora ?? (() => new Date()))())
  if (filas.length === 0) {
    registrar({ estado: 422, motivo: 'todas_descartadas', guardadas: 0, descartadas: descartadas.length })
    return responder(422, {
      ok: false,
      error: 'todas_descartadas',
      mensaje: MENSAJES.todas_descartadas,
      descartadas: descartadas.slice(0, 10),
    })
  }

  let guardadas: number
  try {
    guardadas = await deps.almacen.guardar(autorizacion.usuarioId, filas)
  } catch (e) {
    registrar({ estado: 500, motivo: e instanceof ErrorDeAlmacen ? `almacen_${e.estado}_${e.codigo}` : 'almacen' })
    return responder(500, { ok: false, error: 'servidor', mensaje: MENSAJES.servidor })
  }

  registrar({ estado: 200, guardadas, descartadas: descartadas.length })
  return responder(200, {
    ok: true,
    guardadas,
    descartadas: descartadas.length,
    ...(descartadas.length > 0 ? { detalle: descartadas.slice(0, 10) } : {}),
  })
}

// ---------------------------------------------------------------- arranque

// Solo arranca el servidor dentro de Deno. Así los tests pueden importar este archivo sin
// levantar nada.
declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void } | undefined

function env(clave: string): string | undefined {
  return typeof Deno !== 'undefined' ? Deno.env.get(clave) : undefined
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve((req) => {
    const url = env('SUPABASE_URL')
    const clave = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !clave) {
      registrar({ estado: 500, motivo: 'falta_configuracion' })
      return Promise.resolve(responder(500, { ok: false, error: 'servidor', mensaje: MENSAJES.servidor }))
    }
    return manejar(req, { almacen: almacenSupabase(url, clave) })
  })
}
