import type {
  AdherenciaNutricional, CheckinDiario, EjercicioPrescrito, Microciclo, Perfil, PlanNutricional, Sesion, VisibilidadAsesorado,
} from '../../types'

/**
 * La lista blanca de «Praxis conoce tu plan» (DISENO.md §1, decisión D1 de Bryan, 29-sep).
 *
 * REGLA DEL ESPEJO: Praxis solo le dice a una persona lo que esa persona ya ve en su app o
 * lo que se escribió para ella. La RLS no sirve de filtro —no distingue columnas, y con su
 * propio JWT la persona puede leer su plan `propuesto` sin firmar y notas del staff—, así
 * que el filtro vive aquí, en código, y es por COPIA: cada campo que sale está escrito a
 * mano abajo. Nada pasa por `...resto`. Un campo nuevo en la base no llega a Praxis hasta
 * que alguien lo apunte aquí y en `CAMPOS_PERMITIDOS` (la prueba de al lado lo exige).
 *
 * NUNCA entran:
 *   - microciclos en `propuesto` (el plan sin aprobar, 0086) ni en un estado desconocido;
 *   - notas internas del staff: `planNutricional.analisis`, `visibilidad.nota`, y lo que
 *     la cadena escribe para el coach (`avisos`, `resumen`, `motivo`…);
 *   - el cribado y cualquier dato clínico;
 *   - medidas corporales y peso (solo si la persona los pide; esa puerta aún no existe);
 *   - las cifras de comida, cuando la nutricionista las ocultó para esa persona.
 *
 * Solo lectura: este módulo no tiene ninguna función que escriba.
 */

/** Días de registro que Praxis mira (DISENO §1.1: «los últimos 14 días»). */
export const DIAS_DE_REGISTRO = 14

export interface SerieVista { orden: number; cargaKg: number; reps?: number; rir?: number }

export interface EjercicioVisto {
  id: string
  nombre: string
  categoria: string
  prescripcion: string
  cargaKg?: number
  unidadCarga?: string
  sets: number
  rango: string
  repsDiana: number
  rirObjetivo: EjercicioPrescrito['rirObjetivo']
  seriesPrescritas?: { orden: number; reps: number; rir: number; cargaKg: number }[]
  etiquetasSeries?: string[]
  descansoMin: number
  cues: string
  notaCoach?: string
  /** Solo para explicar el camino ya autorizado; Praxis no lo propone. */
  escenarioRojo?: { deltaRir: number; sueloRir: number; quitarUltimaSerie?: boolean }
  /** Lo que la persona registró. */
  series: SerieVista[]
}

export interface ParteVista { titulo: string; indicaciones: string; duracionMin?: number }

export interface SesionVista {
  id: string
  nombre: string
  dia?: string
  fecha?: string
  ejercicios: EjercicioVisto[]
  preparacion: ParteVista[]
  bloquesCardio: ParteVista[]
  testPost?: { duracionMin: number; rpeSesion: number }
}

export interface MicrocicloVisto { numero: number; fechaInicio: string; cadenciaDias: number; sesiones: SesionVista[] }

export interface PerfilVisto {
  objetivos?: string
  diasDisponibles?: string[]
  tiempoSesionMin?: number
  faseEnergetica?: string
  pasosObjetivo?: number
}

export interface CheckinVisto {
  fecha: string
  horasSueno?: number
  horaAcostarse?: string
  horaLevantarse?: string
  calidadSueno?: CheckinDiario['calidadSueno']
  cansancio?: CheckinDiario['cansancio']
  entreno?: string
  rendimiento?: CheckinDiario['rendimiento']
  motivacion?: CheckinDiario['motivacion']
  dolor?: number
  dolorDonde?: string
  hambreEscala?: number
  alimentacion?: CheckinDiario['alimentacion']
  estres?: CheckinDiario['estres']
  pasos?: number
  comentarios?: string
}

