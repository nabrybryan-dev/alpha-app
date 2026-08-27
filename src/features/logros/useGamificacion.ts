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

/**
 * Lo ya calculado, por asesorado. La entrada vale mientras coincidan la versión
 * del estado y el día; si cambia cualquiera de las dos, se recalcula.
 *
 * Antes esto se rehacía en CADA render de cualquier pantalla que lo usara:
 * cuatro consultas al repo -que filtran la lista entera-, dos recorridos de
 * todas las sesiones de todos los microciclos, tres rachas y un
 * `resumenMicrociclo` por microciclo cerrado. Nada de eso depende del render:
 * depende de los datos.
 *
 * Vive fuera del hook y no en un `useMemo`, por dos motivos. Uno: así dos
 * componentes que pidan la misma persona en el mismo render comparten el
 * cálculo en vez de repetirlo cada uno. Y dos: la llave queda escrita y
 * revisable, en vez de escondida en un array de dependencias que el linter no
 * puede verificar -`db` es un singleton de módulo, así que no lo ve cambiar, y
 * marcaba `version` como dependencia innecesaria-.
 *
 * El tamaño lo acota la cartera: una entrada por asesorado que se pinte.
 */
const memo = new Map<string, { version: number; hoy: string; valor: Gamificacion }>()

function gamificacionDe(usuarioId: string, version: number, hoy: string): Gamificacion {
  const guardada = memo.get(usuarioId)
  if (guardada && guardada.version === version && guardada.hoy === hoy) return guardada.valor

  const valor = calcular(usuarioId, hoy)
  memo.set(usuarioId, { version, hoy, valor })
  return valor
}

/**
 * `useDbVersion` sube con CUALQUIER cambio del estado: tanto una escritura
 * local (`guardar`) como una hidratación desde la nube (`aplicarSnapshot`),
 * porque las dos avisan a los mismos oyentes. Es la única llave correcta:
 * memoizar por `usuarioId` a secas serviría cifras viejas en cuanto la persona
 * registrara una serie.
 *
 * `hoy` entra en la llave porque las rachas se miden contra el día de hoy: una
 * pestaña abierta toda la noche tiene que recalcular al cruzar la medianoche.
 */
export function useGamificacion(usuarioId: string): Gamificacion {
  return gamificacionDe(usuarioId, useDbVersion(), hoyIso())
}

function calcular(usuarioId: string, hoy: string): Gamificacion {
  const checkins = db.bienestar.byUsuario(usuarioId)
  const adherencias = db.nutricion.adherenciasByUsuario(usuarioId)
  const respuestas = db.cuestionarios.respuestasDe(usuarioId)
  const microciclos = db.microciclos.byUsuario(usuarioId)

  // Un solo recorrido de las sesiones en vez de dos: antes se hacía un `flatMap`
  // completo para contar las registradas y otro idéntico para las preparadas.
  const sesiones = microciclos.flatMap((m) => m.sesiones)
  const sesionesRegistradas = sesiones.filter(sesionCompleta).length
  const preparaciones = sesiones.filter((s) => estadoPreparacion(s) === 'hecha').length

  const fechasEntreno = checkins
    .filter((c) => c.entreno && c.entreno.toLowerCase() !== 'descanso')
    .map((c) => c.fecha)

  // Una pasada por `adherencias` en lugar de dos filtros sobre la misma lista.
  let adherenciasSi = 0
  let adherenciasParcial = 0
  for (const a of adherencias) {
    if (a.estado === 'si') adherenciasSi += 1
    else if (a.estado === 'parcial') adherenciasParcial += 1
  }

  const xp = calcularXp({
    checkins: checkins.length,
    sesiones: sesionesRegistradas,
    adherenciasSi,
    adherenciasParcial,
    respuestas: respuestas.length,
    preparaciones,
  })

  const nivel = nivelDeXp(xp)
  const siguiente = siguienteNivel(xp)
  const pctHaciaSiguiente = siguiente
    ? Math.round(((xp - nivel.xpMinimo) / (siguiente.xpMinimo - nivel.xpMinimo)) * 100)
    : 100

  const rachaBienestar = calcularRacha(
    checkins.map((c) => c.fecha),
    hoy,
  )
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
