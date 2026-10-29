// Edge Function avisos-plan: QUÉ alertas nutricionales hay que levantar o retirar. Módulo puro,
// sin red ni base (la parte con red está en alertasNutriEnvio.ts).
//
// Las reglas y los umbrales NO se repiten aquí: se importan de src/domain (hambre.ts y energia.ts),
// los mismos que escribió la nutricionista. Aquí solo se arma la serie diaria y se decide qué
// está vigente. Todo va detrás de un interruptor por alerta (tabla alertas_nutricion_ajustes,
// apagado por defecto, migración 0148).

import { TOLERANCIA_DIAS_SIN_CONFIRMAR, TRAMOS, evaluarRacha, type RegistroHambre } from '../../../src/domain/senales/hambre.ts'
import { objetivoInsuficiente } from '../../../src/domain/nutricion/energia.ts'

export type ClaveAlerta = 'objetivo_insuficiente' | 'hambre_sostenida'

/**
 * Cuántos días hacia atrás se miran los check-ins. No es un umbral clínico: es solo la ventana de
 * lectura, y debe cubrir el tramo más largo (21 días) con su tolerancia.
 */
export const VENTANA_HAMBRE_DIAS = 30

export interface FilaHambre {
  usuario_id: string
  fecha: string // YYYY-MM-DD
  hambre_escala: number | string | null
}

export interface MacrosFila {
  kcal: number
  proteinaG: number
  carbosG: number
  grasaG: number
}

export interface PlanFila {
  usuario_id: string
  actualizado_en: string
  macros: Record<string, MacrosFila> | null
}

export interface AbiertaFila {
  id: string
  asesorado_id: string
  clave: ClaveAlerta
}

export interface EntradaAlertas {
  hoy: string // YYYY-MM-DD, día local
  encendidas: readonly ClaveAlerta[]
  hambre: readonly FilaHambre[]
  planes: readonly PlanFila[]
  abiertas: readonly AbiertaFila[]
}

export interface AlertaNueva {
  asesorado_id: string
  clave: ClaveAlerta
  /** Solo se ve dentro de la app. Nunca viaja en el aviso del teléfono. */
  detalle: string
}

export interface DecisionAlertas {
  crear: AlertaNueva[]
  /** id de las filas abiertas que ya no están vigentes (o cuya alerta se apagó). */
  resolver: string[]
}

function diaAtras(hoy: string, n: number): string {
  const d = new Date(`${hoy}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function escalaValida(v: number | string | null): number | null {
  if (v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null
}

function enElTramo(hambre: number | null, etiqueta: string): boolean {
  if (hambre === null) return false
  const t = TRAMOS.find((x) => hambre >= x.bajo && hambre <= x.alto)
  return t?.etiqueta === etiqueta
}

/** Personas con hambre sostenida VIGENTE, con su texto. */
function hambreVigente(hoy: string, filas: readonly FilaHambre[]): Map<string, string> {
  const porPersona = new Map<string, Map<string, number | null>>()
  for (const f of filas) {
    const m = porPersona.get(f.usuario_id) ?? new Map<string, number | null>()
    m.set(f.fecha, escalaValida(f.hambre_escala))
    porPersona.set(f.usuario_id, m)
  }
  const salida = new Map<string, string>()
  for (const [usuario, dias] of porPersona) {
    const serie: RegistroHambre[] = []
    for (let i = VENTANA_HAMBRE_DIAS - 1; i >= 0; i--) {
      const fecha = diaAtras(hoy, i)
      serie.push({ fecha, hambre: dias.get(fecha) ?? null })
    }
    const v = evaluarRacha(serie)
    if (!v.cumplido || !v.tramo) continue
    // Vigente: la racha no se rompió al final (más días sin ese tramo que la tolerancia).
    const cola = serie.slice(-(TOLERANCIA_DIAS_SIN_CONFIRMAR + 1))
    if (cola.every((r) => !enElTramo(r.hambre, v.tramo as string))) continue
    salida.set(usuario, `Hambre ${v.tramo} sostenida: se cumplieron ${v.diasExigidos} días (desde el ${v.fechaCumplimiento}).`)
  }
  return salida
}

function finito(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** Personas cuyo plan MÁS RECIENTE tiene algún tipo de día con el objetivo insuficiente. */
function objetivoInsuficienteVigente(planes: readonly PlanFila[]): Map<string, string> {
  const ultimo = new Map<string, PlanFila>()
  for (const p of planes) {
    const previo = ultimo.get(p.usuario_id)
    if (!previo || p.actualizado_en > previo.actualizado_en) ultimo.set(p.usuario_id, p)
  }
  const salida = new Map<string, string>()
  for (const [usuario, p] of ultimo) {
    if (!p.macros) continue
    const dias: string[] = []
    for (const [tipo, m] of Object.entries(p.macros)) {
      if (!m || !finito(m.kcal) || !finito(m.proteinaG) || !finito(m.grasaG)) continue
      if (objetivoInsuficiente({ kcal: m.kcal, proteinaG: m.proteinaG, carbosG: finito(m.carbosG) ? m.carbosG : 0, grasaG: m.grasaG })) {
        dias.push(tipo)
      }
    }
    if (dias.length > 0) {
      salida.set(usuario, `El objetivo calórico del plan no alcanza para la proteína y la grasa mínimas (días: ${dias.join(', ')}).`)
    }
  }
  return salida
}

export function decidirAlertasNutri(e: EntradaAlertas): DecisionAlertas {
  const vigentes = new Map<ClaveAlerta, Map<string, string>>()
  if (e.encendidas.includes('hambre_sostenida')) vigentes.set('hambre_sostenida', hambreVigente(e.hoy, e.hambre))
  if (e.encendidas.includes('objetivo_insuficiente')) vigentes.set('objetivo_insuficiente', objetivoInsuficienteVigente(e.planes))

  const crear: AlertaNueva[] = []
  const abiertasSet = new Set(e.abiertas.map((a) => `${a.clave}|${a.asesorado_id}`))
  for (const [clave, personas] of vigentes) {
    for (const [asesorado_id, detalle] of personas) {
      if (!abiertasSet.has(`${clave}|${asesorado_id}`)) crear.push({ asesorado_id, clave, detalle })
    }
  }
  const resolver = e.abiertas
    .filter((a) => !vigentes.get(a.clave)?.has(a.asesorado_id))
    .map((a) => a.id)
  return { crear, resolver }
}

/** El aviso del teléfono: neutro a propósito. El detalle solo se ve dentro de la app, con sesión. */
export function textoDelAviso(): { titulo: string; cuerpo: string; url: string; tag: string } {
  return {
    titulo: 'Tienes una alerta nueva de un asesorado',
    cuerpo: 'Ábrela en la app para ver el detalle.',
    url: '/equipo-nutricion',
    tag: 'alertas-nutricion',
  }
}
