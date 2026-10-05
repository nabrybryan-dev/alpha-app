/**
 * Reglas de la bandeja «Primeros planes por aprobar» (migración 0086, decisión de Bryan del
 * 26-sep-2026). Lógica pura: sin React, sin red.
 *
 *   · Quien tiene `aprobar_primer_plan` aprueba o rechaza el PRIMER plan de un cliente
 *     nuevo antes de un plazo.
 *   · Riesgo `alto` (lo clínico) y lo que ya pasó a `espera_bryan` solo lo aprueba quien
 *     tenga además `autorizar_excepcion`. Rechazar sí puede cualquiera con la capacidad.
 *   · Al vencer el plazo, la base (`vencer_primer_plan`) deja pasar SOLO riesgo bajo sin
 *     dudas; aquí solo se anuncia lo que va a pasar, no se decide.
 *
 * El servidor es quien manda (la RPC rechaza lo que no toca); esto existe para que la
 * pantalla no ofrezca un botón que la base va a rechazar.
 */

export type RiesgoPrimerPlan = 'bajo' | 'medio' | 'alto'
export type EstadoPrimerPlan = 'propuesto' | 'aprobado' | 'rechazado' | 'vencido_aprobado' | 'espera_bryan'

export interface CuentaAtras {
  vencido: boolean
  /** Quedan menos de 6 horas (o ya venció): pide atención. */
  urgente: boolean
  /** «quedan 1 d 4 h», «quedan 35 min», «venció hace 2 h». */
  texto: string
}

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA
const UMBRAL_URGENTE = 6 * HORA

function duracionLegible(ms: number): string {
  if (ms < HORA) return `${Math.max(1, Math.floor(ms / MINUTO))} min`
  if (ms < DIA) {
    const horas = Math.floor(ms / HORA)
    const minutos = Math.floor((ms % HORA) / MINUTO)
    return minutos > 0 ? `${horas} h ${minutos} min` : `${horas} h`
  }
  const dias = Math.floor(ms / DIA)
  const horas = Math.floor((ms % DIA) / HORA)
  return horas > 0 ? `${dias} d ${horas} h` : `${dias} d`
}

/** Cuenta atrás hasta `plazoIso`. Una fecha ilegible no se inventa: se dice. */
export function cuentaAtras(plazoIso: string, ahoraMs: number): CuentaAtras {
  const plazo = Date.parse(plazoIso)
  if (Number.isNaN(plazo)) return { vencido: false, urgente: false, texto: 'plazo sin fecha legible' }
  const resto = plazo - ahoraMs
  if (resto <= 0) return { vencido: true, urgente: true, texto: `venció hace ${duracionLegible(-resto)}` }
  return { vencido: false, urgente: resto < UMBRAL_URGENTE, texto: `quedan ${duracionLegible(resto)}` }
}

export interface PermisosPrimerPlan {
  aprobarPrimerPlan: boolean
  autorizarExcepcion: boolean
}

export interface QuienDecide {
  puedeAprobar: boolean
  puedeRechazar: boolean
  /** Por qué no se puede aprobar, en llano; `undefined` si se puede. */
  motivoNoAprobar: string | undefined
}

export function quienDecide(
  fila: { riesgo: RiesgoPrimerPlan; estado: EstadoPrimerPlan },
  permisos: PermisosPrimerPlan,
): QuienDecide {
  const pendiente = fila.estado === 'propuesto' || fila.estado === 'espera_bryan'
  if (!pendiente) return { puedeAprobar: false, puedeRechazar: false, motivoNoAprobar: 'Ya está decidido.' }
  if (!permisos.aprobarPrimerPlan) {
    return { puedeAprobar: false, puedeRechazar: false, motivoNoAprobar: 'Hace falta la capacidad «aprobar primer plan».' }
  }
  const esDeBryan = fila.riesgo === 'alto' || fila.estado === 'espera_bryan'
  if (esDeBryan && !permisos.autorizarExcepcion) {
    return {
      puedeAprobar: false,
      puedeRechazar: true,
      motivoNoAprobar:
        fila.riesgo === 'alto'
          ? 'Riesgo alto (clínico): lo aprueba Bryan.'
          : 'Ya venció el plazo y espera a Bryan.',
    }
  }
  return { puedeAprobar: true, puedeRechazar: true, motivoNoAprobar: undefined }
}

/** Lo que pasará si nadie decide antes del plazo — para que no sea una sorpresa. */
export function queOcurreAlVencer(fila: {
  riesgo: RiesgoPrimerPlan
  estado: EstadoPrimerPlan
  dudasPendientes: readonly string[]
}): string {
  if (fila.estado === 'espera_bryan') return 'Venció el plazo: espera a Bryan.'
  if (fila.riesgo === 'bajo' && fila.dudasPendientes.length === 0) return 'Si nadie decide, pasa solo al vencer.'
  return 'Al vencer no pasa solo: esperará a Bryan.'
}

/** Primero lo que espera a Bryan, luego el plazo más cercano. Copia, no muta. */
export function ordenarBandeja<T extends { estado: EstadoPrimerPlan; plazoHasta: string }>(filas: readonly T[]): T[] {
  return [...filas].sort((a, b) => {
    const ea = a.estado === 'espera_bryan' ? 0 : 1
    const eb = b.estado === 'espera_bryan' ? 0 : 1
    if (ea !== eb) return ea - eb
    return (Date.parse(a.plazoHasta) || 0) - (Date.parse(b.plazoHasta) || 0)
  })
}

export interface EjercicioResumido {
  nombre: string
  detalle: string
}

export interface SesionResumida {
  nombre: string
  ejercicios: EjercicioResumido[]
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined
}

function detalleEjercicio(e: Record<string, unknown>): string {
  const prescripcion = texto(e.prescripcion)
  if (prescripcion) return prescripcion
  const sets = typeof e.sets === 'number' ? e.sets : undefined
  const rango = texto(e.rango)
  if (sets !== undefined && rango) return `${sets} × ${rango}`
  if (sets !== undefined) return `${sets} series`
  return ''
}

/**
 * Lee `microciclos.datos` (el plan propuesto) sin fiarse de su forma: solo las sesiones y
 * los ejercicios que de verdad traen nombre. Nada se inventa cuando falta.
 */
export function resumirPlanPropuesto(datos: unknown): SesionResumida[] {
  if (typeof datos !== 'object' || datos === null) return []
  const sesiones = (datos as Record<string, unknown>).sesiones
  if (!Array.isArray(sesiones)) return []
  const resultado: SesionResumida[] = []
  for (const s of sesiones) {
    if (typeof s !== 'object' || s === null) continue
    const sesion = s as Record<string, unknown>
    const ejercicios: EjercicioResumido[] = []
    if (Array.isArray(sesion.ejercicios)) {
      for (const e of sesion.ejercicios) {
        if (typeof e !== 'object' || e === null) continue
        const nombre = texto((e as Record<string, unknown>).nombre)
        if (nombre) ejercicios.push({ nombre, detalle: detalleEjercicio(e as Record<string, unknown>) })
      }
    }
    resultado.push({ nombre: texto(sesion.nombre) ?? `Sesión ${resultado.length + 1}`, ejercicios })
  }
  return resultado
}
