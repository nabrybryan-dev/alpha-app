// Edge Function: praxis-registro
//
// El registro en lenguaje natural de Praxis (DISENO-REGISTRO-NATURAL.md, 28-sep-2026).
// Tres rutas:
//
//   POST /praxis-registro            -> PROPONER. Arma el contexto, llama a Haiku con
//                                       salida estructurada, aplica los resolutores y
//                                       devuelve la propuesta + la tarjeta. NO GUARDA.
//   POST /praxis-registro/guardar    -> GUARDAR. Escribe SOLO lo que la persona
//                                       confirmó, en las tablas reales, comprobando
//                                       otra vez cada número.
//   POST /praxis-registro  {accion:'ingreso', turno, texto}
//                                    -> INGRESO (prueba interna, 3-oct-2026). Etiqueta UN turno
//                                       hablado del cuestionario de ingreso con Haiku, citando.
//                                       NO GUARDA NADA, no lee el plan y nunca devuelve un campo
//                                       de salud (ver `ingresar`).
//
// SEGURIDAD
//  - La clave de la API de Anthropic se lee del secreto ANTHROPIC_API_KEY de
//    Supabase (`supabase secrets set ANTHROPIC_API_KEY=...`). Este archivo no la
//    contiene ni la crea.
//  - El usuario sale del token de sesión (se valida contra Supabase Auth), nunca
//    del cuerpo. Los datos se leen y se escriben con el JWT de la PERSONA (RLS),
//    nunca con service_role: la función no puede tocar lo de otro asesorado.
//  - El filtro clínico corre antes del modelo: un mensaje con dolor, lesión,
//    síntoma, medicamento o riesgo NO llega a Haiku... salvo con el interruptor
//    PRAXIS_RIESGO_MAS_GRAVE=1 (apagado por defecto): entonces una marca de «cuidado»
//    o «salud» se le consulta TAMBIÉN al lector de riesgo con modelo y sale la más grave
//    (`marcaMasGrave`). Una Quieta del filtro nunca espera al modelo. Ver `masGrave.ts`.
//  - GUARDAR escribe `series[]` y `testPost` por las mismas RPC que usa la app
//    (`fijar_series_ejercicio`, `fijar_test_post`) y la adherencia por upsert (una fila
//    por usuario y fecha). Check-in, agua, comida, cardio y preparación quedan
//    pendientes de sus prerrequisitos (P2, P5, P6, P7) y se dicen en la respuesta.
//
// NO SE DESPLIEGA SOLA: la publica Bryan. Se importa código de src/domain/praxis/registro
// con rutas relativas y extensión .ts (lo resuelve `supabase functions deploy`).

import {
  MODELO_HAIKU, PROMPT_SISTEMA, ESQUEMA_REGISTRO, VERSION_ESQUEMA, VERSION_PROMPT, VERSION_RESOLUTORES,
  armarContexto, armarMensajeUsuario, construirTarjeta, prepararAdherencia, prepararSeries,
  prepararTestPost, prerrequisitoPendiente, resolverPropuesta, validarExtraccion, caminoRapido,
} from '../../../src/domain/praxis/registro/index.ts'
// El MISMO filtro de riesgo y el MISMO interruptor que la pantalla (revisión del PR #331).
import { derivarPorRiesgo, filtroDeRiesgo, type MarcaDeRiesgo } from '../../../src/domain/praxis/riesgo.ts'
// La otra mitad de «diccionario + modelo en cada mensaje» (decisión firmada del 29-sep).
import { PROMPT_RIESGO, SHA16_PROMPT_RIESGO, leerSalidaRiesgo, marcaDesdeModelo, type LecturaModelo } from '../../../src/domain/praxis/riesgoModelo.ts'
import { hayQueConsultarAlModelo, masGrave } from '../../../src/domain/praxis/masGrave.ts'
import { puedeVerPraxis, type Rol } from '../../../src/domain/praxis/acceso.ts'
// El aviso al coach: el tipo de señal y por dónde llegó, nunca la frase (migración 0108).
import { nivelDeMarca, type AvisoNuevo } from '../../../src/domain/praxis/aviso.ts'
import { bloqueDeSistema } from '../../../src/domain/praxis/prefijoCacheable.ts'
// La charla con modelo (3-oct): contexto saneado, validación de la respuesta y la versión de su bloque del prompt.
import { armarContextoCharla, cabeCharla, leerContextoCharla, leerRespuestaCharla } from '../../../src/domain/praxis/charla/modelo.ts'
import { VERSION_PROMPT_CHARLA } from '../../../src/domain/praxis/charla/promptCharla.ts'
// El cuestionario de ingreso por voz: el prompt y la validación con citas (puros) y su guion.
import { PROMPT_SISTEMA_INGRESO, VERSION_PROMPT_INGRESO, armarMensajeIngreso, leerSalidaIngreso, validarIngreso } from '../../../src/domain/praxis/ingreso/extraer.ts'
import { TURNOS_VOZ, type TurnoId } from '../../../src/domain/praxis/ingreso/guion.ts'
import type {
  ContextoRegistro, MicrocicloJson, RegistroAdherencia, RegistroPropuesto, RegistroSeries, RegistroSesionCampo,
} from '../../../src/domain/praxis/registro/index.ts'

declare const Deno:
  | { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void }
  | undefined

