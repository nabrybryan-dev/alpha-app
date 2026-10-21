import { noAfirmable, type Cifra } from './contrato'
import { VERSION_DEL_MODELO } from './convenciones'
import { crearAzar, normal, percentil } from './bandas'

/**
 * LAS ÁREAS DE SECCIÓN FISIOLÓGICA (PCSA) DE WARD, y solo como PROPORCIONES entre músculos.
 *
 * Fuente: Ward SR, Eng CM, Smallwood LH, Lieber RL (2009), «Are current measurements of lower extremity
 * muscle architecture accurate?», Clin Orthop Relat Res 467(4):1074-1082, doi 10.1007/s11999-008-0594-8,
 * PMC2650051 (acceso abierto), leído en texto: Tabla 3, PCSA en cm² como media ± sd entre especímenes.
 *
 * ## Por qué solo proporciones
 *
 * Son 21 miembros inferiores de CADÁVER fijados en formol, de personas de 83 ± 9 años. El valor absoluto
 * de un área así subestima a un asesorado joven que entrena; lo que se mantiene razonablemente es el
 * REPARTO del tamaño entre músculos. Por eso esta capa nunca da cm²: da la fracción que cada grupo
 * pone del total de los grupos que extienden la cadera. La sd entre especímenes sirve de banda.
 *
 * ## Qué entra en cada grupo (sentadilla)
 *
 *   · glúteo mayor
 *   · isquios = bíceps femoral CABEZA LARGA + semitendinoso + semimembranoso. La cabeza corta del
 *     bíceps no cruza la cadera (solo flexiona la rodilla), así que no entra.
 *   · aductor mayor (su porción posterior extiende la cadera; Ward da el músculo entero, y eso es un
 *     supuesto: el área de la porción extensora es menor)
 * El cuádriceps (recto femoral + los tres vastos) es el único extensor de rodilla del modelo, así que
 * su fracción en la rodilla es 1 por construcción y no se da.
 *
 * ## La banda
 *
 * Monte Carlo con semilla: cada área normal(media, sd) truncada a > 0 e INDEPENDIENTE de las demás.
 * Los músculos de un mismo espécimen están correlacionados (un cuerpo grande tiene todo grande), y esa
 * correlación ESTRECHA el reparto; suponerlos independientes ensancha la banda, que es el lado seguro.
 */

export type MusculoDeWard =
  | 'gluteo_mayor'
  | 'recto_femoral'
  | 'vasto_lateral'
  | 'vasto_intermedio'
  | 'vasto_medial'
  | 'aductor_mayor'
  | 'biceps_larga'
  | 'biceps_corta'
  | 'semitendinoso'
  | 'semimembranoso'

/** Tabla 3: PCSA en cm², media y sd entre especímenes. */
export const PCSA_DE_WARD: Readonly<Record<MusculoDeWard, { media: number; sd: number }>> = {
  gluteo_mayor: { media: 33.4, sd: 8.8 },
  recto_femoral: { media: 13.5, sd: 5.0 },
  vasto_lateral: { media: 35.1, sd: 16.1 },
  vasto_intermedio: { media: 16.7, sd: 6.9 },
  vasto_medial: { media: 20.6, sd: 7.2 },
  aductor_mayor: { media: 20.5, sd: 7.8 },
  biceps_larga: { media: 11.3, sd: 4.8 },
  biceps_corta: { media: 5.1, sd: 1.7 },
  semitendinoso: { media: 4.8, sd: 2.0 },
  semimembranoso: { media: 18.4, sd: 7.5 },
}

export const GRUPOS_QUE_EXTIENDEN_LA_CADERA = ['gluteoMayor', 'isquios', 'aductorMayor'] as const
export type GrupoDeCadera = (typeof GRUPOS_QUE_EXTIENDEN_LA_CADERA)[number]

export const MUSCULOS_DEL_GRUPO: Readonly<Record<GrupoDeCadera, readonly MusculoDeWard[]>> = {
  gluteoMayor: ['gluteo_mayor'],
  isquios: ['biceps_larga', 'semitendinoso', 'semimembranoso'],
  aductorMayor: ['aductor_mayor'],
}

