import { ejercicioOndulado } from './ondulacion'
import type { EjercicioPrescrito, Microciclo } from './types'

/**
 * PAUTADO CONTRA HECHO, microciclo a microciclo (9-oct-2026, la presentación para el
 * asesorado): lo que se le pidió contra lo que registró, en dos magnitudes que NUNCA se
 * mezclan en una misma escala — series y volumen en kg·rep.
 *
 * QUÉ SE REUTILIZA Y QUÉ NO. Se buscó antes de escribir: `cargaPorGrupo` (fatiga.ts) y
 * `volumenDeBloque` cuentan series FRACCIONADAS por grupo muscular (directo 1, indirecto
 * 0,5) — sirven para mirar un grupo, no para decirle a una persona «te pedimos 64 series y
 * hiciste 58», que es una suma llana. `ejercicioOndulado` (ondulacion.ts) sí se reutiliza
 * para saber si la carga viene serie a serie. El tonelaje de `ProgresoEvolucion` es una
 * cuenta en línea dentro de un componente (Σ carga × reps de lo registrado); aquí es la
 * misma regla para lo HECHO, pero con su par pautado, que allí no existía.
 *
 * REGLAS (cada una cierra un caso donde un número sería mentira):
 *
 * - **Series pautadas** = Σ `sets`. **Series hechas** = Σ de las series registradas, todas:
 *   una serie sin `reps` (una plancha) es una serie hecha aunque no sume volumen.
 * - **Volumen pautado** = Σ sets × repeticiones objetivo × carga prescrita; si el ejercicio
 *   viene ondulado, Σ de reps × carga de cada serie prescrita. **Volumen hecho** = Σ reps ×
 *   carga de lo registrado.
 * - **Un ejercicio sin carga prescrita en kilos** (peso corporal, tiempo, «registra tu
 *   carga») NO entra al volumen, ni por el lado pautado NI por el hecho. Si entrara solo
 *   por el hecho, el cumplimiento saldría inflado por ejercicios que nadie pautó en kilos.
 *   Se cuentan en `ejerciciosSinCarga` para poder decirlo.
 * - **Los bloques de una técnica de intensidad** (`SerieRegistrada.extra`: myo-reps,
 *   rest-pause) NO suman volumen: es la convención de Alpha (ver `SerieRegistrada.extra`).
 * - **El FALLO** no cambia nada: pauta las mismas reps y la misma carga; lo que lo distingue
 *   pasa después de la última repetición completa y no se cuenta.
 * - La carga se toma tal cual venga (`por lado`, `por mano`…) en pautado y en hecho: la
 *   comparación es coherente aunque el kg·rep no sea el peso físico total movido.
 * - El volumen se redondea a entero (kg·rep) al final: una semana de 30 000 no necesita
 *   decimales y los mismos números tienen que salir en la barra, en el anillo y en la tabla.
 * - Sin pauta de series (solo cardio, semana vacía) no hay contra qué comparar:
 *   `sin-pauta`. Con pauta y cero series registradas: `sin-registros`. Ninguno de los dos
 *   es un cero, y quien pinta NO debe dibujar una barra en cero.
 * - La división por cero devuelve `undefined`, nunca 0 ni Infinity.
 */

export type SituacionPautado = 'con-datos' | 'sin-registros' | 'sin-pauta'

export interface Cantidades {
  pautado: number
  hecho: number
  /** hecho ÷ pautado en %, SIN tope (se puede hacer más de lo pedido). `undefined` si no hay pautado. */
  cumplimientoPct: number | undefined
}

export interface PautadoVsHechoMicrociclo {
  id: string
  numero: number
  fechaInicio: string
  estado: 'activo' | 'cerrado'
  situacion: SituacionPautado
  series: Cantidades
  /** kg·rep. */
  volumen: Cantidades
  /** Ejercicios con series pautadas que no entran al volumen por no traer carga en kilos. */
  ejerciciosSinCarga: number
}

