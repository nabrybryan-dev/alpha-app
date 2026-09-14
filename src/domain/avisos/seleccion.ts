/** Selección de a quién avisar — lógica pura separada del envío. */

export function hoyBogota(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(d)
}

export interface FilaPermiso {
  usuario_id: string
  dijo_si: boolean
  endpoint: string | null
  p256dh: string | null
  auth: string | null
  vivo_en: string | null
}

export interface FilaCheckin { usuario_id: string; fecha: string }

export interface SuscripcionViva { usuario_id: string; endpoint: string; p256dh: string; auth: string }

export function esViva(f: FilaPermiso): boolean {
  return f.dijo_si === true && !!f.endpoint && !!f.p256dh && !!f.auth
}

export function sinCheckinHoy(suscripciones: FilaPermiso[], checkinsHoy: FilaCheckin[]): SuscripcionViva[] {
  const conCheckin = new Set(checkinsHoy.map((c) => c.usuario_id))
  const out: SuscripcionViva[] = []
  for (const f of suscripciones) {
    if (!esViva(f)) continue
    if (conCheckin.has(f.usuario_id)) continue
    out.push({ usuario_id: f.usuario_id, endpoint: f.endpoint!, p256dh: f.p256dh!, auth: f.auth! })
  }
  return out
}

export function esMuerta(status: number): boolean {
  return status === 404 || status === 410
}
