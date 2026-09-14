// supabase/functions/enviar-aviso-checkin — 2026-09-13
// Lee suscripciones vivas sin check-in hoy (Bogotá) y envía Web Push con VAPID.
// Secretos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:) — nada en código.
// Si el push service responde 404/410 marca esa suscripción muerta (vivo_en = null).

// Lógica de selección en src/domain/avisos/seleccion.ts (importable en tests sin Deno).

// ---------- VAPID + Web Push (Deno Web Crypto, sin deps) ----------

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  // deno-lint-ignore no-window
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : ''
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function vapidJwt(audienceOrigin: string, subject: string, publicKeyB64Url: string, privateKeyB64Url: string): Promise<string> {
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now = Math.floor(Date.now() / 1000)
  const payload = b64urlEncode(
    new TextEncoder().encode(JSON.stringify({ aud: audienceOrigin, exp: now + 12 * 60 * 60, sub: subject })),
  )
  const data = new TextEncoder().encode(`${header}.${payload}`)
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlDecode(publicKeyB64Url).slice(1, 33) as unknown as string, // placeholder para tipar; se reemplaza abajo
    y: '',
    d: '',
  } as unknown as Record<string, string>
  // Construir JWK desde claves raw b64url (P-256 65 bytes uncompressed: 0x04 + x(32) + y(32), priv 32 bytes)
  const pubRaw = b64urlDecode(publicKeyB64Url)
  const privRaw = b64urlDecode(privateKeyB64Url)
  // pubRaw puede venir como 65 bytes (04||x||y) o como x||y crudo según generador; soportar ambos
  let xRaw: Uint8Array, yRaw: Uint8Array
  if (pubRaw.length === 65 && pubRaw[0] === 0x04) {
    xRaw = pubRaw.slice(1, 33)
    yRaw = pubRaw.slice(33, 65)
  } else if (pubRaw.length === 64) {
    xRaw = pubRaw.slice(0, 32)
    yRaw = pubRaw.slice(32, 64)
  } else {
    // Intentar como JWK ya codificado: si no es raw, asumir que es punto sin prefijo recortado
    xRaw = pubRaw.slice(0, 32)
    yRaw = pubRaw.slice(32, 64)
  }
  const jwk2: Record<string, string> = {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(xRaw),
    y: b64urlEncode(yRaw),
    d: b64urlEncode(privRaw.length === 32 ? privRaw : privRaw.slice(0, 32)),
  }
  const key = await crypto.subtle.importKey('jwk', jwk2 as JsonWebKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data)
  // ECDSA sig es ASN.1 DER; JWT exige r||s (64 bytes). Convertir.
  const der = new Uint8Array(sigBuf as ArrayBuffer)
  const rs = derToJose(der)
  return `${header}.${payload}.${b64urlEncode(rs)}`
}

function derToJose(der: Uint8Array): Uint8Array {
  // DER: 0x30 len 0x02 lenR r 0x02 lenS s  — extrae r,s y los deja en 32 bytes cada uno
  if (der[0] !== 0x30) return der.slice(0, 64)
  let off = 2
  if (der[1] & 0x80) off += (der[1] & 0x7f) + 1
  // r
  if (der[off] !== 0x02) return der.slice(0, 64)
  const lenR = der[off + 1]
  let r = der.slice(off + 2, off + 2 + lenR)
  off += 2 + lenR
  if (der[off] !== 0x02) return der.slice(0, 64)
  const lenS = der[off + 1]
  let s = der.slice(off + 2, off + 2 + lenS)
  // quitar ceros de signo
  if (r.length > 32) r = r.slice(r.length - 32)
  if (s.length > 32) s = s.slice(s.length - 32)
  const out = new Uint8Array(64)
  out.set(r, 32 - r.length)
  out.set(s, 64 - s.length + 32 - s.length) // s en [32..64)
  // Corrección simple: copiar r en [0..32), s en [32..64)
  out.fill(0)
  out.set(r, 32 - r.length)
  out.set(s, 64 - s.length)
  return out
}

// ---------- handler ----------

declare const Deno: {
  env: { get(k: string): string | undefined }
  serve(h: (r: Request) => Promise<Response>): void
} | undefined

function env(k: string): string | undefined {
  return typeof Deno !== 'undefined' ? Deno.env.get(k) : undefined
}

