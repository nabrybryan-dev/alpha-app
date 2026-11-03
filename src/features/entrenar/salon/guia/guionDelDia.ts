import { esAlFallo } from '../../../../domain/objetivoDeIntensidad'
import { separarNotas } from '../../../../domain/notasDeLaSemana'
import type { EjercicioPrescrito, ItemMarcable, Microciclo, Sesion } from '../../../../domain/types'
import type { IdDeRegion } from '../../sujeto/regiones'
import { NOMBRE_DE_REGION } from '../../sujeto/regiones'
import { regionesDirectas } from '../../sujeto/tinte'
import { lecturaDeLaPrescripcion, type LecturaDePrescripcion } from '../panel/lecturaDeLaPrescripcion'
import { normalizarNombre } from '../paredes/cargaAnterior'

/**
 * EL GUION DEL DÍA: lo que Praxis le cuenta a la persona, paso a paso, junto al cuerpo.
 *
 * No hay modelo ni red: todo sale de lo que el coach ya escribió. La frase, la nota y la técnica pasan
 * tal cual, «lo nuevo» es la resta contra el microciclo anterior, y las dudas técnicas son la lectura
 * de la prescripción (`lecturaDeLaPrescripcion`). Lo que no esté escrito, Praxis no lo dice.
 */

export interface DudaTecnica {
  pregunta: string
  respuesta: string
}

export interface PasoDelGuion {
  tipo: 'apertura' | 'ejercicio' | 'cierre'
  titulo: string
  frases: string[]
  prescripcion?: string
  nuevo: string[]
  notaCoach?: string
  tecnica?: string
  dudas: DudaTecnica[]
  /** La zona que se enciende en el cuerpo mientras se cuenta este paso. */
  zona: IdDeRegion | null
  /** El lugar del ejercicio en la sesión, para llevar a él. */
  indice?: number
}

function numero(n: number): string {
  return String(n).replace('.', ',')
}

function buscarEnElPrevio(ejercicio: EjercicioPrescrito, previo: Microciclo): EjercicioPrescrito | undefined {
  const buscado = normalizarNombre(ejercicio.nombre)
  for (const s of previo.sesiones) {
    const hallado = s.ejercicios.find((e) => normalizarNombre(e.nombre) === buscado)
    if (hallado) return hallado
  }
  return undefined
}

function unidad(e: EjercicioPrescrito): string {
  return !e.unidadCarga || e.unidadCarga === 'kg' ? 'kg' : `kg ${e.unidadCarga}`
}

function intensidad(e: EjercicioPrescrito): string {
  return esAlFallo(e.rirObjetivo) ? 'al fallo' : String(e.rirObjetivo)
}

/** La resta contra lo PAUTADO la semana anterior. Sin esa semana no se afirma nada. */
export function cambiosDelEjercicio(ejercicio: EjercicioPrescrito, previo: Microciclo | undefined): string[] {
  if (!previo) return []
  const antes = buscarEnElPrevio(ejercicio, previo)
  if (!antes) return ['Este ejercicio es nuevo.']
  const salida: string[] = []
  const conCarga = antes.cargaKg !== undefined && ejercicio.cargaKg !== undefined
  if (conCarga && unidad(antes) === unidad(ejercicio) && antes.cargaKg !== ejercicio.cargaKg) {
    salida.push(`La carga pasa de ${numero(antes.cargaKg!)} a ${numero(ejercicio.cargaKg!)} ${unidad(ejercicio)}.`)
  }
  if (antes.sets !== ejercicio.sets) salida.push(`Las series pasan de ${antes.sets} a ${ejercicio.sets}.`)
  if (antes.repsDiana !== ejercicio.repsDiana) salida.push(`Las repeticiones pasan de ${antes.repsDiana} a ${ejercicio.repsDiana}.`)
  if (antes.rirObjetivo !== ejercicio.rirObjetivo) salida.push(`El RIR pasa de ${intensidad(antes)} a ${intensidad(ejercicio)}.`)
  return salida
}

