import { leerPlanLegible } from './planLegible'
import { tablaDelPlan } from './perfilCompleto'
import type { EstadoPrimerPlan, RiesgoPrimerPlan } from './primerPlan'

/**
 * Reglas de la bandeja «Planes estratégicos por aprobar» (migración 0087, decisión de Bryan
 * del 26-sep-2026). Lógica pura: sin React, sin red.
 *
 *   · El borrador que escribe el agente de renovación lo aprueba o rechaza quien tenga
 *     `aprobar_plan_estrategico`, antes de un plazo (24 h).
 *   · Clínico, riesgo alto y lo que ya espera a Bryan solo lo APRUEBA quien tenga además
 *     `autorizar_excepcion`. Rechazar sí puede cualquiera con la capacidad.
 *   · Al vencer, la base (`vencer_plan_estrategico`) deja pasar SOLO riesgo bajo, no
 *     clínico, sin dudas y sin preguntas para Bryan; aquí solo se anuncia.
 *
 * Los estados y riesgos son los mismos que los del primer plan (0086).
 */

export type RiesgoPlanRenovado = RiesgoPrimerPlan
export type EstadoPlanRenovado = EstadoPrimerPlan

export interface PermisosPlanRenovado {
  aprobarPlanEstrategico: boolean
  autorizarExcepcion: boolean
}

export interface QuienDecidePlan {
  puedeAprobar: boolean
  puedeRechazar: boolean
  motivoNoAprobar: string | undefined
}

export function quienDecidePlan(
  fila: { riesgo: RiesgoPlanRenovado; estado: EstadoPlanRenovado; clinico: boolean },
  permisos: PermisosPlanRenovado,
): QuienDecidePlan {
  const pendiente = fila.estado === 'propuesto' || fila.estado === 'espera_bryan'
  if (!pendiente) return { puedeAprobar: false, puedeRechazar: false, motivoNoAprobar: 'Ya está decidido.' }
  if (!permisos.aprobarPlanEstrategico) {
    return {
      puedeAprobar: false,
      puedeRechazar: false,
      motivoNoAprobar: 'Hace falta la capacidad «aprobar plan estratégico».',
    }
  }
  const esDeBryan = fila.clinico || fila.riesgo === 'alto' || fila.estado === 'espera_bryan'
  if (esDeBryan && !permisos.autorizarExcepcion) {
    return {
      puedeAprobar: false,
      puedeRechazar: true,
      motivoNoAprobar: fila.clinico
        ? 'Clínico: lo aprueba Bryan.'
        : fila.riesgo === 'alto'
          ? 'Riesgo alto: lo aprueba Bryan.'
          : 'Ya venció el plazo y espera a Bryan.',
    }
  }
  return { puedeAprobar: true, puedeRechazar: true, motivoNoAprobar: undefined }
}

/** Lo que pasará si nadie decide antes del plazo. Mismo criterio que `vencer_plan_estrategico`. */
export function queOcurreAlVencerPlan(fila: {
  riesgo: RiesgoPlanRenovado
  estado: EstadoPlanRenovado
  clinico: boolean
  dudasPendientes: readonly string[]
  preguntasParaBryan: readonly unknown[]
}): string {
  if (fila.estado === 'espera_bryan') return 'Venció el plazo: espera a Bryan.'
  if (fila.clinico) return 'Clínico: al vencer no pasa solo, esperará a Bryan.'
  if (fila.riesgo === 'bajo' && fila.dudasPendientes.length === 0 && fila.preguntasParaBryan.length === 0) {
    return 'Si nadie decide, pasa solo al vencer y reemplaza al vigente.'
  }
  return 'Al vencer no pasa solo: esperará a Bryan.'
}

// ── Lo que el agente escribe para quien aprueba ─────────────────────────────────────────

export interface Justificacion {
  decision: string
  evidencia: string
}

export interface PreguntaParaBryan {
  pregunta: string
  opciones: string[]
}

