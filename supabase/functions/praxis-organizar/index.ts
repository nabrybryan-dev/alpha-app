// praxis-organizar: la SEGUNDA CAPA de «organizar la app hablando» (fase O2b). SOLO LEE: recibe la frase y devuelve
// {verbo, pieza} elegidos de un menú cerrado. No cambia nada, no guarda nada y no decide: el teléfono aplica los
// candados (`decidirConLectura`) y la persona confirma. APAGADA: nadie la llama y no está desplegada.
//
//   POST /praxis-organizar   { frase: string }   ->   { lectura: { verbo, pieza } | null }
//
// Reglas (las mismas del resto de Praxis):
//  - Sesión validada contra Auth ANTES de tocar el modelo. El usuario sale del token, nunca del cuerpo.
//  - Seguridad primero: una frase que salta el filtro de riesgo NO se envía al modelo (responde lectura null).
//    El teléfono además aplica `sePuedeConsultarAlModelo` (que suma `DE_SALUD`) antes de llamar.
//  - Salida ilegible o inventada (verbo fuera del menú, pieza que no está en la lista) = lectura null.
//  - Sin la clave de Anthropic responde 503, sin inventar nada.
//  - La frase no se guarda ni se escribe en los registros (solo largo y resultado).
//
// Medición (11-nov-2026, CLI con Haiku 4.5, 3 exámenes): gramática + este modelo 81 a 89 % en frases nuevas, 88 % en
// frases reales de Bryan, 0 falsos positivos en controles, p50 0,8 s. Ver scripts/praxis-eval/organizacion-modelo.mts.
import { filtroDeRiesgo } from '../../../src/domain/praxis/riesgo.ts'
import { leerSalidaDeOrganizacion, promptDeOrganizacion, type LecturaDelModelo } from '../../../src/domain/praxis/organizacion/lectorModelo.ts'
import { excedeLimite } from '../praxis-registro/cupo.ts'
import { CORS, json } from '../praxis-registro/http.ts'
import { PIEZAS_DEL_MENU } from './menu.ts'

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

const MODELO = 'claude-haiku-4-5'
const MAX_FRASE = 400
const TIMEOUT_MODELO_MS = 8000
/** Por persona y hora. Una persona que organiza no manda más de unas pocas órdenes por hora. */
export const MAX_ORGANIZAR_POR_HORA = 30
export const vistoOrganizar = new Map<string, number[]>()

const IDS = new Set(PIEZAS_DEL_MENU.map((p) => p.id))
const PROMPT = promptDeOrganizacion(PIEZAS_DEL_MENU)

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

async function preguntarAlModelo(d: Dependencias, clave: string, frase: string): Promise<LecturaDelModelo | null> {
  const r = await d.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MODELO_MS),
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 80,
      temperature: 0,
      // El menú de piezas no cambia entre llamadas: va en el sistema para que se pueda cachear.
      system: [{ type: 'text', text: PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: frase }],
    }),
  })
  if (!r.ok) return null
  const cuerpo = (await r.json()) as { content?: { type: string; text?: string }[] }
  const texto = cuerpo.content?.find((b) => b.type === 'text')?.text ?? ''
  return leerSalidaDeOrganizacion(texto, IDS)
}

export async function manejar(req: Request, d: Dependencias): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let cuerpo: { frase?: unknown }
  try {
    cuerpo = await req.json()
  } catch {
    return json({ error: 'Cuerpo invalido' }, 400)
  }
  if (!d.entorno.SUPABASE_URL || !d.entorno.SUPABASE_ANON_KEY) return json({ error: 'Falta SUPABASE_URL o SUPABASE_ANON_KEY en la funcion' }, 500)
  const token = tokenDeCabecera(req.headers.get('Authorization'))
  if (!token) return json({ error: 'Falta la sesion' }, 401)
  const usuario = await validarSesion(d, token)
  if (!usuario) return json({ error: 'Sesion invalida' }, 401)

  const frase = typeof cuerpo.frase === 'string' ? cuerpo.frase.trim() : ''
  if (!frase || frase.length > MAX_FRASE) return json({ error: 'Frase invalida' }, 400)
  if (excedeLimite(usuario, d.ahora().getTime(), vistoOrganizar, MAX_ORGANIZAR_POR_HORA)) return json({ error: 'Demasiadas ordenes, espera un rato' }, 429)

  // Seguridad primero: lo que habla de riesgo no llega al modelo.
  if (filtroDeRiesgo(frase)) return json({ lectura: null, motivo: 'riesgo' })

  const clave = d.entorno.ANTHROPIC_API_KEY
  if (!clave) {
    console.error('praxis-organizar: falta el secreto ANTHROPIC_API_KEY')
    return json({ error: 'Servicio no disponible' }, 503)
  }
  let lectura: LecturaDelModelo | null
  try {
    lectura = await preguntarAlModelo(d, clave, frase)
  } catch {
    return json({ error: 'El modelo no respondio' }, 502)
  }
  console.log('praxis-organizar:', JSON.stringify({ largo: frase.length, verbo: lectura?.verbo ?? 'ilegible' })) // nunca la frase
  return json({ lectura })
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  const entorno = (k: string) => Deno!.env.get(k)
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
