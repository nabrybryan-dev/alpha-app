// Edge Function avisos-plan: la decisión de QUÉ avisar. Módulo puro, sin red ni base.
//
// Va aparte de index.ts para poder probarlo con vitest (src/domain/avisosPlan.test.ts) sin levantar
// Deno. No importa nada: se entrega copiando la carpeta a Supabase.
//
// Dos casos, y solo al dueño de la tarea (bryan o manuela):
//   1. inicio_bloque: la tarea PRINCIPAL de hoy, a partir de la hora que el dueño fijó
//      (por defecto 08:00, hora de Bogotá), si sigue sin empezar (estado 'pendiente').
//   2. atascada: tarea abierta con día <= hoy que lleva 2 días sin moverse o se movió 2+ veces.
//
// Como mucho UN aviso por tarea y día (sea del tipo que sea). Los ya enviados llegan en `enviadosHoy`.

export type Dueno = 'bryan' | 'manuela'
export type TipoAviso = 'inicio_bloque' | 'atascada'

export const ZONA = 'America/Bogota'
export const HORA_BLOQUE_POR_DEFECTO = '08:00'
export const DIAS_ATASCADA = 2
export const MOVIDAS_ATASCADA = 2

export interface TareaAviso {
  id: string
  dueno: Dueno
  titulo: string
  primer_paso: string | null
  fecha: string | null // YYYY-MM-DD
  estado: string
  prioridad: string | null
  veces_movida: number
  actualizado_en: string // ISO con zona
}

export interface Aviso {
  tipo: TipoAviso
  dueno: Dueno
  item_id: string
  fecha_aviso: string // el día local en que se avisa
  titulo: string
  cuerpo: string
  url: string
}

/** Día (YYYY-MM-DD) y minutos desde medianoche en la zona dada. */
export function relojLocal(ahora: Date, zona: string = ZONA): { dia: string; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora)
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? '00'
  return { dia: `${g('year')}-${g('month')}-${g('day')}`, minutos: Number(g('hour')) * 60 + Number(g('minute')) }
}

/** 'HH:MM' -> minutos; si viene mal escrita, la hora por defecto (nunca lanza). */
export function minutosDeHora(hora: string | undefined): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hora ?? '').trim())
  const h = m ? Number(m[1]) : NaN
  const mi = m ? Number(m[2]) : NaN
  if (!m || h > 23 || mi > 59) return 8 * 60
  return h * 60 + mi
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000)
}

