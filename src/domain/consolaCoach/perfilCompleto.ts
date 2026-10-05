import type {
  AdherenciaNutricional,
  CheckinDiario,
  Cribado,
  EstadoCribado,
  MedidaCorporal,
  Microciclo,
  Perfil,
  PerfilNutricion,
} from '../types'
import { resumenMicrociclo } from '../cumplimiento'
import { MEDIDA_POR_CLAVE, esClaveDeMedida } from '../medidas'

/**
 * EL PERFIL COMPLETO DE UNA PERSONA, TAL COMO LO LEE LA CONSOLA.
 *
 * Funciones puras sobre lo que ya bajó el repositorio. Ninguna inventa un dato: si falta,
 * devuelven `undefined` o una lista vacía, y quien pinta dice QUÉ falta.
 *
 * El peso y los perímetros viven en TRES sitios y aquí se cruzan los tres (lección del
 * 6-sep: cinco personas «sin una sola medida» tenían sus números en el formulario de
 * nutrición):
 *   1. `perfiles.datos.medidas[]` — las medidas de la ficha (peso, `perimetros`, `cuerpo`).
 *   2. `perfil_alimentario.respuestas` — `pesoKg`, `cinturaCm`, `caderaCm`, `cuelloCm`,
 *      fechados con `completada_en`.
 *   3. `checkins.datos.pesoKg` — el peso del check-in diario.
 * Cada punto lleva su `fuente`: no se funden en uno ni se promedian.
 */

export type FuenteDato = 'medida' | 'formulario' | 'checkin'

export interface PuntoSerie {
  fecha: string
  valor: number
  fuente: FuenteDato
}

const ETIQUETA_FUENTE: Record<FuenteDato, string> = {
  medida: 'medida de la ficha',
  formulario: 'formulario de nutrición',
  checkin: 'check-in',
}

export function etiquetaFuente(fuente: FuenteDato): string {
  return ETIQUETA_FUENTE[fuente]
}

/** `2026-09-17` → `17 sep`, sin depender del idioma del navegador. */
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  if (!m || !d) return iso
  return `${d} ${MESES_CORTOS[m - 1]}`
}

function numero(valor: unknown): number | undefined {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor.replace(',', '.'))
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function fechaDe(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const f = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : undefined
}

