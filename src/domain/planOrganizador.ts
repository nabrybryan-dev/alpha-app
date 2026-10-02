/**
 * Organizador de Bryan y Manuela (migración 0098; ESPEC-ORGANIZADOR.md). Lógica pura.
 *
 * Cascada: objetivo (90 días) -> hito (semana) -> tarea (día). Diseño para TDAH: una sola
 * «siguiente acción» grande, tareas de 50 min como mucho con su primer paso escrito, máximo
 * 3 tareas por día (1 principal + 2 pequeñas), carga semanal visible y nada de culpa
 * acumulada: lo que se arrastra sube a una pregunta, no a una lista más larga.
 *
 * Las mismas reglas están en la base (checks, índice único y trigger de la 0098): aquí sirven
 * para decir el motivo ANTES de intentar guardar. Fechas en ISO local (`YYYY-MM-DD`).
 */

export const NIVELES = ['objetivo', 'hito', 'tarea'] as const
export type Nivel = (typeof NIVELES)[number]

export const DUENOS = ['bryan', 'manuela'] as const
export type Dueno = (typeof DUENOS)[number]

export const PALANCAS = ['A', 'B', 'C', 'D', 'otro'] as const
export type Palanca = (typeof PALANCAS)[number]

export const PRIORIDADES = ['principal', 'pequena'] as const
export type Prioridad = (typeof PRIORIDADES)[number]

export const ESTADOS_PLAN = ['pendiente', 'en_curso', 'hecha', 'movida', 'descartada'] as const
export type EstadoPlan = (typeof ESTADOS_PLAN)[number]

export const esNivel = (v: string): v is Nivel => (NIVELES as readonly string[]).includes(v)
export const esDueno = (v: string): v is Dueno => (DUENOS as readonly string[]).includes(v)
export const esPalanca = (v: string): v is Palanca => (PALANCAS as readonly string[]).includes(v)
export const esPrioridad = (v: string): v is Prioridad => (PRIORIDADES as readonly string[]).includes(v)
export const esEstadoPlan = (v: string): v is EstadoPlan => (ESTADOS_PLAN as readonly string[]).includes(v)

export const MAX_TAREAS_DIA = 3
export const MAX_MIN_TAREA = 50
export const BLOQUES_MIN = [25, 50] as const
/** Una tarea viva que lleva tantos días sin moverse se avisa. */
export const DIAS_ATASCADA = 2
/** Movida tantas veces, ya no se replanifica más: sube a «¿se hace, se delega o se borra?». */
export const MOVIDAS_PARA_PREGUNTAR = 2
/** Hitos por semana, como mucho (principio 3 de la espec). */
export const MAX_HITOS_SEMANA = 3

/**
 * Intensidad de la semana según las horas PLANEADAS. Umbrales propuestos (la espec no fija
 * números): el tope de una semana llena es 3 x 50 min x 5 días = 12,5 h.
 */
export const HORAS_INTENSIDAD_MEDIA = 6
export const HORAS_INTENSIDAD_ALTA = 10

export const NOMBRE_ESTADO_PLAN: Record<EstadoPlan, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  hecha: 'Hecha',
  movida: 'Movida',
  descartada: 'Descartada',
}

export interface ItemPlan {
  id: string
  nivel: Nivel
  padreId: string | null
  titulo: string
  primerPaso: string | null
  dueno: Dueno
  palanca: Palanca | null
  fecha: string | null
  estimadoMin: number | null
  prioridad: Prioridad | null
  estado: EstadoPlan
  iniciadaEn: string | null
  hechaEn: string | null
  vecesMovida: number
  origen: string | null
  actualizadoEn: string
}

/** Estados que ocupan cupo del día y cuentan como trabajo vivo. */
const VIVOS: readonly EstadoPlan[] = ['pendiente', 'en_curso', 'hecha']
const ABIERTOS: readonly EstadoPlan[] = ['pendiente', 'en_curso']

export const esVivo = (i: ItemPlan) => VIVOS.includes(i.estado)
export const estaAbierto = (i: ItemPlan) => ABIERTOS.includes(i.estado)

// ───────────────────────────── fechas ─────────────────────────────