/** Las fracciones de las medias: la respuesta «sin incertidumbre», que se puede comprobar a mano. */
export function proporcionesCentrales(): Record<GrupoDeCadera, number> {
  const area = (g: GrupoDeCadera) => MUSCULOS_DEL_GRUPO[g].reduce((s, m) => s + PCSA_DE_WARD[m].media, 0)
  const total = GRUPOS_QUE_EXTIENDEN_LA_CADERA.reduce((s, g) => s + area(g), 0)
  return Object.fromEntries(GRUPOS_QUE_EXTIENDEN_LA_CADERA.map((g) => [g, area(g) / total])) as Record<GrupoDeCadera, number>
}

/** Un sorteo normal(media, sd) truncado a > 0: un área no puede ser negativa. Reintenta; agotados los intentos, la media. */
export function sorteoPositivo(media: number, sd: number, azar: () => number): number {
  for (let i = 0; i < 50; i++) {
    const x = media + sd * normal(azar)
    if (x > 0) return x
  }
  return media
}

export const MUESTRAS_DE_AREA = 2000
export const SEMILLA_DE_AREA = 20261021

const SUPUESTOS = [
  'Ward 2009 (Clin Orthop Relat Res 467:1074), Tabla 3: PCSA de 21 miembros de cadáver fijados en formol, 83 ± 9 años',
  'solo proporciones entre grupos: el valor absoluto en cm² subestima a un adulto joven y no se usa',
  'isquios = cabeza larga del bíceps + semitendinoso + semimembranoso (la cabeza corta no cruza la cadera)',
  'aductor mayor entero: la porción que extiende la cadera es solo una parte, así que su fracción está sobrestimada',
  'áreas independientes entre músculos: ensancha la banda (en un espécimen real están correlacionadas)',
]

/**
 * La fracción del área total de los extensores de cadera que pone cada grupo, con su banda, o
 * `no_afirmable` si el muestreo no da suficientes realizaciones.
 */
export function proporcionesDeAreaDeCadera(
  opciones: { muestras?: number; semilla?: number } = {},
): Record<GrupoDeCadera, Cifra> {
  const v = VERSION_DEL_MODELO
  const n = opciones.muestras ?? MUESTRAS_DE_AREA
  if (!Number.isInteger(n) || n < 1) throw new RangeError('muestras debe ser un entero >= 1')
  const semilla = opciones.semilla ?? SEMILLA_DE_AREA
  const azar = crearAzar(semilla)
  const muestras: Record<GrupoDeCadera, number[]> = { gluteoMayor: [], isquios: [], aductorMayor: [] }
  const area = (m: MusculoDeWard) => sorteoPositivo(PCSA_DE_WARD[m].media, PCSA_DE_WARD[m].sd, azar)
  for (let i = 0; i < n; i++) {
    const a = Object.fromEntries(
      GRUPOS_QUE_EXTIENDEN_LA_CADERA.map((g) => [g, MUSCULOS_DEL_GRUPO[g].reduce((s, m) => s + area(m), 0)]),
    ) as Record<GrupoDeCadera, number>
    const total = a.gluteoMayor + a.isquios + a.aductorMayor
    for (const g of GRUPOS_QUE_EXTIENDEN_LA_CADERA) muestras[g].push(a[g] / total)
  }
  const centrales = proporcionesCentrales()
  const salida = {} as Record<GrupoDeCadera, Cifra>
  for (const g of GRUPOS_QUE_EXTIENDEN_LA_CADERA) {
    const id = `sentadilla.area.cadera.${g}`
    const orden = [...muestras[g]].sort((x, y) => x - y)
    if (orden.length < n * 0.9) {
      salida[g] = noAfirmable(id, '1', 'el muestreo de áreas no dio suficientes realizaciones', v)
      continue
    }
    salida[g] = {
      id,
      valor: centrales[g],
      unidad: '1',
      estado: 'estimado',
      fuente: MUSCULOS_DEL_GRUPO[g].flatMap((m) => [`ward09.${m}.pcsa.media`, `ward09.${m}.pcsa.sd`]),
      supuestos: [...SUPUESTOS, `Monte Carlo de ${n} muestras, semilla ${semilla}, normales truncadas a > 0`],
      banda: {
        inf: Math.min(percentil(orden, 0.05), centrales[g]),
        sup: Math.max(percentil(orden, 0.95), centrales[g]),
        nivel: 'percentil 5 a 95 con la sd entre especímenes de cadáver de 83 años',
      },
      version: v,
    }
  }
  return salida
}