export interface Entorno {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  ANTHROPIC_API_KEY: string | undefined
  /** «0» apaga el camino rápido (el registrador sin modelo) sin tocar el código. */
  PRAXIS_CAMINO_RAPIDO?: string
  /** '1' enciende «gana la lectura más grave» sobre frases marcadas por el filtro. Apagado por defecto: ver `masGrave.ts`. */
  PRAXIS_RIESGO_MAS_GRAVE?: string
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

// Es un FALLO del servidor (el modelo no respondió o su respuesta no se pudo leer), no un «no entendí» a la persona.
// La pantalla ni lo muestra: por el 502 dice su propio texto.
const MSG_NO_ENTENDI = 'Se me enredó algo de mi lado. ¿Me lo repites?'
const TIMEOUT_MODELO_MS = 8000
const MAX_FRASE = 600
/** Mensajes por persona y hora. 30 → 60 (Bryan, 3-oct-2026): la charla ahora pasa por el modelo y gasta cupo. */
export const MAX_POR_HORA = 60
/** Una respuesta de CONTEXTO es larga a propósito (un minuto hablando son ~1.200 caracteres). */
const MAX_TEXTO_INGRESO = 1500
/** Un ingreso son 5 turnos: 40 por hora dan para ocho pruebas completas por persona. */
const MAX_INGRESO_POR_HORA = 40

// Tope por persona y hora. En memoria: se reinicia con la instancia, así que es
// una red contra el abuso y no una cuota exacta (la cuota exacta vive en
// `praxis_extracciones`, que llega con su migración). El ingreso lleva su propia cuenta:
// una prueba completa no se come el cupo del registro.
const visto = new Map<string, number[]>()
const vistoIngreso = new Map<string, number[]>()
function excedeLimite(usuario: string, ahoraMs: number, mapa: Map<string, number[]> = visto, maximo: number = MAX_POR_HORA): boolean {
  const recientes = (mapa.get(usuario) ?? []).filter((t) => ahoraMs - t < 3_600_000)
  if (recientes.length >= maximo) {
    mapa.set(usuario, recientes)
    return true
  }
  recientes.push(ahoraMs)
  mapa.set(usuario, recientes)
  return false
}

export function tokenDeCabecera(cabecera: string | null): string | null {
  const m = cabecera?.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * El `sub` del JWT, SIN comprobar la firma: eso ya lo hizo el gateway de Supabase (`verify_jwt`)
 * antes de entrar aquí. Solo sirve para ADELANTAR las lecturas del rol y del plan en paralelo
 * con la validación del token. No decide nada: la respuesta sigue dependiendo de que
 * `/auth/v1/user` diga que sí y devuelva este mismo id. `null` si el token no se puede leer o
 * el `sub` no es un uuid (entra en la URL de una consulta); entonces se espera a Auth.
 */
export function subDelJwt(token: string): string | null {
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const texto = new TextDecoder().decode(Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0)))
    const sub = (JSON.parse(texto) as { sub?: unknown } | null)?.sub
    return typeof sub === 'string' && UUID.test(sub) ? sub : null
  } catch {
    return null
  }
}

/** `2026-09-28T18:40:00-05:00` en hora de Bogotá, si el teléfono no mandó la suya. */
export function horaBogota(ahora: Date): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 19) + '-05:00'
}

/** La forma ENTERA de la hora: fecha, hora, segundos opcionales y zona. Nada detrás. */
const HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/

/**
 * La hora del teléfono, si se puede creer; si no, la del servidor en Bogotá. Se cree solo si
 * tiene la forma exacta, no pasa de 25 caracteres y cae a menos de un día de la del
 * servidor. Antes valía cualquier texto que EMPEZARA como una fecha: lo de detrás viajaba
 * al modelo como `hora_local` y se grababa como `hechoEn` (revisión del PR #331, M3).
 */
export function horaConfiable(h: unknown, ahora: Date): string {
  const servidor = horaBogota(ahora)
  if (typeof h !== 'string' || h.length > 25 || !HORA_ISO.test(h)) return servidor
  const t = Date.parse(h)
  if (!Number.isFinite(t) || Math.abs(t - ahora.getTime()) > 86_400_000) return servidor
  return h
}

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


/**
 * AVISA AL COACH (migración 0108, `praxis_avisos_coach`): una fila con quién, por dónde llegó y qué
 * TIPO de señal fue. Sin la frase ni la cita: `AvisoNuevo` no tiene dónde ponerlas, y el cuerpo que
 * viaja se arma aquí campo por campo. Se escribe con el JWT de la persona (la RLS deja insertar solo
 * el aviso propio); el `usuario_id` sale de la sesión validada, no del cuerpo de la petición.
 *
 * NUNCA cambia lo que se le responde a la persona ni lo bloquea: si el insert falla (la migración sin
 * aplicar, la red, un tiempo agotado) se anota «aviso no guardado» con el código HTTP y el código de
 * PostgREST, sin la frase, sin el nombre y sin el cuerpo del error (puede citar valores), y la
 * derivación sigue su curso. Nunca lanza.
 */
