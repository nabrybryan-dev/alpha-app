import {
  ID_REFERENCIA,
  MOTIVOS_RECHAZO,
  PLAZO_HORAS_PROPUESTA,
  ORIGENES_CONTACTO,
  TEMAS_CONTACTO,
  type EstadoPropuesta,
  type FilaBajarCarga,
  type FilaPropuesta,
  type FilaVoyAEscribirte,
  type MotivoRechazo,
} from '../../domain/praxis/propuestaCoach'

/**
 * Repositorio del canal «proponer al coach» (tabla `praxis_propuestas_coach`; el borrador SQL está en
 * `supabase/borradores/`, NO está aplicado). Aquí solo hay la interfaz y una implementación en memoria que
 * hace cumplir las MISMAS reglas que la RLS y los triggers del borrador, para probarlas sin la base:
 *   - la persona inserta lo suyo y no lee nada, ni lo suyo;
 *   - el coach lee todo y decide; la nutricionista solo ve y atiende `voy_a_escribirte`;
 *   - la fila nace pendiente: la persona no puede traer estado, decisión ni hora;
 *   - ninguna columna de texto libre: cada campo es número, lista cerrada o identificador;
 *   - lo decidido no se reescribe; `aplicadaEn` solo se fija si el plan confirmó.
 * La implementación contra Supabase no se escribe todavía: espera a que Bryan numere y aplique la migración.
 */
export const TABLA_PROPUESTAS_COACH = 'praxis_propuestas_coach'
export const MAX_PENDIENTES_POR_PERSONA = 5
const VENTANA_CONTACTO_HORAS = 24

export type RolPropuestas = 'asesorado' | 'coach' | 'nutricionista' | 'anon'
export interface SesionPropuestas {
  uid: string | null
  rol: RolPropuestas
}

export interface Metadatos {
  id: string
  usuarioId: string
  creadoEn: string
  venceEn: string
  estado: EstadoPropuesta
  decididoPor: string | null
  decididoEn: string | null
  cargaDecididaKg: number | null
  motivoRechazo: MotivoRechazo | null
  aplicadaEn: string | null
}
export type PropuestaGuardada = (FilaBajarCarga | FilaVoyAEscribirte) & Metadatos

export type Decision =
  | { accion: 'aceptar' }
  | { accion: 'ajustar'; cargaKg: number }
  | { accion: 'rechazar'; motivo: MotivoRechazo }
  | { accion: 'atender' }

export type MotivoFallo =
  | 'sin_permiso' | 'ajeno' | 'campo_no_permitido' | 'tope' | 'ya_no_pendiente' | 'no_encontrada'
  | 'sin_propuesta' | 'decision_invalida' | 'no_decidida' | 'ya_aplicada' | 'no_confirmo_plan'
export type Resultado = { ok: true; id?: string; duplicada?: boolean } | { ok: false; motivo: MotivoFallo }

export interface RepositorioPropuestasCoach {
  insertar(sesion: SesionPropuestas, usuarioId: string, fila: FilaPropuesta): Promise<Resultado>
  leer(sesion: SesionPropuestas): Promise<PropuestaGuardada[]>
  decidir(sesion: SesionPropuestas, id: string, decision: Decision): Promise<Resultado>
  /** Llama a `aplicar` (la escritura al plan del coach) y solo si devuelve true fija `aplicadaEn`. */
  aplicarAlPlan(sesion: SesionPropuestas, id: string, aplicar: () => Promise<boolean>): Promise<Resultado>
}

const CLAVES_CARGA = [
  'tipo', 'microcicloId', 'ejercicioId', 'cansancio', 'motivo', 'serieCargaKg', 'serieReps', 'serieRir', 'rirObjetivo',
  'unRmKg', 'cargaPropuestaKg', 'razonSinCalculo', 'saltoKg', 'reglaFirmada',
]
const CLAVES_CONTACTO = ['tipo', 'origenContacto', 'fichaId', 'tema']
const FICHA = /^[a-z0-9-]{1,60}$/
const esNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const entre = (v: unknown, min: number, max: number): boolean => esNum(v) && Number.isInteger(v) && v >= min && v <= max
const dentro = (v: unknown, lista: readonly string[]) => typeof v === 'string' && lista.includes(v)

