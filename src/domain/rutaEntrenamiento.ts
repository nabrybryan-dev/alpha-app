import { diaDeSesion, diaSemanaDe, type DiaSemana } from './calendario'
import { estimarUnRm } from './cargas'
import { sesionCompleta } from './cumplimiento'
import { duracionTotalSeg, formatoDuracion } from './ritmoSesion'
import type { Microciclo, Sesion, ValoracionCompetencia } from './types'

/**
 * Vista macro de la pestaña Entreno ("Ruta"): en qué nivel está el asesorado,
 * qué semana le toca y qué le falta para subir.
 *
 * Aquí solo vive lo que se puede DEDUCIR de su microciclo real (la semana).
 * El nivel, las competencias y los requisitos son valoración del coach y
 * entran por `data/ruta/` — no se calculan desde el registro de series.
 */

// ---------- Semana ----------

export type EstadoDiaRuta = 'completada' | 'hoy' | 'programada' | 'descanso'

/** Índice 0 = domingo, igual que `Date.getDay()`. */
const ABREVIATURAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

const DIA_MS = 24 * 60 * 60 * 1000

export interface DiaRuta {
  fechaIso: string
  dia: DiaSemana
  /** "Lun", "Mar"… para la rejilla de 7 columnas. */
  abreviatura: string
  /** Día del mes, ya formateado ("07"). */
  numero: string
  estado: EstadoDiaRuta
  esHoy: boolean
  sesionId?: string
  titulo: string
  detalle: string
}

/** El primer día de la rejilla depende de la persona, no de una constante. */
export type InicioSemana = 'DOMINGO' | 'LUNES'

/**
 * Dónde arranca la semana de ESTE asesorado.
 *
 * Hay asesorados que entrenan el domingo como primer día del microciclo y otros
 * que lo tienen de descanso al final. Mandar una constante global le movería el
 * calendario a la mitad de la gente, así que se decide por microciclo:
 *
 * 1. Si el microciclo empieza en domingo o en lunes, ese es el inicio: es la
 *    señal más fuerte, la puso el coach al programar.
 * 2. Si empieza cualquier otro día, manda que haya sesión programada en domingo
 *    (entrena el domingo → el domingo abre su semana).
 */
export function inicioSemanaDe(microciclo: Microciclo): InicioSemana {
  const arranque = diaSemanaDe(microciclo.fechaInicio)
  if (arranque === 'DOMINGO') return 'DOMINGO'
  if (arranque === 'LUNES') return 'LUNES'
  return microciclo.sesiones.some((s) => diaDeSesion(s) === 'DOMINGO') ? 'DOMINGO' : 'LUNES'
}