export interface ComidaVista {
  /** `false` cuando la nutricionista ocultó las cifras: Praxis tampoco las dice. */
  verCifras: boolean
  menus: { nombre: string; comidas: { hora: string; titulo: string; alimentos: string[]; nota?: string }[] }[]
  equivalencias: { grupo: string; base: string; opciones: string[] }[]
  seccionesEspeciales: { titulo: string; contenido: string }[]
  listaCompras: string[]
}

/** El agua de HOY. `null` en `LoQuePraxisVe` cuando no hay nada anotado (el almacén no distingue «0 ml» de «sin registro»). */
export interface AguaVista { fecha: string; ml: number }

/** De dónde salió un número del check-in de hoy: lo movió la persona, quedó el de la vez anterior, o el reporte es viejo y no lo dice. */
export type ProcedenciaDelDia = 'anotado' | 'arrastrado' | 'sin_marca'

/** El check-in de HOY. `procedencia` solo nombra los números que el formulario trae ya puestos (pasos y sueño; el peso no entra). */
export interface CheckinHoyVisto {
  campos: CheckinVisto
  procedencia: { pasos?: ProcedenciaDelDia; horasSueno?: ProcedenciaDelDia }
}

/** La comida marcada en la semana en curso (lunes a hoy). Solo cuenta lo que la persona marcó; el día sin marca no es «no». */
export interface AdherenciaSemanaVista {
  desde: string
  hasta: string
  si: number
  parcial: number
  no: number
  /** Días de la semana ya transcurridos (hoy incluido). */
  diasTranscurridos: number
}

export type DatoQueFalta = 'plan_activo' | 'perfil' | 'checkins' | 'plan_de_comida'

export interface LoQuePraxisVe {
  activo: MicrocicloVisto | null
  cerrados: MicrocicloVisto[]
  perfil: PerfilVisto | null
  /** Del más antiguo al más reciente. */
  checkins: CheckinVisto[]
  adherencias: { fecha: string; estado: AdherenciaNutricional['estado'] }[]
  hidratacionHoyMl: number
  aguaHoy: AguaVista | null
  checkinHoy: CheckinHoyVisto | null
  adherenciaSemana: AdherenciaSemanaVista | null
  comida: ComidaVista | null
  /** Lo que Praxis no tiene de esta persona, para decirlo en vez de inventarlo. */
  falta: DatoQueFalta[]
}

/** Lo que la capa de datos le entrega, tal como sale de la base local. */
export interface CrudoDePersona {
  usuarioId: string
  microciclos: Microciclo[]
  perfil?: Perfil
  checkins: CheckinDiario[]
  planNutricional?: PlanNutricional
  visibilidad?: VisibilidadAsesorado
  adherencias: AdherenciaNutricional[]
  hidratacionHoyMl?: number
}