function ordenar(puntos: PuntoSerie[]): PuntoSerie[] {
  return [...puntos].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** El peso en el tiempo, de las tres fuentes. Ordenado por fecha, sin fundir fuentes. */
export function seriePeso(
  checkins: readonly CheckinDiario[],
  medidas: readonly MedidaCorporal[],
  perfilNutricion: PerfilNutricion | undefined,
): PuntoSerie[] {
  const puntos: PuntoSerie[] = []
  for (const c of checkins) {
    const kg = numero(c.pesoKg)
    if (kg !== undefined && kg > 0) puntos.push({ fecha: c.fecha, valor: kg, fuente: 'checkin' })
  }
  for (const m of medidas) {
    const kg = numero(m.pesoKg)
    if (kg !== undefined && kg > 0) puntos.push({ fecha: m.fecha, valor: kg, fuente: 'medida' })
  }
  const fechaForm = fechaDe(perfilNutricion?.completadaEn)
  const kgForm = numero(perfilNutricion?.respuestas.pesoKg)
  if (fechaForm && kgForm !== undefined && kgForm > 0) {
    puntos.push({ fecha: fechaForm, valor: kgForm, fuente: 'formulario' })
  }
  return ordenar(puntos)
}

export type CampoNumericoCheckin = 'horasSueno' | 'dolor' | 'pasos' | 'hambreEscala'

/** Una señal numérica del check-in en el tiempo (sueño, dolor, pasos, hambre). */
export function serieDeCheckins(checkins: readonly CheckinDiario[], campo: CampoNumericoCheckin): PuntoSerie[] {
  const puntos: PuntoSerie[] = []
  for (const c of checkins) {
    const v = c[campo]
    if (typeof v === 'number' && Number.isFinite(v)) puntos.push({ fecha: c.fecha, valor: v, fuente: 'checkin' })
  }
  return ordenar(puntos)
}

/** Las claves del formulario de nutrición que son perímetros, con el nombre con que se pintan. */
const PERIMETROS_DEL_FORMULARIO: Record<string, string> = {
  cinturaCm: 'Cintura',
  caderaCm: 'Cadera',
  cuelloCm: 'Cuello',
}

/**
 * Los perímetros en el tiempo, por nombre. Los nombres de `perimetros` se respetan tal
 * cual vienen («Glúteo» y «Glúteos» quedan separados): juntarlos sería decidir que son el
 * mismo sitio de medida, y eso no lo sabe la consola.
 */
export function seriesPerimetros(
  medidas: readonly MedidaCorporal[],
  perfilNutricion: PerfilNutricion | undefined,
): Map<string, PuntoSerie[]> {
  const series = new Map<string, PuntoSerie[]>()
  const anadir = (nombre: string, punto: PuntoSerie) => {
    const lista = series.get(nombre) ?? []
    lista.push(punto)
    series.set(nombre, lista)
  }

  for (const m of medidas) {
    for (const [nombre, valor] of Object.entries(m.perimetros ?? {})) {
      const cm = numero(valor)
      if (cm !== undefined && cm > 0) anadir(nombre, { fecha: m.fecha, valor: cm, fuente: 'medida' })
    }
    for (const [clave, valor] of Object.entries(m.cuerpo ?? {})) {
      const cm = numero(valor)
      if (cm === undefined || cm <= 0 || !esClaveDeMedida(clave)) continue
      anadir(MEDIDA_POR_CLAVE[clave].etiqueta, { fecha: m.fecha, valor: cm, fuente: 'medida' })
    }
  }

  const fechaForm = fechaDe(perfilNutricion?.completadaEn)
  if (fechaForm && perfilNutricion) {
    for (const [clave, nombre] of Object.entries(PERIMETROS_DEL_FORMULARIO)) {
      const cm = numero(perfilNutricion.respuestas[clave])
      if (cm !== undefined && cm > 0) anadir(nombre, { fecha: fechaForm, valor: cm, fuente: 'formulario' })
    }
  }

  for (const [nombre, lista] of series) series.set(nombre, ordenar(lista))
  return series
}

export interface Tendencia {
  ultimo: PuntoSerie
  /** Diferencia con el primer punto de la ventana; `undefined` si solo hay un punto. */
  delta?: number
  desde?: PuntoSerie
}

/**
 * El último valor y su cambio frente al punto más antiguo dentro de `ventanaDias` antes de
 * él. Sin un segundo punto en la ventana, no hay tendencia — no se extrapola.
 */
export function tendencia(serie: readonly PuntoSerie[], ventanaDias = 28): Tendencia | undefined {
  if (serie.length === 0) return undefined
  const ultimo = serie[serie.length - 1]
  const limite = new Date(`${ultimo.fecha}T00:00:00Z`).getTime() - ventanaDias * 86_400_000
  const desde = serie.find((p) => new Date(`${p.fecha}T00:00:00Z`).getTime() >= limite && p !== ultimo)
  if (!desde || desde.fecha === ultimo.fecha) return { ultimo }
  return { ultimo, desde, delta: Math.round((ultimo.valor - desde.valor) * 10) / 10 }
}

// ── Adherencia ────────────────────────────────────────────────────────────────────────

export interface AdherenciaMicrociclo {
  id: string
  numero: number
  fechaInicio: string
  estado: Microciclo['estado']
  pct: number
  registradas: number
  totales: number
}

/** Una barra por microciclo (activo y cerrados; las propuestas no se han entrenado). */
export function adherenciaPorMicrociclo(historial: readonly Microciclo[]): AdherenciaMicrociclo[] {
  return historial
    .filter((m) => m.estado !== 'propuesto')
    .map((m) => {
      const r = resumenMicrociclo(m)
      return {
        id: m.id,
        numero: m.numero,
        fechaInicio: m.fechaInicio,
        estado: m.estado,
        pct: r.pctRegistrado,
        registradas: r.sesionesRegistradas,
        totales: r.sesionesTotales,
      }
    })
    .sort((a, b) => a.numero - b.numero)
}

export interface SemanaNutricional {
  /** Lunes de la semana (ISO). */
  semana: string
  si: number
  parcial: number
  no: number
}

function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  const dia = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dia)
  return d.toISOString().slice(0, 10)
}

