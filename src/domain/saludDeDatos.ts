/**
 * Salud de los datos: ¿está llegando lo que la gente registra?
 *
 * POR QUÉ EXISTE. El registro de comidas estuvo roto desde que existe la función
 * y nadie lo notó: la app guardaba en el teléfono, la subida fallaba y el
 * descarte es silencioso a propósito (protege el registro local). Ninguna
 * pantalla decía «llevas semanas sin recibir una sola comida», que es la frase
 * que habría convertido semanas en horas.
 *
 * Esto no previene el fallo: lo hace visible. Lo que se mira no es cuánto
 * registra una persona —eso es adherencia, y es otra cosa— sino si el canal
 * está vivo: si de TODO el equipo no llega ni un dato de una familia, no es que
 * nadie coma, es que algo se rompió.
 */

/** Días sin un solo registro nuevo antes de considerar la familia atrasada. */
export const UMBRAL_ATRASO_DIAS = 3

/** Ventana que se resume en el panel. */
export const VENTANA_DIAS = 7

const DIA_MS = 24 * 60 * 60 * 1000

export type EstadoSalud = 'al-dia' | 'atrasado' | 'sin-datos'

export interface FamiliaDeDatos {
  id: string
  nombre: string
  /** Fechas `YYYY-MM-DD` de los registros que llegaron, en cualquier orden. */
  fechas: readonly string[]
}

export interface SaludDeFamilia {
  id: string
  nombre: string
  /** Cuántos registros llegaron en la ventana. */
  recientes: number
  /** Fecha del último registro, si hay alguno. */
  ultimo?: string
  /** Días desde el último registro. Sin registros, indefinido. */
  diasSinRegistrar?: number
  estado: EstadoSalud
}

export interface Salud {
  familias: SaludDeFamilia[]
  /**
   * Ninguna familia tiene un solo registro. Es un equipo recién creado, no una
   * avería: pintar todo en rojo el primer día enseña a ignorar el panel.
   */
  sinEstrenar: boolean
}

function aDia(fechaIso: string): number {
  return Math.floor(new Date(`${fechaIso}T00:00:00`).getTime() / DIA_MS)
}

function saludDeFamilia(familia: FamiliaDeDatos, hoyIso: string): SaludDeFamilia {
  const base = { id: familia.id, nombre: familia.nombre }
  if (familia.fechas.length === 0) {
    return { ...base, recientes: 0, estado: 'sin-datos' }
  }

  const hoy = aDia(hoyIso)
  const dias = familia.fechas.map(aDia)
  const ultimoDia = Math.max(...dias)
  // Un registro con fecha futura (reloj del móvil adelantado) no debe dar
  // "hace -2 días" ni marcar como atrasado lo que está al día.
  const diasSinRegistrar = Math.max(0, hoy - ultimoDia)
  const desde = hoy - VENTANA_DIAS

  return {
    ...base,
    recientes: dias.filter((d) => d > desde).length,
    ultimo: familia.fechas[dias.indexOf(ultimoDia)],
    diasSinRegistrar,
    estado: diasSinRegistrar > UMBRAL_ATRASO_DIAS ? 'atrasado' : 'al-dia',
  }
}

/**
 * Estado de cada familia de datos del equipo.
 *
 * Los umbrales son de presentación, no clínicos: dicen cuándo mirar, no que
 * algo esté mal. Una familia atrasada puede ser temporada baja; una familia en
 * cero desde siempre casi nunca lo es.
 */
export function saludDeDatos(familias: readonly FamiliaDeDatos[], hoyIso: string): Salud {
  const evaluadas = familias.map((f) => saludDeFamilia(f, hoyIso))
  return {
    familias: evaluadas,
    sinEstrenar: evaluadas.length > 0 && evaluadas.every((f) => f.estado === 'sin-datos'),
  }
}

/** Las que piden mirada, para poder avisar sin obligar a leer la tabla entera. */
export function familiasEnRiesgo(salud: Salud): SaludDeFamilia[] {
  if (salud.sinEstrenar) return []
  return salud.familias.filter((f) => f.estado !== 'al-dia')
}