/** Todas las rutas (sin índices) que pueden salir de `loQuePraxisVe`. La prueba compara contra esto. */
export const CAMPOS_PERMITIDOS: readonly string[] = [
  'activo', 'cerrados', 'perfil', 'checkins', 'adherencias', 'hidratacionHoyMl', 'aguaHoy', 'checkinHoy', 'adherenciaSemana', 'comida', 'falta',
  ...['activo', 'cerrados'].flatMap((m) => [
    `${m}.numero`, `${m}.fechaInicio`, `${m}.cadenciaDias`, `${m}.sesiones`,
    ...['id', 'nombre', 'dia', 'fecha', 'ejercicios', 'preparacion', 'bloquesCardio', 'testPost', 'testPost.duracionMin', 'testPost.rpeSesion'].map((c) => `${m}.sesiones.${c}`),
    ...['titulo', 'indicaciones', 'duracionMin'].flatMap((c) => [`${m}.sesiones.preparacion.${c}`, `${m}.sesiones.bloquesCardio.${c}`]),
    ...[
      'id', 'nombre', 'categoria', 'prescripcion', 'cargaKg', 'unidadCarga', 'sets', 'rango', 'repsDiana', 'rirObjetivo', 'seriesPrescritas',
      'seriesPrescritas.orden', 'seriesPrescritas.reps', 'seriesPrescritas.rir', 'seriesPrescritas.cargaKg', 'etiquetasSeries', 'descansoMin', 'cues',
      'notaCoach', 'escenarioRojo', 'escenarioRojo.deltaRir', 'escenarioRojo.sueloRir', 'escenarioRojo.quitarUltimaSerie',
      'series', 'series.orden', 'series.cargaKg', 'series.reps', 'series.rir',
    ].map((c) => `${m}.sesiones.ejercicios.${c}`),
  ]),
  'perfil.objetivos', 'perfil.diasDisponibles', 'perfil.tiempoSesionMin', 'perfil.faseEnergetica', 'perfil.pasosObjetivo',
  ...[
    'fecha', 'horasSueno', 'horaAcostarse', 'horaLevantarse', 'calidadSueno', 'cansancio', 'entreno', 'rendimiento', 'motivacion', 'dolor',
    'dolorDonde', 'hambreEscala', 'alimentacion', 'estres', 'pasos', 'comentarios',
  ].map((c) => `checkins.${c}`),
  'adherencias.fecha', 'adherencias.estado',
  'aguaHoy.fecha', 'aguaHoy.ml',
  'checkinHoy.campos', 'checkinHoy.procedencia', 'checkinHoy.procedencia.pasos', 'checkinHoy.procedencia.horasSueno',
  ...[
    'fecha', 'horasSueno', 'horaAcostarse', 'horaLevantarse', 'calidadSueno', 'cansancio', 'entreno', 'rendimiento', 'motivacion', 'dolor',
    'dolorDonde', 'hambreEscala', 'alimentacion', 'estres', 'pasos', 'comentarios',
  ].map((c) => `checkinHoy.campos.${c}`),
  'adherenciaSemana.desde', 'adherenciaSemana.hasta', 'adherenciaSemana.si', 'adherenciaSemana.parcial', 'adherenciaSemana.no', 'adherenciaSemana.diasTranscurridos',
  'comida.verCifras', 'comida.menus', 'comida.menus.nombre', 'comida.menus.comidas', 'comida.menus.comidas.hora', 'comida.menus.comidas.titulo',
  'comida.menus.comidas.alimentos', 'comida.menus.comidas.nota', 'comida.equivalencias', 'comida.equivalencias.grupo', 'comida.equivalencias.base',
  'comida.equivalencias.opciones', 'comida.seccionesEspeciales', 'comida.seccionesEspeciales.titulo', 'comida.seccionesEspeciales.contenido', 'comida.listaCompras',
]

/** Quita las claves sin valor: lo que no se dio queda fuera, no como `undefined`. */
function limpio<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as T
}

function ejercicioVisto(e: EjercicioPrescrito): EjercicioVisto {
  const rojo = e.escenarios?.rojo
  return limpio({
    id: e.id,
    nombre: e.nombre,
    categoria: e.categoria,
    prescripcion: e.prescripcion,
    cargaKg: e.cargaKg,
    unidadCarga: e.unidadCarga,
    sets: e.sets,
    rango: e.rango,
    repsDiana: e.repsDiana,
    rirObjetivo: e.rirObjetivo,
    seriesPrescritas: e.seriesPrescritas?.map((s) => ({ orden: s.orden, reps: s.reps, rir: s.rir, cargaKg: s.cargaKg })),
    etiquetasSeries: e.etiquetasSeries ? [...e.etiquetasSeries] : undefined,
    descansoMin: e.descansoMin,
    cues: e.cues,
    notaCoach: e.notaCoach,
    escenarioRojo: rojo ? limpio({ deltaRir: rojo.deltaRir, sueloRir: rojo.sueloRir, quitarUltimaSerie: rojo.quitarUltimaSerie }) : undefined,
    series: (e.series ?? []).map((s) => limpio({ orden: s.orden, cargaKg: s.cargaKg, reps: s.reps, rir: s.rir })),
  })
}

