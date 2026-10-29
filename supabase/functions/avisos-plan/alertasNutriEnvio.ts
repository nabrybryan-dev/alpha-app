// Edge Function avisos-plan: la parte con red de las alertas nutricionales. Nunca lanza: si algo
// falla devuelve { alertasNutri: 'error' } y el resto de avisos-plan sigue como antes.
//
// Con todo apagado (lo normal hasta que Manuela firme) hace UNA lectura (los ajustes) y sale.
// Avisa SOLO a Manuela, con un texto neutro; si el teléfono falla, la alerta queda sin `avisada_en`
// y el próximo cron reintenta (un solo push por corrida, sea cual sea el número de alertas nuevas).

import { decidirAlertasNutri, textoDelAviso, VENTANA_HAMBRE_DIAS, type ClaveAlerta } from './alertasNutri.ts'

export type Rest = (ruta: string, init?: RequestInit) => Promise<Response>

export interface Suscripcion {
  endpoint: string
  p256dh: string
  auth: string
}

export interface EntradaEnvio {
  rest: Rest
  hoy: string
  /** UUID de Manuela en usuarios_app. */
  manuelaId: string
  /** Envía el push; lanza con { statusCode } si falla. */
  enviar: (s: Suscripcion, carga: string) => Promise<void>
}

const CLAVES: readonly ClaveAlerta[] = ['objetivo_insuficiente', 'hambre_sostenida']
const PAGINA = 1000

async function leerTodo<T>(rest: Rest, ruta: string): Promise<T[]> {
  const todo: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const r = await rest(`${ruta}&limit=${PAGINA}&offset=${desde}`)
    if (!r.ok) throw new Error(`lectura fallida: ${ruta.split('?')[0]}`)
    const filas = (await r.json()) as T[]
    todo.push(...filas)
    if (filas.length < PAGINA) return todo
  }
}

function diaAtras(hoy: string, n: number): string {
  const d = new Date(`${hoy}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function correrAlertasNutri(e: EntradaEnvio): Promise<Record<string, unknown>> {
  try {
    const ajustes = await leerTodo<{ clave: ClaveAlerta; encendida: boolean }>(
      e.rest,
      'alertas_nutricion_ajustes?select=clave,encendida&order=clave',
    )
    const encendidas = ajustes.filter((a) => a.encendida && CLAVES.includes(a.clave)).map((a) => a.clave)

    const abiertas = await leerTodo<{ id: string; asesorado_id: string; clave: ClaveAlerta; avisada_en: string | null }>(
      e.rest,
      'alertas_nutricion?resuelta_en=is.null&select=id,asesorado_id,clave,avisada_en&order=creada_en',
    )
    if (encendidas.length === 0 && abiertas.length === 0) return { alertasNutri: 'apagadas' }

    const hambre = encendidas.includes('hambre_sostenida')
      ? await leerTodo<{ usuario_id: string; fecha: string; hambre_escala: string | null }>(
          e.rest,
          `checkins?fecha=gte.${diaAtras(e.hoy, VENTANA_HAMBRE_DIAS)}&select=usuario_id,fecha,hambre_escala:datos->>hambreEscala&order=id`,
        )
      : []
    const planes = encendidas.includes('objetivo_insuficiente')
      ? await leerTodo<{ usuario_id: string; actualizado_en: string; macros: Record<string, never> | null }>(
          e.rest,
          'planes_nutricionales?select=usuario_id,actualizado_en,macros:datos->macrosPorDia&order=id',
        )
      : []

    const d = decidirAlertasNutri({ hoy: e.hoy, encendidas, hambre, planes, abiertas })

    if (d.resolver.length > 0) {
      const rp = await e.rest(`alertas_nutricion?id=in.(${d.resolver.join(',')})`, {
        method: 'PATCH',
        body: JSON.stringify({ resuelta_en: new Date().toISOString() }),
      })
      if (!rp.ok) throw new Error(`no se pudieron retirar las alertas (${rp.status})`)
    }
    let nuevas: { id: string }[] = []
    if (d.crear.length > 0) {
      const r = await e.rest('alertas_nutricion', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(d.crear),
      })
      if (!r.ok) throw new Error(`no se pudieron crear las alertas (${r.status})`)
      nuevas = (await r.json()) as { id: string }[]
    }

    // Pendientes de avisar: las nuevas y las que quedaron sin aviso en una corrida anterior.
    const resolverSet = new Set(d.resolver)
    const pendientes = [
      ...abiertas.filter((a) => a.avisada_en === null && !resolverSet.has(a.id)).map((a) => a.id),
      ...nuevas.map((n) => n.id),
    ]
    const resumen = { alertasNutri: 'ok', creadas: nuevas.length, retiradas: d.resolver.length }
    if (pendientes.length === 0) return { ...resumen, push: 0 }

    const rs = await e.rest(
      `permisos_de_aviso?usuario_id=eq.${e.manuelaId}&dijo_si=eq.true&endpoint=not.is.null&p256dh=not.is.null&auth=not.is.null&select=endpoint,p256dh,auth`,
    )
    const subs = rs.ok ? ((await rs.json()) as Suscripcion[]) : []
    if (subs.length === 0) return { ...resumen, push: 0, motivo: 'Manuela sin suscripcion' }

    try {
      await e.enviar(subs[0], JSON.stringify(textoDelAviso()))
    } catch (err) {
      const codigo = (err as { statusCode?: number }).statusCode
      if (codigo === 404 || codigo === 410) {
        await e.rest(`permisos_de_aviso?usuario_id=eq.${e.manuelaId}`, {
          method: 'PATCH',
          body: JSON.stringify({ endpoint: null, p256dh: null, auth: null }),
        })
      }
      return { ...resumen, push: 0, motivo: 'fallo del envio' }
    }
    const ra = await e.rest(`alertas_nutricion?id=in.(${pendientes.join(',')})`, {
      method: 'PATCH',
      body: JSON.stringify({ avisada_en: new Date().toISOString() }),
    })
    if (!ra.ok) return { alertasNutri: 'error', motivo: `push enviado pero no se marcó avisada_en (${ra.status})`, push: 1 }
    return { ...resumen, push: 1 }
  } catch (err) {
    return { alertasNutri: 'error', motivo: err instanceof Error ? err.message : 'desconocido' }
  }
}
