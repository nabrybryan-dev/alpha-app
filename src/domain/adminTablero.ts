/**
 * Dominio puro del Área administrativa (migración 0102; ESPEC-ADMINISTRACION-INTERACTIVA.md).
 *
 * La tabla `admin_tablero` guarda UNA fila por sección y corte con un `datos` jsonb que escribe un
 * importador. Este archivo decide qué de eso se puede pintar:
 *
 *   · `validarDatos` revisa el jsonb y dice el motivo si no cuadra; un dato malo NUNCA se pinta a
 *     medias ni se convierte en «0» o en texto inventado.
 *   · «Sin dato = gris FALTA»: una sección sin filas, o una cifra vacía, se dicen como FALTA.
 *   · `ultimoCortePorSeccion` se queda con el corte más reciente de cada sección.
 *   · `requiereAccion` es lo que usa el filtro «todo / requiere acción».
 *
 * Sin React, sin red, sin fecha del sistema: se prueba con datos en la mano.
 */

export const SECCIONES = ['finanzas', 'plan', 'propuestas', 'desvios', 'influencers', 'mercadeo', 'plataforma'] as const
export type Seccion = (typeof SECCIONES)[number]

/** Nombre y orden de la pantalla (el orden de la espec, de arriba abajo). */
export const NOMBRE_SECCION: Record<Seccion, string> = {
  finanzas: 'Finanzas',
  plan: 'Plan estratégico',
  propuestas: 'Lo que proponen los agentes',
  desvios: 'Desvíos',
  influencers: 'Influencers (bola de nieve)',
  mercadeo: 'Mercadeo',
  plataforma: 'Plataforma Alpha y estudio',
}

/** Qué falta cuando una sección no tiene ni un corte cargado, y de quién es. */
export const FALTA_SECCION: Record<Seccion, string> = {
  finanzas: 'el corte de finanzas (finanzas.json) que carga Bryan',
  plan: 'el avance del plan de 90 días y de la operación que carga Bryan',
  propuestas: 'las propuestas de los agentes que carga Bryan',
  desvios: 'los desvíos contra lo estandarizado que carga Bryan',
  influencers: 'el resumen de la bola de nieve que carga Bryan (el detalle vive en Creadores)',
  mercadeo: 'el resumen de mercadeo que carga Bryan (el buzón de Manuela vive en Creadores)',
  plataforma: 'el estado de la plataforma y el estudio que carga Bryan',
}

export const SEMAFOROS = ['verde', 'amarillo', 'rojo', 'gris'] as const
export type Semaforo = (typeof SEMAFOROS)[number]

/** Palabra que acompaña al color: el semáforo nunca se dice solo con color. */
export const PALABRA_SEMAFORO: Record<Semaforo, string> = {
  verde: 'Bien',
  amarillo: 'Atento',
  rojo: 'Rojo',
  gris: 'Falta',
}

export interface FuenteFila {
  archivo: string
  corte: string
  huella: string
}

export interface FilaDetalle {
  id: string
  titulo: string
  /** `''` = sin dato: la pantalla dice FALTA, nunca 0. */
  cifra: string
  semaforo: Semaforo
  dueno: string
  detalle: string
  queHacer: string
  fuente: FuenteFila
}

export interface Tarjeta {
  titulo: string
  semaforo: Semaforo
  frase: string
  cifra: string
  cifraEtiqueta: string
}

export interface PuntoGrafico {
  etiqueta: string
  valor: number
}

export interface Grafico {
  tipo: 'barras' | 'flujo'
  series: PuntoGrafico[]
}

export interface DatosSeccion {
  tarjeta: Tarjeta
  filas: FilaDetalle[]
  grafico: Grafico | null
}

/** Una fila cruda de `admin_tablero` tal como la entrega la base. */
export interface FilaAdminTablero {
  id: string
  seccion: string
  corte: string
  datos: unknown
  fuente: string | null
  huella: string | null
}

/** Una sección lista para pintar: o sus datos validados, o el motivo por el que no se pudieron leer. */
export type SeccionLeida =
  | { seccion: Seccion; estado: 'ok'; corte: string; fuente: string | null; huella: string | null; datos: DatosSeccion }
  | { seccion: Seccion; estado: 'sin_corte' }
  | { seccion: Seccion; estado: 'invalida'; corte: string; motivo: string }

export type ResultadoValidacion = { ok: true; datos: DatosSeccion } | { ok: false; motivo: string }

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const esTexto = (v: unknown): v is string => typeof v === 'string'
export const esSemaforo = (v: unknown): v is Semaforo => typeof v === 'string' && (SEMAFOROS as readonly string[]).includes(v)
export const esSeccion = (v: unknown): v is Seccion => typeof v === 'string' && (SECCIONES as readonly string[]).includes(v)

/** Dueño válido: `bryan`, `manuela` o `agente:<nombre>`; vacío = sin dueño (la pantalla lo dice). */
const DUENO_VALIDO = /^(bryan|manuela|agente:[\p{L}\p{N}_-]+)$/u

