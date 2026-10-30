// Edge Function: avisos-plan
// Envía Web Push (VAPID). Dos cosas, las dos con una suscripción viva en `permisos_de_aviso`:
//   1. El organizador, SOLO al dueño (Bryan / Manuela).
//   2. El recordatorio del check-in de las 6 pm (hora de Bogotá) a los asesorados y a la nutricionista que aún no lo ha llenado hoy, aunque la
//      app esté cerrada. Su registro vive en `avisos_checkin_enviados` (migración 0146; si no está
//      aplicada, la reserva falla y no se envía nada).
// La llama un cron (ver organizador-NOTAS.md). Se despliega con `supabase functions deploy avisos-plan` desde la RAÍZ del repo (importa de src/domain;
// pegar index.ts y decidir.ts en el editor ya no basta).
//
// Variables de entorno (ninguna vive en el repo):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   las pone Supabase
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY       par VAPID (la pública es la misma que usa la app)
//   VAPID_SUBJECT                             'mailto:…' (opcional)
//   AVISOS_HORA_BRYAN, AVISOS_HORA_MANUELA    'HH:MM' Bogotá (opcional, por defecto 08:00)
//   AVISOS_USUARIO_BRYAN, AVISOS_USUARIO_MANUELA  UUID de usuarios_app (opcional; por defecto los de la 0098)
//
// Solo acepta la clave de servicio en Authorization. Sin datos de salud: solo título y primer paso.

import { correrAlertasNutri } from './alertasNutriEnvio.ts'
import { autorizarLlamada, decidirAvisos, decidirRecordatoriosCheckin, destinatariosDelPlan, lotesDeIds, ROLES_DEL_RECORDATORIO_CHECKIN, relojLocal, ZONA, type Dueno, type TareaAviso } from './decidir.ts'

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

type Resultado = 'enviado' | 'caducada' | 'fallo'

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