function cargaValida(f: Record<string, unknown>): boolean {
  if (!ID_REFERENCIA.test(String(f.microcicloId)) || !ID_REFERENCIA.test(String(f.ejercicioId))) return false
  if (!dentro(f.cansancio, ['algo', 'mucho']) || !dentro(f.motivo, ['cansancio', 'tecnica', 'otro'])) return false
  // Los mismos rangos que los checks del SQL (reps 1-100, RIR 0-10, RIR objetivo 0-15, enteros; salto y 1RM > 0).
  if (!esNum(f.serieCargaKg) || f.serieCargaKg <= 0 || !entre(f.serieReps, 1, 100) || !entre(f.serieRir, 0, 10) || !entre(f.rirObjetivo, 0, 15)) return false
  if (!esNum(f.saltoKg) || f.saltoKg <= 0) return false
  if (f.unRmKg !== null && (!esNum(f.unRmKg) || f.unRmKg <= 0)) return false
  if (f.reglaFirmada !== false) return false
  if (f.cargaPropuestaKg === null) return dentro(f.razonSinCalculo, ['fuera_de_tabla', 'no_baja'])
  // «Nunca igual ni mayor» también aquí, como el check del borrador SQL.
  return f.razonSinCalculo === null && esNum(f.cargaPropuestaKg) && f.cargaPropuestaKg > 0 && f.cargaPropuestaKg < f.serieCargaKg && f.unRmKg !== null
}
function contactoValido(f: Record<string, unknown>): boolean {
  return dentro(f.origenContacto, ORIGENES_CONTACTO) && typeof f.fichaId === 'string' && FICHA.test(f.fichaId) && dentro(f.tema, TEMAS_CONTACTO)
}
function filaValida(fila: FilaPropuesta): boolean {
  const f = fila as unknown as Record<string, unknown>
  const claves = Object.keys(f).sort()
  if (f.tipo === 'bajar_carga') return JSON.stringify(claves) === JSON.stringify([...CLAVES_CARGA].sort()) && cargaValida(f)
  if (f.tipo === 'voy_a_escribirte') return JSON.stringify(claves) === JSON.stringify([...CLAVES_CONTACTO].sort()) && contactoValido(f)
  return false
}

const esCoach = (s: SesionPropuestas) => s.rol === 'coach' && s.uid !== null
const esNutri = (s: SesionPropuestas) => s.rol === 'nutricionista' && s.uid !== null