function entero(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

function positivo(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

/** El volumen que pide un ejercicio, o `undefined` si no se puede saber en kilos. */
function volumenPautadoDe(e: EjercicioPrescrito): number | undefined {
  if (e.sets <= 0) return undefined
  if (ejercicioOndulado(e) && e.seriesPrescritas) {
    const escalera = [...e.seriesPrescritas].sort((a, b) => a.orden - b.orden).slice(0, e.sets)
    if (escalera.every((s) => positivo(s.reps) && positivo(s.cargaKg))) {
      return escalera.reduce((suma, s) => suma + s.reps * s.cargaKg, 0)
    }
    return undefined
  }
  if (!positivo(e.cargaKg) || !positivo(e.repsDiana)) return undefined
  return e.sets * e.repsDiana * e.cargaKg
}

function volumenHechoDe(e: EjercicioPrescrito): number {
  return e.series.reduce((suma, s) => {
    if (typeof s.reps !== 'number' || !Number.isFinite(s.reps)) return suma
    if (typeof s.cargaKg !== 'number' || !Number.isFinite(s.cargaKg)) return suma
    return suma + Math.max(0, s.reps) * Math.max(0, s.cargaKg)
  }, 0)
}

function cumplimiento(pautado: number, hecho: number): number | undefined {
  return pautado > 0 ? Math.round((hecho / pautado) * 100) : undefined
}

export function pautadoVsHechoDe(microciclo: Microciclo): PautadoVsHechoMicrociclo {
  let seriesPautadas = 0
  let seriesHechas = 0
  let volumenPautado = 0
  let volumenHecho = 0
  let ejerciciosSinCarga = 0

  for (const sesion of microciclo.sesiones) {
    for (const ejercicio of sesion.ejercicios) {
      seriesPautadas += entero(ejercicio.sets)
      seriesHechas += ejercicio.series.length

      if (entero(ejercicio.sets) === 0) continue
      const pauta = volumenPautadoDe(ejercicio)
      if (pauta === undefined) {
        ejerciciosSinCarga += 1
        continue
      }
      volumenPautado += pauta
      volumenHecho += volumenHechoDe(ejercicio)
    }
  }

  const vp = Math.round(volumenPautado)
  const vh = Math.round(volumenHecho)
  const situacion: SituacionPautado =
    seriesPautadas === 0 ? 'sin-pauta' : seriesHechas === 0 ? 'sin-registros' : 'con-datos'

  return {
    id: microciclo.id,
    numero: microciclo.numero,
    fechaInicio: microciclo.fechaInicio,
    // `propuesto` ya se filtró arriba (`pautadoVsHechoPorMicrociclo`); aquí solo queda lo vivido.
    estado: microciclo.estado === 'activo' ? 'activo' : 'cerrado',
    situacion,
    series: {
      pautado: seriesPautadas,
      hecho: seriesHechas,
      cumplimientoPct: cumplimiento(seriesPautadas, seriesHechas),
    },
    volumen: { pautado: vp, hecho: vh, cumplimientoPct: cumplimiento(vp, vh) },
    ejerciciosSinCarga,
  }
}

/**
 * Todos los microciclos que la persona ya tiene cargados, por número. Los `propuesto` no
 * entran: todavía no son suyos (mismo criterio que `adherenciaPorMicrociclo`).
 */
export function pautadoVsHechoPorMicrociclo(historial: readonly Microciclo[]): PautadoVsHechoMicrociclo[] {
  return historial
    .filter((m) => m.estado !== 'propuesto')
    .map(pautadoVsHechoDe)
    .sort((a, b) => a.numero - b.numero)
}

export type MagnitudPautado = 'series' | 'volumen'

/**
 * Por qué un microciclo NO tiene barras en la magnitud elegida, o `undefined` si las tiene.
 * Es la frase que se pinta en lugar de una barra en cero.
 */
export function motivoSinBarras(fila: PautadoVsHechoMicrociclo, magnitud: MagnitudPautado): string | undefined {
  if (fila.situacion === 'sin-pauta') return 'sin pauta'
  if (fila.situacion === 'sin-registros') return 'sin registros'
  if (magnitud === 'volumen' && fila.volumen.pautado <= 0) return 'sin kilos pautados'
  return undefined
}

const FORMATO_ENTERO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

/** El número tal cual se escribe sobre la barra y en la tabla: entero, con punto de miles. Uno solo para los dos. */
export function numeroExacto(n: number): string {
  return FORMATO_ENTERO.format(n)
}