/** `YYYY-MM-DD` de una fecha en hora local. */
export function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function aFecha(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function sumarDias(iso: string, dias: number): string {
  const d = aFecha(iso)
  d.setDate(d.getDate() + dias)
  return isoLocal(d)
}

/** El lunes de la semana de `iso`. */
export function lunesDe(iso: string): string {
  const d = aFecha(iso)
  const dia = d.getDay() // 0 = domingo
  return sumarDias(iso, dia === 0 ? -6 : 1 - dia)
}

export function diasEntre(desdeIso: string, hastaIso: string): number {
  return Math.round((aFecha(hastaIso).getTime() - aFecha(desdeIso).getTime()) / 86_400_000)
}

// ───────────────────────────── el día ─────────────────────────────

export interface TareasDelDia {
  principal: ItemPlan | null
  pequenas: ItemPlan[]
  /** Todas las del día que siguen vivas (incluye las hechas), en orden de aparición. */
  vivas: ItemPlan[]
}

/** Las tareas de UN dueño en UN día: la principal y las pequeñas, sin descartadas ni movidas. */
export function tareasDelDia(items: readonly ItemPlan[], dueno: Dueno, fecha: string): TareasDelDia {
  const vivas = items.filter((i) => i.nivel === 'tarea' && i.dueno === dueno && i.fecha === fecha && esVivo(i))
  return {
    principal: vivas.find((t) => t.prioridad === 'principal') ?? null,
    pequenas: vivas.filter((t) => t.prioridad !== 'principal'),
    vivas,
  }
}

/** Lo que va a «después»: tareas abiertas sin día. */
export function tareasParaDespues(items: readonly ItemPlan[], dueno: Dueno): ItemPlan[] {
  return items.filter((i) => i.nivel === 'tarea' && i.dueno === dueno && i.fecha === null && estaAbierto(i))
}

export interface EntradaTarea {
  titulo: string
  primerPaso: string | null
  fecha: string | null
  estimadoMin: number | null
  prioridad: Prioridad
}

export type Veredicto = { ok: true } | { ok: false; motivo: string }

/** ¿Cabe esta tarea? El motivo se dice en claro: nunca se rechaza en silencio. */
export function puedeAgregarTarea(items: readonly ItemPlan[], dueno: Dueno, e: EntradaTarea): Veredicto {
  if (e.titulo.trim().length === 0) return { ok: false, motivo: 'La tarea necesita un título.' }
  if (e.primerPaso === null || e.primerPaso.trim().length === 0) {
    return { ok: false, motivo: 'Escribe el primer paso físico: qué abres o qué tocas primero.' }
  }
  if (e.estimadoMin === null || !Number.isFinite(e.estimadoMin) || e.estimadoMin < 1) {
    return { ok: false, motivo: 'Pon cuántos minutos toma.' }
  }
  if (e.estimadoMin > MAX_MIN_TAREA) {
    return { ok: false, motivo: `Una tarea dura ${MAX_MIN_TAREA} min como máximo: pártela en dos.` }
  }
  if (e.fecha === null) return { ok: true }
  const dia = tareasDelDia(items, dueno, e.fecha)
  if (dia.vivas.length >= MAX_TAREAS_DIA) {
    return { ok: false, motivo: `Ese día ya tiene ${MAX_TAREAS_DIA} tareas: lo que no cabe va a «después».` }
  }
  if (e.prioridad === 'principal' && dia.principal) {
    return { ok: false, motivo: 'Ese día ya tiene su tarea principal.' }
  }
  return { ok: true }
}

/** Mover una tarea a otro día tiene las mismas reglas de cupo que crearla ahí. */
export function puedeMoverTarea(items: readonly ItemPlan[], tarea: ItemPlan, nuevaFecha: string | null): Veredicto {
  if (tarea.nivel !== 'tarea') return { ok: false, motivo: 'Solo se mueven tareas.' }
  if (nuevaFecha === null) return { ok: true }
  const dia = tareasDelDia(items.filter((i) => i.id !== tarea.id), tarea.dueno, nuevaFecha)
  if (dia.vivas.length >= MAX_TAREAS_DIA) {
    return { ok: false, motivo: `Ese día ya tiene ${MAX_TAREAS_DIA} tareas.` }
  }
  if (tarea.prioridad === 'principal' && dia.principal) {
    return { ok: false, motivo: 'Ese día ya tiene su tarea principal.' }
  }
  return { ok: true }
}

// ───────────────────────────── atasco y arrastre ─────────────────────────────

/**
 * «Atascada»: una tarea abierta, ya con día (hoy o antes), que lleva `DIAS_ATASCADA` días o más
 * sin tocarse. `actualizadoEn` sube con cada cambio (trigger de la base), así que empezar,
 * mover o editar la sacan del atasco.
 */
export function estaAtascada(t: ItemPlan, hoy: string): boolean {
  if (t.nivel !== 'tarea' || !estaAbierto(t) || t.fecha === null || t.fecha > hoy) return false
  return diasEntre(t.actualizadoEn.slice(0, 10), hoy) >= DIAS_ATASCADA
}

export function tareasAtascadas(items: readonly ItemPlan[], dueno: Dueno, hoy: string): ItemPlan[] {
  return items.filter((i) => i.dueno === dueno && estaAtascada(i, hoy))
}

/** Movida dos veces: ya no se replanifica, se pregunta «¿se hace, se delega a Manuela o se borra?». */
export function debePreguntarDestino(t: ItemPlan): boolean {
  return t.nivel === 'tarea' && estaAbierto(t) && t.vecesMovida >= MOVIDAS_PARA_PREGUNTAR
}

// ───────────────────────────── la semana ─────────────────────────────

export type Intensidad = 'baja' | 'media' | 'alta'

export const NOMBRE_INTENSIDAD: Record<Intensidad, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' }

export function intensidadDe(minutosPlaneados: number): Intensidad {
  const horas = minutosPlaneados / 60
  if (horas >= HORAS_INTENSIDAD_ALTA) return 'alta'
  if (horas >= HORAS_INTENSIDAD_MEDIA) return 'media'
  return 'baja'
}

export interface CargaSemanal {
  lunes: string
  /** Minutos de tareas vivas (pendientes, en curso y hechas) con día dentro de la semana. */
  planeadoMin: number
  /** Minutos de las hechas. */
  hechoMin: number
  tareas: number
  hechas: number
  intensidad: Intensidad
}

/** Carga de UN dueño en la semana que empieza en `lunes`. Solo cuenta estimados que existen. */
export function cargaSemanal(items: readonly ItemPlan[], dueno: Dueno, lunes: string): CargaSemanal {
  const domingo = sumarDias(lunes, 6)
  const de = items.filter(
    (i) => i.nivel === 'tarea' && i.dueno === dueno && esVivo(i) && i.fecha !== null && i.fecha >= lunes && i.fecha <= domingo,
  )
  const min = (t: ItemPlan) => t.estimadoMin ?? 0
  const planeadoMin = de.reduce((s, t) => s + min(t), 0)
  const hechasLista = de.filter((t) => t.estado === 'hecha')
  return {
    lunes,
    planeadoMin,
    hechoMin: hechasLista.reduce((s, t) => s + min(t), 0),
    tareas: de.length,
    hechas: hechasLista.length,
    intensidad: intensidadDe(planeadoMin),
  }
}

export interface Avance {
  hechas: number
  total: number
  /** 0 a 100, entero; 0 si aún no hay tareas (y `sinTareas` lo dice). */
  pct: number
  sinTareas: boolean
}

function avanceDe(tareas: readonly ItemPlan[]): Avance {
  const vivas = tareas.filter(esVivo)
  const hechas = vivas.filter((t) => t.estado === 'hecha').length
  return {
    hechas,
    total: vivas.length,
    pct: vivas.length === 0 ? 0 : Math.round((hechas / vivas.length) * 100),
    sinTareas: vivas.length === 0,
  }
}

/** Avance de un hito = sus tareas hechas sobre sus tareas vivas. */
export function avanceDeHito(items: readonly ItemPlan[], hitoId: string): Avance {
  return avanceDe(items.filter((i) => i.nivel === 'tarea' && i.padreId === hitoId))
}

/** Avance de un objetivo = las tareas de todos sus hitos. */
export function avanceDeObjetivo(items: readonly ItemPlan[], objetivoId: string): Avance {
  const hitos = new Set(items.filter((i) => i.nivel === 'hito' && i.padreId === objetivoId).map((h) => h.id))
  return avanceDe(items.filter((i) => i.nivel === 'tarea' && i.padreId !== null && hitos.has(i.padreId)))
}

/** Hitos de la semana (su fecha es el lunes), sin descartados. */
export function hitosDeLaSemana(items: readonly ItemPlan[], dueno: Dueno, lunes: string): ItemPlan[] {
  return items.filter((i) => i.nivel === 'hito' && i.dueno === dueno && i.fecha === lunes && i.estado !== 'descartada')
}

export function objetivosActivos(items: readonly ItemPlan[], dueno: Dueno): ItemPlan[] {
  return items
    .filter((i) => i.nivel === 'objetivo' && i.dueno === dueno && i.estado !== 'descartada')
    .sort((a, b) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999'))
}

// ───────────────────────────── el aviso al abrir ─────────────────────────────

/** La principal de hoy si sigue sin empezar; si no hay principal o ya se empezó, nada. */
export function principalSinEmpezar(items: readonly ItemPlan[], dueno: Dueno, hoy: string): ItemPlan | null {
  const { principal } = tareasDelDia(items, dueno, hoy)
  return principal !== null && principal.estado === 'pendiente' ? principal : null
}

// ───────────────────────────── el temporizador ─────────────────────────────

/** Segundos que quedan de un bloque de `minutos` que empezó en `inicioMs`; nunca negativo. */
export function segundosRestantes(inicioMs: number, minutos: number, ahoraMs: number): number {
  return Math.max(0, Math.ceil((inicioMs + minutos * 60_000 - ahoraMs) / 1000))
}

export function relojMmSs(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Bloque sugerido para una tarea: 25 si dura 25 o menos, 50 si no. */
export function bloqueSugerido(estimadoMin: number | null): (typeof BLOQUES_MIN)[number] {
  return estimadoMin !== null && estimadoMin <= 25 ? 25 : 50
}

export function horasTexto(min: number): string {
  const h = min / 60
  return `${(Math.round(h * 10) / 10).toLocaleString('es-CO')} h`
}
