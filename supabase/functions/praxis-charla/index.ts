// praxis-charla: la charla de Praxis con DeepSeek (modelo provisional; el saldo de Anthropic está en cero).
//
// APAGADA: nadie la llama y no está desplegada. Nada de la app, del teléfono ni de la interfaz apunta aquí.
// Mientras la bandera `PRAXIS_CHARLA_ACTIVA` no valga '1' responde 503 sin llamar a nada (ni Auth, ni base, ni modelos).
//
//   POST /praxis-charla   { frase: string }
//     -> { salida: 'respuesta', respuesta, piezas_usadas, piezas: [{ id, estudios|null, criterio_de_practica }], origen: 'modelo'|'respaldo' }
//     -> { salida: 'coach', motivo }          (la frase va al coach y NO se llama a DeepSeek)
//
// Orden fijo (cada puerta frena a la siguiente):
//   1. autenticación (el usuario sale del token, nunca del cuerpo)
//   2. límite por persona y hora
//   3. filtro local de salud (`filtroDeRiesgo`): si marca algo, va al coach
//   4. lector de riesgo con modelo, ANTES y FALLA CERRADO: solo un «sin riesgo» explícito sigue; si falla, tarda o
//      dice otra cosa, va al coach. Recibe la frase CRUDA a propósito (el limpiador podría tapar una palabra de riesgo);
//      eso manda texto sin limpiar a Anthropic: es H3 del informe del custodio y lo decide el abogado, no se cambia aquí.
//   5. limpiador de patrones (nombres de la lista, correos, teléfonos, peso, edad, medidas, usuario, cédula, dirección) Y DESPUÉS
//      `soloVocabulario`: solo salen palabras del vocabulario permitido (piezas aprobadas + español común); lo demás pasa a «[…]».
//      UNA vez, justo después del lector: de aquí en adelante solo circula la frase FILTRADA (H4 y cierre estructural de H1)
//   6. búsqueda de piezas aprobadas con la frase limpia (`buscar_conceptos_vector`, luego su fila de `praxis_conceptos`)
//   7. DeepSeek (POST https://api.deepseek.com/chat/completions, modelo `deepseek-flash`, clave DEEPSEEK_API_KEY)
//   8. respaldo sin modelo: si DeepSeek falla, tarda o devuelve algo inválido, la pieza tal cual; nunca vacío
//
// Lo que sale hacia DeepSeek: solo la frase limpia y, de cada pieza, id/respuesta/estudios/criterio. Nunca id de persona,
// perfil, plan ni historial. La clave vive solo en el servidor. Cada envío deja una línea de registro con los NOMBRES de los
// campos que salieron y los tipos de cosa que se tapó, sin el texto de la frase.
//
// Corregido tras el informe del custodio (11-nov): H1 limpiador más estricto y luego vocabulario permitido, H2 frase de hasta 200
// caracteres, H4 la búsqueda de piezas y DeepSeek reciben la frase limpia, H9 sin secreto PRAXIS_CHARLA_NOMBRES.
// PRAXIS_CHARLA_NOMBRES YA NO SE LEE en esta función (comprobado: ninguna referencia a esa variable en praxis-charla); no hace falta
// crearlo. El vocabulario sale de `vocabularioCharla.generado.ts` (scripts/generar-vocabulario-charla.mts); si cambian las piezas, regenerar.
// Pendiente: H3/H6 abogado. H5 provisional: rama construida APAGADA tras una segunda bandera `PRAXIS_CHARLA_PROVISIONAL=1` (sin ella, la frase fija);
// sin pieza, DeepSeek con prompt de conocimiento general -> filtro de salida -> rótulo (TEXTO PENDIENTE DE APROBACION DEL DUENO) o al coach.
// Siempre devuelve `hueco` ({temaClave, frase limpia}) para que quien llama lo encole; aquí no se escribe en ninguna tabla.
// Pendiente antes de encender (no hecho aquí): revisión del abogado por la transferencia a un proveedor extranjero, saldo del
// lector de riesgo, desplegar con la CLI. El nombre `deepseek-flash` lo dio el dueño: no se comprobó contra la documentación
// del proveedor. La búsqueda de piezas manda la frase LIMPIA al servicio de vectores propio (el mismo de
// `praxis-registro/biblioteca.ts`), no a DeepSeek; que ese servicio no guarde texto: NO MEDIDO.
import { filtroDeRiesgo } from '../../../src/domain/praxis/riesgo.ts'
import { PROMPT_RIESGO, leerSalidaRiesgo } from '../../../src/domain/praxis/riesgoModelo.ts'
import { limpiarFrase, type ResultadoLimpieza } from '../../../src/domain/praxis/charla/limpiador.ts'
import { soloVocabulario } from '../../../src/domain/praxis/charla/vocabularioPermitido.ts'
import { VOCABULARIO_CHARLA } from '../../../src/domain/praxis/charla/vocabularioCharla.generado.ts'
import {
  CAMPOS_DEL_ENVIO,
  URL_DEEPSEEK,
  armarPedidoDeepseek,
  validarRespuestaCharla,
  type PiezaDeLaBiblioteca,
  type RespuestaCharla,
} from '../../../src/domain/praxis/charla/pedidoCharla.ts'
import { normalizarHueco, type Hueco } from '../../../src/domain/praxis/charla/hueco.ts'
import { armarPedidoProvisional, decidirProvisional, tieneContenido } from '../../../src/domain/praxis/charla/provisional.ts'
import { conTope, decidirSalida, lecturaDesdeNivel, respaldoSinModelo, type LecturaDeRiesgo } from '../../../src/domain/praxis/charla/salidaCharla.ts'
import { excedeLimite } from '../praxis-registro/cupo.ts'
import { CORS, json } from '../praxis-registro/http.ts'

