/**
 * La PRUEBA con cronómetro del ingreso por voz (Bryan, 2-oct-2026): el equipo llena el cuestionario HABLANDO
 * con Praxis y ESCRIBIENDO, y se compara cuánto tarda cada forma. Nada se guarda: esto es lógica pura que la
 * pantalla `/praxis/ingreso-prueba` usa para el formulario, el cronómetro y el resultado.
 *
 * REGLA DEL RESULTADO. Lo que se copia para pasárselo a Bryan lleva SOLO tiempos y conteos (y el nombre de los
 * campos corregidos, nunca su valor). `ResultadoModo` ni siquiera tiene dónde guardar un valor del formulario.
 */
import { MENSAJES_DE_BLOQUE, camposDeVoz, campoPorId, turnosDeBloque, type CampoIngreso, type TextoDeTrato, type TurnoId, type TurnoVoz } from './guion.ts'

// ───────────────────────────── El formulario de la prueba ─────────────────────────────

export type Valores = Record<string, string>

export interface SeccionDelFormulario {
  id: 'precisos' | 'contexto' | 'rapidas' | 'salud'
  titulo: TextoDeTrato
  campos: readonly string[]
}

/** Los toques de salud, en el orden en que se preguntan. Todos son sí/no, salvo el ciclo. */
export const TOQUES_DE_SALUD: readonly string[] = [
  'parq_enfermedad_cardiaca', 'parq_medicamento_presion', 'parq_huesos_articulaciones', 'lesiones',
  'ejercicios_limitados', 'medicacion', 'alergias_restricciones', 'tca_historia', 'solo_mujeres_ciclo',
]

/** Las pocas opciones cerradas que NO son de salud: se tocan antes del bloque de sí o no. */
export const TOQUES_RAPIDOS: readonly string[] = ['genero', 'pais', 'dias_por_semana', 'cadencia_revision']

export const SECCIONES: readonly SeccionDelFormulario[] = [
  {
    id: 'precisos', titulo: { tu: 'Sobre ti', usted: 'Sobre usted' },
    campos: ['ciudad', 'edad', 'altura_cm', 'peso_actual_kg', 'peso_objetivo_kg', 'tiempo_entrenando', 'nivel_fuerza', 'marcas_fuerza'],
  },
  {
    id: 'contexto', titulo: { tu: 'Tu objetivo y tu día', usted: 'Su objetivo y su día' },
    campos: ['objetivo_principal', 'parte_a_mejorar', 'tipo_trabajo', 'dia_tipo_alimentacion', 'cocina_o_compra', 'vasos_agua'],
  },
  { id: 'rapidas', titulo: { tu: 'Datos rápidos', usted: 'Datos rápidos' }, campos: TOQUES_RAPIDOS },
  { id: 'salud', titulo: { tu: 'Salud', usted: 'Salud' }, campos: TOQUES_DE_SALUD },
]

export const IDS_FORMULARIO: readonly string[] = SECCIONES.flatMap((s) => s.campos)

/**
 * Lo que el guion tiene y esta prueba NO pone en el formulario, con su porqué (se dice en el informe).
 */
export const FUERA_DE_LA_PRUEBA: Readonly<Record<string, string>> = {
  nivel_autopercibido: 'es la misma pregunta que nivel_fuerza para quien habla («en qué nivel te sientes»)',
  fecha_nacimiento: 'la edad sale del turno hablado; la fecha de nacimiento la decidirá la landing real',
  medida_cuello_cm: 'se miden con cinta, ni voz ni toque: no comparan nada entre hablar y escribir',
  medida_cintura_natural_cm: 'ídem',
  medida_cintura_ombligo_cm: 'ídem',
  medida_cadera_cm: 'ídem',
}

const IDS_DE_VOZ: ReadonlySet<string> = new Set(camposDeVoz().map((x) => x.id))

export const idDetalle = (id: string): string => `${id}__detalle`
export const tieneDetalle = (c: CampoIngreso): boolean => c.detalle === 'teclado'
const campo = (id: string): CampoIngreso => {
  const c = campoPorId(id)
  if (!c) throw new Error(`campo desconocido en el formulario de la prueba: ${id}`)
  return c
}

/** ¿Este campo se pregunta, dado lo que ya hay? (aplica `condicion`). */
export function aplica(c: CampoIngreso, valores: Readonly<Valores>): boolean {
  return !c.condicion || valores[c.condicion.campo] === c.condicion.valor
}

/** Los campos que la persona ve ahora, en orden. */
export function camposVisibles(valores: Readonly<Valores>): CampoIngreso[] {
  return IDS_FORMULARIO.map(campo).filter((c) => aplica(c, valores))
}