const TIMEOUT_AVISO_MS = 3000
export async function avisarAlCoach(d: Dependencias, s: Sesion, aviso: AvisoNuevo): Promise<void> {
  try {
    const r = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/praxis_avisos_coach`, {
      method: 'POST',
      headers: {
        apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${s.token}`,
        'content-type': 'application/json', prefer: 'return=minimal',
      },
      signal: AbortSignal.timeout(TIMEOUT_AVISO_MS),
      body: JSON.stringify({ usuario_id: s.usuarioId, origen: aviso.origen, nivel: aviso.nivel }),
    })
    if (r.ok) return
    let codigo = ''
    try {
      const c = ((await r.json()) as { code?: unknown } | null)?.code
      if (typeof c === 'string' && /^[A-Za-z0-9]{3,10}$/.test(c)) codigo = c
    } catch { /* sin cuerpo legible */ }
    console.error('praxis-registro: aviso no guardado', r.status, codigo)
  } catch (e) {
    console.error('praxis-registro: aviso no guardado', e instanceof Error ? e.name : 'error')
  }
}

type Plan = { activo: MicrocicloJson | null; anterior: MicrocicloJson | null }

async function microciclosDe(d: Dependencias, s: Sesion): Promise<Plan> {
  const filas = await leer<FilaMicrociclo[]>(
    d, s,
    `microciclos?usuario_id=eq.${s.usuarioId}&estado=in.(activo,cerrado)&select=id,numero,estado,datos&order=numero.desc&limit=4`,
  )
  const lista = filas ?? []
  const activo = lista.find((f) => f.estado === 'activo') ?? null
  const anterior = activo ? (lista.find((f) => f.estado === 'cerrado' && f.numero < activo.numero) ?? null) : null
  return { activo: activo ? aMicrociclo(activo) : null, anterior: anterior ? aMicrociclo(anterior) : null }
}

/**
 * Lo que respondió Anthropic cuando no fue un 200, para poder diagnosticarlo en el log de la
 * función: el código y el cuerpo del error. La frase de la persona se borra del cuerpo antes
 * de escribirlo (algunos errores la citan), y se corta a 600 caracteres.
 */
async function registrarErrorDeAnthropic(r: Response, frase: string): Promise<void> {
  let cuerpo = ''
  try { cuerpo = await r.text() } catch { /* sin cuerpo */ }
  for (const forma of [frase, JSON.stringify(frase).slice(1, -1)]) if (forma) cuerpo = cuerpo.split(forma).join('[frase]')
  console.error('praxis-registro: Anthropic respondió', r.status, cuerpo.slice(0, 600))
}

/**
 * Tope de la salida del registrador. Con la salida corta (prompt registro-prompt-2026-10-03.1: lo no
 * dicho se omite) el banco midió, en 657 llamadas (3 corridas de 219 casos): mediana 122 tokens, p95 208,
 * máximo 508 (antes: 373, 745 y 1.766). 800 deja ~58 % de margen sobre ese máximo. Es un techo, no
 * acelera la respuesta: el tiempo lo pone lo que el modelo escribe de verdad.
 */
export const MAX_TOKENS_REGISTRO = 800

const HERRAMIENTAS_REGISTRO = [
  {
    name: 'registrar',
    description: 'Etiqueta lo que la persona dijo. No calcules ni completes números: copia fragmentos literales.',
    input_schema: ESQUEMA_REGISTRO,
  },
]
const HERRAMIENTAS_REGISTRO_JSON = JSON.stringify(HERRAMIENTAS_REGISTRO)

/**
 * Un solo llamado a Haiku con la herramienta `registrar` forzada.
 *
 * SIN `strict`. El esquema tiene 46 parámetros con unión (`anyOf` con `null`), y el modo
 * estricto admite 16 en total («Parameters with union types: 16», documentación de
 * structured outputs): con `strict: true` la API respondía 400 «Schema is too complex for
 * compilation» a cada frase. Sin él, la salida no viene garantizada por gramática, pero
 * `validarExtraccion` revisa cada campo, exige que cada cita sea literal de la frase y que
 * cada enum esté en su lista, y lo que no cumple se descarta: falla cerrando. Nada de esto
 * se probó todavía contra la API de verdad (ver PASOS-DE-BRYAN.md, paso 3).
 */
