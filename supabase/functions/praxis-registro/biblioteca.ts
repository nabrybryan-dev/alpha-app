/**
 * LA BIBLIOTECA, SOLO MIRANDO (Bryan, 31-oct-2026: «todo menos la respuesta»). Busca qué pieza contestaría la consulta
 * y deja una línea en el registro con los ids y el coseno, para medir con dudas reales. Lo encontrado no se devuelve:
 * esta función no tiene cómo cambiar lo que recibe la persona, y un fallo solo deja su línea. Nunca registra la frase.
 *
 * El vector lo da el servicio del portátil de Manu, con los secretos del portero. Se busca con el JWT de la persona (RLS).
 */

const TIMEOUT_VECTOR_MS = 1500
const TIMEOUT_BUSQUEDA_MS = 1500
const DIMENSION = 768

interface EntornoBiblioteca {
  entorno: { PORTERO_URL?: string; PORTERO_CLAVE?: string; SUPABASE_URL: string; SUPABASE_ANON_KEY: string }
  fetch: typeof fetch
}

export type ResultadoBiblioteca = 'encontro' | 'nada' | 'sin_secretos' | 'vector_ilegible' | `vector_http_${number}` | `busqueda_http_${number}` | `error_${string}`

function vectorValido(cuerpo: unknown): number[] | null {
  const v = (cuerpo as { vector?: unknown } | null)?.vector
  return Array.isArray(v) && v.length === DIMENSION && v.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (v as number[]) : null
}

export async function observarBiblioteca(d: EntornoBiblioteca, token: string, frase: string): Promise<ResultadoBiblioteca> {
  const fin = (resultado: ResultadoBiblioteca, detalle = '') => {
    console.log('praxis-registro: biblioteca', resultado, detalle)
    return resultado
  }
  try {
    const { PORTERO_URL: url, PORTERO_CLAVE: clave } = d.entorno
    if (!url || !clave) return fin('sin_secretos')
    const rv = await d.fetch(`${url.replace(/\/+$/, '')}/vector`, {
      method: 'POST',
      headers: { 'x-clave': clave, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_VECTOR_MS),
      body: JSON.stringify({ texto: frase }),
    })
    if (!rv.ok) return fin(`vector_http_${rv.status}`)
    const vector = vectorValido(await rv.json().catch(() => null))
    if (!vector) return fin('vector_ilegible')
    const rb = await d.fetch(`${d.entorno.SUPABASE_URL}/rest/v1/rpc/buscar_conceptos_vector`, {
      method: 'POST',
      headers: { apikey: d.entorno.SUPABASE_ANON_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_BUSQUEDA_MS),
      body: JSON.stringify({ consulta: `[${vector.join(',')}]`, tope: 3 }),
    })
    if (!rb.ok) return fin(`busqueda_http_${rb.status}`)
    const piezas = (await rb.json()) as { id: string; coseno: number }[]
    if (piezas.length === 0) return fin('nada')
    return fin('encontro', piezas.map((p) => `${p.id}:${p.coseno.toFixed(3)}`).join(' '))
  } catch (e) {
    return fin(`error_${e instanceof Error ? e.name : 'desconocido'}`)
  }
}
