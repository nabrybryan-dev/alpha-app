import { diaDeSesion, diaSemanaDe, type DiaSemana } from './calendario'
import { sesionCompleta } from './cumplimiento'
import { duracionTotalSeg, formatoDuracion } from './ritmoSesion'
import type { Microciclo, Sesion } from './types'

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
  if (sesion.tipo === 'metabolica') {
    const bloques = (sesion.bloquesCardio ?? []).length
    return `${bloques} bloque${bloques === 1 ? '' : 's'} · cardio`
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

  const sueltas = [...sinDia]
  return ABREVIATURAS.map((_, i) => i).map((i) => {
    const fechaIso = sumarDias(primerDia, i)
    const fecha = new Date(`${fechaIso}T00:00:00`)
    const dia = diaSemanaDe(fechaIso)
    const sesion = conDia.get(dia) ?? sueltas.shift()
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

export interface NivelAlfa {
  /** "01"…"05", tal cual se pinta. */
  numero: string
  nombre: string
  /** Edad de entrenamiento típica: "18–36 meses". */
  rango: string
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

export interface RequisitoNivel {
  id: string
  cumplido: boolean
  texto: string
  /** Dónde va hoy: "18 / 20 series · faltan 2". */
  metrica: string
}

export interface MiniEstadistica {
  valor: string
  etiqueta: string
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
  /** Progreso al siguiente nivel, 0–100. */
  pctAlSiguiente: number
  estadisticas: MiniEstadistica[]
  bloque: BloqueEnCurso
  competencias: Competencia[]
  requisitos: RequisitoNivel[]
  escala: NivelAlfa[]
}
