import { sesionCompleta } from './cumplimiento'
import type {
  AdherenciaNutricional,
  CheckinDiario,
  Mensaje,
  Microciclo,
  Usuario,
} from './types'

/**
 * Fila del ranking del Equipo Alpha. Solo expone rendimiento y cumplimiento
 * (qué tan juicioso es cada asesorado), nunca datos personales: ni cómo se
 * sintió, ni sus cargas concretas, ni sus notas, ni su edad.
 */
export interface FilaRanking {
  usuarioId: string
  nombre: string
  iniciales: string
  sesionesCompletas: number
  diasCumplidos: number
  checkins: number
  /** Cargas colocadas: series registradas en el microciclo activo. */
  seriesRegistradas: number
  /** Ejercicios cuya carga subió en una sesión posterior del microciclo. */
  ejerciciosProgresados: number
  /** Mensajes enviados al coach en la ventana (curiosidad/compromiso). */
  preguntas: number
  puntos: number
}

/** Categorías visibles del ranking; cada una premia una virtud distinta. */
export type CategoriaRanking =
  | 'general'
  | 'disciplina'
  | 'sesiones'
  | 'cargas'
  | 'progresion'
  | 'preguntas'

export const CATEGORIAS: { id: CategoriaRanking; etiqueta: string; titulo: string }[] = [
  { id: 'general', etiqueta: 'General', titulo: 'Nivel general del equipo' },
  { id: 'disciplina', etiqueta: 'Disciplina', titulo: 'Los que llenan toda su información' },
  { id: 'sesiones', etiqueta: 'Sesiones', titulo: 'Los que completan sus sesiones' },
  { id: 'cargas', etiqueta: 'Cargas', titulo: 'Los que registran todas sus cargas' },
  { id: 'progresion', etiqueta: 'Progresión', titulo: 'Los que suben cargas constantemente' },
  { id: 'preguntas', etiqueta: 'Preguntas', titulo: 'Los que más preguntan al coach' },
]

/** Valor de una fila en una categoría dada, para ordenar y mostrar. */
export function valorDeCategoria(fila: FilaRanking, categoria: CategoriaRanking): number {
  switch (categoria) {
    case 'general':
      return fila.puntos
    case 'disciplina':
      return fila.checkins + fila.diasCumplidos
    case 'sesiones':
      return fila.sesionesCompletas
    case 'cargas':
      return fila.seriesRegistradas
    case 'progresion':
      return fila.ejerciciosProgresados
    case 'preguntas':
      return fila.preguntas
  }
}

/** Ordena por la categoría elegida, desempatando por puntos y nombre. */
export function ordenarPorCategoria(
  filas: FilaRanking[],
  categoria: CategoriaRanking,
): FilaRanking[] {
  return [...filas].sort(
    (a, b) =>
      valorDeCategoria(b, categoria) - valorDeCategoria(a, categoria) ||
      b.puntos - a.puntos ||
      a.nombre.localeCompare(b.nombre),
  )
}

export const VENTANA_RANKING_DIAS = 30

export const PUNTOS = {
  sesionCompleta: 3,
  adherenciaSi: 2,
  adherenciaParcial: 1,
  checkin: 1,
  ejercicioProgresado: 4,
  pregunta: 1,
  /** Tope de puntos por preguntas: preguntar suma, spamear no. */
  maxPreguntas: 10,
} as const

interface DatosRanking {
  usuarios: Usuario[]
  microciclos: Microciclo[]
  adherencias: AdherenciaNutricional[]
  checkins: CheckinDiario[]
  mensajes?: Mensaje[]
  coachId?: string
}

function fechaLimite(hoy: string): string {
  const fecha = new Date(`${hoy}T00:00:00`)
  fecha.setDate(fecha.getDate() - VENTANA_RANKING_DIAS)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/** Series registradas en todo el microciclo (cargas colocadas). */
function contarSeries(microciclo: Microciclo | undefined): number {
  if (!microciclo) return 0
  return microciclo.sesiones.reduce(
    (total, s) => total + s.ejercicios.reduce((t, e) => t + e.series.length, 0),
    0,
  )
}

/**
 * Ejercicios (por nombre) cuya mejor carga en una sesión posterior supera
 * la de su primera aparición: mejora constante de cargas.
 */
function contarProgresiones(microciclo: Microciclo | undefined): number {
  if (!microciclo) return 0
  const porNombre = new Map<string, number[]>()
  const sesiones = [...microciclo.sesiones].sort((a, b) => a.orden - b.orden)
  for (const sesion of sesiones) {
    for (const ejercicio of sesion.ejercicios) {
      const cargas = ejercicio.series.map((s) => s.cargaKg)
      if (cargas.length === 0) continue
      const mejor = Math.max(...cargas)
      const lista = porNombre.get(ejercicio.nombre) ?? []
      lista.push(mejor)
      porNombre.set(ejercicio.nombre, lista)
    }
  }
  let progresados = 0
  for (const mejores of porNombre.values()) {
    if (mejores.length >= 2 && Math.max(...mejores.slice(1)) > mejores[0]) progresados += 1
  }
  return progresados
}

/**
 * Construye el ranking con los últimos 30 días de adherencia, check-ins y
 * preguntas más las sesiones, series y progresiones del microciclo activo.
 * Mismo criterio que la función SQL `ranking_disciplina` (migración 0005)
 * usada en modo nube.
 */
export function construirRanking(datos: DatosRanking, hoy: string): FilaRanking[] {
  const limite = fechaLimite(hoy)
  const coachId = datos.coachId ?? datos.usuarios.find((u) => u.rol === 'coach')?.id
  return datos.usuarios
    .filter((u) => u.rol === 'asesorado')
    .map((u) => {
      const activo = datos.microciclos.find((m) => m.usuarioId === u.id && m.estado === 'activo')
      const sesionesCompletas = activo ? activo.sesiones.filter(sesionCompleta).length : 0
      const adherencias = datos.adherencias.filter((a) => a.usuarioId === u.id && a.fecha >= limite)
      const si = adherencias.filter((a) => a.estado === 'si').length
      const parcial = adherencias.filter((a) => a.estado === 'parcial').length
      const checkins = datos.checkins.filter((c) => c.usuarioId === u.id && c.fecha >= limite).length
      const seriesRegistradas = contarSeries(activo)
      const ejerciciosProgresados = contarProgresiones(activo)
      const preguntas = coachId
        ? (datos.mensajes ?? []).filter(
            (m) => m.deId === u.id && m.paraId === coachId && m.fechaIso.slice(0, 10) >= limite,
          ).length
        : 0
      return {
        usuarioId: u.id,
        nombre: u.nombre,
        iniciales: u.avatarIniciales,
        sesionesCompletas,
        diasCumplidos: si + parcial,
        checkins,
        seriesRegistradas,
        ejerciciosProgresados,
        preguntas,
        puntos:
          sesionesCompletas * PUNTOS.sesionCompleta +
          si * PUNTOS.adherenciaSi +
          parcial * PUNTOS.adherenciaParcial +
          checkins * PUNTOS.checkin +
          ejerciciosProgresados * PUNTOS.ejercicioProgresado +
          Math.min(preguntas, PUNTOS.maxPreguntas) * PUNTOS.pregunta,
      }
    })
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre))
}