function validarFuente(v: unknown, donde: string): { ok: true; fuente: FuenteFila } | { ok: false; motivo: string } {
  if (!esObjeto(v)) return { ok: false, motivo: `${donde}: falta la fuente` }
  const { archivo, corte, huella } = v
  if (!esTexto(archivo) || !esTexto(corte) || !esTexto(huella)) {
    return { ok: false, motivo: `${donde}: la fuente debe traer archivo, corte y huella` }
  }
  return { ok: true, fuente: { archivo, corte, huella } }
}

function validarTarjeta(v: unknown): { ok: true; tarjeta: Tarjeta } | { ok: false; motivo: string } {
  if (!esObjeto(v)) return { ok: false, motivo: 'falta la tarjeta' }
  const { titulo, semaforo, frase, cifra, cifra_etiqueta: cifraEtiqueta } = v
  if (!esTexto(titulo) || titulo.trim() === '') return { ok: false, motivo: 'la tarjeta no tiene título' }
  if (!esSemaforo(semaforo)) return { ok: false, motivo: `semáforo de la tarjeta desconocido: ${JSON.stringify(semaforo)}` }
  if (!esTexto(frase) || !esTexto(cifra) || !esTexto(cifraEtiqueta)) {
    return { ok: false, motivo: 'la tarjeta debe traer frase, cifra y cifra_etiqueta como texto' }
  }
  return { ok: true, tarjeta: { titulo, semaforo, frase, cifra, cifraEtiqueta } }
}

function validarFila(v: unknown, i: number): { ok: true; fila: FilaDetalle } | { ok: false; motivo: string } {
  const donde = `fila ${i + 1}`
  if (!esObjeto(v)) return { ok: false, motivo: `${donde}: no es un objeto` }
  const { id, titulo, cifra, semaforo, dueno, detalle, que_hacer: queHacer, fuente } = v
  if (!esTexto(id) || id.trim() === '') return { ok: false, motivo: `${donde}: sin id` }
  if (!esTexto(titulo) || titulo.trim() === '') return { ok: false, motivo: `${donde} (${id}): sin título` }
  if (!esTexto(cifra)) return { ok: false, motivo: `${donde} (${id}): la cifra debe ser texto (vacío = falta)` }
  if (!esSemaforo(semaforo)) return { ok: false, motivo: `${donde} (${id}): semáforo desconocido ${JSON.stringify(semaforo)}` }
  if (!esTexto(dueno) || (dueno !== '' && !DUENO_VALIDO.test(dueno))) {
    return { ok: false, motivo: `${donde} (${id}): dueño no válido ${JSON.stringify(dueno)}` }
  }
  if (!esTexto(detalle) || !esTexto(queHacer)) return { ok: false, motivo: `${donde} (${id}): detalle y que_hacer deben ser texto` }
  const f = validarFuente(fuente, `${donde} (${id})`)
  if (!f.ok) return f
  return { ok: true, fila: { id, titulo, cifra, semaforo, dueno, detalle, queHacer, fuente: f.fuente } }
}

function validarGrafico(v: unknown): { ok: true; grafico: Grafico | null } | { ok: false; motivo: string } {
  if (v === null || v === undefined) return { ok: true, grafico: null }
  if (!esObjeto(v)) return { ok: false, motivo: 'el gráfico no es un objeto' }
  const { tipo, series } = v
  if (tipo !== 'barras' && tipo !== 'flujo') return { ok: false, motivo: `tipo de gráfico desconocido: ${JSON.stringify(tipo)}` }
  if (!Array.isArray(series)) return { ok: false, motivo: 'el gráfico no trae series' }
  const puntos: PuntoGrafico[] = []
  for (const [i, s] of series.entries()) {
    if (!esObjeto(s) || !esTexto(s.etiqueta) || typeof s.valor !== 'number' || !Number.isFinite(s.valor)) {
      return { ok: false, motivo: `gráfico, punto ${i + 1}: necesita etiqueta y un valor numérico` }
    }
    puntos.push({ etiqueta: s.etiqueta, valor: s.valor })
  }
  return { ok: true, grafico: { tipo, series: puntos } }
}

/** Valida el `datos` jsonb de una sección. Devuelve el PRIMER motivo por el que no se puede pintar. */
export function validarDatos(crudo: unknown): ResultadoValidacion {
  if (!esObjeto(crudo)) return { ok: false, motivo: 'los datos no son un objeto' }
  const t = validarTarjeta(crudo.tarjeta)
  if (!t.ok) return t
  if (!Array.isArray(crudo.filas)) return { ok: false, motivo: 'faltan las filas' }
  const filas: FilaDetalle[] = []
  const vistos = new Set<string>()
  for (const [i, f] of crudo.filas.entries()) {
    const r = validarFila(f, i)
    if (!r.ok) return r
    if (vistos.has(r.fila.id)) return { ok: false, motivo: `fila ${i + 1}: id repetido (${r.fila.id})` }
    vistos.add(r.fila.id)
    filas.push(r.fila)
  }
  const g = validarGrafico(crudo.grafico)
  if (!g.ok) return g
  return { ok: true, datos: { tarjeta: t.tarjeta, filas, grafico: g.grafico } }
}

