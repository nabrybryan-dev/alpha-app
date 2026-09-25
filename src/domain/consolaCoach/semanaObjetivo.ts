import type { CadenaCorrida } from '../../data/consola/cadenaCorridas'
import { lunesDeLaSemana } from '../resumenSemanal/reparto'

/**
 * La semana que «Detener publicación» y «Reportar riesgo» tienen que apuntar — la que SE
 * VA A CARGAR, no la que está en curso.
 *
 * Bryan o Manuela revisan sábado/domingo; la carga real es el LUNES SIGUIENTE, y la guarda
 * de la carga (ya en producción, en el repo de agentes) compara `objetivo.semana_inicio`
 * contra la `fechaInicio` de esa semana NUEVA — nunca contra la que está terminando. Un
 * `semana_inicio` calculado con `lunesDeLaSemana(hoy)` apuntaría a la semana que ya se
 * cargó o se está viviendo: «Detener» no detendría nada.
 *
 * Es la `semana_inicio` MÁS RECIENTE entre las filas de `cadena_corridas` de esta persona,
 * SI es posterior al lunes en curso — una corrida de esta semana o de una vieja no cuenta:
 * ya se cargó o se está cargando, no es la que viene. Sin ninguna corrida posterior (la
 * cadena todavía no generó nada para la próxima semana), es el LUNES SIGUIENTE al de hoy —
 * la única semana que todavía puede detenerse antes de que exista un solo evento que la
 * describa.
 */
export function semanaObjetivoDeAcciones(
  usuarioId: string,
  corridas: readonly CadenaCorrida[],
  hoy: string,
): string {
  const lunesActual = lunesDeLaSemana(hoy)
  const masReciente = corridas
    .filter((c) => c.usuarioId === usuarioId)
    .reduce<string | undefined>((max, c) => (max === undefined || c.semanaInicio > max ? c.semanaInicio : max), undefined)

  if (masReciente !== undefined && masReciente > lunesActual) return masReciente
  return lunesSiguiente(lunesActual)
}

/** El lunes siete días después de `lunes` (que ya debe ser, a su vez, un lunes). */
function lunesSiguiente(lunes: string): string {
  const d = new Date(`${lunes}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString().slice(0, 10)
}