export async function llamarHaiku(
  d: Dependencias,
  ctx: ContextoRegistro,
  frase: string,
  /** El pedazo de charla del mensaje de usuario (`armarContextoCharla`); sin él, el registrador de siempre. */
  charla?: string,
): Promise<{ entrada: unknown; tokensEntrada: number; tokensSalida: number } | null> {
  const clave = d.entorno.ANTHROPIC_API_KEY
  if (!clave) {
    console.error('praxis-registro: falta el secreto ANTHROPIC_API_KEY')
    return null
  }
  const r = await d.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MODELO_MS),
    body: JSON.stringify({
      model: MODELO_HAIKU,
      max_tokens: MAX_TOKENS_REGISTRO,
      temperature: 0,
      // El prefijo fijo (herramienta + sistema, en ese orden) va cacheado: es lo que se repite.
      // Mide ~8.800 tokens aproximados, sobre el mínimo de 4.096 de Haiku 4.5 (prefijoCacheable.ts).
      system: [bloqueDeSistema(PROMPT_SISTEMA, HERRAMIENTAS_REGISTRO_JSON)],
      tools: HERRAMIENTAS_REGISTRO,
      tool_choice: { type: 'tool', name: 'registrar' },
      messages: [{ role: 'user', content: armarMensajeUsuario(ctx, frase, charla) }],
    }),
  })
  if (!r.ok) {
    await registrarErrorDeAnthropic(r, frase)
    return null
  }
  const cuerpo = (await r.json()) as {
    content?: { type: string; input?: unknown }[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const bloque = cuerpo.content?.find((b) => b.type === 'tool_use')
  if (!bloque) return null
  return { entrada: bloque.input, tokensEntrada: cuerpo.usage?.input_tokens ?? 0, tokensSalida: cuerpo.usage?.output_tokens ?? 0 }
}

/**
 * El lector de riesgo con modelo: una llamada corta a Haiku, sin herramientas, con el prompt
 * medido contra el oro firmado (`riesgoModelo.ts`). Devuelve null si la llamada falla o la
 * respuesta no se puede leer; quien llama NO sigue sin cribado.
 */
export async function leerRiesgoConModelo(d: Dependencias, frase: string): Promise<LecturaModelo | null> {
  const clave = d.entorno.ANTHROPIC_API_KEY
  if (!clave) {
    console.error('praxis-registro: falta el secreto ANTHROPIC_API_KEY')
    return null
  }
  const r = await d.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MODELO_MS),
    body: JSON.stringify({
      model: MODELO_HAIKU,
      max_tokens: 200,
      temperature: 0,
      // Sin herramientas: el prefijo es solo este prompt (~1.600 tokens aproximados), por debajo
      // del mínimo cacheable de Haiku 4.5; `bloqueDeSistema` no le pone cache_control.
      system: [bloqueDeSistema(PROMPT_RIESGO)],
      messages: [{ role: 'user', content: frase }],
    }),
  })
  if (!r.ok) {
    await registrarErrorDeAnthropic(r, frase)
    return null
  }
  const cuerpo = (await r.json()) as { content?: { type: string; text?: string }[] }
  const texto = (cuerpo.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
  const lectura = leerSalidaRiesgo(texto)
  if (!lectura) console.error('praxis-registro: el lector de riesgo devolvió algo ilegible')
  return lectura
}

/**
 * «Gana la lectura más grave» (3-oct). El filtro ya marcó algo: si es Quieta no se hace nada (es el
 * máximo y la pantalla de emergencia no espera); si es cuidado o salud, y SOLO con el interruptor
 * `PRAXIS_RIESGO_MAS_GRAVE=1`, se consulta también al lector con modelo y sale la más grave de las dos.
 * El modelo solo SUBE la marca. Si no hay interruptor, se pasó del límite por hora, el modelo falla,
 * tarda más de `TIMEOUT_MODELO_MS` o devuelve algo ilegible: se queda la marca del filtro, tal cual.
 * Nunca lanza.
 */
export async function marcaMasGrave(
  d: Dependencias, usuarioId: string, frase: string, filtro: MarcaDeRiesgo,
): Promise<{ marca: MarcaDeRiesgo; origen: 'filtro' | 'modelo'; consultado: boolean; lector: string | null }> {
  const igual = { marca: filtro, origen: 'filtro' as const, consultado: false, lector: null }
  if (!hayQueConsultarAlModelo(filtro, d.entorno.PRAXIS_RIESGO_MAS_GRAVE === '1')) return igual
  if (excedeLimite(usuarioId, d.ahora().getTime())) return igual // sin cupo no se consulta; la marca del filtro ya es una respuesta
  let lectura: LecturaModelo | null = null
  try {
    lectura = await leerRiesgoConModelo(d, frase)
  } catch (e) {
    console.error('praxis-registro: el lector de riesgo falló sobre una frase marcada', e instanceof Error ? e.name : 'error')
  }
  if (!lectura) return { ...igual, consultado: true }
  const final = masGrave(filtro, marcaDesdeModelo(lectura.nivel))
  return { marca: final, origen: final === filtro ? 'filtro' : 'modelo', consultado: true, lector: lectura.nivel }
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
  ver_composicion?: unknown
  comidas_ayer?: unknown
  comida_pendiente?: unknown
  /** La charla (3-oct): trato, nombre, hasta 6 turnos de esta sesión y el saludo ya dicho. Nada de esto se guarda. */
  charla?: unknown
}