/**
 * De todas las filas leídas, deja UNA por sección: la de corte más reciente (las fechas ISO
 * `aaaa-mm-dd` se comparan como texto). Toda sección de la espec sale, tenga o no corte, en el
 * orden de la espec. Una fila con una sección desconocida se ignora aquí; la lectura la cuenta aparte.
 */
export function ultimoCortePorSeccion(filas: readonly FilaAdminTablero[]): SeccionLeida[] {
  const mejor = new Map<Seccion, FilaAdminTablero>()
  for (const f of filas) {
    if (!esSeccion(f.seccion)) continue
    const actual = mejor.get(f.seccion)
    if (!actual || f.corte > actual.corte) mejor.set(f.seccion, f)
  }
  return SECCIONES.map((seccion): SeccionLeida => {
    const f = mejor.get(seccion)
    if (!f) return { seccion, estado: 'sin_corte' }
    const v = validarDatos(f.datos)
    if (!v.ok) return { seccion, estado: 'invalida', corte: f.corte, motivo: v.motivo }
    return { seccion, estado: 'ok', corte: f.corte, fuente: f.fuente, huella: f.huella, datos: v.datos }
  })
}

/**
 * Lo que se muestra en lugar de una cifra: la cifra, o FALTA dicho como falta. Nunca «0».
 * El importador escribe «FALTA» (o «FALTA: …») cuando no hay dato; una cifra vacía es lo mismo.
 */
export function textoCifra(cifra: string): { texto: string; falta: boolean } {
  const c = cifra.trim()
  return c === '' || /^falta(?![\p{L}\p{N}])/iu.test(c) ? { texto: 'FALTA', falta: true } : { texto: c, falta: false }
}

/** Semáforo efectivo de una sección: sin corte o inválida = gris. */
export function semaforoDe(s: SeccionLeida): Semaforo {
  return s.estado === 'ok' ? s.datos.tarjeta.semaforo : 'gris'
}

/**
 * «Requiere acción» (acuerdo con el importador, 29-sep): una FILA la requiere si su `que_hacer`
 * no está vacío; no hay otro campo que lo diga.
 */
export function filaRequiereAccion(fila: FilaDetalle): boolean {
  return fila.queHacer.trim() !== ''
}

/**
 * Una TARJETA (sección) la requiere si su semáforo es rojo o alguna de sus filas la requiere.
 * Una sección sin corte o con datos inválidos también: un dato que falta lo tiene que traer
 * alguien, y esconderla dejaría «en paz» lo que nadie ha medido.
 */
export function seccionRequiereAccion(s: SeccionLeida): boolean {
  if (s.estado !== 'ok') return true
  return s.datos.tarjeta.semaforo === 'rojo' || s.datos.filas.some(filaRequiereAccion)
}

/** Filas de una sección que piden acción, en el orden en que llegaron. */
export function filasQueRequierenAccion(filas: readonly FilaDetalle[]): FilaDetalle[] {
  return filas.filter(filaRequiereAccion)
}

/** Cuántas secciones piden acción (para el resumen de arriba). */
export function contarQueRequierenAccion(secciones: readonly SeccionLeida[]): number {
  return secciones.filter(seccionRequiereAccion).length
}

/** Dueño dicho para una persona: `agente:x` = «agente x»; vacío = sin dueño asignado. */
export function nombreDueno(dueno: string): string {
  if (dueno === '') return 'sin dueño asignado'
  if (dueno.startsWith('agente:')) return `agente ${dueno.slice('agente:'.length)}`
  return dueno === 'bryan' ? 'Bryan' : dueno === 'manuela' ? 'Manuela' : dueno
}

/** Lo que dice la tarjeta gris cuando el tablero de la 0102 todavía no se puede leer. */
export const TEXTO_PENDIENTE_0102 = 'Pendiente de activar (migración 0102)'
/** Quien mira no tiene `ver_administracion`: no es que falte la tabla, es que falta el permiso. */
export const TEXTO_SIN_PERMISO_0102 = 'Sin permiso: pídele al coach el permiso «ver_administracion»'

/**
 * ¿El fallo de lectura es que la tabla `admin_tablero` no existe (la 0102 no está aplicada)?
 * Solo ese caso se dice «pendiente de activar»; un fallo de red o de permiso (RLS) sigue siendo
 * un fallo y se pinta como tal, con «Reintentar»: nunca se disfraza de pendiente ni de «sin datos».
 */
export function esTablaAusente(error: string): boolean {
  return /could not find the table|schema cache|PGRST205|42P01|relation .*does not exist/i.test(error)
}