export function crearRepoPropuestasEnMemoria(opciones: { ahora?: () => Date; nuevoId?: () => string } = {}): RepositorioPropuestasCoach {
  const ahora = opciones.ahora ?? (() => new Date())
  let contador = 0
  const nuevoId = opciones.nuevoId ?? (() => `propuesta-${++contador}`)
  const tabla: PropuestaGuardada[] = []
  const aplicando = new Set<string>()

  const copia = (p: PropuestaGuardada): PropuestaGuardada => ({ ...p })
  const visible = (s: SesionPropuestas, p: PropuestaGuardada) => esCoach(s) || (esNutri(s) && p.tipo === 'voy_a_escribirte')

  return {
    async insertar(sesion, usuarioId, fila) {
      if (sesion.uid === null || sesion.rol === 'anon') return { ok: false, motivo: 'sin_permiso' }
      if (usuarioId !== sesion.uid) return { ok: false, motivo: 'ajeno' }
      if (!filaValida(fila)) return { ok: false, motivo: 'campo_no_permitido' }

      const t = ahora().getTime()
      const pendientes = tabla.filter((p) => p.usuarioId === usuarioId && p.estado === 'pendiente')
      const igual = pendientes.find((p) =>
        p.tipo === fila.tipo &&
        (fila.tipo === 'bajar_carga'
          ? (p as FilaBajarCarga).ejercicioId === fila.ejercicioId
          : (p as FilaVoyAEscribirte).tema === fila.tema &&
            (p as FilaVoyAEscribirte).origenContacto === fila.origenContacto &&
            t - Date.parse(p.creadoEn) < VENTANA_CONTACTO_HORAS * 3_600_000),
      )
      if (igual) return { ok: true, duplicada: true }
      if (pendientes.length >= MAX_PENDIENTES_POR_PERSONA) return { ok: false, motivo: 'tope' }

      const id = nuevoId()
      tabla.push({
        ...fila, id, usuarioId, creadoEn: new Date(t).toISOString(), venceEn: new Date(t + PLAZO_HORAS_PROPUESTA * 3_600_000).toISOString(), estado: 'pendiente',
        decididoPor: null, decididoEn: null, cargaDecididaKg: null, motivoRechazo: null, aplicadaEn: null,
      })
      return { ok: true, id }
    },

    async leer(sesion) {
      return tabla.filter((p) => visible(sesion, p)).map(copia)
    },

    async decidir(sesion, id, decision) {
      const p = tabla.find((x) => x.id === id)
      if (!esCoach(sesion) && !esNutri(sesion)) return { ok: false, motivo: 'sin_permiso' }
      // La nutricionista no ve las cargas: una carga y un id inexistente le dan EXACTAMENTE lo mismo (sin oráculo).
      if (esNutri(sesion) && (!p || p.tipo !== 'voy_a_escribirte')) return { ok: false, motivo: 'no_encontrada' }
      // Y solo puede «atender».
      if (esNutri(sesion) && decision.accion !== 'atender') return { ok: false, motivo: 'sin_permiso' }
      if (!p) return { ok: false, motivo: 'no_encontrada' }
      if (p.estado !== 'pendiente') return { ok: false, motivo: 'ya_no_pendiente' }

      const decidido = { decididoPor: sesion.uid, decididoEn: ahora().toISOString() }
      if (decision.accion === 'atender') {
        if (p.tipo !== 'voy_a_escribirte') return { ok: false, motivo: 'decision_invalida' }
        Object.assign(p, decidido, { estado: 'atendida' as const })
        return { ok: true, id }
      }
      if (p.tipo !== 'bajar_carga') return { ok: false, motivo: 'decision_invalida' }
      if (decision.accion === 'aceptar') {
        if (p.cargaPropuestaKg === null) return { ok: false, motivo: 'sin_propuesta' }
        Object.assign(p, decidido, { estado: 'aceptada' as const, cargaDecididaKg: p.cargaPropuestaKg })
      } else if (decision.accion === 'ajustar') {
        if (!esNum(decision.cargaKg) || decision.cargaKg <= 0 || decision.cargaKg === p.cargaPropuestaKg) return { ok: false, motivo: 'decision_invalida' }
        Object.assign(p, decidido, { estado: 'ajustada' as const, cargaDecididaKg: decision.cargaKg })
      } else {
        if (!dentro(decision.motivo, MOTIVOS_RECHAZO)) return { ok: false, motivo: 'decision_invalida' }
        Object.assign(p, decidido, { estado: 'rechazada' as const, motivoRechazo: decision.motivo })
      }
      return { ok: true, id }
    },

    async aplicarAlPlan(sesion, id, aplicar) {
      if (!esCoach(sesion)) return { ok: false, motivo: 'sin_permiso' }
      const p = tabla.find((x) => x.id === id)
      if (!p) return { ok: false, motivo: 'no_encontrada' }
      if (p.estado !== 'aceptada' && p.estado !== 'ajustada') return { ok: false, motivo: 'no_decidida' }
      // El chequeo y la reserva van en el mismo tramo síncrono (antes de cualquier await): dos llamadas a la vez
      // no pueden pasar las dos.
      if (p.aplicadaEn !== null || aplicando.has(id)) return { ok: false, motivo: 'ya_aplicada' }
      aplicando.add(id)
      let confirmo: boolean
      try {
        confirmo = (await aplicar()) === true
      } catch {
        confirmo = false
      } finally {
        aplicando.delete(id)
      }
      if (!confirmo) return { ok: false, motivo: 'no_confirmo_plan' }
      p.aplicadaEn = ahora().toISOString()
      return { ok: true, id }
    },
  }
}