async function proponer(d: Dependencias, s: Sesion, cuerpo: CuerpoProponer, plan: Promise<Plan>): Promise<Response> {
  const frase = typeof cuerpo.frase === 'string' ? cuerpo.frase.trim() : ''
  if (!frase) return json({ error: 'Falta la frase' }, 400)
  if (frase.length > MAX_FRASE) return json({ error: 'La frase es muy larga' }, 400)
  const mensajeId = typeof cuerpo.mensaje_id === 'string' && cuerpo.mensaje_id ? cuerpo.mensaje_id : `m-${d.ahora().getTime()}`
  const t0 = d.ahora().getTime()

  // 1. Filtro de riesgo ANTES del modelo: el MISMO que corre en la pantalla (riesgo, pareja,
  //    niños, frases ambiguas, salud). Haiku no ve estas frases.
  const marcaDelFiltro = filtroDeRiesgo(frase)
  if (marcaDelFiltro) {
    // Gana la más grave: con el interruptor encendido, una marca de cuidado o salud se consulta también al modelo.
    const leida = await marcaMasGrave(d, s.usuarioId, frase, marcaDelFiltro)
    const marca = leida.marca
    const propuesta = derivarPorRiesgo(marca)
    await avisarAlCoach(d, s, { origen: 'praxis', nivel: nivelDeMarca(marca) })
    return json({
      propuesta,
      tarjeta: construirTarjeta(propuesta, mensajeId),
      meta: {
        modelo: leida.consultado ? MODELO_HAIKU : null, derivada: true, aviso_bryan: true, version_prompt: VERSION_PROMPT, version_resolutores: VERSION_RESOLUTORES,
        ...(leida.origen === 'modelo' ? { lector_riesgo: leida.lector, version_prompt_riesgo: SHA16_PROMPT_RIESGO } : {}),
      },
    })
  }

  if (excedeLimite(s.usuarioId, t0)) return json({ error: 'Demasiados mensajes en la última hora' }, 429)

  // El lector de riesgo no necesita el plan: arranca ya, en paralelo con la lectura del plan
  // y con el registrador (Bryan, 2-oct: «Praxis se queda cargando; que sea en tiempo real»).
  const reloj = cronometro()
  const riesgoEnCurso = medir(reloj, 'riesgo', leerRiesgoConModelo(d, frase).catch((e: unknown) => {
    console.error('praxis-registro: el lector de riesgo falló', e instanceof Error ? e.name : 'error')
    return null
  }))

  // 2. Contexto implícito, leído con el JWT de la persona.
  const ahora = horaConfiable(cuerpo.hora_local, d.ahora())
  const contextoCharla = leerContextoCharla(cuerpo.charla)
  const { activo, anterior } = await medir(reloj, 'plan', plan) // ya venía leyéndose desde antes de la validación: aquí casi no espera
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
    verComposicion: typeof cuerpo.ver_composicion === 'boolean' ? cuerpo.ver_composicion : undefined,
    comidasAyer: cuerpo.comidas_ayer,
    comidaPendiente: cuerpo.comida_pendiente,
  })

  // 3. Haiku dos veces y en paralelo: el registrador (solo cita y etiqueta) y el lector de
  //    riesgo con modelo. Sin la lectura de riesgo no se sigue: se pide repetir.
  //    CAMINO RÁPIDO (3-oct): las frases más simples de entreno (un ejercicio del plan de hoy, números
  //    explícitos, ninguna palabra de más) se extraen con una gramática cerrada y NO esperan al registrador;
  //    pasan por el mismo validador y los mismos resolutores. El lector de riesgo con modelo corre igual,
  //    y su fallo sigue siendo un 502. Ante la mínima duda, `caminoRapido` devuelve null y se llama al modelo.
  let rapido: { bruto: unknown } | null = null
  if (d.entorno.PRAXIS_CAMINO_RAPIDO !== '0') {
    try { rapido = caminoRapido(frase, ctx) } catch { rapido = null }
  }
  const registrador: Promise<{ entrada: unknown; tokensEntrada: number; tokensSalida: number } | null> = rapido
    ? Promise.resolve({ entrada: rapido.bruto, tokensEntrada: 0, tokensSalida: 0 })
    : llamarHaiku(d, ctx, frase, armarContextoCharla(contextoCharla, ahora)).catch((e: unknown) => {
        console.error('praxis-registro: la llamada a Anthropic falló', e instanceof Error ? e.name : 'error')
        return null
      })
  const [salida, riesgo] = await Promise.all([medir(reloj, 'registro', registrador), riesgoEnCurso])
  reloj.anotar('total')
  console.log('praxis-registro: tiempos', JSON.stringify(reloj.tiempos)) // sin la frase: solo milisegundos
  if (!riesgo) return json({ error: MSG_NO_ENTENDI, reintentable: true }, 502)
  const marcaModelo = marcaDesdeModelo(riesgo.nivel)
  if (marcaModelo) {
    const propuesta = derivarPorRiesgo(marcaModelo)
    await avisarAlCoach(d, s, { origen: 'praxis', nivel: nivelDeMarca(marcaModelo) })
    return json({
      propuesta,
      tarjeta: construirTarjeta(propuesta, mensajeId),
      meta: {
        modelo: MODELO_HAIKU, derivada: true, aviso_bryan: true, lector_riesgo: riesgo.nivel,
        version_prompt_riesgo: SHA16_PROMPT_RIESGO, version_prompt: VERSION_PROMPT, version_resolutores: VERSION_RESOLUTORES,
      },
    })
  }
  if (!salida) return json({ error: MSG_NO_ENTENDI, reintentable: true }, 502)

  // 4. Citas válidas + resolutores deterministas. Nada se guarda.
  const { extraccion, citasInvalidas } = validarExtraccion(frase, salida.entrada)
  const propuesta = resolverPropuesta(frase, extraccion, ctx, citasInvalidas)
  // La charla: solo si no hay nada que guardar, preguntar ni derivar. Es TEXTO: no crea tarjeta de confirmación ni escribe nada.
  const textoCharla = !rapido && cabeCharla(propuesta, { intencionCharla: extraccion.intencion.includes('charla') && !extraccion.intencion.includes('consulta') }) ? leerRespuestaCharla(salida.entrada, contextoCharla) : null
  return json({
    propuesta,
    tarjeta: construirTarjeta(propuesta, mensajeId),
    ...(textoCharla ? { charla: { texto: textoCharla } } : {}),
    meta: {
      modelo: MODELO_HAIKU,
      derivada: propuesta.accion === 'derivar',
      version_prompt: VERSION_PROMPT,
      version_prompt_charla: VERSION_PROMPT_CHARLA,
      version_esquema: VERSION_ESQUEMA,
      version_resolutores: VERSION_RESOLUTORES,
      camino: rapido ? 'rapido' : 'modelo', // «rapido»: el registrador no llamó al modelo
      tokens_entrada: salida.tokensEntrada,
      tokens_salida: salida.tokensSalida,
      latencia_ms: d.ahora().getTime() - t0,
      tiempos_ms: reloj.tiempos,
    },
  })
}