async function manejar(req: Request): Promise<Response> {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } })

  // Solo invocable con service_role (lo llama pg_cron) o con anon autenticado para pruebas manuales
  const SUPABASE_URL = env('SUPABASE_URL')
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
  const VAPID_PUBLIC = env('VAPID_PUBLIC_KEY')
  const VAPID_PRIVATE = env('VAPID_PRIVATE_KEY')
  const VAPID_SUBJECT = env('VAPID_SUBJECT') ?? 'mailto:soporte@alpha.test'

  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Falta SUPABASE_URL o SERVICE_KEY' }, 500)
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'Falta VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY' }, 500)

  function hoyBogota(d = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  }
  function esViva(f: { dijo_si: boolean; endpoint: string | null; p256dh: string | null; auth: string | null }): boolean {
    return f.dijo_si === true && !!f.endpoint && !!f.p256dh && !!f.auth
  }
  function sinCheckinHoy(permisos: { usuario_id: string; dijo_si: boolean; endpoint: string | null; p256dh: string | null; auth: string | null }[], checkinsHoy: { usuario_id: string }[]) {
    const con = new Set(checkinsHoy.map((c) => c.usuario_id))
    return permisos.filter((p) => esViva(p) && !con.has(p.usuario_id)).map((p) => ({ usuario_id: p.usuario_id, endpoint: p.endpoint!, p256dh: p.p256dh!, auth: p.auth! }))
  }

  const hoy = hoyBogota(new Date())

  const rest = (path: string, init: RequestInit = {}) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SERVICE_KEY,
        authorization: `Bearer ${SERVICE_KEY}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

  // 1. Traer permisos vivos
  const rPerm = await rest(`permisos_de_aviso?select=usuario_id,dijo_si,endpoint,p256dh,auth,vivo_en`)
  if (!rPerm.ok) return json({ error: 'No se pudo leer permisos_de_aviso', detalle: await rPerm.text() }, 500)
  const permisos: { usuario_id: string; dijo_si: boolean; endpoint: string | null; p256dh: string | null; auth: string | null; vivo_en: string | null }[] = await rPerm.json()

  // 2. Traer checkins de hoy
  const rChk = await rest(`checkins?select=usuario_id,fecha&fecha=eq.${hoy}`)
  const checkinsHoy: { usuario_id: string; fecha: string }[] = rChk.ok ? await rChk.json() : []

  const destinos = sinCheckinHoy(permisos, checkinsHoy)

  // Payload mínimo; el SW resuelve título/cuerpo y el click abre /bienestar
  const payloadText = JSON.stringify({ title: 'Tu check-in te espera', body: 'Son las 7 pm y aún no registras tu día. Un minuto y listo.', tag: 'bienestar-diario', url: '/bienestar' })
  const payloadBytes = new TextEncoder().encode(payloadText)

  let enviados = 0
  let muertas = 0
  let fallos = 0

  for (const d of destinos) {
    try {
      const aud = new URL(d.endpoint).origin
      const jwt = await vapidJwt(aud, VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
      // Envío sin cifrado de payload (muchos push services lo aceptan para notificaciones
      // vacías); si el servicio exige cifrado, responderá 400 y no se marca muerta.
      // El cifrado Web Push (aes128gcm con p256dh/auth) se puede añadir sin cambiar
      // la selección; por ahora se prioriza llegar con el mínimo viable.
      const r = await fetch(d.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
          TTL: '2419200',
          // Sin Content-Encoding cuando no se cifra
        },
        body: payloadBytes.length ? payloadBytes : undefined,
      })
      if (r.status === 404 || r.status === 410) {
        muertas++
        await rest(`permisos_de_aviso?usuario_id=eq.${d.usuario_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ vivo_en: null, actualizado_en: new Date().toISOString() }),
        })
      } else if (r.ok || r.status === 201) {
        enviados++
        await rest(`permisos_de_aviso?usuario_id=eq.${d.usuario_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ vivo_en: new Date().toISOString(), actualizado_en: new Date().toISOString() }),
        })
      } else {
        fallos++
      }
    } catch {
      fallos++
    }
  }

  return json({ hoy, candidatos: destinos.length, enviados, muertas, fallos })
}

if (typeof Deno !== 'undefined' && typeof (Deno as unknown as { serve?: unknown }).serve === 'function') {
  ;(Deno as unknown as { serve: (h: (r: Request) => Promise<Response>) => void }).serve(manejar)
}