const limpio = (v: string | undefined): string => (v ?? '').trim()
export const estaLleno = (valores: Readonly<Valores>, id: string): boolean => limpio(valores[id]) !== ''

/** Campos llenos y campos que se piden (los opcionales no cuentan entre los que se piden). */
export function contarLlenos(valores: Readonly<Valores>): { llenos: number; total: number } {
  const pedidos = camposVisibles(valores).filter((c) => !c.opcional)
  return { llenos: pedidos.filter((c) => estaLleno(valores, c.id)).length, total: pedidos.length }
}

/**
 * Lo que dijo la voz, al formulario. Solo entra un campo que la voz puede llenar: un campo de salud o uno que no
 * existe se ignora aunque llegue (defensa en el cliente, además de la del servidor).
 */
export function valoresDeExtraccion(campos: Readonly<Record<string, string | number>>): Valores {
  const salida: Valores = {}
  for (const [id, v] of Object.entries(campos)) {
    if (!IDS_DE_VOZ.has(id)) continue
    const texto = String(v).trim()
    if (texto) salida[id] = texto
  }
  return salida
}

const comoNumero = (v: string): number | null => {
  const n = Number(v.replace(',', '.'))
  return v !== '' && Number.isFinite(n) ? n : null
}
function iguales(a: string | undefined, b: string | undefined): boolean {
  const x = limpio(a), y = limpio(b)
  if (x === y) return true
  const nx = comoNumero(x), ny = comoNumero(y)
  return nx !== null && ny !== null && nx === ny
}

/** Ids de los campos (no de sus detalles) cuyo valor cambió entre dos fotos del formulario. */
export function camposCorregidos(antes: Readonly<Valores>, despues: Readonly<Valores>): string[] {
  return IDS_FORMULARIO.filter((id) => {
    const c = campo(id)
    if (!aplica(c, antes) && !aplica(c, despues)) return false
    return !iguales(antes[id], despues[id]) || (tieneDetalle(c) && !iguales(antes[idDetalle(id)], despues[idDetalle(id)]))
  })
}

/**
 * El siguiente toque por contestar: el primero de la lista que aplica y aún no tiene respuesta ni se saltó. Lo de
 * salud que la voz ya dejó entrever (`prioritarios`) va primero dentro de su lista, sin romper las condiciones:
 * una pregunta que depende de otra solo aplica cuando ya se contestó la de la que depende.
 */
export function siguienteToque(
  lista: readonly string[],
  valores: Readonly<Valores>,
  saltados: ReadonlySet<string> = new Set(),
  prioritarios: readonly string[] = [],
): CampoIngreso | null {
  const orden = [...lista].sort((a, b) => Number(prioritarios.includes(b)) - Number(prioritarios.includes(a)))
  for (const id of orden) {
    const c = campo(id)
    if (aplica(c, valores) && !estaLleno(valores, id) && !saltados.has(id)) return c
  }
  return null
}

// ───────────────────────────── La respuesta del servidor ─────────────────────────────

export type LineaDeAyudaIngreso = 'vida' | 'pareja' | 'nino'
export type DerivacionIngreso = {
  filtro: string | null
  riesgo: { tipo: 'quieta'; linea: LineaDeAyudaIngreso } | { tipo: 'cuidado' } | null
  urgencia: 'alta' | null
}

/** Lo que `accion: 'ingreso'` devuelve para un turno, o por qué no se pudo. */
export type RespuestaIngreso =
  | {
    ok: true; derivada: false; turno: TurnoId
    campos: Record<string, string | number>
    temas: string[]
    /** Los toques de salud que lo hablado hace urgentes. */
    toques: string[]
    descartados: { campo: string; motivo: string }[]
  }
  | { ok: true; derivada: true; turno: TurnoId; derivacion: DerivacionIngreso }
  | { ok: false; motivo: 'no_desplegada' | 'sin_sesion' | 'red' | 'limite' | 'no_entendi' | 'frase' }

// ───────────────────────────── El cronómetro ─────────────────────────────

export type ModoPrueba = 'voz' | 'escribir'
/** Por dónde va la persona. «sino» incluye los toques cerrados que no son de salud. */
export type Segmento = 'preciso' | 'contexto' | 'sino' | 'revision' | 'escribir'

export const ROTULO_SEGMENTO: Record<Segmento, string> = {
  preciso: 'Preciso',
  contexto: 'Contexto',
  sino: 'Sí o no y toques',
  revision: 'Revisión',
  escribir: 'Escribir todo',
}
export const SEGMENTOS_DE: Record<ModoPrueba, readonly Segmento[]> = {
  voz: ['preciso', 'contexto', 'sino', 'revision'],
  escribir: ['escribir'],
}