declare const Deno:
  | { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void }
  | undefined

export interface Entorno {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  /** Solo '1' enciende la función. Por defecto (ausente o cualquier otra cosa) responde 503. */
  PRAXIS_CHARLA_ACTIVA: string | undefined
  DEEPSEEK_API_KEY: string | undefined
  ANTHROPIC_API_KEY: string | undefined
  PORTERO_URL: string | undefined
  PORTERO_CLAVE: string | undefined
  /** Segunda bandera: solo '1' enciende la respuesta provisional sin pieza. Por defecto apagada (se conserva la frase fija). */
  PRAXIS_CHARLA_PROVISIONAL: string | undefined
}
export interface Dependencias {
  entorno: Entorno
  fetch: typeof fetch
  ahora: () => Date
}

const VOCABULARIO: ReadonlySet<string> = new Set(VOCABULARIO_CHARLA)

/** H2 (informe del custodio): menos texto libre hacia fuera. */
const MAX_FRASE = 200
export const MAX_CHARLA_POR_HORA = 30
export const vistoCharla = new Map<string, number[]>()
export const TOPE_LECTOR_MS = 3000
export const TOPE_DEEPSEEK_MS = 4000
const TIMEOUT_VECTOR_MS = 1500
const TIMEOUT_BUSQUEDA_MS = 1500
const DIMENSION = 768
const MODELO_LECTOR = 'claude-haiku-4-5'

const tokenDeCabecera = (c: string | null): string | null => c?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null

async function validarSesion(d: Dependencias, token: string): Promise<string | null> {
  try {
    const r = await d.fetch(`${d.entorno.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` } })
    if (!r.ok) return null
    const u = (await r.json()) as { id?: string }
    return u?.id ?? null
  } catch {
    return null
  }
}

/** El lector de riesgo con modelo (mismo prompt medido que `praxis-registro`). Devuelve el nivel o null si no se pudo leer. */
async function leerNivelDeRiesgo(d: Dependencias, frase: string): Promise<string | null> {
  const clave = d.entorno.ANTHROPIC_API_KEY
  if (!clave) return null
  const r = await d.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TOPE_LECTOR_MS),
    body: JSON.stringify({ model: MODELO_LECTOR, max_tokens: 200, temperature: 0, system: [{ type: 'text', text: PROMPT_RIESGO }], messages: [{ role: 'user', content: frase }] }),
  })
  if (!r.ok) return null
  const cuerpo = (await r.json()) as { content?: { type: string; text?: string }[] }
  const texto = (cuerpo.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n')
  return leerSalidaRiesgo(texto)?.nivel ?? null
}