/** Las marcas de adherencia nutricional agrupadas por semana (lunes a domingo). */
export function adherenciaNutricionalPorSemana(adherencias: readonly AdherenciaNutricional[]): SemanaNutricional[] {
  const porSemana = new Map<string, SemanaNutricional>()
  for (const a of adherencias) {
    const semana = lunesDe(a.fecha)
    const fila = porSemana.get(semana) ?? { semana, si: 0, parcial: 0, no: 0 }
    fila[a.estado] += 1
    porSemana.set(semana, fila)
  }
  return [...porSemana.values()].sort((a, b) => a.semana.localeCompare(b.semana))
}

// ── Cribado ───────────────────────────────────────────────────────────────────────────

export type ColorCribado = 'rojo' | 'ambar' | 'verde' | 'sin_dato'

export interface LecturaCribado {
  color: ColorCribado
  motivo: string
  /** Los campos con «sí», con su etiqueta y el detalle que escribió la persona. */
  positivos: { campo: string; etiqueta: string; detalle?: string }[]
  /** Campos que no se preguntaron (`no_declarado` o ausentes). */
  sinDeclarar: string[]
}

const CAMPOS_CRIBADO: { campo: keyof Cribado; etiqueta: string }[] = [
  { campo: 'sintomasConEsfuerzo', etiqueta: 'Síntomas con el esfuerzo' },
  { campo: 'medicacionCronica', etiqueta: 'Medicación crónica' },
  { campo: 'diagnostico', etiqueta: 'Diagnóstico' },
  { campo: 'tratamientoActivo', etiqueta: 'Tratamiento activo' },
  { campo: 'quienLoLleva', etiqueta: 'Quién lo lleva' },
  { campo: 'autorizacionSanitaria', etiqueta: 'Autorización sanitaria' },
  { campo: 'restriccionesExplicitas', etiqueta: 'Restricciones explícitas' },
  { campo: 'nivelFuncional', etiqueta: 'Nivel funcional limitado' },
  { campo: 'queLeHanDichoQueNoHaga', etiqueta: 'Le han dicho que no haga' },
]

const CAMPOS_PARQ: { campo: keyof Cribado; clave: string; etiqueta: string }[] = [
  { campo: 'parqEnfermedadCardiaca', clave: 'parq_enfermedad_cardiaca', etiqueta: 'PAR-Q · enfermedad cardíaca' },
  { campo: 'parqMedicamentoPresion', clave: 'parq_medicamento_presion', etiqueta: 'PAR-Q · medicamento para la presión' },
  { campo: 'parqHuesosArticulaciones', clave: 'parq_huesos_articulaciones', etiqueta: 'PAR-Q · huesos o articulaciones' },
]

function detalleDe(cribado: Cribado, campo: string): string | undefined {
  const snake = campo.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)
  const texto = cribado.detalle?.[campo] ?? cribado.detalle?.[snake]
  return typeof texto === 'string' && texto.trim() ? texto.trim() : undefined
}

/**
 * El semáforo del cribado. ES DESCRIPTIVO, NO UNA REGLA CLÍNICA NUEVA: la consola no
 * decide si alguien puede entrenar (eso es del coach, `necesitaCribado.ts`).
 *   rojo  → declara síntomas con el esfuerzo o enfermedad cardíaca en el PAR-Q, las dos
 *           preguntas que la casa trata como críticas.
 *   ámbar → cualquier otro «sí».
 *   verde → contestado, sin ningún «sí».
 *   sin_dato → no hay fila de cribado.
 *
 * LA MEDICACIÓN CRÓNICA ES ÁMBAR, NUNCA ROJO POR SÍ SOLA (decisión de Bryan, 26-sep): se
 * ve y avisa —el motivo la nombra— pero no sube a rojo. El rojo por medicación lo marca
 * Bryan a mano, no esta lectura.
 */