function texto(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** `[{decision, evidencia}]`; lo que no tiene esa forma se descarta, no se inventa. */
export function leerJustificacion(valor: unknown): Justificacion[] {
  if (!Array.isArray(valor)) return []
  const lista: Justificacion[] = []
  for (const j of valor) {
    if (typeof j !== 'object' || j === null) continue
    const decision = texto((j as Record<string, unknown>).decision)
    const evidencia = texto((j as Record<string, unknown>).evidencia)
    if (decision) lista.push({ decision, evidencia: evidencia ?? '' })
  }
  return lista
}

/** `[{pregunta, opciones[]}]` (la primera opción es la recomendada). */
export function leerPreguntasParaBryan(valor: unknown): PreguntaParaBryan[] {
  if (!Array.isArray(valor)) return []
  const lista: PreguntaParaBryan[] = []
  for (const p of valor) {
    if (typeof p !== 'object' || p === null) continue
    const pregunta = texto((p as Record<string, unknown>).pregunta)
    const crudas = (p as Record<string, unknown>).opciones
    const opciones = Array.isArray(crudas) ? crudas.map(texto).filter((o): o is string => o !== undefined) : []
    if (pregunta) lista.push({ pregunta, opciones })
  }
  return lista
}

// ── Diferencia entre el vigente y el borrador ─────────────────────────────────────────

export interface FilaDiferencia {
  numero: number
  celdas: string[]
}

export interface ReglaDerogada {
  texto: string
  sustitucion: string | undefined
}

export interface CambioCampo {
  campo: string
  antes: string | undefined
  despues: string | undefined
}

export interface DiferenciaPlanes {
  /** Cabecera del borrador (para pintar las filas). */
  cabecera: string[]
  filasAnadidas: FilaDiferencia[]
  filasCambiadas: (FilaDiferencia & { antes: string[] })[]
  filasQuitadas: FilaDiferencia[]
  reglasAnadidas: string[]
  reglasMantenidas: number
  /** Derogadas NUEVAS en este borrador (las que el vigente ya traía derogadas no cuentan). */
  reglasDerogadas: ReglaDerogada[]
  /** Reglas vivas del vigente que el borrador ni mantiene ni deroga: se pierden sin decirlo. */
  reglasPerdidas: string[]
  campos: CambioCampo[]
  /** true si no hay vigente con el que comparar (todo el borrador es «nuevo»). */
  sinVigente: boolean
}

function derogadasConSustitucion(contenido: unknown): ReglaDerogada[] {
  if (typeof contenido !== 'object' || contenido === null) return []
  const lista = (contenido as Record<string, unknown>).reglas_derogadas
  if (!Array.isArray(lista)) return []
  const out: ReglaDerogada[] = []
  for (const r of lista) {
    if (typeof r !== 'object' || r === null) continue
    const t = texto((r as Record<string, unknown>).texto)
    if (t) out.push({ texto: t, sustitucion: texto((r as Record<string, unknown>).sustitucion) })
  }
  return out
}

function normal(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Qué cambia del vigente al borrador: filas de la tabla (añadidas, cambiadas, quitadas),
 * reglas (añadidas, derogadas con su sustitución, y las que se pierden sin derogar) y los
 * campos de cabecera (objetivo, métrica, horizonte). Compara por texto normalizado.
 */
export function diferenciaPlanes(vigente: unknown | null, borrador: unknown): DiferenciaPlanes {
  const lb = leerPlanLegible(borrador)
  const tb = tablaDelPlan(borrador, undefined)
  const sinVigente = vigente === null || vigente === undefined
  const lv = leerPlanLegible(sinVigente ? null : vigente)
  const tv = sinVigente ? undefined : tablaDelPlan(vigente, undefined)

  const filasV = new Map((tv?.filas ?? []).map((f) => [f.numero, f.celdas]))
  const filasB = new Map((tb?.filas ?? []).map((f) => [f.numero, f.celdas]))
  const filasAnadidas: FilaDiferencia[] = []
  const filasCambiadas: (FilaDiferencia & { antes: string[] })[] = []
  for (const [numero, celdas] of filasB) {
    const antes = filasV.get(numero)
    if (!antes) filasAnadidas.push({ numero, celdas })
    else if (antes.map(normal).join('|') !== celdas.map(normal).join('|')) filasCambiadas.push({ numero, celdas, antes })
  }
  const filasQuitadas: FilaDiferencia[] = []
  for (const [numero, celdas] of filasV) if (!filasB.has(numero)) filasQuitadas.push({ numero, celdas })

  const vivasV = new Set(lv.reglas.map(normal))
  const vivasB = new Set(lb.reglas.map(normal))
  const derogadasV = new Set(lv.reglasDerogadas.map(normal))
  const derogadasB = derogadasConSustitucion(borrador)
  const reglasDerogadas = derogadasB.filter((r) => !derogadasV.has(normal(r.texto)))
  const derogadasBSet = new Set(derogadasB.map((r) => normal(r.texto)))

  const reglasAnadidas = lb.reglas.filter((r) => !vivasV.has(normal(r)))
  const reglasMantenidas = lb.reglas.length - reglasAnadidas.length
  const reglasPerdidas = lv.reglas.filter((r) => !vivasB.has(normal(r)) && !derogadasBSet.has(normal(r)))

  const campos: CambioCampo[] = []
  const pares: [string, string | undefined, string | undefined][] = [
    ['Objetivo', lv.objetivo, lb.objetivo],
    ['Métrica principal', lv.metricaPrincipal, lb.metricaPrincipal],
    ['Horizonte', lv.horizonte, lb.horizonte],
  ]
  for (const [campo, antes, despues] of pares) {
    if (normal(antes ?? '') !== normal(despues ?? '')) campos.push({ campo, antes, despues })
  }

  return {
    cabecera: tb?.cabecera ?? tv?.cabecera ?? [],
    filasAnadidas,
    filasCambiadas,
    filasQuitadas,
    reglasAnadidas,
    reglasMantenidas,
    reglasDerogadas,
    reglasPerdidas,
    campos,
    sinVigente,
  }
}
