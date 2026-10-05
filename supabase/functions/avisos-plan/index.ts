// Edge Function: avisos-plan
// Envía Web Push (VAPID) del organizador SOLO al dueño (Bryan / Manuela). La llama un cron (ver
// organizador-NOTAS.md). Se entrega copiando esta carpeta (index.ts + decidir.ts) a Supabase.
//
// Variables de entorno (ninguna vive en el repo):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   las pone Supabase
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY       par VAPID (la pública es la misma que usa la app)
//   VAPID_SUBJECT                             'mailto:…' (opcional)
//   AVISOS_HORA_BRYAN, AVISOS_HORA_MANUELA    'HH:MM' Bogotá (opcional, por defecto 08:00)
//   AVISOS_USUARIO_BRYAN, AVISOS_USUARIO_MANUELA  UUID de usuarios_app (opcional; por defecto los de la 0098)
//
// Solo acepta la clave de servicio en Authorization. Sin datos de salud: solo título y primer paso.

import { decidirAvisos, relojLocal, ZONA, type Dueno, type TareaAviso } from './decidir.ts'

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void }

const env = (k: string) => Deno.env.get(k)

const USUARIOS: Record<Dueno, string> = {
  bryan: env('AVISOS_USUARIO_BRYAN') ?? '28c3cfe8-13ef-4f3e-95cc-f23c4f260bce',
  manuela: env('AVISOS_USUARIO_MANUELA') ?? 'aa202ff5-74c1-4b76-9140-8ba44dc62f17',
}

interface Suscripcion {
  usuario_id: string
  endpoint: string
  p256dh: string
  auth: string
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

async function manejar(req: Request): Promise<Response> {
  const base = env('SUPABASE_URL')
  const clave = env('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPub = env('VAPID_PUBLIC_KEY')
  const vapidPriv = env('VAPID_PRIVATE_KEY')
  if (!base || !clave || !vapidPub || !vapidPriv) return json({ error: 'falta configuración' }, 500)
  if (req.headers.get('Authorization') !== `Bearer ${clave}`) return json({ error: 'no autorizado' }, 401)

  const rest = (ruta: string, init: RequestInit = {}) =>
    fetch(`${base}/rest/v1/${ruta}`, {
      ...init,
      headers: {
        apikey: clave,
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

  const ahora = new Date()
  const { dia } = relojLocal(ahora, ZONA)
  const ids = Object.values(USUARIOS).join(',')

  const rSubs = await rest(
    `permisos_de_aviso?usuario_id=in.(${ids})&dijo_si=eq.true&endpoint=not.is.null&p256dh=not.is.null&auth=not.is.null&select=usuario_id,endpoint,p256dh,auth`,
  )
  if (!rSubs.ok) return json({ error: 'no se leyeron las suscripciones' }, 502)
  const subs = (await rSubs.json()) as Suscripcion[]
  const duenos = (Object.keys(USUARIOS) as Dueno[]).filter((d) => subs.some((s) => s.usuario_id === USUARIOS[d]))
  if (duenos.length === 0) return json({ enviados: 0, motivo: 'sin suscripciones vivas' })

  const rTareas = await rest(
    `plan_items?nivel=eq.tarea&estado=in.(pendiente,en_curso)&fecha=lte.${dia}&dueno=in.(${duenos.join(',')})` +
      '&select=id,dueno,titulo,primer_paso,fecha,estado,prioridad,veces_movida,actualizado_en',
  )
  const rHechos = await rest(`avisos_plan_enviados?fecha_aviso=eq.${dia}&select=item_id`)
  if (!rTareas.ok || !rHechos.ok) return json({ error: 'no se leyó el plan' }, 502)
  const tareas = (await rTareas.json()) as TareaAviso[]
  const enviadosHoy = new Set(((await rHechos.json()) as { item_id: string }[]).map((x) => x.item_id))

  const avisos = decidirAvisos({
    tareas,
    ahora,
    horas: { bryan: env('AVISOS_HORA_BRYAN'), manuela: env('AVISOS_HORA_MANUELA') },
    duenosConSuscripcion: duenos,
    enviadosHoy,
  })

  const webpush = (await import('npm:web-push@3.6.7')).default
  webpush.setVapidDetails(env('VAPID_SUBJECT') ?? 'mailto:avisos@alpha.local', vapidPub, vapidPriv)

  let enviados = 0
  let caducadas = 0
  let fallos = 0
  for (const a of avisos) {
    // Se reserva el aviso ANTES de enviarlo: el índice único (item_id, fecha_aviso) impide el duplicado
    // aunque dos corridas se pisen. Si la fila ya existe, no vuelve nada y se salta.
    const reserva = await rest('avisos_plan_enviados', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ dueno: a.dueno, tipo: a.tipo, item_id: a.item_id, fecha_aviso: a.fecha_aviso }),
    })
    if (!reserva.ok) {
      fallos++
      continue
    }
    const filas = (await reserva.json()) as { id: string }[]
    if (filas.length === 0) continue

    const s = subs.find((x) => x.usuario_id === USUARIOS[a.dueno])!
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, tag: `plan-${a.item_id}` }),
        { TTL: 60 * 60 * 6 },
      )
      enviados++
      await rest(`permisos_de_aviso?usuario_id=eq.${s.usuario_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ vivo_en: new Date().toISOString() }),
      })
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode
      if (codigo === 404 || codigo === 410) {
        // Suscripción caducada: se marca inactiva (sin endpoint ni claves) y el aviso queda registrado.
        caducadas++
        await rest(`permisos_de_aviso?usuario_id=eq.${s.usuario_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ endpoint: null, p256dh: null, auth: null }),
        })
      } else {
        // Fallo pasajero: se libera la reserva para que la próxima corrida lo reintente.
        fallos++
        await rest(`avisos_plan_enviados?id=eq.${filas[0].id}`, { method: 'DELETE' })
      }
    }
  }
  return json({ dia, candidatos: avisos.length, enviados, caducadas, fallos })
}

Deno.serve(manejar)