const parteVista = (p: { titulo: string; indicaciones: string; duracionMin?: number }): ParteVista =>
  limpio({ titulo: p.titulo, indicaciones: p.indicaciones, duracionMin: p.duracionMin })

function sesionVista(s: Sesion): SesionVista {
  return limpio({
    id: s.id,
    nombre: s.nombre,
    dia: s.dia,
    fecha: s.fecha,
    ejercicios: (s.ejercicios ?? []).map(ejercicioVisto),
    preparacion: (s.preparacion ?? []).map(parteVista),
    bloquesCardio: (s.bloquesCardio ?? []).map(parteVista),
    testPost: s.testPost ? { duracionMin: s.testPost.duracionMin, rpeSesion: s.testPost.rpeSesion } : undefined,
  })
}

function microcicloVisto(m: Microciclo): MicrocicloVisto {
  return { numero: m.numero, fechaInicio: m.fechaInicio, cadenciaDias: m.cadenciaDias, sesiones: (m.sesiones ?? []).map(sesionVista) }
}

function checkinVisto(c: CheckinDiario): CheckinVisto {
  return limpio({
    fecha: c.fecha,
    horasSueno: c.horasSueno,
    horaAcostarse: c.horaAcostarse,
    horaLevantarse: c.horaLevantarse,
    calidadSueno: c.calidadSueno,
    cansancio: c.cansancio,
    entreno: c.entreno,
    rendimiento: c.rendimiento,
    motivacion: c.motivacion,
    dolor: c.dolor,
    dolorDonde: c.dolorDonde,
    hambreEscala: c.hambreEscala,
    alimentacion: c.alimentacion,
    estres: c.estres,
    pasos: c.pasos,
    comentarios: c.comentarios,
  })
}

function comidaVista(p: PlanNutricional, v: VisibilidadAsesorado | undefined): ComidaVista {
  return {
    // Las cifras (kcal, macros) NO se copian en ningún caso: hoy Praxis no las dice. El
    // interruptor viaja para que quien responda sepa que tampoco debe deducirlas.
    verCifras: !!v && v.verComposicion && v.verObjetivoCalorico && v.verContadorKcal,
    menus: (p.menus ?? []).map((m) => ({
      nombre: m.nombre,
      comidas: (m.comidas ?? []).map((c) => limpio({ hora: c.hora, titulo: c.titulo, alimentos: [...(c.alimentos ?? [])], nota: c.nota })),
    })),
    equivalencias: (p.equivalencias ?? []).map((e) => ({ grupo: e.grupo, base: e.base, opciones: [...(e.opciones ?? [])] })),
    seccionesEspeciales: (p.seccionesEspeciales ?? []).map((s) => ({ titulo: s.titulo, contenido: s.contenido })),
    listaCompras: [...(p.listaCompras ?? [])],
  }
}

/** `2026-10-01` menos `dias` días, en el mismo formato. */
export function fechaMenos(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - dias)
  return d.toISOString().slice(0, 10)
}

function procedenciaDe(c: CheckinDiario, campo: 'pasos' | 'horasSueno'): ProcedenciaDelDia | undefined {
  if (typeof c[campo] !== 'number') return undefined
  if (!c.anotadoHoy) return 'sin_marca'
  return c.anotadoHoy.includes(campo) ? 'anotado' : 'arrastrado'
}

function checkinHoyVisto(c: CheckinDiario): CheckinHoyVisto {
  return { campos: checkinVisto(c), procedencia: limpio({ pasos: procedenciaDe(c, 'pasos'), horasSueno: procedenciaDe(c, 'horasSueno') }) }
}

/** El lunes de la semana de `fecha` (la semana corre de lunes a domingo). */
export function lunesDeLaSemana(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay()
  return fechaMenos(fecha, (dia + 6) % 7)
}

