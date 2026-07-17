import { sesionCompleta } from './cumplimiento'
import type { AdherenciaNutricional, CheckinDiario, Microciclo, Usuario } from './types'

/**
 * Fila del ranking de disciplina del Equipo Alpha. Solo expone cumplimiento
 * (qué tan juicioso es cada asesorado), nunca datos personales: ni cómo se
 * sintió, ni sus cargas, ni sus notas.
 */
export interface FilaRanking {
  usuarioId: string
  nombre: string
  iniciales: string
  sesionesCompletas: number
  diasCumplidos: number
  checkins: number
  puntos: number
}

export const VENTANA_RANKING_DIAS = 30

export const PUNTOS = {
  sesionCompleta: 3,
  adherenciaSi: 2,
  adherenciaParcial: 1,
  checkin: 1,
} as const

interface DatosRanking {
  usuarios: Usuario[]
  microciclos: Microciclo[]
  adherencias: AdherenciaNutricional[]
  checkins: CheckinDiario[]
}

function fechaLimite(hoy: string): string {
  const fecha = new Date(`${hoy}T00:00:00`)
  fecha.setDate(fecha.getDate() - VENTANA_RANKING_DIAS)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/**
 * Construye el ranking con los últimos 30 días de adherencia y check-ins más
 * las sesiones completas del microciclo activo. Mismo criterio que la función
 * SQL `ranking_disciplina` (migración 0004) usada en modo nube.
 */
export function construirRanking(datos: DatosRanking, hoy: string): FilaRanking[] {
  const limite = fechaLimite(hoy)
  return datos.usuarios
    .filter((u) => u.rol === 'asesorado')
    .map((u) => {
      const activo = datos.microciclos.find((m) => m.usuarioId === u.id && m.estado === 'activo')
      const sesionesCompletas = activo ? activo.sesiones.filter(sesionCompleta).length : 0
      const adherencias = datos.adherencias.filter((a) => a.usuarioId === u.id && a.fecha >= limite)
      const si = adherencias.filter((a) => a.estado === 'si').length
      const parcial = adherencias.filter((a) => a.estado === 'parcial').length
      const checkins = datos.checkins.filter((c) => c.usuarioId === u.id && c.fecha >= limite).length
      return {
        usuarioId: u.id,
        nombre: u.nombre,
        iniciales: u.avatarIniciales,
        sesionesCompletas,
        diasCumplidos: si + parcial,
        checkins,
        puntos:
          sesionesCompletas * PUNTOS.sesionCompleta +
          si * PUNTOS.adherenciaSi +
          parcial * PUNTOS.adherenciaParcial +
          checkins * PUNTOS.checkin,
      }
    })
    .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre))
}
