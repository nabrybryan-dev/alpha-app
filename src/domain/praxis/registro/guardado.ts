/**
 * Lo que se guarda cuando la persona toca «Guardar» (DISENO §4.2 y §5.1).
 *
 * La Edge Function NO se fía de la tarjeta: vuelve a leer el microciclo, vuelve a
 * comprobar cada número contra los límites y solo entonces arma la escritura.
 * Estas funciones son puras (reciben el estado leído, devuelven qué escribir); la
 * función hace la llamada a las mismas RPC que usa la app
 * (`fijar_series_ejercicio`, `fijar_test_post`), así hereda la RLS.
 *
 * Solo se toca lo del asesorado: `series[]` y `testPost`. Nunca la pauta, el RIR
 * objetivo, la nota del coach ni el plan.
 */
import { sumarDias } from './fecha.ts'
import { revisarCarga, revisarReps, revisarRpeSesion } from './limites.ts'
import type {
  Confianza, ContextoRegistro, RegistroAdherencia, RegistroPropuesto, RegistroSesionCampo, RegistroSeries, SerieDictada,
} from './tipos.ts'

export interface OpcionesGuardado {
  ahora: string
  /** La persona confirmó que la fecha de OTRA sesión quede sellada hoy (CE-030). */
  confirmaSesion?: boolean
  /** La persona aceptó anotar una serie por encima de `sets` (CE-045). */
  confirmaExtra?: boolean
}

export type Escritura<T> = { ok: true; valor: T } | { ok: false; motivo: string }

const esEntero = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max

/**
 * Las series finales de UN ejercicio: las que ya había, con las nuevas encima por
 * `orden`. Conserva los campos de las existentes que no toca (velocidad, extra...).
 */
export function prepararSeries(
  reg: RegistroSeries,
  ctx: ContextoRegistro,
  existentes: Record<string, unknown>[],
  op: OpcionesGuardado,
): Escritura<{ ejercicioId: string; series: Record<string, unknown>[] }> {
  if (!ctx.microciclo) return { ok: false, motivo: 'no hay microciclo activo' }
  if (ctx.microciclo.vencido) return { ok: false, motivo: 'el microciclo venció: no se escribe en el bloque viejo' }
  const ej = ctx.sesiones.flatMap((s) => s.ejercicios).find((e) => e.id === reg.ejercicio_id)
  if (!ej) return { ok: false, motivo: 'ese ejercicio no está en tu microciclo activo' }
  if (ctx.sesionHoyId && ej.sesionId !== ctx.sesionHoyId && !op.confirmaSesion) {
    return { ok: false, motivo: 'el ejercicio es de otra sesión: hace falta confirmar que se selle su fecha' }
  }
  if (!Array.isArray(reg.valor) || reg.valor.length === 0) return { ok: false, motivo: 'sin series' }

  const ordenes = new Set<number>()
  const nuevas: Record<string, unknown>[] = []
  for (const s of reg.valor as SerieDictada[]) {
    if (!esEntero(s.orden, 1, 20)) return { ok: false, motivo: 'orden de serie inválido' }
    if (ordenes.has(s.orden)) return { ok: false, motivo: 'orden de serie repetido' }
    ordenes.add(s.orden)
    if (s.orden > ej.sets && !op.confirmaExtra) return { ok: false, motivo: `la serie ${s.orden} pasa de las ${ej.sets} prescritas y no se confirmó` }
    if (typeof s.cargaKg !== 'number') return { ok: false, motivo: 'carga inválida' }
    const anterior = ej.series.filter((h) => h.orden < s.orden).at(-1)?.cargaKg ?? null
    const vc = revisarCarga(s.cargaKg, anterior)
    if (vc.tipo === 'imposible') return { ok: false, motivo: vc.motivo }
    if (s.reps !== undefined) {
      const vr = revisarReps(s.reps, ej.rango)
      if (vr.tipo === 'imposible') return { ok: false, motivo: vr.motivo }
    }
    if (s.rir !== undefined && !esEntero(s.rir, 0, 5)) return { ok: false, motivo: 'RIR fuera de 0 a 5' }
    const conf: Confianza = ['alta', 'media', 'baja'].includes(reg.confianza) ? reg.confianza : 'baja'
    nuevas.push({
      orden: s.orden,
      cargaKg: s.cargaKg,
      ...(s.reps !== undefined ? { reps: s.reps } : {}),
      ...(s.rir !== undefined ? { rir: s.rir } : {}),
      ...(s.extra?.length ? { extra: s.extra } : {}),
      fuente: 'praxis',
      confianza: conf,
      ...(reg.origen ? { origen: reg.origen } : {}),
      hechoEn: op.ahora,
    })
  }
  const conservadas = existentes.filter((e) => !ordenes.has(Number(e.orden)))
  const series = [...conservadas, ...nuevas].sort((a, b) => Number(a.orden) - Number(b.orden))
  return { ok: true, valor: { ejercicioId: ej.id, series } }
}