function preguntaDe(l: LecturaDePrescripcion): string {
  if (l.id === 'series') return `¿Por qué ${l.cifra} ${l.cifra === '1' ? 'serie' : 'series'}?`
  if (l.id === 'reps') return `¿Por qué ${l.cifra} repeticiones?`
  if (l.id === 'descanso') return `¿Por qué ${l.cifra} minutos de descanso?`
  return l.cifra === 'FALLO' ? '¿Qué significa ir al fallo?' : `¿Qué significa RIR ${l.cifra}?`
}

function pasoDeEjercicio(ejercicio: EjercicioPrescrito, indice: number, previo: Microciclo | undefined): PasoDelGuion {
  return {
    tipo: 'ejercicio',
    titulo: ejercicio.nombre,
    frases: [],
    prescripcion: ejercicio.prescripcion || undefined,
    nuevo: cambiosDelEjercicio(ejercicio, previo),
    notaCoach: ejercicio.notaCoach?.trim() || undefined,
    tecnica: ejercicio.cues?.trim() || undefined,
    dudas: lecturaDeLaPrescripcion(ejercicio).map((l) => ({
      pregunta: preguntaDe(l),
      respuesta: `${l.que} ${l.porque} ${l.senal}`,
    })),
    zona: regionesDirectas(ejercicio)[0] ?? null,
    indice,
  }
}

function fraseDeBloque(b: ItemMarcable): string {
  const minutos = b.duracionMin ? ` ${b.duracionMin} minutos.` : ''
  return `${b.titulo}: ${b.indicaciones.trim()}${minutos}`
}

/** Las zonas directas de la sesión, sin repetir, en el orden de sus ejercicios. */
function zonasDeLaSesion(sesion: Sesion): string[] {
  return [...new Set(sesion.ejercicios.flatMap((e) => regionesDirectas(e)))].map((id) => NOMBRE_DE_REGION[id])
}

function frasesDeApertura(sesion: Sesion, previo: Microciclo | undefined): string[] {
  const series = sesion.ejercicios.reduce((n, e) => n + e.sets, 0)
  const anotadas = sesion.ejercicios.reduce((n, e) => n + e.series.length, 0)
  const preparacion = separarNotas(sesion.preparacion)
  const cardio = separarNotas(sesion.bloquesCardio)
  const antes = preparacion.marcables.map((b) => b.titulo).join(', ')
  const zonas = zonasDeLaSesion(sesion)
  const conCambios = sesion.ejercicios.filter((e) => cambiosDelEjercicio(e, previo).length > 0).length
  return [
    ...(series > 0 ? [`Son ${series} series pautadas.`] : []),
    ...(zonas.length > 0 ? [`Trabajas: ${zonas.join(', ')}.`] : []),
    ...(conCambios > 0 ? [`Hay cambios en ${conCambios} ${conCambios === 1 ? 'ejercicio' : 'ejercicios'} frente a la semana pasada: te los cuento en cada uno.`] : []),
    ...(anotadas > 0 ? [`Ya anotaste ${anotadas} de ${series}.`] : []),
    ...(antes ? [`Antes de empezar: ${antes}.`] : []),
    ...[...preparacion.notas, ...cardio.notas].map((n) => n.indicaciones.trim()).filter(Boolean),
    ...cardio.marcables.map(fraseDeBloque),
  ]
}

function tituloDeApertura(sesion: Sesion): string {
  const n = sesion.ejercicios.length
  if (n === 0) return sesion.nombre
  return `${sesion.nombre}: ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}`
}

const VACIO = { nuevo: [], dudas: [], zona: null }

export function guionDelDia(sesion: Sesion | undefined, previo: Microciclo | undefined): PasoDelGuion[] {
  if (!sesion) return [{ ...VACIO, tipo: 'apertura', titulo: 'Hoy no hay sesión', frases: [] }]
  return [
    { ...VACIO, tipo: 'apertura', titulo: tituloDeApertura(sesion), frases: frasesDeApertura(sesion, previo) },
    ...sesion.ejercicios.map((e, i) => pasoDeEjercicio(e, i, previo)),
    { ...VACIO, tipo: 'cierre', titulo: 'Eso es lo de hoy', frases: ['Cuando quieras, toca «Empezar sesión» abajo.'] },
  ]
}
