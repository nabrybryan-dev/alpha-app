import { ultimoEventoPorPaso, type CadenaCorrida, type PasoCadena } from '../data/consola/cadenaCorridas'
import { fechaCorta, type TablaPlan } from './consolaCoach/perfilCompleto'
import { nombreDelMicrociclo } from './palabrasLlanas'
import type { Microciclo } from './types'

/**
 * Lo que la presentación para el asesorado necesita de dos fuentes que ya existen —el
 * plan estratégico y la cadena de agentes— puesto en la forma que se pinta. Nada se inventa:
 * lo que la fuente no trae, no sale.
 */

// ── El mapa del plan ──────────────────────────────────────────────────────────────────

export type SituacionCasilla = 'hecha' | 'actual' | 'viene'

export interface CasillaMapa {
  numero: number
  situacion: SituacionCasilla
  /** Las columnas de su fila del plan, tal cual las escribe el coach (ya sin marcas de Markdown). */
  detalle: { titulo: string; texto: string }[]
}

/**
 * Una casilla por microciclo del plan. La actual es la del microciclo en curso; sin
 * microciclo en curso, «hecha» es lo que no pasa del último cerrado. Las columnas vacías
 * no se pintan: una celda en blanco del plan no es un dato.
 *
 * Reutiliza `tablaDelPlan` (perfilCompleto.ts), que es quien sabe leer la forma del
 * `contenido` y quitar el Markdown, igual que la ficha de la consola.
 */
export function mapaDelPlan(
  tabla: TablaPlan | undefined,
  numeroActual: number | undefined,
  ultimoCerrado: number | undefined,
): CasillaMapa[] {
  if (!tabla) return []
  return tabla.filas.map((fila) => {
    const situacion: SituacionCasilla =
      numeroActual !== undefined
        ? fila.numero === numeroActual
          ? 'actual'
          : fila.numero < numeroActual
            ? 'hecha'
            : 'viene'
        : ultimoCerrado !== undefined && fila.numero <= ultimoCerrado
          ? 'hecha'
          : 'viene'
    const detalle = tabla.cabecera
      .map((titulo, i) => ({ titulo, texto: (fila.celdas[i] ?? '').trim() }))
      .filter((d) => d.texto !== '')
    return { numero: fila.numero, situacion, detalle }
  })
}

// ── Las conclusiones de la cadena ─────────────────────────────────────────────────────

export interface ConclusionDeSemana {
  clave: string
  /** «Semana 8», o «Semana del 12 oct» si la corrida no cae en ningún microciclo cargado. */
  titulo: string
  numero?: number
  /** Desde cuándo cuenta (para ordenar). */
  desde: string
  /** El paso del que sale el texto. */
  paso: PasoCadena
  resumen?: string
  avisos: string[]
}

/** Un aviso llega como texto suelto o como objeto de forma libre: solo se aprovecha lo que ya es texto. */
export function textoDeAviso(aviso: unknown): string | undefined {
  if (typeof aviso === 'string') return aviso.trim() || undefined
  if (typeof aviso === 'object' && aviso !== null) {
    const o = aviso as Record<string, unknown>
    for (const campo of ['texto', 'mensaje', 'aviso', 'descripcion']) {
      const v = o[campo]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return undefined
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Los pasos de los que se toma el texto, del último al primero. El ① (Valoración) se deja
 * fuera A PROPÓSITO: es el dictamen cuyos campos de resumen se derivan mal de las series
 * (anota el pico de la rampa en vez del arranque, o se queda vacío en falso — medido el
 * 2026-09-06) y nadie lo contrasta. Ni la consola ni la cadena lo desmienten, así que a
 * una persona no se le enseña como conclusión. Se toma el del último paso COMPLETADO de
 * los demás.
 */
const PASOS_QUE_CONCLUYEN: readonly PasoCadena[] = [4, 3, 2]

/**
 * Por microciclo, lo que la cadena dejó escrito: `resumen` y `avisos` del último paso
 * completado (②-④) de esa semana. Una corrida pertenece al microciclo que la contiene por
 * fecha (su `semana_inicio` cae entre `fechaInicio` y `fechaInicio + cadencia`). Las que no
 * caen en ninguno (la semana que viene, preparada por adelantado) salen con su fecha.
 * Lo más reciente primero. Un grupo sin texto no sale.
 */
export function conclusionesPorMicrociclo(
  corridas: readonly CadenaCorrida[],
  usuarioId: string,
  microciclos: readonly Microciclo[],
): ConclusionDeSemana[] {
  const propias = corridas.filter((c) => c.usuarioId === usuarioId)
  const grupos = new Map<string, { micro?: Microciclo; semana: string; eventos: CadenaCorrida[] }>()

  for (const c of propias) {
    const micro = microciclos.find(
      (m) => m.estado !== 'propuesto' && c.semanaInicio >= m.fechaInicio && c.semanaInicio < sumarDias(m.fechaInicio, m.cadenciaDias),
    )
    const clave = micro ? `m:${micro.id}` : `s:${c.semanaInicio}`
    const g = grupos.get(clave) ?? { micro, semana: c.semanaInicio, eventos: [] }
    g.eventos.push(c)
    grupos.set(clave, g)
  }

  const salida: ConclusionDeSemana[] = []
  for (const [clave, g] of grupos) {
    const porPaso = ultimoEventoPorPaso(g.eventos)
    const paso = PASOS_QUE_CONCLUYEN.find((p) => porPaso[p]?.estado === 'completado')
    const evento = paso !== undefined ? porPaso[paso] : undefined
    if (!evento || paso === undefined) continue

    const resumen = evento.resumen?.trim() || undefined
    const avisos = [...new Set(evento.avisos.map(textoDeAviso).filter((t): t is string => t !== undefined))]
    if (!resumen && avisos.length === 0) continue

    salida.push({
      clave,
      titulo: g.micro ? nombreDelMicrociclo(g.micro.numero, true) : `Semana del ${fechaCorta(g.semana)}`,
      numero: g.micro?.numero,
      desde: g.micro ? g.micro.fechaInicio : g.semana,
      paso,
      resumen,
      avisos,
    })
  }
  return salida.sort((a, b) => b.desde.localeCompare(a.desde))
}
