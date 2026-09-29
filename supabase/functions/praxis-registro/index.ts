// Edge Function: praxis-registro
//
// El registro en lenguaje natural de Praxis (DISENO-REGISTRO-NATURAL.md, 28-sep-2026).
// Dos rutas:
//
//   POST /praxis-registro            -> PROPONER. Arma el contexto, llama a Haiku con
//                                       salida estructurada, aplica los resolutores y
//                                       devuelve la propuesta + la tarjeta. NO GUARDA.
//   POST /praxis-registro/guardar    -> GUARDAR. Escribe SOLO lo que la persona
//                                       confirmó, en las tablas reales, comprobando
//                                       otra vez cada número.
//
// SEGURIDAD
//  - La clave de la API de Anthropic se lee del secreto ANTHROPIC_API_KEY de
//    Supabase (`supabase secrets set ANTHROPIC_API_KEY=...`). Este archivo no la
//    contiene ni la crea.
//  - El usuario sale del token de sesión (se valida contra Supabase Auth), nunca
//    del cuerpo. Los datos se leen y se escriben con el JWT de la PERSONA (RLS),
//    nunca con service_role: la función no puede tocar lo de otro asesorado.
//  - El filtro clínico corre antes del modelo: un mensaje con dolor, lesión,
//    síntoma, medicamento o riesgo NO llega a Haiku.
//  - GUARDAR solo escribe `series[]` y `testPost` por las mismas RPC que usa la app
//    (`fijar_series_ejercicio`, `fijar_test_post`). Check-in, agua y comida quedan
//    pendientes de sus prerrequisitos (P2, P5, P6) y se dicen en la respuesta.
//
// NO SE DESPLIEGA SOLA: la publica Bryan. Se importa código de src/domain/praxis/registro
// con rutas relativas y extensión .ts (lo resuelve `supabase functions deploy`).

import {
  MODELO_HAIKU, PROMPT_SISTEMA, ESQUEMA_REGISTRO, VERSION_ESQUEMA, VERSION_PROMPT, VERSION_RESOLUTORES,
  armarContexto, armarMensajeUsuario, construirTarjeta, derivarPorFiltro, filtrarClinico, prepararSeries,
  prepararTestPost, prerrequisitoPendiente, resolverPropuesta, validarExtraccion,
} from '../../../src/domain/praxis/registro/index.ts'
import type {
  ContextoRegistro, MicrocicloJson, RegistroPropuesto, RegistroSeries, RegistroSesionCampo,
} from '../../../src/domain/praxis/registro/index.ts'

declare const Deno:
  | { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void }
  | undefined

export interface Entorno {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  ANTHROPIC_API_KEY: string | undefined
}

export interface Dependencias {
  entorno: Entorno
  fetch: typeof fetch
  ahora: () => Date
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', ...CORS } })

const MSG_NO_ENTENDI = 'No te entendí bien, ¿lo anotas aquí?'
const TIMEOUT_MODELO_MS = 8000
const MAX_FRASE = 600
const MAX_POR_HORA = 30

// Tope por persona y hora. En memoria: se reinicia con la instancia, así que es
// una red contra el abuso y no una cuota exacta (la cuota exacta vive en
// `praxis_extracciones`, que llega con su migración).
const visto = new Map<string, number[]>()
function excedeLimite(usuario: string, ahoraMs: number): boolean {
  const recientes = (visto.get(usuario) ?? []).filter((t) => ahoraMs - t < 3_600_000)
  if (recientes.length >= MAX_POR_HORA) {
    visto.set(usuario, recientes)
    return true
  }
  recientes.push(ahoraMs)
  visto.set(usuario, recientes)
  return false
}

export function tokenDeCabecera(cabecera: string | null): string | null {
  const m = cabecera?.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

/** `2026-09-28T18:40:00-05:00` en hora de Bogotá, si el teléfono no mandó la suya. */
export function horaBogota(ahora: Date): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 19) + '-05:00'
}

const esHoraIso = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)

interface FilaMicrociclo {
  id: string
  numero: number
  estado: string
  datos: { cadenciaDias?: number; fechaInicio?: string; sesiones?: MicrocicloJson['sesiones'] }
}

