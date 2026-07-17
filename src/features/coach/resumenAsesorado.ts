import { hoyIso, idCoach } from '../../data/dbInstance'
import type { Db } from '../../data/repos'
import { resumenMicrociclo, semaforoAsesorado, type Semaforo } from '../../domain/cumplimiento'
import type { Microciclo, Usuario } from '../../domain/types'

export interface ResumenAsesorado {
  usuario: Usuario
  microciclo?: Microciclo
  pctRegistrado: number
  diasSinRegistrar: number
  readinessBaja: boolean
  semaforo: Semaforo
  noLeidos: number
  cuestionariosPendientes: number
}

const DIA_MS = 24 * 60 * 60 * 1000

function diasDesde(fecha: string | undefined, hoy: string): number {
  if (!fecha) return 99
  const diferencia = new Date(`${hoy}T00:00:00`).getTime() - new Date(`${fecha}T00:00:00`).getTime()
  return Math.max(0, Math.round(diferencia / DIA_MS))
}

export function resumenAsesorado(db: Db, usuario: Usuario): ResumenAsesorado {
  const hoy = hoyIso()
  const idCoachId = idCoach()
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
  const checkins = db.bienestar.byUsuario(usuario.id)
  const ultimoCheckin = checkins[checkins.length - 1]?.fecha
  const diasSinRegistrar = diasDesde(ultimoCheckin, hoy)

  const ultimaSemana = checkins.slice(-7)
  const senalesBajas = ultimaSemana.filter(
    (c) =>
      c.calidadSueno === 'MALA' ||
      c.estres === 'MUCHO' ||
      c.cansancio === 'MUCHO' ||
      (c.horasSueno !== undefined && c.horasSueno < 6),
  ).length
  const readinessBaja = senalesBajas >= 3

  const respuestas = db.cuestionarios.respuestasDe(usuario.id)
  const cuestionariosPendientes = db.cuestionarios
    .asignadosA(usuario.id)
    .filter((q) => !respuestas.some((r) => r.cuestionarioId === q.id)).length

  return {
    usuario,
    microciclo,
    pctRegistrado: microciclo ? resumenMicrociclo(microciclo).pctRegistrado : 0,
    diasSinRegistrar,
    readinessBaja,
    semaforo: semaforoAsesorado({ diasSinRegistrar, readinessBaja }),
    noLeidos: db.mensajes.noLeidosDe(idCoachId, usuario.id),
    cuestionariosPendientes,
  }
}