async function lectorDeRiesgo(d: Dependencias, frase: string): Promise<LecturaDeRiesgo> {
  const r = await conTope(() => leerNivelDeRiesgo(d, frase), TOPE_LECTOR_MS)
  if (!r.ok) return { tipo: r.motivo }
  return lecturaDesdeNivel(r.valor)
}

const vectorValido = (c: unknown): number[] | null => {
  const v = (c as { vector?: unknown } | null)?.vector
  return Array.isArray(v) && v.length === DIMENSION && v.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (v as number[]) : null
}

/** Las piezas aprobadas que contestan la frase, tal cual están en `praxis_conceptos`. Lista vacía si algo falla. */
async function buscarPiezas(d: Dependencias, token: string, frase: string): Promise<PiezaDeLaBiblioteca[]> {
  try {
    const { PORTERO_URL: url, PORTERO_CLAVE: clave } = d.entorno
    if (!url || !clave) return []
    const rv = await d.fetch(`${url.replace(/\/+$/, '')}/vector`, {
      method: 'POST',
      headers: { 'x-clave': clave, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_VECTOR_MS),
      body: JSON.stringify({ texto: frase }),
    })
    if (!rv.ok) return []
    const vector = vectorValido(await rv.json().catch(() => null))
    if (!vector) return []
    const cab = { apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    const rb = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/rpc/buscar_conceptos_vector`, {
      method: 'POST',
      headers: cab,
      signal: AbortSignal.timeout(TIMEOUT_BUSQUEDA_MS),
      body: JSON.stringify({ consulta: `[${vector.join(',')}]`, tope: 3 }),
    })
    if (!rb.ok) return []
    const halladas = ((await rb.json()) as { id?: unknown }[]).map((p) => p.id).filter((i): i is string => typeof i === 'string' && /^[\w.-]+$/.test(i))
    if (halladas.length === 0) return []
    const rf = await d.fetch(
      `${d.entorno.SUPABASE_URL}/rest/v1/praxis_conceptos?id=in.(${halladas.join(',')})&estado=eq.aprobada&select=id,respuesta,estudios,criterio_de_practica`,
      { headers: cab, signal: AbortSignal.timeout(TIMEOUT_BUSQUEDA_MS) },
    )
    if (!rf.ok) return []
    const filas = (await rf.json()) as Partial<PiezaDeLaBiblioteca>[]
    const porId = new Map(filas.map((f) => [f.id, f]))
    return halladas.flatMap((id) => {
      const f = porId.get(id)
      if (!f || typeof f.respuesta !== 'string' || !f.respuesta.trim()) return []
      return [{ id, respuesta: f.respuesta, estudios: typeof f.estudios === 'string' ? f.estudios : '', criterio_de_practica: typeof f.criterio_de_practica === 'string' ? f.criterio_de_practica : '' }]
    })
  } catch {
    return []
  }
}

async function preguntarADeepseek(d: Dependencias, clave: string, fraseLimpia: string, piezas: PiezaDeLaBiblioteca[]): Promise<RespuestaCharla | null> {
  const r = await d.fetch(URL_DEEPSEEK, {
    method: 'POST',
    headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TOPE_DEEPSEEK_MS),
    body: JSON.stringify(armarPedidoDeepseek(fraseLimpia, piezas)),
  })
  if (!r.ok) return null
  const cuerpo = (await r.json()) as { choices?: { message?: { content?: unknown } }[] }
  return validarRespuestaCharla(cuerpo.choices?.[0]?.message?.content, piezas)
}

const registrar = (datos: Record<string, unknown>) => console.log('praxis-charla:', JSON.stringify(datos)) // nunca la frase

/** Respuesta provisional sin pieza: DeepSeek con conocimiento general. Devuelve el texto o null si el proveedor no contesta bien. */
async function preguntarProvisional(d: Dependencias, clave: string, fraseLimpia: string): Promise<string | null> {
  const r = await d.fetch(URL_DEEPSEEK, {
    method: 'POST',
    headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TOPE_DEEPSEEK_MS),
    body: JSON.stringify(armarPedidoProvisional(fraseLimpia)),
  })
  if (!r.ok) return null
  const cuerpo = (await r.json()) as { choices?: { message?: { content?: unknown }; finish_reason?: unknown }[] }
  if (cuerpo.choices?.[0]?.finish_reason === 'length') return null // texto cortado a mitad: no se muestra
  const c = cuerpo.choices?.[0]?.message?.content
  return typeof c === 'string' ? c : null
}

/** Sin piezas aprobadas. Con la segunda bandera: respuesta provisional o al coach; sin ella, la frase fija de siempre. Siempre lleva el hueco. */
async function responderSinPiezas(d: Dependencias, frase: string, limpia: ResultadoLimpieza, hueco: Hueco): Promise<Response> {
  if (d.entorno.PRAXIS_CHARLA_PROVISIONAL !== '1') {
    registrar({ largo: frase.length, salida: 'respuesta', origen: 'respaldo', motivo: 'sin_piezas', campos: [] })
    return json({ salida: 'respuesta', ...respaldoSinModelo([]), hueco })
  }
  const clave = d.entorno.DEEPSEEK_API_KEY
  let motivo: string
  let salioFrase = false
  if (!clave) motivo = 'sin_clave'
  else if (!tieneContenido(limpia.texto)) motivo = 'frase_vacia'
  else {
    salioFrase = true
    const r = await conTope(() => preguntarProvisional(d, clave, limpia.texto), TOPE_DEEPSEEK_MS)
    if (!r.ok) motivo = r.motivo === 'tarda' ? 'deepseek_tarda' : 'deepseek_falla'
    else {
      const dec = decidirProvisional(r.valor, limpia.texto)
      if (dec.tipo === 'provisional') {
        registrar({ largo: frase.length, salida: 'respuesta', origen: 'provisional', campos: ['frase'], tapado: limpia.tipos, piezas: 0 })
        return json({ salida: 'respuesta', respuesta: dec.texto, piezas_usadas: [], piezas: [], origen: dec.origen, excluirEntrenamiento: dec.excluirEntrenamiento, hueco })
      }
      motivo = dec.motivo
    }
  }
  registrar({ largo: frase.length, salida: 'coach', motivo: `provisional_${motivo}`, campos: salioFrase ? ['frase'] : [] })
  return json({ salida: 'coach', motivo: `provisional_${motivo}`, hueco })
}

/** Puertas 1 y 2: autenticación, frase y límite por persona. Devuelve la respuesta de rechazo o la frase y el token. */
async function puertasPrevias(req: Request, d: Dependencias): Promise<Response | { frase: string; token: string }> {
  let cuerpo: { frase?: unknown }
  try {
    cuerpo = await req.json()
  } catch {
    return json({ error: 'Cuerpo invalido' }, 400)
  }
  if (!d.entorno.SUPABASE_URL || !d.entorno.SUPABASE_ANON_KEY) return json({ error: 'Falta SUPABASE_URL o SUPABASE_ANON_KEY en la funcion' }, 500)

  // 1. autenticación
  const token = tokenDeCabecera(req.headers.get('Authorization'))
  if (!token) return json({ error: 'Falta la sesion' }, 401)
  const usuario = await validarSesion(d, token)
  if (!usuario) return json({ error: 'Sesion invalida' }, 401)

  const frase = typeof cuerpo.frase === 'string' ? cuerpo.frase.trim() : ''
  if (!frase || frase.length > MAX_FRASE) return json({ error: 'Frase invalida' }, 400)

  // 2. límite por persona
  if (excedeLimite(usuario, d.ahora().getTime(), vistoCharla, MAX_CHARLA_POR_HORA)) return json({ error: 'Demasiados mensajes, espera un rato' }, 429)
  return { frase, token }
}

/** Pasos 7 y 8: DeepSeek (con la frase ya limpia) y respaldo sin modelo. */
async function responderConDeepseek(d: Dependencias, frase: string, limpia: ResultadoLimpieza, piezas: PiezaDeLaBiblioteca[]): Promise<Response> {
  // 7. DeepSeek, y 8. respaldo
  const clave = d.entorno.DEEPSEEK_API_KEY
  let respuesta: RespuestaCharla | null = null
  let motivoRespaldo = 'sin_clave'
  if (clave) {
    const r = await conTope(() => preguntarADeepseek(d, clave, limpia.texto, piezas), TOPE_DEEPSEEK_MS)
    respuesta = r.ok ? r.valor : null
    motivoRespaldo = r.ok ? 'respuesta_invalida' : r.motivo === 'tarda' ? 'deepseek_tarda' : 'deepseek_falla'
  } else {
    console.error('praxis-charla: falta el secreto DEEPSEEK_API_KEY')
  }
  const final = respuesta ?? respaldoSinModelo(piezas)
  registrar({
    largo: frase.length,
    salida: 'respuesta',
    origen: final.origen,
    ...(respuesta ? {} : { motivo: motivoRespaldo }),
    campos: clave ? CAMPOS_DEL_ENVIO : [], // solo los NOMBRES de lo que salió
    tapado: limpia.tipos,
    piezas: piezas.length,
  })
  return json({ salida: 'respuesta', ...final })
}

export async function manejar(req: Request, d: Dependencias): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  // Apagada por defecto: antes de leer nada ni llamar a nadie.
  if (d.entorno.PRAXIS_CHARLA_ACTIVA !== '1') return json({ error: 'Servicio no disponible' }, 503)
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const previas = await puertasPrevias(req, d)
  if (previas instanceof Response) return previas
  const { frase, token } = previas

  // 3. filtro local de salud
  if (filtroDeRiesgo(frase)) {
    registrar({ largo: frase.length, salida: 'coach', motivo: 'filtro_local', campos: [] })
    return json({ salida: 'coach', motivo: 'filtro_local' })
  }

  // 4. lector de riesgo, antes y falla cerrado
  const decision = decidirSalida(await lectorDeRiesgo(d, frase))
  if (decision.salida === 'coach') {
    registrar({ largo: frase.length, salida: 'coach', motivo: decision.motivo, campos: [] })
    return json({ salida: 'coach', motivo: decision.motivo })
  }

  // 5. limpiador, una sola vez: la frase cruda no sale de aquí hacia el vector ni hacia DeepSeek
  // El lector de riesgo de arriba SIGUE con la frase cruda a propósito (H3, del abogado): si recibiera la filtrada podría perder una
  // palabra de riesgo. Aquí, en cambio, el vocabulario es el cierre estructural de lo que sale a /vector y a DeepSeek.
  const patrones = limpiarFrase(frase, [], { mayusculas: false })
  const limpia: ResultadoLimpieza = { ...patrones, texto: soloVocabulario(patrones.texto, VOCABULARIO) }

  // 6. piezas aprobadas, buscadas con la frase limpia
  const piezas = await buscarPiezas(d, token, limpia.texto)
  if (piezas.length === 0) return responderSinPiezas(d, frase, limpia, normalizarHueco(limpia.texto))
  return responderConDeepseek(d, frase, limpia, piezas)
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  const entorno = (k: string) => Deno!.env.get(k)
  Deno.serve((req) =>
    manejar(req, {
      entorno: {
        SUPABASE_URL: entorno('SUPABASE_URL') ?? '',
        SUPABASE_ANON_KEY: entorno('SUPABASE_ANON_KEY') ?? entorno('SUPABASE_PUBLISHABLE_KEY') ?? '',
        PRAXIS_CHARLA_ACTIVA: entorno('PRAXIS_CHARLA_ACTIVA'),
        DEEPSEEK_API_KEY: entorno('DEEPSEEK_API_KEY'),
        ANTHROPIC_API_KEY: entorno('ANTHROPIC_API_KEY'),
        PORTERO_URL: entorno('PORTERO_URL'),
        PORTERO_CLAVE: entorno('PORTERO_CLAVE'),
        PRAXIS_CHARLA_PROVISIONAL: entorno('PRAXIS_CHARLA_PROVISIONAL'),
      },
      fetch: (...a) => fetch(...a),
      ahora: () => new Date(),
    }),
  )
}