async function manejar(req: Request): Promise<Response> {
  const base = env('SUPABASE_URL')
  const clave = env('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPub = env('VAPID_PUBLIC_KEY')
  const vapidPriv = env('VAPID_PRIVATE_KEY')
  if (!base || !clave || !vapidPub || !vapidPriv) return json({ error: 'falta configuración' }, 500)
  // Solo Auth acepta listar usuarios con una clave de servicio: es la pregunta, sin leer datos de nadie.
  const esClaveDeServicio = async (t: string) =>
    (await fetch(`${base}/auth/v1/admin/users?page=1&per_page=1`, { headers: { apikey: t, Authorization: `Bearer ${t}` } })).ok
  if (!(await autorizarLlamada(req.headers.get('Authorization'), clave, esClaveDeServicio))) return json({ error: 'no autorizado' }, 401)

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

  // Todas las suscripciones vivas (una por persona): los dos dueños y el resto comparten tabla.
  // Alertas nutricionales (0148): apagadas por defecto; nunca lanza. Ver alertasNutriEnvio.ts.
  console.log(JSON.stringify(await correrAlertasNutri({ rest, hoy: dia, manuelaId: USUARIOS.manuela, enviar: async (s, c) => { const wp = (await import('npm:web-push@3.6.7')).default; wp.setVapidDetails(env('VAPID_SUBJECT') ?? 'mailto:avisos@alpha.local', vapidPub, vapidPriv); await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, c, { TTL: 60 * 60 * 6 }) } })))


  const rSubs = await rest(
    'permisos_de_aviso?dijo_si=eq.true&endpoint=not.is.null&p256dh=not.is.null&auth=not.is.null&select=usuario_id,endpoint,p256dh,auth',
  )
  if (!rSubs.ok) return json({ error: 'no se leyeron las suscripciones' }, 502)
  const subs = (await rSubs.json()) as Suscripcion[]
  if (subs.length === 0) return json({ enviados: 0, motivo: 'sin suscripciones vivas' })

  const webpush = (await import('npm:web-push@3.6.7')).default
  webpush.setVapidDetails(env('VAPID_SUBJECT') ?? 'mailto:avisos@alpha.local', vapidPub, vapidPriv)

  const enviar = async (s: Suscripcion, carga: unknown): Promise<Resultado> => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(carga),
        { TTL: 60 * 60 * 6 },
      )
      await rest(`permisos_de_aviso?usuario_id=eq.${s.usuario_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ vivo_en: new Date().toISOString() }),
      })
      return 'enviado'
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode
      if (codigo === 404 || codigo === 410) {
        // Suscripción caducada: se marca inactiva (sin endpoint ni claves) y el aviso queda registrado.
        await rest(`permisos_de_aviso?usuario_id=eq.${s.usuario_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ endpoint: null, p256dh: null, auth: null }),
        })
        return 'caducada'
      }
      return 'fallo'
    }
  }

  let enviados = 0
  let caducadas = 0
  let fallos = 0
  let candidatos = 0
  let recordatorios = 0
  const cuenta = (r: Resultado) => {
    if (r === 'enviado') enviados++
    else if (r === 'caducada') caducadas++
    else fallos++
  }

  // ---- 1 · El plan del dueño (Bryan y Manuela) ----
  const duenos = destinatariosDelPlan(subs.map((s) => s.usuario_id), USUARIOS)
  if (duenos.length > 0) {
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
    candidatos += avisos.length

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
      const r = await enviar(s, { titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, tag: `plan-${a.item_id}` })
      cuenta(r)
      // Fallo pasajero: se libera la reserva para que la próxima corrida lo reintente.
      if (r === 'fallo') await rest(`avisos_plan_enviados?id=eq.${filas[0].id}`, { method: 'DELETE' })
    }
  }

  // ---- 2 · El recordatorio del check-in de las 6 pm, para toda persona con suscripción viva ----
  // Las tres lecturas van por lotes de ids (la URL no crece sin tope) y, si una falla, queda dicho cuál en `lecturasFallidas`.
  const lotes = lotesDeIds(subs.map((s) => s.usuario_id))
  const lecturasFallidas: string[] = []
  const leer = async <T>(nombre: string, ruta: (ids: string) => string): Promise<T[]> => {
    const filas: T[] = []
    for (const lote of lotes) {
      const r = await rest(ruta(lote.join(',')))
      if (!r.ok) {
        lecturasFallidas.push(nombre)
        break
      }
      filas.push(...((await r.json()) as T[]))
    }
    return filas
  }
  // El recordatorio va a asesorados y a la nutricionista con suscripción (Bryan, 29-oct); el coach no lo recibe.
  const usuarios = await leer<{ id: string }>('usuarios_app', (ids) => `usuarios_app?id=in.(${ids})&rol=in.(${ROLES_DEL_RECORDATORIO_CHECKIN.join(',')})&select=id`)
  const checkins = await leer<{ usuario_id: string }>('checkins', (ids) => `checkins?fecha=eq.${dia}&usuario_id=in.(${ids})&select=usuario_id`)
  const rYa = await rest(`avisos_checkin_enviados?fecha_aviso=eq.${dia}&select=usuario_id`)
  if (!rYa.ok) lecturasFallidas.push('avisos_checkin_enviados')
  if (lecturasFallidas.length === 0) {
    const elegibles = usuarios.map((x) => x.id)
    const conCheckinHoy = new Set(checkins.map((x) => x.usuario_id))
    const yaAvisados = new Set(((await rYa.json()) as { usuario_id: string }[]).map((x) => x.usuario_id))
    const recordar = decidirRecordatoriosCheckin({ ahora, suscritos: elegibles, conCheckinHoy, enviadosHoy: yaAvisados })
    candidatos += recordar.length

    for (const a of recordar) {
      const reserva = await rest('avisos_checkin_enviados', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ usuario_id: a.usuario_id, fecha_aviso: a.fecha_aviso }),
      })
      // Sin la migración 0146 la reserva falla y NO se envía: mejor callar que avisar dos veces.
      if (!reserva.ok) {
        fallos++
        continue
      }
      const filas = (await reserva.json()) as { id: string }[]
      if (filas.length === 0) continue

      const s = subs.find((x) => x.usuario_id === a.usuario_id)!
      const r = await enviar(s, { titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, tag: 'checkin-diario' })
      cuenta(r)
      if (r === 'enviado') recordatorios++
      if (r === 'fallo') await rest(`avisos_checkin_enviados?id=eq.${filas[0].id}`, { method: 'DELETE' })
    }
  } else {
    fallos++
  }
  return json({ dia, candidatos, enviados, recordatorios, caducadas, fallos, lecturasFallidas })
}

Deno.serve(manejar)
