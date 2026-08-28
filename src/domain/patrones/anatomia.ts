/**
 * Catálogo anatómico: tipos y consultas.
 *
 * Un músculo NO es un tubo entre dos puntos. Tiene porciones con identidad
 * propia —la cabeza larga del bíceps nace en la escápula y la corta en la
 * coracoides—, y esa diferencia es justo lo que explica por qué un ejercicio
 * carga una y no la otra. Aquí cada porción lleva su origen y su inserción con
 * el nombre del accidente óseo, para que el asesorado pueda leerlo y entenderlo
 * en vez de ver una mancha roja.
 *
 * Los datos viven en `musculosInferior.ts` y `musculosSuperior.ts`; este módulo
 * solo define la forma y la manera de consultarlos.
 */

import type { Vec3 } from './algebra'

/** `[hueso, t a lo largo del hueso, desplazamiento local]`. */
export type Anclaje = [string, number, Vec3]

export type Grupo =
  | 'cadera'
  | 'rodilla'
  | 'tobillo'
  | 'tronco'
  | 'escapula'
  | 'hombro'
  | 'codo'

export const NOMBRE_DE_GRUPO: Record<Grupo, string> = {
  cadera: 'Cadera',
  rodilla: 'Rodilla',
  tobillo: 'Tobillo y pie',
  tronco: 'Tronco',
  escapula: 'Cintura escapular',
  hombro: 'Hombro',
  codo: 'Codo y antebrazo',
}

/**
 * Una porción muscular: un vientre con su propio origen, su propia inserción y
 * su propia acción.
 *
 * `origen` e `insercion` son el texto anatómico que se le enseña al asesorado.
 * `desde` y `hasta` son dónde cae eso en el esqueleto del visor. Los dos tienen
 * que contar la misma historia: si el texto dice «tuberosidad isquiática» y la
 * geometría sale del fémur, el visor está mintiendo con letra pequeña.
 */
/**
 * Cómo se ordenan las fibras dentro de la porción.
 *
 * No es un detalle de manual: decide qué se ve al contraerse. En un fusiforme
 * las fibras corren a lo largo y el vientre se acorta entero; en un penado van
 * oblicuas a un tendón, así que el músculo engorda mucho y se acorta poco. Un
 * gemelo y un bíceps se mueven distinto porque están construidos distinto, y
 * dibujarlos los dos como un tubo liso borra justamente eso.
 *
 * - `fusiforme`  fibras a lo largo del eje. Bíceps braquial.
 * - `unipenado`  todas a un lado del tendón, oblicuas. Vasto lateral.
 * - `bipenado`   a los dos lados de un tendón central. Recto femoral, gemelo.
 * - `multipenado` varios tendones dentro del mismo músculo. Deltoides.
 * - `convergente` nacen anchas y confluyen en un tendón. Pectoral, dorsal.
 * - `plano`      láminas paralelas anchas. Oblicuos, transverso.
 */
export type Arquitectura =
  | 'fusiforme'
  | 'unipenado'
  | 'bipenado'
  | 'multipenado'
  | 'convergente'
  | 'plano'

export interface Porcion {
  id: string
  nombre: string
  origen: string
  insercion: string
  desde: Anclaje
  hasta: Anclaje
  via?: Anclaje[]
  radio: number
  /** Achatamiento de la sección: 1 es redondo, 0,4 es una lámina. */
  aplanar?: number
  /** Cómo van las fibras. Si no se dice, fusiforme. */
  arquitectura?: Arquitectura
  /**
   * Ángulo de la fibra con el eje del músculo, en grados.
   *
   * Cero es una fibra paralela al eje. Los penados del cuerpo humano rondan los
   * 10° a 30°, y cuanto mayor es, más fuerza cabe en el mismo volumen a costa de
   * recorrido. Solo se declara donde la arquitectura no es fusiforme.
   */
  penacion?: number
  /** Fascículos visibles dentro de la porción, para los músculos en abanico. */
  fasciculos?: number
  abanicoDesde?: Vec3
  abanicoHasta?: Vec3
  /**
   * Cruza dos articulaciones, así que su longitud depende de las dos. Es lo que
   * explica que el recto femoral no pueda dar todo su recorrido en sentadilla,
   * o que la cabeza larga del tríceps solo se estire con el brazo elevado.
   */
  biarticular?: boolean
}

export interface Musculo {
  id: string
  nombre: string
  grupo: Grupo
  /** Qué hace, dicho como lo diría un preparador. */
  acciones: string[]
  porciones: Porcion[]
}

/** Clave de una porción concreta: `biceps.larga`. */
export const clavePorcion = (musculo: string, porcion: string): string =>
  `${musculo}.${porcion}`

export interface PorcionLocalizada {
  musculo: Musculo
  porcion: Porcion
  /** `biceps.larga` */
  clave: string
}

export function indexarPorciones(musculos: Musculo[]): PorcionLocalizada[] {
  const salida: PorcionLocalizada[] = []
  for (const musculo of musculos) {
    for (const porcion of musculo.porciones) {
      salida.push({ musculo, porcion, clave: clavePorcion(musculo.id, porcion.id) })
    }
  }
  return salida
}

/**
 * Activación: de 0 a 1, por músculo entero o por porción concreta.
 *
 * Admite `biceps`, `biceps.larga` y el sufijo de lado `:D` / `:I` sobre
 * cualquiera de los dos. La porción manda sobre el músculo, y el lado sobre lo
 * general, porque es siempre lo más específico lo que se quiso decir.
 */
export type Activacion = Record<string, number>

export function activacionDe(
  activacion: Activacion,
  musculoId: string,
  porcionId: string,
  lado: string,
): number {
  const porcion = clavePorcion(musculoId, porcionId)
  const candidatos = [
    `${porcion}:${lado}`,
    porcion,
    `${musculoId}:${lado}`,
    musculoId,
  ]
  for (const c of candidatos) {
    const v = activacion[c]
    if (v !== undefined) return v
  }
  return 0
}

/** La activación más alta de cualquier porción del músculo, en cualquier lado. */
export function activacionMaxima(activacion: Activacion, musculo: Musculo): number {
  let max = 0
  for (const p of musculo.porciones) {
    for (const lado of ['D', 'I']) {
      max = Math.max(max, activacionDe(activacion, musculo.id, p.id, lado))
    }
  }
  return max
}