function sumarDias(fechaIso: string, dias: number): string {
  const d = new Date(new Date(`${fechaIso}T00:00:00`).getTime() + dias * DIA_MS)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function detalleDeSesion(sesion: Sesion): string {
  const bloques = (sesion.bloquesCardio ?? []).length

  // Manda lo que hay, no la etiqueta. Si la sesion trae ejercicios se describen
  // los ejercicios, aunque este marcada `metabolica`: desde el 2026-08-25 esos
  // ejercicios cuentan para cerrarla y para la propuesta, asi que esconderlos en
  // la Ruta seria lo unico que quedaria mintiendo.
  if (sesion.ejercicios.length === 0) {
    const cola = sesion.tipo === 'metabolica' ? ' · cardio' : ''
    return `${bloques} bloque${bloques === 1 ? '' : 's'}${cola}`
  }

  const series = sesion.ejercicios.reduce((n, e) => n + e.sets, 0)
  return `${sesion.ejercicios.length} ejercicios · ${series} series · ${formatoDuracion(duracionTotalSeg(sesion))}`
}

/**
 * Reparte las sesiones del microciclo en los 7 días de la semana de `hoyIso`.
 *
 * Las sesiones que traen `dia` caen en su día exacto. Las que no —el Excel no
 * siempre lo trae— se colocan por `orden` en los primeros huecos libres: es lo
 * mismo que ya hacía la lista de sesiones, y así el calendario nunca sale vacío
 * por un campo que el coach no llenó.
 */
export function armarSemana(microciclo: Microciclo, hoyIso: string): DiaRuta[] {
  const inicio = inicioSemanaDe(microciclo)
  const dowHoy = new Date(`${hoyIso}T00:00:00`).getDay()
  const desplazamiento = inicio === 'DOMINGO' ? dowHoy : (dowHoy + 6) % 7
  const primerDia = sumarDias(hoyIso, -desplazamiento)

  const conDia = new Map<DiaSemana, Sesion>()
  const sinDia: Sesion[] = []
  for (const sesion of [...microciclo.sesiones].sort((a, b) => a.orden - b.orden)) {
    const dia = diaDeSesion(sesion)
    if (dia && !conDia.has(dia)) conDia.set(dia, sesion)
    else sinDia.push(sesion)
  }

  /**
   * Si esta fecha cae DENTRO del microciclo.
   *
   * La rejilla que se pinta son los 7 días naturales de hoy, pero el microciclo
   * dura `cadenciaDias` —8 o 15— y puede empezar cualquier día. No son la misma
   * cosa, y sin esta comprobación el reparto por nombre de día colocaba sesiones
   * en fechas que el microciclo ni siquiera cubre.
   *
   * Lo que pasó el 2026-08-24: el microciclo de una asesorada empezaba el martes
   * 25 y su sesión de CIERRE se llama «(LUNES)» —el lunes 31, el último día—.
   * Como hoy era lunes 24, esa sesión caía en hoy: la app le ofrecía el último
   * día de su bloque **antes de que el bloque empezara**.
   *
   * SOLO SE ACOTA POR ABAJO, y es deliberado. El mismo descuadre tiene una
   * segunda mitad —un microciclo ya vencido sigue repartiendo sesiones de la
   * semana pasada— pero esa afecta a quien YA está entrenando y taparla le
   * dejaría la semana en blanco. Es una decisión distinta, con otro riesgo, y va
   * en su propia tanda. Aquí solo se impide ofrecer lo que aún no ha empezado.
   *
   * Si falta `fechaInicio`, NO se acota: degradar a la conducta de antes es
   * preferible a dejar a alguien sin semana por un campo ausente.
   */
  const acota = Boolean(microciclo.fechaInicio)
  const yaEmpezo = (fechaIso: string) => !acota || fechaIso >= microciclo.fechaInicio

  const sueltas = [...sinDia]
  return ABREVIATURAS.map((_, i) => i).map((i) => {
    const fechaIso = sumarDias(primerDia, i)
    const fecha = new Date(`${fechaIso}T00:00:00`)
    const dia = diaSemanaDe(fechaIso)
    // Antes del arranque no se reparte nada — y en particular no se consume de
    // `sueltas`, que si no se gastarían en días que el microciclo no cubre.
    const sesion = yaEmpezo(fechaIso) ? (conDia.get(dia) ?? sueltas.shift()) : undefined
    const esHoy = fechaIso === hoyIso

    const base = {
      fechaIso,
      dia,
      abreviatura: ABREVIATURAS[fecha.getDay()],
      numero: String(fecha.getDate()).padStart(2, '0'),
      esHoy,
    }

    if (!sesion) {
      return {
        ...base,
        estado: 'descanso' as const,
        titulo: 'Descanso',
        detalle: 'Sin sesión programada. Prioriza sueño y pasos.',
      }
    }

    const estado: EstadoDiaRuta = sesionCompleta(sesion) ? 'completada' : esHoy ? 'hoy' : 'programada'
    return { ...base, estado, sesionId: sesion.id, titulo: sesion.nombre, detalle: detalleDeSesion(sesion) }
  })
}

export interface SesionDestacada {
  sesionId: string
  titulo: string
  esDeHoy: boolean
}

/**
 * La sesión que propone el botón grande de la Ruta.
 *
 * Sale de la MISMA semana que pinta el calendario, a propósito: cuando el CTA
 * se calculaba aparte, el botón decía "sesión de hoy · UPPER A" mientras la
 * agenda ponía otra sesión en el día de hoy. Dos respuestas distintas a la
 * misma pregunta en la misma pantalla.
 *
 * Orden: la de hoy si está pendiente; si no, la siguiente de la semana; y si
 * tampoco, una pendiente que quedó atrás.
 */
export function sesionDestacada(dias: readonly DiaRuta[]): SesionDestacada | undefined {
  const hoy = dias.find((d) => d.estado === 'hoy')
  if (hoy?.sesionId) return { sesionId: hoy.sesionId, titulo: hoy.titulo, esDeHoy: true }

  const indiceHoy = dias.findIndex((d) => d.esHoy)
  const pendiente =
    dias.slice(indiceHoy + 1).find((d) => d.estado === 'programada') ??
    dias.slice(0, Math.max(0, indiceHoy)).find((d) => d.estado === 'programada')

  if (!pendiente?.sesionId) return undefined
  return { sesionId: pendiente.sesionId, titulo: pendiente.titulo, esDeHoy: false }
}

export interface ResumenSemana {
  completadas: number
  programadas: number
}

/** "2/5 sesiones" de la cabecera del calendario. */
export function resumenSemana(dias: readonly DiaRuta[]): ResumenSemana {
  const conSesion = dias.filter((d) => d.sesionId !== undefined)
  return {
    completadas: conSesion.filter((d) => d.estado === 'completada').length,
    programadas: conSesion.length,
  }
}

// ---------- Nivel, competencias y requisitos ----------

export type EstadoNivelAlfa = 'superado' | 'actual' | 'bloqueado' | 'elite'

/**
 * Los tres niveles con los que programa el método (Pérez-Córdoba). Son los que
 * mandan de verdad: fijan intensidad, esfuerzo, volumen, frecuencia y modelo de
 * progresión.
 *
 * La Escala Alfa enseña 5 peldaños porque una escalera larga se recorre mejor,
 * pero cada peldaño declara a qué nivel real pertenece. Si algún día la app
 * decide programación desde aquí, tiene que mirar esto y no el número bonito.
 */
export type NivelMetodo = 'principiante' | 'intermedio' | 'avanzado'

export interface NivelAlfa {
  /** "01"…"05", tal cual se pinta. */
  numero: string
  nombre: string
  nivelMetodo: NivelMetodo
  descripcion: string
  estado: EstadoNivelAlfa
}

/** Qué tan lograda está una competencia. La UI decide el color. */
export type GradoCompetencia = 'alto' | 'medio' | 'bajo'

export interface Competencia {
  id: string
  nombre: string
  /** 0–100. */
  pct: number
  nota: string
}

export function gradoDeCompetencia(pct: number): GradoCompetencia {
  if (pct >= 80) return 'alto'
  if (pct >= 65) return 'medio'
  return 'bajo'
}

export interface CompetenciaDelCoach {
  id: string
  nombre: string
  /** Qué mirar al puntuarla, para que dos valoraciones signifiquen lo mismo. */
  ayuda: string
}

/**
 * Las competencias que NO se pueden deducir del registro y las pone el coach.
 *
 * Hoy solo la técnica: la app no ve ejecución. Consistencia, autorregulación,
 * volumen, fuerza y nutrición salen de los datos, y meterlas aquí sería pedirle
 * al coach que teclee lo que la app ya sabe.
 */
export const COMPETENCIAS_DEL_COACH: CompetenciaDelCoach[] = [
  {
    id: 'tecnica',
    nombre: 'Técnica y patrones',
    ayuda:
      'Fase de aprendizaje motor: ¿piensa cada paso (cognitiva), lo refina (asociativa) o ejecuta sin pensar (autónoma)?',
  },
]

/** Convierte lo que puso el coach en tarjetas de competencia de la Ruta. */
export function valoracionesACompetencias(
  valoraciones: readonly ValoracionCompetencia[] | undefined,
): Competencia[] {
  if (!valoraciones) return []
  return COMPETENCIAS_DEL_COACH.flatMap((definicion) => {
    const valoracion = valoraciones.find((v) => v.id === definicion.id)
    if (!valoracion) return []
    return [
      {
        id: definicion.id,
        nombre: definicion.nombre,
        pct: Math.max(0, Math.min(100, Math.round(valoracion.pct))),
        nota: valoracion.nota,
      },
    ]
  })
}

export interface RequisitoNivel {
  id: string
  cumplido: boolean
  texto: string
  /** Dónde va hoy: "18 / 20 series · faltan 2". */
  metrica: string
}

/**
 * Landmarks de volumen (Israetel/RP), en series por grupo y semana. Son los
 * mismos que usa el motor: MEV ~8–12 · MAV ~12–20 · MRV ~18–26. Aquí se toma el
 * centro de cada rango — sirven de escala, no de prescripción.
 */
export const LANDMARK_MEV = 10
export const LANDMARK_MAV_ALTO = 20
export const LANDMARK_MRV = 22

/** Lo que hace falta para valorar a la persona con SUS datos, no con un número fijo. */
export interface DatosRuta {
  microcicloNumero: number
  sesionesRegistradas: number
  sesionesTotales: number
  /** Desviación media RIR real vs pautado. Sin series registradas, indefinida. */
  desviacionRir?: number
  /** Series pautadas por grupo muscular en el microciclo. */
  seriesPorGrupo: readonly number[]
  /** Cómo evolucionó el 1RM estimado frente al microciclo anterior. */
  progresoFuerza?: ProgresoFuerza
  /** Adherencia nutricional, 0–100. */
  adherenciaPct?: number
  /** Valoración de técnica del coach, 0–100. Es la compuerta humana del ascenso. */
  tecnicaPct?: number
  /** Baja la carga los días de readiness baja, en vez de sostenerla igual. */
  autorregulaConReadiness?: boolean
  /** Su 1RM estimado sube después de una descarga. */
  respondeADescarga?: boolean
  /** Sostiene el resto de requisitos dos bloques seguidos. */
  estableEntreBloques?: boolean
}

export interface ProgresoFuerza {
  mejoraron: number
  comparados: number
  /** Número del microciclo contra el que se compara. */
  microcicloPrevio: number
}

function acotar(pct: number): number {
  return Math.max(0, Math.min(100, Math.round(pct)))
}

function mediana(valores: readonly number[]): number | undefined {
  if (valores.length === 0) return undefined
  const orden = [...valores].sort((a, b) => a - b)
  const medio = Math.floor(orden.length / 2)
  return orden.length % 2 === 0 ? (orden[medio - 1] + orden[medio]) / 2 : orden[medio]
}

/**
 * Mejor 1RM estimado por ejercicio en un microciclo.
 *
 * Se toma el mejor de todas las series y no el promedio: una serie de calentar
 * a RIR 5 hundiría la media y haría parecer que retrocedió alguien que subió.
 */
function mejorUnRmPorEjercicio(microciclo: Microciclo): Map<string, number> {
  const mejores = new Map<string, number>()
  for (const sesion of microciclo.sesiones) {
    for (const ejercicio of sesion.ejercicios) {
      for (const serie of ejercicio.series) {
        // Sin reps o sin RIR no hay 1RM que estimar: ese trabajo no se mide así.
        if (serie.reps === undefined || serie.rir === undefined) continue
        const estimado = estimarUnRm(serie.cargaKg, serie.reps, serie.rir)
        if (estimado === undefined) continue
        // La clave es el nombre, no el id: los ids llevan el sufijo del
        // microciclo, así que el mismo ejercicio nunca cruzaría entre semanas.
        const previo = mejores.get(ejercicio.nombre)
        if (previo === undefined || estimado > previo) mejores.set(ejercicio.nombre, estimado)
      }
    }
  }
  return mejores
}

/**
 * Cuántos ejercicios subieron su 1RM estimado frente al microciclo anterior.
 *
 * Solo cuentan los que aparecen en ambos con series registradas: comparar
 * contra un ejercicio que no se hizo no dice nada.
 */
export function compararFuerza(
  actual: Microciclo,
  previo: Microciclo | undefined,
): ProgresoFuerza | undefined {
  if (!previo) return undefined
  const ahora = mejorUnRmPorEjercicio(actual)
  const antes = mejorUnRmPorEjercicio(previo)

  let mejoraron = 0
  let comparados = 0
  for (const [nombre, valor] of ahora) {
    const anterior = antes.get(nombre)
    if (anterior === undefined) continue
    comparados += 1
    if (valor > anterior) mejoraron += 1
  }

  if (comparados === 0) return undefined
  return { mejoraron, comparados, microcicloPrevio: previo.numero }
}

/** Cuántos grupos se miran para juzgar la tolerancia al volumen. */
const GRUPOS_PRIORITARIOS = 3

/**
 * El volumen se juzga donde el bloque ACUMULA, no promediando todos los grupos.
 *
 * Los landmarks son "por grupo grande" (página 01 del motor); meter pantorrillas
 * y abdomen en la misma media hunde el número y hace parecer que la persona
 * entrena por debajo de MEV cuando sus grupos prioritarios están en MAV.
 */
function cargaDeGruposPrioritarios(seriesPorGrupo: readonly number[]): number | undefined {
  const top = [...seriesPorGrupo].sort((a, b) => b - a).slice(0, GRUPOS_PRIORITARIOS)
  return mediana(top)
}

/**
 * Las competencias que salen de lo que la persona registró.
 *
 * El porcentaje es solo la barra: lo que afirma algo es la nota, que lleva el
 * número real. Las otras cuatro competencias (técnica, fuerza, recuperación y
 * nutrición) son juicio del coach y entran por `competenciasCoach`; aquí no se
 * inventan.
 */
/** Cuánto del microciclo hay que llevar para que las cifras signifiquen algo. */
const FRACCION_PARA_QUE_CUENTE = 0.5

/**
 * Va por menos de la mitad del microciclo.
 *
 * Importa para el progreso de fuerza: con 1 de 6 sesiones registradas el número
 * es correcto —ningún ejercicio ha subido todavía— pero se lee como un juicio.
 * La diferencia entre «vas mal» y «aún no hay con qué» tiene que estar escrita,
 * porque la barra sola no la dice.
 */
function microcicloTempranero(datos: DatosRuta): boolean {
  if (datos.sesionesTotales === 0) return false
  return datos.sesionesRegistradas / datos.sesionesTotales < FRACCION_PARA_QUE_CUENTE
}

export function competenciasCalculadas(datos: DatosRuta): Competencia[] {
  const competencias: Competencia[] = []

  if (datos.sesionesTotales > 0) {
    const pct = acotar((datos.sesionesRegistradas / datos.sesionesTotales) * 100)
    competencias.push({
      id: 'consistencia',
      nombre: 'Consistencia',
      pct,
      nota: `${datos.sesionesRegistradas} de ${datos.sesionesTotales} sesiones registradas en el microciclo M${datos.microcicloNumero}.`,
    })
  }

  if (datos.desviacionRir !== undefined) {
    const desvio = Math.abs(datos.desviacionRir)
    // 0 de desviación = 100; a partir de 2 puntos, 0. Es la escala de la barra,
    // no un umbral clínico: el dato que vale es el de la nota.
    const pct = acotar(100 - desvio * 50)
    const sentido =
      datos.desviacionRir > 0
        ? 'te quedas más lejos del fallo de lo pautado (carga corta)'
        : 'llegas más cerca del fallo de lo pautado (carga larga)'
    competencias.push({
      id: 'autorregulacion',
      nombre: 'Autorregulación (RIR)',
      pct,
      nota:
        desvio === 0
          ? 'Tu RIR real coincide con el pautado.'
          : `Tu RIR real se desvía ${desvio.toString().replace('.', ',')} puntos: ${sentido}.`,
    })
  }

  const series = cargaDeGruposPrioritarios(datos.seriesPorGrupo)
  if (series !== undefined) {
    const pct = acotar(((series - LANDMARK_MEV) / (LANDMARK_MRV - LANDMARK_MEV)) * 100)
    competencias.push({
      id: 'volumen',
      nombre: 'Tolerancia al volumen',
      pct,
      nota: `Mediana de ${series} series por grupo esta semana. MEV ≈${LANDMARK_MEV} · MRV ≈${LANDMARK_MRV}.`,
    })
  }

  const fuerza = datos.progresoFuerza
  if (fuerza && fuerza.comparados > 0) {
    // Progreso contra sí mismo, no contra un ratio de peso corporal: en toda la
    // wiki no hay ningún estándar de fuerza relativa, y fijar uno empuja contra
    // la jerarquía (seguridad y adherencia van antes que tensión mecánica).
    competencias.push({
      id: 'fuerza',
      nombre: 'Progreso de fuerza',
      pct: acotar((fuerza.mejoraron / fuerza.comparados) * 100),
      nota:
        `${fuerza.mejoraron} de ${fuerza.comparados} ejercicios subieron su 1RM estimado frente al M${fuerza.microcicloPrevio}.` +
        (microcicloTempranero(datos)
          ? ` Llevas ${datos.sesionesRegistradas} de ${datos.sesionesTotales} sesiones: la cifra todavía no dice mucho y subirá al registrar el resto.`
          : ''),
    })
  }

  if (datos.adherenciaPct !== undefined) {
    competencias.push({
      id: 'nutricion',
      nombre: 'Nutrición aplicada',
      pct: acotar(datos.adherenciaPct),
      nota: `${acotar(datos.adherenciaPct)}% de adherencia a tu plan en los días registrados.`,
    })
  }

  return competencias
}

/**
 * Requisitos para el siguiente nivel.
 *
 * El criterio es el mismo para todos —define el nivel—, pero dónde va cada uno
 * se calcula con sus datos. Los dos últimos los valida el coach mirando la
 * ejecución: no hay forma honesta de deducirlos del registro de series.
 */
/**
 * @deprecated Ya no la usa ninguna pantalla. La sustituye
 * `requisitosParaPeldano(destino, datos)` de `nivelesAlfa.ts`, que sí mira a qué
 * peldaño va la persona: esta devolvía la MISMA lista para los siete.
 *
 * Sigue aquí solo porque sus tests documentan por qué cada criterio existe.
 * Al borrarla, llevarse esos tests a `nivelesAlfa.test.ts` en vez de tirarlos.
 */
export function requisitosDeNivel(datos: DatosRuta): RequisitoNivel[] {
  const pctSesiones =
    datos.sesionesTotales > 0
      ? acotar((datos.sesionesRegistradas / datos.sesionesTotales) * 100)
      : 0
  const desvio = datos.desviacionRir === undefined ? undefined : Math.abs(datos.desviacionRir)
  const series = cargaDeGruposPrioritarios(datos.seriesPorGrupo)

  return [
    {
      id: 'consistencia',
      cumplido: pctSesiones >= 90,
      texto: 'Registrar al menos el 90% de las sesiones que te pauta el coach',
      metrica:
        datos.sesionesTotales > 0
          ? `${datos.sesionesRegistradas} / ${datos.sesionesTotales} sesiones · ${pctSesiones}%`
          : 'Sin sesiones pautadas todavía',
    },
    {
      id: 'error-rir',
      cumplido: desvio !== undefined && desvio < 0.5,
      texto: 'Estimar tu RIR con una desviación media menor a 0,5 respecto al pautado',
      metrica:
        desvio === undefined
          ? 'Aún sin series registradas para medirlo'
          : `${desvio.toString().replace('.', ',')} de desviación media`,
    },
    {
      id: 'volumen',
      cumplido: series !== undefined && series >= LANDMARK_MAV_ALTO,
      texto:
        'Llegar a la parte alta del volumen (≈20 series por grupo) dentro de la onda, sin perder rendimiento',
      metrica:
        series === undefined
          ? 'Sin volumen pautado todavía'
          : `Mediana de ${series} series · objetivo ≈${LANDMARK_MAV_ALTO}`,
    },
    {
      id: 'tecnica',
      cumplido: false,
      texto: 'Ejecutar en fase autónoma los patrones que entrenas (sin pensar cada paso)',
      metrica: 'Lo valora tu coach viendo tu ejecución',
    },
    {
      id: 'fuerza',
      // Contra sí mismo: que la mayoría de sus ejercicios suban el 1RM estimado
      // respecto al microciclo anterior. Sin ratio universal.
      cumplido:
        datos.progresoFuerza !== undefined &&
        datos.progresoFuerza.comparados > 0 &&
        datos.progresoFuerza.mejoraron / datos.progresoFuerza.comparados >= 0.5,
      texto: 'Progresar tu propia fuerza en los básicos, medida con tu 1RM estimado',
      metrica:
        datos.progresoFuerza && datos.progresoFuerza.comparados > 0
          ? `${datos.progresoFuerza.mejoraron} / ${datos.progresoFuerza.comparados} ejercicios al alza vs M${datos.progresoFuerza.microcicloPrevio}`
          : 'Aún sin dos microciclos con series para comparar',
    },
  ]
}

export interface MiniEstadistica {
  valor: string
  etiqueta: string
}

/** Las tres cifras que sostienen la tarjeta de progreso, todas del microciclo real. */
export function estadisticasCalculadas(datos: DatosRuta): MiniEstadistica[] {
  const estadisticas: MiniEstadistica[] = []
  const series = cargaDeGruposPrioritarios(datos.seriesPorGrupo)

  if (series !== undefined) {
    estadisticas.push({ valor: String(series), etiqueta: 'Series / grupo' })
  }
  if (datos.desviacionRir !== undefined) {
    const d = datos.desviacionRir
    estadisticas.push({
      valor: `${d > 0 ? '+' : ''}${d.toString().replace('.', ',')}`,
      etiqueta: 'Desviación RIR',
    })
  }
  if (datos.sesionesTotales > 0) {
    estadisticas.push({
      valor: `${datos.sesionesRegistradas}/${datos.sesionesTotales}`,
      etiqueta: `Sesiones M${datos.microcicloNumero}`,
    })
  }

  return estadisticas
}

/**
 * Cuánto le falta para el siguiente nivel: la proporción de requisitos que ya
 * cumple. Antes era un 62% fijo que no salía de ningún lado.
 */
export function progresoAlSiguiente(requisitos: readonly RequisitoNivel[]): number {
  if (requisitos.length === 0) return 0
  return Math.round((requisitos.filter((r) => r.cumplido).length / requisitos.length) * 100)
}

export interface BloqueEnCurso {
  nombre: string
  detalle: string
  semana: number
  semanasTotales: number
}

export interface RutaAsesorado {
  usuarioId: string
  nivelActual: NivelAlfa
  siguienteNivel?: NivelAlfa
  bloque: BloqueEnCurso
  escala: NivelAlfa[]
}