function semanaVista(adherencias: AdherenciaNutricional[], usuarioId: string, hoy: string): AdherenciaSemanaVista | null {
  const desde = lunesDeLaSemana(hoy)
  const porDia = new Map<string, AdherenciaNutricional['estado']>()
  for (const a of adherencias) {
    if (a.usuarioId === usuarioId && a.fecha >= desde && a.fecha <= hoy) porDia.set(a.fecha, a.estado)
  }
  if (porDia.size === 0) return null
  const estados = [...porDia.values()]
  return {
    desde,
    hasta: hoy,
    si: estados.filter((e) => e === 'si').length,
    parcial: estados.filter((e) => e === 'parcial').length,
    no: estados.filter((e) => e === 'no').length,
    diasTranscurridos: Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400000) + 1,
  }
}

export function loQuePraxisVe(crudo: CrudoDePersona, hoy: string): LoQuePraxisVe {
  const mios = crudo.microciclos.filter((m) => m.usuarioId === crudo.usuarioId)
  // Solo `activo` y `cerrado`. Lo demás —`propuesto` y cualquier estado que aparezca
  // mañana— se trata como no aprobado.
  const activos = mios.filter((m) => m.estado === 'activo').sort((a, b) => b.numero - a.numero)
  const cerrados = mios.filter((m) => m.estado === 'cerrado').sort((a, b) => b.numero - a.numero)

  const desde = fechaMenos(hoy, DIAS_DE_REGISTRO - 1)
  const enVentana = (f: string) => f >= desde && f <= hoy
  const checkins = crudo.checkins
    .filter((c) => c.usuarioId === crudo.usuarioId && enVentana(c.fecha))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(checkinVisto)

  const hoyCheckin = crudo.checkins.filter((c) => c.usuarioId === crudo.usuarioId && c.fecha === hoy).at(-1)
  const aguaMl = Math.max(0, crudo.hidratacionHoyMl ?? 0)

  const p = crudo.perfil && crudo.perfil.usuarioId === crudo.usuarioId ? crudo.perfil : undefined
  const perfil: PerfilVisto | null = p
    ? limpio({
        objetivos: p.objetivos || undefined,
        diasDisponibles: p.diasDisponibles ? [...p.diasDisponibles] : undefined,
        tiempoSesionMin: p.tiempoSesionMin,
        faseEnergetica: p.faseEnergetica,
        pasosObjetivo: p.pasosObjetivo,
      })
    : null

  const plan = crudo.planNutricional && crudo.planNutricional.usuarioId === crudo.usuarioId ? crudo.planNutricional : undefined
  const visibilidad = crudo.visibilidad && crudo.visibilidad.usuarioId === crudo.usuarioId ? crudo.visibilidad : undefined

  const ve: LoQuePraxisVe = {
    activo: activos[0] ? microcicloVisto(activos[0]) : null,
    cerrados: cerrados.map(microcicloVisto),
    perfil,
    checkins,
    adherencias: crudo.adherencias
      .filter((a) => a.usuarioId === crudo.usuarioId && enVentana(a.fecha))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((a) => ({ fecha: a.fecha, estado: a.estado })),
    hidratacionHoyMl: aguaMl,
    aguaHoy: aguaMl > 0 ? { fecha: hoy, ml: aguaMl } : null,
    checkinHoy: hoyCheckin ? checkinHoyVisto(hoyCheckin) : null,
    adherenciaSemana: semanaVista(crudo.adherencias, crudo.usuarioId, hoy),
    comida: plan ? comidaVista(plan, visibilidad) : null,
    falta: [],
  }
  if (!ve.activo) ve.falta.push('plan_activo')
  if (!ve.perfil) ve.falta.push('perfil')
  if (ve.checkins.length === 0) ve.falta.push('checkins')
  if (!ve.comida) ve.falta.push('plan_de_comida')
  return ve
}