export interface Cronometro {
  modo: ModoPrueba
  inicio: number
  segmento: Segmento
  desde: number
  acumulado: Readonly<Partial<Record<Segmento, number>>>
  fin: number | null
}

export function iniciarCronometro(modo: ModoPrueba, ahora: number): Cronometro {
  return { modo, inicio: ahora, segmento: SEGMENTOS_DE[modo][0], desde: ahora, acumulado: {}, fin: null }
}

const sumar = (c: Cronometro, hasta: number): Partial<Record<Segmento, number>> => ({
  ...c.acumulado,
  [c.segmento]: (c.acumulado[c.segmento] ?? 0) + Math.max(0, hasta - c.desde),
})

/** Cierra el segmento actual y abre otro. Pasar al mismo segmento, o a uno cuando ya terminó, no cambia nada. */
export function pasarASegmento(c: Cronometro, segmento: Segmento, ahora: number): Cronometro {
  if (c.fin !== null || c.segmento === segmento) return c
  return { ...c, acumulado: sumar(c, ahora), segmento, desde: ahora }
}

/** Para el cronómetro (el toque en «Confirmar»). Parar dos veces deja la primera hora. */
export function detenerCronometro(c: Cronometro, ahora: number): Cronometro {
  if (c.fin !== null) return c
  return { ...c, acumulado: sumar(c, ahora), desde: ahora, fin: ahora }
}

export function tiempos(c: Cronometro, ahora: number): { totalMs: number; segmentosMs: Partial<Record<Segmento, number>> } {
  const corte = c.fin ?? ahora
  return { totalMs: Math.max(0, corte - c.inicio), segmentosMs: c.fin === null ? sumar(c, ahora) : { ...c.acumulado } }
}