function recortar(texto: string, max: number): string {
  const t = texto.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

export const urlDelPlan = (d: Dueno) => (d === 'bryan' ? '/coach/mi-plan' : '/mi-plan')

function cuerpoConPaso(paso: string | null): string {
  return paso && paso.trim() ? `Primer paso: ${recortar(paso, 120)}` : 'Abre Mi plan y empieza por lo más pequeño.'
}

const ABIERTA = ['pendiente', 'en_curso']

export interface EntradaDecision {
  tareas: readonly TareaAviso[]
  ahora: Date
  /** Hora fijada por dueño ('HH:MM' hora de Bogotá). Lo que falte usa 08:00. */
  horas?: Partial<Record<Dueno, string | undefined>>
  /** Dueños con suscripción viva. Sin ella no se decide nada para ese dueño. */
  duenosConSuscripcion: readonly Dueno[]
  /** item_id de los avisos ya registrados HOY (cualquier tipo). */
  enviadosHoy: ReadonlySet<string>
}

export function decidirAvisos(e: EntradaDecision): Aviso[] {
  const { dia, minutos } = relojLocal(e.ahora)
  const salida: Aviso[] = []
  const usados = new Set(e.enviadosHoy)
  const puede = (d: Dueno) => e.duenosConSuscripcion.includes(d) && minutos >= minutosDeHora(e.horas?.[d])

  // Primero el inicio de bloque: si la principal también está atascada, con ese aviso basta.
  for (const t of e.tareas) {
    if (!puede(t.dueno)) continue
    if (t.prioridad !== 'principal' || t.estado !== 'pendiente' || t.fecha !== dia) continue
    if (usados.has(t.id)) continue
    usados.add(t.id)
    salida.push({
      tipo: 'inicio_bloque',
      dueno: t.dueno,
      item_id: t.id,
      fecha_aviso: dia,
      titulo: `Hoy: ${recortar(t.titulo, 80)}`,
      cuerpo: cuerpoConPaso(t.primer_paso),
      url: urlDelPlan(t.dueno),
    })
  }

  for (const t of e.tareas) {
    if (!puede(t.dueno)) continue
    if (!ABIERTA.includes(t.estado) || t.fecha === null || t.fecha > dia) continue
    const quieta = diasEntre(t.actualizado_en.slice(0, 10), dia) >= DIAS_ATASCADA
    if (!quieta && t.veces_movida < MOVIDAS_ATASCADA) continue
    if (usados.has(t.id)) continue
    usados.add(t.id)
    salida.push({
      tipo: 'atascada',
      dueno: t.dueno,
      item_id: t.id,
      fecha_aviso: dia,
      titulo: `Sigue sin moverse: ${recortar(t.titulo, 70)}`,
      cuerpo: cuerpoConPaso(t.primer_paso),
      url: urlDelPlan(t.dueno),
    })
  }
  return salida
}

// ---------------------------------------------------------------------------------------------
// Recordatorio del check-in de las 6 pm (decisión de Bryan, 28-oct). Antes solo salía una notificación
// LOCAL con la app abierta (`features/bienestar/recordatorio.ts`); ahora sale del servidor aunque la
// app esté cerrada. Va a quien tiene una suscripción viva y no ha llenado el check-in de HOY.
// Como mucho UN aviso por persona y día; sin datos de salud en el texto.
// ---------------------------------------------------------------------------------------------

export const HORA_CHECKIN = '18:00'
/** Pasada esta hora ya no se avisa: un recordatorio a las 11 de la noche no ayuda a nadie. */
export const HORA_TOPE_CHECKIN = '22:00'
export const URL_CHECKIN = '/bienestar'

export interface AvisoCheckin {
  usuario_id: string
  fecha_aviso: string
  titulo: string
  cuerpo: string
  url: string
}

export interface EntradaCheckin {
  ahora: Date
  /** usuario_id de quien tiene una suscripción viva. */
  suscritos: readonly string[]
  /** usuario_id de quien ya tiene un check-in con la fecha de hoy. */
  conCheckinHoy: ReadonlySet<string>
  /** usuario_id de quien ya recibió hoy este recordatorio. */
  enviadosHoy: ReadonlySet<string>
}

/** Quién recibe el recordatorio de las 6 pm (Bryan, 29-oct): asesorados y la nutricionista; el coach no. Aparte de los avisos del plan. */
export const ROLES_DEL_RECORDATORIO_CHECKIN = ['asesorado', 'nutricionista'] as const

export function decidirRecordatoriosCheckin(e: EntradaCheckin): AvisoCheckin[] {
  const { dia, minutos } = relojLocal(e.ahora)
  if (minutos < minutosDeHora(HORA_CHECKIN) || minutos >= minutosDeHora(HORA_TOPE_CHECKIN)) return []
  const vistos = new Set<string>()
  const salida: AvisoCheckin[] = []
  for (const id of e.suscritos) {
    if (vistos.has(id)) continue
    vistos.add(id)
    if (e.conCheckinHoy.has(id) || e.enviadosHoy.has(id)) continue
    salida.push({
      usuario_id: id,
      fecha_aviso: dia,
      titulo: 'Tu check-in te espera',
      cuerpo: 'Ya pasan de las 6 pm y aún no registras tu día. Toma 1 minuto.',
      url: URL_CHECKIN,
    })
  }
  return salida
}

/**
 * Quién recibe los avisos del PLAN (organizador): solo Bryan y Manuela, por su id. `permisos_de_aviso` guarda a todo el
 * que activó los avisos, asesorados incluidos; sin este filtro un asesorado suscrito podría recibir avisos del equipo.
 */
export function destinatariosDelPlan(suscritos: readonly string[], ids: Record<Dueno, string>): Dueno[] {
  return (Object.keys(ids) as Dueno[]).filter((d) => suscritos.includes(ids[d]))
}