export function leerCribado(cribado: Cribado | undefined): LecturaCribado {
  if (!cribado) {
    return { color: 'sin_dato', motivo: 'Sin cribado contestado', positivos: [], sinDeclarar: [] }
  }
  const positivos: LecturaCribado['positivos'] = []
  const sinDeclarar: string[] = []

  for (const { campo, etiqueta } of CAMPOS_CRIBADO) {
    const valor = cribado[campo] as EstadoCribado | undefined
    if (valor === 'presente') positivos.push({ campo, etiqueta, detalle: detalleDe(cribado, campo) })
    else if (valor === undefined || valor === 'no_declarado') sinDeclarar.push(etiqueta)
  }
  for (const { campo, clave, etiqueta } of CAMPOS_PARQ) {
    const valor = cribado[campo] as boolean | undefined
    if (valor === true) positivos.push({ campo, etiqueta, detalle: cribado.detalle?.[clave] ?? detalleDe(cribado, campo) })
    else if (valor === undefined) sinDeclarar.push(etiqueta)
  }

  const critico = cribado.sintomasConEsfuerzo === 'presente' || cribado.parqEnfermedadCardiaca === true
  if (critico) {
    return { color: 'rojo', motivo: 'Declara un síntoma crítico', positivos, sinDeclarar }
  }
  if (positivos.length > 0) {
    const cuantas = `${positivos.length} respuesta${positivos.length === 1 ? '' : 's'} con «sí»`
    return {
      color: 'ambar',
      motivo: cribado.medicacionCronica === 'presente' ? `Toma medicación crónica · ${cuantas}` : cuantas,
      positivos,
      sinDeclarar,
    }
  }
  return { color: 'verde', motivo: 'Sin respuestas positivas', positivos, sinDeclarar }
}

// ── Perfil legible ────────────────────────────────────────────────────────────────────

export interface DatoPerfil {
  etiqueta: string
  valor: string
}

function edadDesdeNacimiento(nacimiento: unknown, hoy: string): number | undefined {
  if (typeof nacimiento !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(nacimiento)) return undefined
  const [a, m, d] = nacimiento.slice(0, 10).split('-').map(Number)
  const [ha, hm, hd] = hoy.split('-').map(Number)
  let edad = ha - a
  if (hm < m || (hm === m && hd < d)) edad -= 1
  return edad > 0 && edad < 110 ? edad : undefined
}

/** La edad: la de la ficha si es un número real; si no, la que da la fecha de nacimiento del formulario. */
export function edadDe(perfil: Perfil | undefined, perfilNutricion: PerfilNutricion | undefined, hoy: string): number | undefined {
  if (perfil && typeof perfil.edad === 'number' && perfil.edad > 0) return perfil.edad
  return edadDesdeNacimiento(perfilNutricion?.respuestas.fechaNacimiento, hoy)
}

/**
 * El objetivo, partido en su titular y sus apartados. Muchos `objetivos` son la carta del
 * microciclo con apartados separados por « || » y un «TÍTULO: texto» en cada uno: se
 * respetan tal cual, solo se separan para poder leerlos.
 */
export function partirObjetivo(objetivos: string | undefined): { titular?: string; apartados: { titulo?: string; texto: string }[] } {
  const texto = (objetivos ?? '').trim()
  if (!texto) return { apartados: [] }
  const trozos = texto.split(/\s*\|\|\s*/).filter(Boolean)
  const apartados = trozos.map((t) => {
    const m = /^([A-ZÁÉÍÓÚÑÜ0-9 ,.·()«»-]{3,60}):\s+([\s\S]+)$/.exec(t)
    return m ? { titulo: m[1].trim(), texto: m[2].trim() } : { texto: t }
  })
  const [primero, ...resto] = apartados
  if (!primero.titulo && primero.texto.includes(' — ')) {
    const [titular, ...cuerpo] = primero.texto.split(' — ')
    return { titular: titular.trim(), apartados: [{ texto: cuerpo.join(' — ').trim() }, ...resto] }
  }
  return { apartados }
}