/** `2:31`; con horas, `1:02:03`. */
export function formatoTiempo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const dos = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dos(m)}:${dos(r)}` : `${m}:${dos(r)}`
}

// ───────────────────────────── El resultado ─────────────────────────────

export interface ConteosDeTurnos {
  porVoz: number
  porTeclado: number
  /** Turnos que la persona tuvo que repetir (no se entendió o el servidor falló). */
  repetidos: number
  /** Turnos que Praxis detuvo por riesgo o salud. */
  detenidos: number
}

/** Nada de esto lleva un valor del formulario: solo tiempos, conteos y el NOMBRE de los campos corregidos. */
export interface ResultadoModo {
  modo: ModoPrueba
  totalMs: number
  segmentosMs: Partial<Record<Segmento, number>>
  camposLlenos: number
  camposTotales: number
  corregidos: { etiquetas: string[]; deSalud: number } | null
  turnos: ConteosDeTurnos | null
}

export function armarResultado(entrada: {
  cronometro: Cronometro
  final: Readonly<Valores>
  /** El formulario tal como llegó a la revisión (solo en voz). */
  alLlegarALaRevision?: Readonly<Valores>
  turnos?: ConteosDeTurnos
}): ResultadoModo {
  const { cronometro, final, alLlegarALaRevision, turnos } = entrada
  const { totalMs, segmentosMs } = tiempos(cronometro, cronometro.fin ?? cronometro.desde)
  const { llenos, total } = contarLlenos(final)
  let corregidos: ResultadoModo['corregidos'] = null
  if (cronometro.modo === 'voz' && alLlegarALaRevision) {
    const ids = camposCorregidos(alLlegarALaRevision, final)
    const conCampo = ids.map(campo)
    corregidos = {
      etiquetas: conCampo.filter((c) => !c.salud).map((c) => c.etiqueta),
      deSalud: conCampo.filter((c) => c.salud).length,
    }
  }
  return {
    modo: cronometro.modo, totalMs, segmentosMs, camposLlenos: llenos, camposTotales: total,
    corregidos, turnos: cronometro.modo === 'voz' ? (turnos ?? null) : null,
  }
}

export function comparar(voz: ResultadoModo, escribir: ResultadoModo): { masRapido: 'voz' | 'escribir' | 'igual'; diferenciaMs: number; veces: number | null } {
  const diferenciaMs = Math.abs(voz.totalMs - escribir.totalMs)
  const masRapido = voz.totalMs === escribir.totalMs ? 'igual' : voz.totalMs < escribir.totalMs ? 'voz' : 'escribir'
  const [lento, rapido] = voz.totalMs >= escribir.totalMs ? [voz.totalMs, escribir.totalMs] : [escribir.totalMs, voz.totalMs]
  return { masRapido, diferenciaMs, veces: rapido > 0 ? lento / rapido : null }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const decimal = (n: number): string => n.toFixed(1).replace('.', ',')

/**
 * El texto corto que se pega en el chat de Bryan. SOLO tiempos y conteos: ningún valor del formulario, y
 * de los campos corregidos solo el nombre (los de salud, solo cuántos).
 */
export function textoParaCopiar(r: { voz: ResultadoModo | null; escribir: ResultadoModo | null }, fecha: Date): string {
  const L: string[] = [`Prueba de ingreso con Praxis · ${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`]
  if (r.voz) {
    const partes = SEGMENTOS_DE.voz.map((s) => `${ROTULO_SEGMENTO[s].toLowerCase()} ${formatoTiempo(r.voz?.segmentosMs[s] ?? 0)}`)
    L.push(`HABLANDO · total ${formatoTiempo(r.voz.totalMs)} (${partes.join(' · ')})`)
    const c = r.voz.corregidos
    const quien = c ? [...c.etiquetas, ...(c.deSalud > 0 ? [`${c.deSalud} de salud`] : [])] : []
    L.push(`  Llenó ${r.voz.camposLlenos} de ${r.voz.camposTotales} campos · corrigió ${c ? c.etiquetas.length + c.deSalud : 0} en la revisión${quien.length ? `: ${quien.join(', ')}` : ''}`)
    const t = r.voz.turnos
    if (t) L.push(`  Turnos: ${t.porVoz} por voz, ${t.porTeclado} escritos, ${t.repetidos} repetidos, ${t.detenidos} detenidos por Praxis`)
  }
  if (r.escribir) L.push(`ESCRIBIENDO · total ${formatoTiempo(r.escribir.totalMs)} · llenó ${r.escribir.camposLlenos} de ${r.escribir.camposTotales} campos`)
  if (r.voz && r.escribir) {
    const c = comparar(r.voz, r.escribir)
    if (c.masRapido === 'igual') L.push('COMPARACIÓN · tardaron lo mismo')
    else {
      const ratio = c.veces !== null ? ` (${decimal(c.veces)} veces el tiempo del otro)` : ''
      L.push(`COMPARACIÓN · ${c.masRapido === 'voz' ? 'hablando' : 'escribiendo'} fue más rápido por ${formatoTiempo(c.diferenciaMs)}${ratio}`)
    }
  }
  return L.join('\n')
}

/** Las preguntas de los toques de la prueba, de usted (las de tú son `pregunta` en el guion). */
export const PREGUNTAS_USTED: Readonly<Record<string, string>> = {
  genero: '¿Es mujer u hombre?',
  pais: '¿En qué país vive?',
  dias_por_semana: '¿Cuántos días a la semana puede entrenar?',
  cadencia_revision: '¿Cada cuánto quiere que revisemos su plan: 8 o 15 días?',
  parq_enfermedad_cardiaca: '¿Algún médico le ha dicho que tiene un problema del corazón y que solo haga ejercicio con supervisión?',
  parq_medicamento_presion: '¿Toma medicamentos para la presión o el corazón?',
  parq_huesos_articulaciones: '¿Tiene algún problema de huesos o articulaciones que el ejercicio pueda empeorar?',
  lesiones: '¿Tiene o ha tenido alguna lesión?',
  ejercicios_limitados: '¿Hay ejercicios que su médico o fisio le haya prohibido?',
  medicacion: '¿Toma algún medicamento?',
  alergias_restricciones: '¿Tiene alguna alergia o algo que no pueda comer?',
  tca_historia: '¿Ha tenido alguna vez dificultades con la comida (atracones, restricciones extremas)?',
  solo_mujeres_ciclo: '¿Cómo es su ciclo?',
}

/** La pregunta de un toque en el trato que toca. */
export function preguntaDeToque(c: CampoIngreso, usted: boolean): string {
  return (usted ? PREGUNTAS_USTED[c.id] : undefined) ?? c.pregunta ?? c.etiqueta
}

/** Lo que Praxis dice en un turno: la entrada (solo la primera vez), la explicación del bloque (al empezar el bloque) y la pregunta. */
export function guionDelTurno(turno: TurnoVoz, indice: number, usted: boolean): { entrada: string | null; bloque: string | null; pregunta: string; ejemplo: string | null } {
  const idioma = usted ? 'usted' : 'tu'
  const primeroDelBloque = turnosDeBloque(turno.bloque)[0]?.id === turno.id
  return {
    entrada: indice === 0 ? MENSAJES_DE_BLOQUE.entrada[idioma] : null,
    bloque: primeroDelBloque ? MENSAJES_DE_BLOQUE[turno.bloque][idioma] : null,
    pregunta: usted ? turno.preguntaUsted : turno.pregunta,
    ejemplo: turno.ejemplo ?? null,
  }
}
