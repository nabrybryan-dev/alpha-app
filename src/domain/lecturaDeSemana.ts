import { diaSemanaDe } from './calendario'
import { esPorTiempo } from './prescripcion'
import { ultimoDiaDe } from './rutaEntrenamiento'
import type { EjercicioPrescrito, Microciclo, UnidadCarga } from './types'

/**
 * Las frases llanas de «la semana pasada, esta y la que viene» (presentación para el
 * asesorado): fechas en claro y, por ejercicio, lo que se le pidió y lo que hizo. Todo sale de
 * campos que ya existen; lo que no hay, no se escribe (un `cargaKg` ausente NO es «0 kg»).
 */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

interface FechaPartida {
  anio: number
  mes: number
  dia: number
}

function partir(iso: string): FechaPartida {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return { anio, mes, dia }
}

/**
 * «del lunes 5 al domingo 11 de octubre». Si cruza de mes se dice el mes dos veces, y si cruza
 * de año, el año también. El último día sale de `ultimoDiaDe` (la misma cuenta de cadencia que
 * usa la Ruta), así que un microciclo de 15 días dice «del lunes 5 al lunes 19», no «al domingo».
 * Sin cadencia no se inventa un final: «desde el lunes 5 de octubre».
 */
export function fechasEnClaro(microciclo: Microciclo): string {
  const inicio = partir(microciclo.fechaInicio)
  const diaInicio = diaSemanaDe(microciclo.fechaInicio).toLowerCase()
  const fin = ultimoDiaDe(microciclo)
  if (!fin) return `desde el ${diaInicio} ${inicio.dia} de ${MESES[inicio.mes - 1]}`

  const f = partir(fin)
  const diaFin = diaSemanaDe(fin).toLowerCase()
  const mismoAnio = inicio.anio === f.anio
  const mismoMes = mismoAnio && inicio.mes === f.mes
  const izquierda = mismoMes
    ? `${diaInicio} ${inicio.dia}`
    : `${diaInicio} ${inicio.dia} de ${MESES[inicio.mes - 1]}${mismoAnio ? '' : ` de ${inicio.anio}`}`
  return `del ${izquierda} al ${diaFin} ${f.dia} de ${MESES[f.mes - 1]}${mismoAnio ? '' : ` de ${f.anio}`}`
}

/** «60» y «62,5»: coma decimal, que es como se escriben los números en toda la app. */
function cifra(n: number): string {
  return String(Number(n.toFixed(2))).replace('.', ',')
}

/**
 * Lo que acompaña a los kilos. `unidadCarga` no dice en qué unidad está el número —siempre
 * son kilos— sino a QUÉ se refieren: `'kg'` no añade nada; `'total'`, `'por lado'` y
 * `'por mano'` cambian lo que se pone en la barra o en cada mancuerna. Es el mismo reparto
 * que `sufijoUnidad` (prescripcion.ts) y `matizDeUnidad` (la pared del salón); aquí se repite
 * porque ambos son privados y exportarlos tocaría archivos ajenos a este encargo.
 */
function matiz(unidad: UnidadCarga | undefined): string {
  return unidad === undefined || unidad === 'kg' ? '' : ` (${unidad})`
}

function esNumero(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** La carga prescrita, o lo que se pueda decir sin inventarla. */
function cargaPedida(e: EjercicioPrescrito): string {
  if (esNumero(e.cargaKg)) return `${cifra(e.cargaKg)} kg${matiz(e.unidadCarga)}`
  // Ondulado: no hay UNA carga sino una por serie; se dice la horquilla real.
  const escalera = (e.seriesPrescritas ?? []).map((s) => s.cargaKg).filter(esNumero)
  if (escalera.length > 0) {
    const menor = Math.min(...escalera)
    const mayor = Math.max(...escalera)
    return menor === mayor ? `${cifra(menor)} kg` : `${cifra(menor)} a ${cifra(mayor)} kg`
  }
  return 'sin carga fija'
}

/**
 * «Te pedimos»: «3 series de 8-10 repeticiones · 60 kg (por lado)». Un ejercicio por tiempo
 * (`rango` en segundos o minutos) no dice «repeticiones»: escribirlas ahí fue el error de «A 1
 * REPS» en una plancha que ya corrigió la prescripción.
 */
export function textoDeLoPedido(e: EjercicioPrescrito): string {
  const rango = (e.rango ?? '').replace(/[()]/g, '').replace(/\s*reps?\.?$/i, '').trim()
  const series = e.sets > 0 ? `${e.sets} ${e.sets === 1 ? 'serie' : 'series'}` : ''
  const de = rango ? (esPorTiempo(rango) ? `de ${rango}` : `de ${rango} ${rango === '1' ? 'repetición' : 'repeticiones'}`) : ''
  return [[series, de].filter(Boolean).join(' '), cargaPedida(e)].filter(Boolean).join(' · ')
}

/**
 * «Hiciste»: «3 series · 60 kg × 10 · 60 kg × 9 · 55 kg × 10», o `undefined` si no anotó
 * ninguna (quien pinta dice «sin anotar»). Una serie sin repeticiones (una plancha) sigue
 * contando como serie hecha, igual que en `pautadoVsHechoDe`.
 */
export function textoDeLoHecho(e: EjercicioPrescrito): string | undefined {
  if (e.series.length === 0) return undefined
  const cuantas = `${e.series.length} ${e.series.length === 1 ? 'serie' : 'series'}`
  const detalle = [...e.series]
    .sort((a, b) => a.orden - b.orden)
    .map((s) => {
      const carga = esNumero(s.cargaKg) ? `${cifra(s.cargaKg)} kg` : ''
      const reps = esNumero(s.reps) ? String(s.reps) : ''
      if (carga && reps) return `${carga} × ${reps}`
      if (carga) return carga
      return reps ? `${reps} reps` : ''
    })
    .filter(Boolean)
  return [cuantas, ...detalle].join(' · ')
}