/** El `testPost` fusionado: `{...actual, campo}`. Nunca pisa el resto. */
export function prepararTestPost(
  reg: RegistroSesionCampo,
  ctx: ContextoRegistro,
  actual: Record<string, unknown> | null | undefined,
): Escritura<{ sesionId: string; testPost: Record<string, unknown> }> {
  if (!ctx.microciclo) return { ok: false, motivo: 'no hay microciclo activo' }
  if (ctx.microciclo.vencido) return { ok: false, motivo: 'el microciclo venció' }
  if (!ctx.sesiones.some((s) => s.id === reg.sesion_id)) return { ok: false, motivo: 'esa sesión no está en tu microciclo activo' }
  if (reg.campo === 'testPost.rpeSesion') {
    const v = revisarRpeSesion(reg.valor)
    if (v.tipo === 'imposible' || !Number.isInteger(reg.valor)) return { ok: false, motivo: 'esfuerzo de sesión fuera de 1 a 10' }
    return { ok: true, valor: { sesionId: reg.sesion_id, testPost: { ...(actual ?? {}), rpeSesion: reg.valor } } }
  }
  if (!esEntero(reg.valor, 1, 600)) return { ok: false, motivo: 'duración fuera de 1 a 600 min' }
  return { ok: true, valor: { sesionId: reg.sesion_id, testPost: { ...(actual ?? {}), duracionMin: reg.valor } } }
}

/**
 * Registros que todavía NO se escriben desde aquí y por qué. Es honesto a
 * propósito: escribirlos sin sus prerrequisitos rompería lo que el diseño protege.
 */
export function prerrequisitoPendiente(reg: RegistroPropuesto): string | null {
  switch (reg.campo) {
    case 'checkin':
      return 'P2: hoy una fila parcial cierra el formulario del check-in y da XP; queda como prellenado hasta que exista el estado parcial'
    case 'hidratacion':
      return 'P5: registrarHidratacion suma un delta y no es idempotente; hace falta el libro de tarjetas aplicadas (migración)'
    case 'comida':
      return 'P5/P6: faltan las columnas de procedencia de registro_item y el catálogo curado'
    default:
      if (reg.campo.startsWith('bloquesCardio[')) {
        return 'P7: registrarEjecucionCardio no sincroniza con la nube (0 de 945 en producción); se escribiría solo en el teléfono'
      }
      if (reg.campo.startsWith('preparacion[')) {
        return 'marcarParte alterna la marca y materializa la plantilla: hay que hacerlo desde el repo de la app, no desde el servidor'
      }
      return null
  }
}

/** La adherencia sí es idempotente: una fila por (usuario, fecha). Solo hoy y ayer. */
export function prepararAdherencia(
  reg: RegistroAdherencia,
  usuarioId: string,
  ahoraIso: string,
): Escritura<{ id: string; usuario_id: string; fecha: string; estado: 'si' | 'parcial' | 'no' }> {
  if (!['si', 'parcial', 'no'].includes(reg.estado)) return { ok: false, motivo: 'estado de adherencia inválido' }
  const hoy = ahoraIso.slice(0, 10)
  const ayer = sumarDias(hoy, -1)
  if (reg.fecha !== hoy && reg.fecha !== ayer) return { ok: false, motivo: 'la adherencia solo se marca de hoy o de ayer' }
  return { ok: true, valor: { id: `ad-${usuarioId}-${reg.fecha}`, usuario_id: usuarioId, fecha: reg.fecha, estado: reg.estado } }
}