interface CuerpoIngreso {
  turno?: unknown
  texto?: unknown
}

/**
 * Un solo llamado a Haiku, sin herramientas, para etiquetar UN turno hablado del ingreso. El prompt y la
 * validación son los de `ingreso/extraer.ts` (medidos en `scripts/banco-ingreso/`); aquí solo se pone el modelo.
 */
export async function llamarHaikuIngreso(
  d: Dependencias,
  turno: TurnoId,
  texto: string,
): Promise<{ bruto: unknown; tokensEntrada: number; tokensSalida: number } | null> {
  const clave = d.entorno.ANTHROPIC_API_KEY
  if (!clave) {
    console.error('praxis-registro: falta el secreto ANTHROPIC_API_KEY')
    return null
  }
  const r = await d.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MODELO_MS),
    body: JSON.stringify({
      model: MODELO_HAIKU,
      max_tokens: 900,
      temperature: 0,
      // ~1.100 tokens aproximados: por debajo del mínimo cacheable, sin cache_control.
      system: [bloqueDeSistema(PROMPT_SISTEMA_INGRESO)],
      messages: [{ role: 'user', content: armarMensajeIngreso(turno, texto) }],
    }),
  })
  if (!r.ok) {
    await registrarErrorDeAnthropic(r, texto)
    return null
  }
  const cuerpo = (await r.json()) as {
    content?: { type: string; text?: string }[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  const bruto = leerSalidaIngreso((cuerpo.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n'))
  if (bruto === null) return null
  return { bruto, tokensEntrada: cuerpo.usage?.input_tokens ?? 0, tokensSalida: cuerpo.usage?.output_tokens ?? 0 }
}

/**
 * Lo único de una derivación que sale hacia la pantalla del ingreso: sin notas del coach ni la marca que disparó.
 * Antes de responder deja el aviso para el coach (tipo de señal y origen, nunca el texto).
 */
async function derivacionDeIngreso(d: Dependencias, s: Sesion, turno: TurnoId, marca: MarcaDeRiesgo, extra: Record<string, unknown> = {}): Promise<Response> {
  const p = derivarPorRiesgo(marca)
  await avisarAlCoach(d, s, { origen: 'ingreso', nivel: nivelDeMarca(marca) })
  return json({
    tipo: 'ingreso', turno, derivada: true,
    derivacion: { filtro: p.filtro ?? null, riesgo: p.riesgo ?? null, urgencia: p.urgencia ?? null },
    meta: { modelo: null, ...extra },
  })
}

/**
 * INGRESO (prueba interna). Mismo orden de seguridad que `proponer`:
 *   1. Auth y rol ya pasaron en `manejar`, antes de llegar aquí.
 *   2. El filtro de riesgo (el mismo de la pantalla) ANTES de cualquier modelo: si marca, se responde
 *      con la derivación y NO se extrae nada.
 *   3. El límite por hora.
 *   4. Haiku dos veces y en paralelo: el etiquetador del ingreso y el lector de riesgo con modelo. Si el
 *      lector ve riesgo, la extracción se descarta; si falla, no se sigue.
 *   5. `validarIngreso`: solo pasa lo que se rastrea a una cita literal. Un campo de salud JAMÁS sale de
 *      aquí: la respuesta lleva el tema y los toques que corresponden, nunca la frase que lo dijo.
 * No guarda nada, no lee el plan y los tiempos que registra son milisegundos, sin el texto.
 */
async function ingresar(d: Dependencias, s: Sesion, cuerpo: CuerpoIngreso): Promise<Response> {
  const turnoDef = TURNOS_VOZ.find((t) => t.id === cuerpo.turno)
  if (!turnoDef) return json({ error: 'Turno desconocido' }, 400)
  const turno = turnoDef.id
  const texto = typeof cuerpo.texto === 'string' ? cuerpo.texto.trim() : ''
  if (!texto) return json({ error: 'Falta el texto' }, 400)
  if (texto.length > MAX_TEXTO_INGRESO) return json({ error: 'El texto es muy largo' }, 400)
  const t0 = d.ahora().getTime()

  const marca = filtroDeRiesgo(texto)
  if (marca) return derivacionDeIngreso(d, s, turno, marca, { version_prompt: VERSION_PROMPT_INGRESO })

  if (excedeLimite(s.usuarioId, t0, vistoIngreso, MAX_INGRESO_POR_HORA)) return json({ error: 'Demasiados mensajes en la última hora' }, 429)

  const reloj = cronometro()
  const [salida, riesgo] = await Promise.all([
    medir(reloj, 'ingreso', llamarHaikuIngreso(d, turno, texto).catch((e: unknown) => {
      console.error('praxis-registro: la llamada de ingreso a Anthropic falló', e instanceof Error ? e.name : 'error')
      return null
    })),
    medir(reloj, 'riesgo', leerRiesgoConModelo(d, texto).catch((e: unknown) => {
      console.error('praxis-registro: el lector de riesgo falló', e instanceof Error ? e.name : 'error')
      return null
    })),
  ])
  reloj.anotar('total')
  console.log('praxis-registro: tiempos-ingreso', JSON.stringify(reloj.tiempos)) // sin el texto: solo milisegundos
  if (!riesgo) return json({ error: MSG_NO_ENTENDI, reintentable: true }, 502)
  const marcaModelo = marcaDesdeModelo(riesgo.nivel)
  if (marcaModelo) return derivacionDeIngreso(d, s, turno, marcaModelo, { lector_riesgo: riesgo.nivel, version_prompt_riesgo: SHA16_PROMPT_RIESGO, tiempos_ms: reloj.tiempos })
  if (!salida) return json({ error: MSG_NO_ENTENDI, reintentable: true }, 502)

  const r = validarIngreso(turno, texto, salida.bruto)
  // Defensa en profundidad: el filtro de riesgo ya habría detenido un síntoma urgente; si aun así asoma, se detiene.
  if (r.urgencia === 'alta') return derivacionDeIngreso(d, s, turno, { tipo: 'quieta', linea: 'vida' }, { tiempos_ms: reloj.tiempos })
  // Salud en lo que dijo: el coach lo sabe por el aviso (solo el tipo), no por la frase.
  if (r.salud.length > 0) await avisarAlCoach(d, s, { origen: 'ingreso', nivel: 'salud' })
  return json({
    tipo: 'ingreso',
    turno,
    derivada: false,
    // Solo el valor ya convertido por el código: ni la cita (puede ser texto libre) ni ningún campo de salud.
    campos: Object.fromEntries(Object.values(r.campos).map((v) => [v.campo, v.valor])),
    // Salud: el tema y el toque que hay que hacer. Jamás la frase.
    temas: r.salud.map((m) => m.tema),
    toques: r.toques,
    descartados: r.descartados.map((x) => ({ campo: x.campo, motivo: x.motivo })),
    meta: {
      modelo: MODELO_HAIKU,
      version_prompt: VERSION_PROMPT_INGRESO,
      tokens_entrada: salida.tokensEntrada,
      tokens_salida: salida.tokensSalida,
      latencia_ms: d.ahora().getTime() - t0,
      tiempos_ms: reloj.tiempos,
    },
  })
}

/* ——— Cronómetro por paso: dónde se van los segundos de cada mensaje ——— */
interface Reloj { inicio: number; tiempos: Record<string, number>; anotar: (paso: string) => void }
function cronometro(): Reloj {
  const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  const inicio = ahora()
  const r: Reloj = { inicio, tiempos: {}, anotar: (paso) => { r.tiempos[paso] = Math.round(ahora() - inicio) } }
  return r
}
/** Anota cuándo terminó la promesa, contando desde el inicio del reloj. */
function medir<T>(reloj: Reloj, paso: string, p: Promise<T>): Promise<T> {
  return p.finally(() => reloj.anotar(paso))
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

async function guardar(d: Dependencias, s: Sesion, cuerpo: CuerpoGuardar, plan: Promise<Plan>): Promise<Response> {
  if (!Array.isArray(cuerpo.registros) || cuerpo.registros.length === 0 || cuerpo.registros.length > 12) {
    return json({ error: 'Faltan los registros confirmados (1 a 12)' }, 400)
  }
  const ahora = horaConfiable(cuerpo.hora_local, d.ahora())
  const { activo } = await plan
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
    if (campo === 'adherencia') {
      const w = prepararAdherencia(bruto as RegistroAdherencia, s.usuarioId, ahora)
      if (!w.ok) {
        resultados.push({ indice, campo, estado: 'rechazado', motivo: w.motivo })
        continue
      }
      // Una fila por (usuario, fecha): reaplicar da lo mismo. Solo viajan las columnas que cambian,
      // así el comentario que ya tuviera la fila no se borra.
      const r = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/adherencias?on_conflict=usuario_id,fecha`, {
        method: 'POST',
        headers: {
          apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${s.token}`, 'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(w.valor),
      })
      resultados.push({ indice, campo, estado: r.ok ? 'guardado' : 'rechazado', motivo: r.ok ? undefined : 'la base no aceptó la escritura' })
      continue
    }
    resultados.push({ indice, campo, estado: 'rechazado', motivo: 'campo no soportado' })
  }
  return json({ mensaje_id: typeof cuerpo.mensaje_id === 'string' ? cuerpo.mensaje_id : null, resultados })
}

type ResultadoAuth = { ok: true; id: string } | { ok: false; error: string }

/** El token contra Supabase Auth. Nunca lanza: devuelve el motivo. */
async function validarSesion(d: Dependencias, token: string): Promise<ResultadoAuth> {
  try {
    const r = await d.fetch(`${d.entorno.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
    })
    if (!r.ok) return { ok: false, error: 'Sesion invalida' }
    const u = (await r.json()) as { id?: string }
    if (!u?.id) return { ok: false, error: 'Sesion invalida' }
    return { ok: true, id: u.id }
  } catch {
    return { ok: false, error: 'No se pudo validar la sesion' }
  }
}

/** El rol de la persona, con su JWT (RLS). `undefined` si no se pudo leer. */
async function leerRol(d: Dependencias, s: Sesion): Promise<string | undefined> {
  const filas = await leer<{ rol?: string }[]>(d, s, `usuarios_app?id=eq.${s.usuarioId}&select=rol`).catch(() => null)
  return filas?.[0]?.rol
}

export async function manejar(req: Request, d: Dependencias): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let cuerpo: CuerpoProponer & CuerpoGuardar & CuerpoIngreso & { accion?: unknown }
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
  //
  // La espera de antes (Bryan, 2-oct: «Praxis se queda cargando»): Auth (~0,7 s), después el rol
  // (~0,4 s) y después el plan (~0,3 s), uno tras otro. Ahora las TRES lecturas arrancan a la vez.
  // El rol y el plan se leen con el JWT de la persona (RLS) y con el `sub` del propio token, que el
  // gateway ya verificó; pero nada de eso vale hasta que Auth diga que sí Y devuelva ese mismo id.
  //
  // REGLA DURA: ninguna frase llega a Anthropic (ni el registrador ni el lector de riesgo) antes
  // de que Auth Y el rol hayan pasado. Lo único que corre en paralelo son lecturas de la propia
  // base con el JWT de la persona; el modelo se llama más abajo, en `proponer`, ya con las dos
  // puertas abiertas.
  const relojSesion = cronometro()
  const authEnCurso = medir(relojSesion, 'auth', validarSesion(d, token))
  let previa: Sesion
  const sub = subDelJwt(token)
  if (sub) previa = { usuarioId: sub, token }
  else { // un token ilegible no deja adelantar nada: se espera a Auth, como antes
    const a = await authEnCurso
    if (!a.ok) return json({ error: a.error }, 401)
    previa = { usuarioId: a.id, token }
  }
  const rolEnCurso = medir(relojSesion, 'rol', leerRol(d, previa))
  // El ingreso y la relectura de riesgo no usan el plan de nadie: no se lee.
  const esIngreso = cuerpo.accion === 'ingreso'
  const esRelectura = cuerpo.accion === 'releer_riesgo'
  const planEnCurso = esIngreso || esRelectura ? Promise.resolve<Plan>({ activo: null, anterior: null }) : medir(relojSesion, 'plan', microciclosDe(d, previa))
  planEnCurso.catch(() => undefined) // si Auth o el rol cierran la puerta antes, que su fallo no quede suelto

  const auth = await authEnCurso
  if (!auth.ok) return json({ error: auth.error }, 401)
  if (auth.id !== previa.usuarioId) return json({ error: 'Sesion invalida' }, 401) // el token decía una persona y Auth otra
  const sesion: Sesion = { usuarioId: auth.id, token }

  // Mientras Praxis esté cerrada a los asesorados, la función atiende solo al equipo. El
  // interruptor es el de la pantalla (`acceso.ts`): antes solo existía allí, y cualquier
  // asesorado con sesión podía llamar a la función y mandar su texto al modelo (revisión del
  // PR #331, A2). Si no se sabe el rol, se cierra.
  const rol = await rolEnCurso
  const conocido = rol === 'asesorado' || rol === 'coach' || rol === 'nutricionista'
  if (!conocido || !puedeVerPraxis(rol as Rol)) return json({ error: 'Praxis todavía no está abierta para esta cuenta' }, 403)
  console.log('praxis-registro: tiempos-sesion', JSON.stringify(relojSesion.tiempos))

  const ruta = new URL(req.url).pathname.replace(/\/+$/, '')
  if (esIngreso) return ingresar(d, sesion, cuerpo)
  if (esRelectura) return releerRiesgo(d, sesion, cuerpo)
  if (ruta.endsWith('/guardar') || cuerpo.accion === 'guardar') return guardar(d, sesion, cuerpo, planEnCurso)
  return proponer(d, sesion, cuerpo, planEnCurso)
}

interface CuerpoReleer { frase?: unknown }

/**
 * RELEER EL RIESGO de una frase que la pantalla YA marcó como cuidado o salud (3-oct). Solo devuelve la
 * marca más grave entre el filtro y el modelo; no lee el plan, no llama al registrador, no guarda nada,
 * no entra a ningún hilo de charla y no deja aviso al coach (la pantalla dice que desde ahí no se avisa a nadie).
 * El filtro se vuelve a correr AQUÍ: la función no se fía de lo que la pantalla diga que marcó. Si la frase
 * no la marca el filtro, no se manda al modelo (esta ruta no es otra puerta al lector). Sin el interruptor
 * `PRAXIS_RIESGO_MAS_GRAVE=1` devuelve la marca del filtro sin llamar a nadie.
 */
async function releerRiesgo(d: Dependencias, s: Sesion, cuerpo: CuerpoReleer): Promise<Response> {
  const frase = typeof cuerpo.frase === 'string' ? cuerpo.frase.trim() : ''
  if (!frase) return json({ error: 'Falta la frase' }, 400)
  if (frase.length > MAX_FRASE) return json({ error: 'La frase es muy larga' }, 400)
  const filtro = filtroDeRiesgo(frase)
  if (!filtro) return json({ marca: null, origen: 'filtro', consultado: false })
  const leida = await marcaMasGrave(d, s.usuarioId, frase, filtro)
  return json({
    marca: leida.marca.tipo === 'quieta' ? { tipo: 'quieta', linea: leida.marca.linea } : { tipo: leida.marca.tipo },
    origen: leida.origen, consultado: leida.consultado,
    ...(leida.origen === 'modelo' ? { lector_riesgo: leida.lector, version_prompt_riesgo: SHA16_PROMPT_RIESGO } : {}),
  })
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
        PRAXIS_CAMINO_RAPIDO: entorno('PRAXIS_CAMINO_RAPIDO'),
        PRAXIS_RIESGO_MAS_GRAVE: entorno('PRAXIS_RIESGO_MAS_GRAVE'),
      },
      fetch: (...a) => fetch(...a),
      ahora: () => new Date(),
    }),
  )
}