const aMicrociclo = (f: FilaMicrociclo): MicrocicloJson => ({
  id: f.id,
  numero: f.numero,
  cadenciaDias: f.datos?.cadenciaDias,
  fechaInicio: f.datos?.fechaInicio,
  sesiones: f.datos?.sesiones ?? [],
})

interface Sesion {
  usuarioId: string
  token: string
}

/** GET a PostgREST con el JWT de la persona (RLS). */
async function leer<T>(d: Dependencias, s: Sesion, ruta: string): Promise<T | null> {
  const r = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${s.token}` },
  })
  return r.ok ? ((await r.json()) as T) : null
}

async function rpc(d: Dependencias, s: Sesion, nombre: string, args: Record<string, unknown>): Promise<boolean> {
  const r = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: { apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${s.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  return r.ok
}

async function microciclosDe(d: Dependencias, s: Sesion): Promise<{ activo: MicrocicloJson | null; anterior: MicrocicloJson | null }> {
  const filas = await leer<FilaMicrociclo[]>(
    d, s,
    `microciclos?usuario_id=eq.${s.usuarioId}&estado=in.(activo,cerrado)&select=id,numero,estado,datos&order=numero.desc&limit=4`,
  )
  const lista = filas ?? []
  const activo = lista.find((f) => f.estado === 'activo') ?? null
  const anterior = activo ? (lista.find((f) => f.estado === 'cerrado' && f.numero < activo.numero) ?? null) : null
  return { activo: activo ? aMicrociclo(activo) : null, anterior: anterior ? aMicrociclo(anterior) : null }
}

/** Un solo llamado a Haiku con la herramienta `registrar` forzada y esquema estricto. */
export async function llamarHaiku(
  d: Dependencias,
  ctx: ContextoRegistro,
  frase: string,
): Promise<{ entrada: unknown; tokensEntrada: number; tokensSalida: number } | null> {
  const clave = d.entorno.ANTHROPIC_API_KEY
  if (!clave) return null
  const r = await d.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MODELO_MS),
    body: JSON.stringify({
      model: MODELO_HAIKU,
      max_tokens: 1500,
      temperature: 0,
      // El prefijo fijo (sistema + herramienta) va cacheado: es lo que se repite.
      system: [{ type: 'text', text: PROMPT_SISTEMA, cache_control: { type: 'ephemeral' } }],
      tools: [
        {
          name: 'registrar',
          description: 'Etiqueta lo que la persona dijo. No calcules ni completes números: copia fragmentos literales.',
          strict: true,
          input_schema: ESQUEMA_REGISTRO,
        },
      ],
      tool_choice: { type: 'tool', name: 'registrar' },
      messages: [{ role: 'user', content: armarMensajeUsuario(ctx, frase) }],
    }),
  })
  if (!r.ok) return null
  const cuerpo = (await r.json()) as {
    content?: { type: string; input?: unknown }[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const bloque = cuerpo.content?.find((b) => b.type === 'tool_use')
  if (!bloque) return null
  return { entrada: bloque.input, tokensEntrada: cuerpo.usage?.input_tokens ?? 0, tokensSalida: cuerpo.usage?.output_tokens ?? 0 }
}

interface CuerpoProponer {
  frase?: unknown
  mensaje_id?: unknown
  canal?: unknown
  hora_local?: unknown
  pantalla_ejercicio_id?: unknown
  ultimo_tocado?: { ejercicio_id?: unknown; minutos_atras?: unknown } | null
  peso_barra_kg?: unknown
  checkin_hoy?: Record<string, unknown>
  hidratacion_hoy_ml?: unknown
  cronometro_min?: unknown
}

async function proponer(d: Dependencias, s: Sesion, cuerpo: CuerpoProponer): Promise<Response> {
  const frase = typeof cuerpo.frase === 'string' ? cuerpo.frase.trim() : ''
  if (!frase) return json({ error: 'Falta la frase' }, 400)
  if (frase.length > MAX_FRASE) return json({ error: 'La frase es muy larga' }, 400)
  const mensajeId = typeof cuerpo.mensaje_id === 'string' && cuerpo.mensaje_id ? cuerpo.mensaje_id : `m-${d.ahora().getTime()}`
  const t0 = d.ahora().getTime()

  // 1. Filtro clínico ANTES del modelo. Haiku no ve estas frases.
  const marca = filtrarClinico(frase)
  if (marca) {
    const propuesta = derivarPorFiltro(marca)
    return json({
      propuesta,
      tarjeta: construirTarjeta(propuesta, mensajeId),
      meta: { modelo: null, derivada: true, aviso_bryan: true, version_prompt: VERSION_PROMPT, version_resolutores: VERSION_RESOLUTORES },
    })
  }

  if (excedeLimite(s.usuarioId, t0)) return json({ error: 'Demasiados mensajes en la última hora' }, 429)

  // 2. Contexto implícito, leído con el JWT de la persona.
  const ahora = esHoraIso(cuerpo.hora_local) ? cuerpo.hora_local : horaBogota(d.ahora())
  const { activo, anterior } = await microciclosDe(d, s)
  const ut = cuerpo.ultimo_tocado
  const ctx = armarContexto({
    ahora,
    activo,
    anterior,
    pantallaEjercicioId: typeof cuerpo.pantalla_ejercicio_id === 'string' ? cuerpo.pantalla_ejercicio_id : null,
    ultimoTocado: ut && typeof ut.ejercicio_id === 'string' && typeof ut.minutos_atras === 'number'
      ? { ejercicioId: ut.ejercicio_id, minutosAtras: ut.minutos_atras }
      : null,
    pesoBarraKg: typeof cuerpo.peso_barra_kg === 'number' ? cuerpo.peso_barra_kg : null,
    checkinHoy: cuerpo.checkin_hoy,
    hidratacionHoyMl: typeof cuerpo.hidratacion_hoy_ml === 'number' ? cuerpo.hidratacion_hoy_ml : undefined,
    cronometroMin: typeof cuerpo.cronometro_min === 'number' ? cuerpo.cronometro_min : null,
  })

  // 3. Haiku: solo cita y etiqueta.
  const salida = await llamarHaiku(d, ctx, frase).catch(() => null)
  if (!salida) return json({ error: MSG_NO_ENTENDI, reintentable: true }, 502)

  // 4. Citas válidas + resolutores deterministas. Nada se guarda.
  const { extraccion, citasInvalidas } = validarExtraccion(frase, salida.entrada)
  const propuesta = resolverPropuesta(frase, extraccion, ctx, citasInvalidas)
  return json({
    propuesta,
    tarjeta: construirTarjeta(propuesta, mensajeId),
    meta: {
      modelo: MODELO_HAIKU,
      derivada: propuesta.accion === 'derivar',
      version_prompt: VERSION_PROMPT,
      version_esquema: VERSION_ESQUEMA,
      version_resolutores: VERSION_RESOLUTORES,
      tokens_entrada: salida.tokensEntrada,
      tokens_salida: salida.tokensSalida,
      latencia_ms: d.ahora().getTime() - t0,
    },
  })
}

interface CuerpoGuardar {
  mensaje_id?: unknown
  registros?: unknown
  confirma_sesion?: unknown
  confirma_extra?: unknown
  hora_local?: unknown
}

export interface ResultadoRegistro {
  indice: number
  campo: string
  estado: 'guardado' | 'rechazado' | 'pendiente_prerrequisito'
  motivo?: string
}

async function guardar(d: Dependencias, s: Sesion, cuerpo: CuerpoGuardar): Promise<Response> {
  if (!Array.isArray(cuerpo.registros) || cuerpo.registros.length === 0 || cuerpo.registros.length > 12) {
    return json({ error: 'Faltan los registros confirmados (1 a 12)' }, 400)
  }
  const ahora = esHoraIso(cuerpo.hora_local) ? cuerpo.hora_local : horaBogota(d.ahora())
  const { activo } = await microciclosDe(d, s)
  const ctx = armarContexto({ ahora, activo })
  const resultados: ResultadoRegistro[] = []

  for (const [indice, bruto] of (cuerpo.registros as RegistroPropuesto[]).entries()) {
    const campo = typeof bruto?.campo === 'string' ? bruto.campo : '?'
    const pendiente = bruto && typeof bruto === 'object' ? prerrequisitoPendiente(bruto) : null
    if (pendiente) {
      resultados.push({ indice, campo, estado: 'pendiente_prerrequisito', motivo: pendiente })
      continue
    }
    if (campo === 'series') {
      const reg = bruto as RegistroSeries
      const ej = activo?.sesiones.flatMap((x) => x.ejercicios ?? []).find((e) => e.id === reg.ejercicio_id)
      const w = prepararSeries(reg, ctx, (ej?.series as unknown as Record<string, unknown>[]) ?? [], {
        ahora,
        confirmaSesion: cuerpo.confirma_sesion === true,
        confirmaExtra: cuerpo.confirma_extra === true,
      })
      if (!w.ok || !activo) {
        resultados.push({ indice, campo, estado: 'rechazado', motivo: w.ok ? 'no hay microciclo activo' : w.motivo })
        continue
      }
      const ok = await rpc(d, s, 'fijar_series_ejercicio', {
        p_microciclo_id: activo.id,
        p_ejercicio_id: w.valor.ejercicioId,
        p_series: w.valor.series,
      })
      resultados.push({ indice, campo, estado: ok ? 'guardado' : 'rechazado', motivo: ok ? undefined : 'la base no aceptó la escritura' })
      continue
    }
    if (campo === 'testPost.rpeSesion' || campo === 'testPost.duracionMin') {
      const reg = bruto as RegistroSesionCampo
      const sesionCruda = activo?.sesiones.find((x) => x.id === reg.sesion_id) as (MicrocicloJson['sesiones'][0] & { testPost?: Record<string, unknown> }) | undefined
      const w = prepararTestPost(reg, ctx, sesionCruda?.testPost)
      if (!w.ok || !activo) {
        resultados.push({ indice, campo, estado: 'rechazado', motivo: w.ok ? 'no hay microciclo activo' : w.motivo })
        continue
      }
      const ok = await rpc(d, s, 'fijar_test_post', { p_microciclo_id: activo.id, p_sesion_id: w.valor.sesionId, p_test: w.valor.testPost })
      resultados.push({ indice, campo, estado: ok ? 'guardado' : 'rechazado', motivo: ok ? undefined : 'la base no aceptó la escritura' })
      continue
    }
    resultados.push({ indice, campo, estado: 'rechazado', motivo: 'campo no soportado' })
  }
  return json({ mensaje_id: typeof cuerpo.mensaje_id === 'string' ? cuerpo.mensaje_id : null, resultados })
}

export async function manejar(req: Request, d: Dependencias): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let cuerpo: CuerpoProponer & CuerpoGuardar & { accion?: unknown }
  try {
    cuerpo = await req.json()
  } catch {
    return json({ error: 'Cuerpo invalido' }, 400)
  }

  if (!d.entorno.SUPABASE_URL || !d.entorno.SUPABASE_ANON_KEY) {
    return json({ error: 'Falta SUPABASE_URL o SUPABASE_ANON_KEY en la funcion' }, 500)
  }
  const token = tokenDeCabecera(req.headers.get('Authorization'))
  if (!token) return json({ error: 'Falta la sesion' }, 401)

  // El usuario se decide con el token, validado contra Auth. Nunca del cuerpo.
  let usuarioId: string
  try {
    const r = await d.fetch(`${d.entorno.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
    })
    if (!r.ok) return json({ error: 'Sesion invalida' }, 401)
    const u = (await r.json()) as { id?: string }
    if (!u?.id) return json({ error: 'Sesion invalida' }, 401)
    usuarioId = u.id
  } catch {
    return json({ error: 'No se pudo validar la sesion' }, 401)
  }
  const sesion: Sesion = { usuarioId, token }

  const ruta = new URL(req.url).pathname.replace(/\/+$/, '')
  if (ruta.endsWith('/guardar') || cuerpo.accion === 'guardar') return guardar(d, sesion, cuerpo)
  return proponer(d, sesion, cuerpo)
}

function entorno(clave: string): string | undefined {
  return typeof Deno !== 'undefined' ? Deno.env.get(clave) : undefined
}

// Solo arranca el servidor dentro de Deno, para que los tests puedan importar el archivo.
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve((req) =>
    manejar(req, {
      entorno: {
        SUPABASE_URL: entorno('SUPABASE_URL') ?? '',
        SUPABASE_ANON_KEY: entorno('SUPABASE_ANON_KEY') ?? entorno('SUPABASE_PUBLISHABLE_KEY') ?? '',
        ANTHROPIC_API_KEY: entorno('ANTHROPIC_API_KEY'),
      },
      fetch: (...a) => fetch(...a),
      ahora: () => new Date(),
    }),
  )
}