const ETIQUETAS_ALIMENTACION: Record<string, string> = {
  alergias: 'Alergias',
  excluye: 'Excluye',
  noLeGustan: 'No le gustan',
  condicionesMedicas: 'Condiciones médicas (formulario)',
  comeVisceras: 'Come vísceras',
  frecuenciaCocina: 'Cocina',
  lugarCompra: 'Compra en',
  presupuestoSemanal: 'Presupuesto semanal',
  tieneBascula: 'Báscula de cocina',
  cicloMenstrual: 'Ciclo menstrual',
  sinAcceso: 'Sin acceso a',
  pasosDiarios: 'Pasos diarios (dichos)',
  diasEntreno: 'Días de entreno (dichos)',
}

function textoDeRespuesta(valor: unknown): string | undefined {
  if (Array.isArray(valor)) {
    const limpio = valor.filter((v) => typeof v === 'string' && v.trim()).map((v) => String(v).replace(/_/g, ' '))
    return limpio.length ? limpio.join(', ') : undefined
  }
  if (typeof valor === 'number') return String(valor)
  if (typeof valor === 'string' && valor.trim()) return valor.replace(/_/g, ' ').trim()
  return undefined
}

/** Lo que el formulario de nutrición dice de su alimentación, en pares etiqueta → valor. */
export function datosAlimentacion(perfilNutricion: PerfilNutricion | undefined): DatoPerfil[] {
  if (!perfilNutricion) return []
  const datos: DatoPerfil[] = []
  for (const [clave, etiqueta] of Object.entries(ETIQUETAS_ALIMENTACION)) {
    const valor = textoDeRespuesta(perfilNutricion.respuestas[clave])
    if (valor) datos.push({ etiqueta, valor })
  }
  return datos
}

// ── Plan estratégico en tabla ─────────────────────────────────────────────────────────

/** Quita el marcado de Markdown que trae el plan (negritas, cursivas, enlaces) sin tocar el texto. */
export function sinMarkdown(texto: string): string {
  return texto
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

export interface TablaPlan {
  cabecera: string[]
  filas: { numero: number; celdas: string[]; actual: boolean }[]
}

/**
 * `contenido.cabecera` + `contenido.filas` (un objeto por número de microciclo con sus
 * `columnas`) como tabla. `undefined` si el contenido no trae esa forma: entonces no se
 * pinta tabla, no se inventa una.
 */
export function tablaDelPlan(contenido: unknown, numeroActual: number | undefined): TablaPlan | undefined {
  if (typeof contenido !== 'object' || contenido === null) return undefined
  const c = contenido as Record<string, unknown>
  if (!Array.isArray(c.cabecera) || typeof c.filas !== 'object' || c.filas === null) return undefined
  const cabecera = c.cabecera.filter((x): x is string => typeof x === 'string')
  if (cabecera.length === 0) return undefined

  const filas: TablaPlan['filas'] = []
  for (const [clave, fila] of Object.entries(c.filas as Record<string, unknown>)) {
    const n = Number(clave)
    if (!Number.isFinite(n) || typeof fila !== 'object' || fila === null) continue
    const columnas = (fila as Record<string, unknown>).columnas
    if (typeof columnas !== 'object' || columnas === null) continue
    const celdas = cabecera.map((col) => {
      const v = (columnas as Record<string, unknown>)[col]
      return typeof v === 'string' ? sinMarkdown(v) : v === undefined || v === null ? '' : String(v)
    })
    filas.push({ numero: n, celdas, actual: numeroActual === n })
  }
  if (filas.length === 0) return undefined
  filas.sort((a, b) => a.numero - b.numero)
  return { cabecera, filas }
}
