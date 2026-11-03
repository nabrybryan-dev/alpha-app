import { noAfirmable, type Cifra } from './contrato'
import { VERSION_DEL_MODELO } from './convenciones'
import { momentosDeSentadilla, type EntradaDeSentadilla } from './dinamica'
import { repartirMomento, type Musculo } from './reparto'
import { momentosPasivosDeLaPose } from './pasivo'
import { proporcionesDeAreaDeCadera } from './areasDeWard'

/**
 * EL REPARTO DE LA SENTADILLA CON BARRA ENTRE MÚSCULOS (M5), con la puerta puesta.
 *
 * Plano y unidades: las de `dinamica.ts` y `reparto.ts`.
 *
 * Los cuatro grupos de la sentadilla son cuádriceps (rodilla) y glúteo mayor, isquios y aductor
 * mayor (cadera). Tanda A reabierta el 21-oct con fuentes abiertas:
 *   · el momento pasivo viene de Silder 2007 (`pasivo.ts`) y es `no_afirmable` fuera de su dominio;
 *   · las áreas de Ward 2009 (`areasDeWard.ts`) dan solo PROPORCIONES entre los grupos de cadera;
 *   · los BRAZOS DE PALANCA internos de cada músculo siguen sin una tabla abierta (Arnold 2010 está en
 *     figuras). Sin brazos no hay reparto: SIN una tabla muscular los cuatro músculos son `no_afirmable`.
 *
 * Si quien llama pasa una tabla, el resultado se marca `simulado` y con el supuesto «parámetros
 * hipotéticos»: sirve para ver cómo se comporta el método, no para decirle nada a un asesorado.
 * El estado `estimado` está reservado a parámetros con procedencia verificada.
 */

export interface TablaMuscular {
  cadera: readonly Musculo[]
  rodilla: readonly Musculo[]
  /** Exponente del criterio Σ(F/A)^r; lo fija quien llama. */
  r: number
}

export const MUSCULOS_DE_LA_SENTADILLA = ['cuadriceps', 'gluteoMayor', 'isquios', 'aductorMayor'] as const

const MOTIVO_MUSCULOS =
  'faltan los brazos de palanca internos de cada músculo (sin tabla abierta; Arnold 2010 solo en figuras): las áreas de Ward 2009 dan proporciones, no el reparto'

export interface RepartoDeSentadilla {
  musculos: Cifra[]
  /** Momento pasivo de cadera y rodilla (Silder 2007), `no_afirmable` fuera de su dominio. */
  pasivo: Cifra[]
  /** Proporción del área de los grupos que extienden la cadera (Ward 2009), con su banda. */
  areas: Cifra[]
}

export function repartoDeSentadilla(e: EntradaDeSentadilla, tabla?: TablaMuscular | null): RepartoDeSentadilla {
  const v = VERSION_DEL_MODELO
  const pose = e.pose ? { tibia: e.pose.tibia, muslo: e.pose.muslo, tronco: e.pose.tronco } : null
  const pas = momentosPasivosDeLaPose(pose)
  const pasivo = [pas.cadera, pas.rodilla]
  const proporciones = proporcionesDeAreaDeCadera()
  const areas = [proporciones.gluteoMayor, proporciones.isquios, proporciones.aductorMayor]
  const sinDatos = (motivo: string): RepartoDeSentadilla => ({
    musculos: MUSCULOS_DE_LA_SENTADILLA.map((m) => noAfirmable(`sentadilla.reparto.${m}`, '1', motivo, v)),
    pasivo,
    areas,
  })
  if (!tabla) return sinDatos(MOTIVO_MUSCULOS)
  const mom = momentosDeSentadilla(e)
  if (mom.cadera.valor === null || mom.rodilla.valor === null) {
    return sinDatos(mom.cadera.motivo ?? 'falta un dato del sujeto, la carga o la pose')
  }
  const reparto = (articulacion: 'cadera' | 'rodilla') =>
    repartirMomento(mom[articulacion].valor as number, tabla[articulacion], tabla.r)
  const rodilla = reparto('rodilla')
  const cadera = reparto('cadera')
  if (!rodilla || !cadera) return sinDatos('el momento no es extensor o la tabla muscular no admite el reparto')
  const cifra = (nombre: string, fraccion: number): Cifra => ({
    id: `sentadilla.reparto.${nombre}`,
    valor: fraccion,
    unidad: '1',
    estado: 'simulado',
    fuente: ['reparto.metodo.crowninshield-brand-1981'],
    supuestos: ['parámetros musculares hipotéticos, sin procedencia verificada', `criterio Σ(F/A)^r con r = ${tabla.r}`],
    banda: null,
    version: v,
  })
  return {
    musculos: [...rodilla, ...cadera].map((x) => cifra(x.nombre, x.fraccion)),
    pasivo,
    areas,
  }
}
