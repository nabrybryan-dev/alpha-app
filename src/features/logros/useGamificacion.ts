import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { estadoPreparacion, resumenMicrociclo, sesionCompleta } from '../../domain/cumplimiento'
import {
  calcularRacha,
  calcularXp,
  evaluarLogros,
  nivelDeXp,
  siguienteNivel,
  type Logro,
  type Nivel,
  type Racha,
} from '../../domain/gamification'

export interface Gamificacion {
  xp: number
  nivel: Nivel
  siguiente?: Nivel
  pctHaciaSiguiente: number
  rachaBienestar: Racha
  rachaEntrenamiento: Racha
  rachaNutricion: Racha
  logros: Logro[]
}

export function useGamificacion(usuarioId: string): Gamificacion {
  useDbVersion()
  const hoy = hoyIso()

  const checkins = db.bienestar.byUsuario(usuarioId)
  const adherencias = db.nutricion.adherenciasByUsuario(usuarioId)
  const respuestas = db.cuestionarios.respuestasDe(usuarioId)
  const microciclos = db.microciclos.byUsuario(usuarioId)

  const sesionesRegistradas = microciclos
    .flatMap((m) => m.sesiones)
    .filter(sesionCompleta).length

  const fechasEntreno = checkins
    .filter((c) => c.entreno && c.entreno.toLowerCase() !== 'descanso')
    .map((c) => c.fecha)

  const xp = calcularXp({
    checkins: checkins.length,
    sesiones: sesionesRegistradas,
    adherenciasSi: adherencias.filter((a) => a.estado === 'si').length,
    adherenciasParcial: adherencias.filter((a) => a.estado === 'parcial').length,
    respuestas: respuestas.length,
    preparaciones: microciclos.flatMap((m) => m.sesiones).filter((s) => estadoPreparacion(s) === 'hecha').length,
  })

  const nivel = nivelDeXp(xp)
  const siguiente = siguienteNivel(xp)
  const pctHaciaSiguiente = siguiente
    ? Math.round(((xp - nivel.xpMinimo) / (siguiente.xpMinimo - nivel.xpMinimo)) * 100)
    : 100

  const rachaBienestar = calcularRacha(checkins.map((c) => c.fecha), hoy)
  const rachaNutricion = calcularRacha(
    adherencias.filter((a) => a.estado !== 'no').map((a) => a.fecha),
    hoy,
  )
  const rachaEntrenamiento = calcularRacha(fechasEntreno, hoy)

  const activo = microciclos.find((m) => m.estado === 'activo')
  const cerrados = microciclos.filter((m) => m.estado === 'cerrado')
  const cuestionariosPendientes = db.cuestionarios
    .asignadosA(usuarioId)
    .filter((q) => !respuestas.some((r) => r.cuestionarioId === q.id)).length

  const logros = evaluarLogros({
    sesionesRegistradas,
    diasCheckinConsecutivos: rachaBienestar.record,
    microcicloCompleto:
      cerrados.some((m) => resumenMicrociclo(m).pctRegistrado === 100) ||
      (activo ? resumenMicrociclo(activo).pctRegistrado === 100 : false),
    adherenciaPerfectaMicrociclo:
      adherencias.length >= 8 && adherencias.slice(-8).every((a) => a.estado === 'si'),
    cuestionariosPendientes,
    semanasConstancia: Math.floor(rachaBienestar.record / 7),
  })

  return {
    xp,
    nivel,
    siguiente,
    pctHaciaSiguiente,
    rachaBienestar,
    rachaEntrenamiento,
    rachaNutricion,
    logros,
  }
}
