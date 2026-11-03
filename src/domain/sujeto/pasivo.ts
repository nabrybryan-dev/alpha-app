import { noAfirmable, type Cifra } from './contrato'
import { VERSION_DEL_MODELO } from './convenciones'
import { crearAzar, normal, percentil } from './bandas'
import type { PoseSagital } from './dinamica'

/**
 * EL MOMENTO PASIVO DE CADERA, RODILLA Y TOBILLO (M5, tanda A reabierta el 21-oct).
 *
 * Fuente: Silder A, Whittington B, Heiderscheit B, Thelen DG (2007), «Identification of passive
 * elastic joint moment-angle relationships in the lower extremity», J Biomech 40(12):2628-2635,
 * doi 10.1016/j.jbiomech.2006.12.017, manuscrito de autor PMC2020832 (acceso abierto), leído en
 * texto: ecuaciones A.5 a A.7, Tabla 4 (parámetros, media y sd de 20 adultos jóvenes sanos) y
 * Tabla 2 (los ensayos que fijan DÓNDE vale el modelo). Plano sagital, sin histéresis.
 *
 * Cada músculo aporta `e^(β·(θ − α))` newton-metros (el artículo: «reduce a 1 Nm cuando el ángulo es
 * el desfase»). Los bi-articulares acoplan dos articulaciones con el cociente de ganancias.
 *
 * ## Dos decisiones que NO vienen del artículo
 *
 *  1. **β va por RADIÁN.** El artículo no dice la unidad de β ni de θ en las ecuaciones; α sí está en
 *     grados (Tabla 4). Con β por grado los exponentes salen de cientos y ninguna cifra tiene
 *     sentido. Con β por radián y α pasado a radianes, la cadera al despegue de la marcha
 *     (flexión −10°, rodilla 35°) da 34 N·m de flexor pasivo con los parámetros medios, del orden de
 *     los «~20 Nm» que el artículo publica para un sujeto en ese instante. Es un supuesto con su
 *     prueba de orden de magnitud (`pasivo.test.ts`), no un hecho confirmado: si se consigue el PDF
 *     de la editorial, hay que confirmarlo.
 *  2. **Signo.** En el artículo un momento positivo es FLEXOR (de cadera y rodilla) y de dorsiflexión.
 *     Aquí, como en `dinamica.ts`, positivo es el momento que hacen las estructuras para SOSTENER
 *     la carga: extensor de cadera y rodilla, flexor plantar. Todo se devuelve con el signo cambiado.
 *
 * ## Dominio de validez (Tabla 2)
 *
 * Fuera de los ángulos ensayados el modelo extrapola exponenciales: ahí la salida es `no_afirmable`,
 * no un número. El dominio se juzga por TÉRMINO, porque cada articulación solo usa algunos:
 *   · cadera y rodilla (términos RF/HAM): (cadera, rodilla) dentro de la unión de los ensayos
 *     —cadera −15° a 85° con rodilla 0° a 135°, o cadera 85° a 100° con rodilla 0° a 25°—;
 *   · rodilla y tobillo (término GAS): rodilla 0° a 135° y tobillo −20° a 20°.
 * La rodilla necesita las dos cosas; la cadera la primera; el tobillo la segunda. Una sentadilla
 * profunda (cadera por encima de 100°, o 85° con rodilla flexionada) cae fuera: se dice, no se calcula.
 *
 * ## La banda
 *
 * La sd de la Tabla 4 es ENTRE sujetos. Se siembra un Monte Carlo con parámetros normales (media y sd
 * de la tabla, ganancias truncadas a > 0), semilla fija, y se da el percentil 5 a 95; como en
 * `bandas.ts`, el valor central se incluye en la banda. Es la dispersión de la población ensayada
 * (jóvenes sanos), no la de una persona.
 */

/** Ganancia en 1/rad y desfase en grados, media y sd. `bd` solo en los bi-articulares. */
export interface ParametrosDeUnMusculo {
  bp: number
  bd?: number
  a: number
}

export type MusculoDeSilder = 'RF' | 'HAM' | 'GAS' | 'HF' | 'HE' | 'KF' | 'KE' | 'PF'
export const MUSCULOS_DE_SILDER: readonly MusculoDeSilder[] = ['RF', 'HAM', 'GAS', 'HF', 'HE', 'KF', 'KE', 'PF']

/** Tabla 4, media de 20 sujetos. `bp` = ganancia proximal (o la única), `bd` = distal, `a` = desfase α en grados. */
export const SILDER_MEDIA: Readonly<Record<MusculoDeSilder, ParametrosDeUnMusculo>> = {
  RF: { bp: 3.1, bd: 1.9, a: 24.4 },
  HAM: { bp: 5.1, bd: 3.9, a: 30.8 },
  GAS: { bp: 4.5, bd: 4.7, a: 26.0 },
  HF: { bp: 5.1, a: 19.5 },
  HE: { bp: 2.0, a: 27.3 },
  KF: { bp: 5.8, a: 12.8 },
  KE: { bp: 3.5, a: 101.9 },
  PF: { bp: 4.9, a: -3.4 },
}

/** Tabla 4, desviación estándar entre los 20 sujetos. */
export const SILDER_SD: Readonly<Record<MusculoDeSilder, ParametrosDeUnMusculo>> = {
  RF: { bp: 1.4, bd: 0.7, a: 9.0 },
  HAM: { bp: 2.0, bd: 2.5, a: 14.9 },
  GAS: { bp: 1.6, bd: 3.4, a: 28.9 },
  HF: { bp: 0.9, a: 10.0 },
  HE: { bp: 0.9, a: 18.0 },
  KF: { bp: 4.2, a: 13.1 },
  KE: { bp: 1.7, a: 11.9 },
  PF: { bp: 1.5, a: 5.0 },
}

/** Tabla 2: rangos de los ensayos, en grados (flexión de cadera y rodilla, dorsiflexión de tobillo). */
export const DOMINIO_DE_SILDER = {
  caderaMin: -15,
  caderaHastaConRodillaFlexionada: 85,
  caderaMax: 100,
  rodillaMin: 0,
  rodillaMax: 135,
  /** Con la cadera entre 85° y 100° solo se ensayó la rodilla hasta aquí (ensayo 15). */
  rodillaConCaderaProfunda: 25,
  tobilloMin: -20,
  tobilloMax: 20,
} as const

export type ParametrosDeSilder = Readonly<Record<MusculoDeSilder, ParametrosDeUnMusculo>>

/** Ángulos articulares en radianes, positivos en flexión de cadera y rodilla y en dorsiflexión. */
export interface AngulosArticulares {
  cadera: number
  rodilla: number
  tobillo: number
}

const rad = (g: number) => (g * Math.PI) / 180
const gradosDe = (r: number) => (r * 180) / Math.PI

/**
 * De la pose de `dinamica.ts` (ángulos de cada segmento respecto de la vertical, del extremo distal al
 * proximal) a los ángulos de las articulaciones. De pie todo vale 0.
 *   cadera  = tronco − muslo   (el tronco se inclina hacia delante, el muslo apunta atrás y arriba)
 *   rodilla = tibia − muslo
 *   tobillo = tibia            (pie plano: la tibia inclinada hacia delante es dorsiflexión)
 */
export function angulosDeLaPose(p: Pick<PoseSagital, 'tibia' | 'muslo' | 'tronco'>): AngulosArticulares {
  return { cadera: p.tronco - p.muslo, rodilla: p.tibia - p.muslo, tobillo: p.tibia }
}

/** Los momentos en el signo del artículo (positivo = flexor / dorsiflexor), en N·m. */
export function momentosDeSilder(par: ParametrosDeSilder, a: AngulosArticulares): { cadera: number; rodilla: number; tobillo: number } {
  const { cadera: th, rodilla: tk, tobillo: ta } = a
  const al = (m: MusculoDeSilder) => rad(par[m].a)
  const bd = (m: MusculoDeSilder) => par[m].bd as number
  const bp = (m: MusculoDeSilder) => par[m].bp

  // Los dos bi-articulares de cadera y rodilla comparten el cociente distal/proximal.
  const kRF = bd('RF') / bp('RF')
  const kHAM = bd('HAM') / bp('HAM')
  const kGAS = bd('GAS') / bp('GAS') // βaGAS/βkGAS: GAS lleva la ganancia de rodilla como «proximal» y la de tobillo como «distal»

  const rf = Math.exp(-bp('RF') * (th - kRF * tk - al('RF')))
  const hf = Math.exp(-bp('HF') * (th - al('HF')))
  const ham = Math.exp(bp('HAM') * (th - kHAM * tk - al('HAM')))
  const he = Math.exp(bp('HE') * (th - al('HE')))
  const ke = Math.exp(bp('KE') * (tk - al('KE')))
  const kf = Math.exp(-bp('KF') * (tk - al('KF')))
  const gas = Math.exp(bp('GAS') * (tk - kGAS * ta - al('GAS')))
  const pf = Math.exp(bp('PF') * (ta - al('PF')))

  return {
    cadera: rf + hf - ham - he, // A.5
    rodilla: -kRF * rf - ke + kHAM * ham + kf + gas, // A.6
    tobillo: -kGAS * gas - pf, // A.7
  }
}

/** ¿Están los ángulos dentro de lo ensayado? Por término, ver la cabecera. */
export function dominioDeSilder(a: AngulosArticulares): { cadera: boolean; rodilla: boolean; tobillo: boolean } {
  const d = DOMINIO_DE_SILDER
  const h = gradosDe(a.cadera)
  const k = gradosDe(a.rodilla)
  const t = gradosDe(a.tobillo)
  const todoFinito = [h, k, t].every(Number.isFinite)
  const enRodilla = k >= d.rodillaMin && k <= d.rodillaMax
  const caderaRodilla =
    todoFinito &&
    ((h >= d.caderaMin && h <= d.caderaHastaConRodillaFlexionada && enRodilla) ||
      (h >= d.caderaHastaConRodillaFlexionada && h <= d.caderaMax && k >= d.rodillaMin && k <= d.rodillaConCaderaProfunda))
  const rodillaTobillo = todoFinito && enRodilla && t >= d.tobilloMin && t <= d.tobilloMax
  return { cadera: caderaRodilla, rodilla: caderaRodilla && rodillaTobillo, tobillo: rodillaTobillo }
}

const ARTICULACIONES = ['cadera', 'rodilla', 'tobillo'] as const
type Articulacion = (typeof ARTICULACIONES)[number]

/** Ids de las constantes de `PROCEDENCIAS.tsv` que entran en cada momento. */
export function fuentesDeSilder(articulacion: Articulacion): string[] {
  const usa: Record<Articulacion, MusculoDeSilder[]> = {
    cadera: ['RF', 'HF', 'HAM', 'HE'],
    rodilla: ['RF', 'KE', 'HAM', 'KF', 'GAS'],
    tobillo: ['GAS', 'PF'],
  }
  return usa[articulacion].flatMap((m) =>
    (['bp', 'bd', 'a'] as const).flatMap((c) =>
      SILDER_MEDIA[m][c] === undefined ? [] : [`silder07.${m}.${c}.media`, `silder07.${m}.${c}.sd`],
    ),
  )
}

const SUPUESTOS = [
  'Silder 2007 (J Biomech 40:2628), manuscrito PMC2020832: modelo exponencial pasivo, 20 adultos jóvenes sanos',
  'β por radián: DERIVADO por orden de magnitud (el artículo no dice la unidad); sin confirmar en el PDF de la editorial',
  'signo cambiado respecto del artículo: positivo = extensor de cadera y rodilla / flexor plantar',
  'plano sagital, sin histéresis; Silder mide UNA pierna y aquí se multiplica por 2 (piernas simétricas), para compararlo con el momento total de dinamica.ts',
  'ángulos articulares derivados de la pose: cadera = tronco − muslo, rodilla = tibia − muslo, tobillo = tibia (pie plano)',
]

export const MUESTRAS_DE_PASIVO = 1000
export const SEMILLA_DE_PASIVO = 20261021

/** Una realización de la población: cada parámetro normal(media, sd), ganancias truncadas a > 0. */
function muestraDeParametros(azar: () => number): ParametrosDeSilder {
  const sorteo = (media: number, sd: number, positivo: boolean) => {
    for (let i = 0; i < 50; i++) {
      const x = media + sd * normal(azar)
      if (!positivo || x > 0.05) return x
    }
    return media
  }
  const salida = {} as Record<MusculoDeSilder, ParametrosDeUnMusculo>
  for (const m of MUSCULOS_DE_SILDER) {
    const mu = SILDER_MEDIA[m]
    const sd = SILDER_SD[m]
    salida[m] = {
      bp: sorteo(mu.bp, sd.bp, true),
      ...(mu.bd === undefined ? {} : { bd: sorteo(mu.bd, sd.bd as number, true) }),
      a: sorteo(mu.a, sd.a, false),
    }
  }
  return salida
}

/**
 * Los tres momentos pasivos de una pose, con su banda, o `no_afirmable` con el motivo.
 * Positivo = lo que ponen las estructuras pasivas en el sentido de sostener la carga (extensor), TOTAL
 * de las dos piernas (el doble del modelo de una pierna), como los momentos de `dinamica.ts`.
 */
export function momentosPasivosDeLaPose(
  pose: Pick<PoseSagital, 'tibia' | 'muslo' | 'tronco'> | null | undefined,
  opciones: { muestras?: number; semilla?: number } = {},
): Record<Articulacion, Cifra> {
  const v = VERSION_DEL_MODELO
  const id = (a: Articulacion) => `sentadilla.pasivo.${a}`
  const todo = (motivo: string) =>
    Object.fromEntries(ARTICULACIONES.map((a) => [a, noAfirmable(id(a), 'N·m', motivo, v)])) as Record<Articulacion, Cifra>
  if (!pose || ![pose.tibia, pose.muslo, pose.tronco].every(Number.isFinite)) {
    return todo('falta la pose o algún ángulo no es un número')
  }
  const n = opciones.muestras ?? MUESTRAS_DE_PASIVO
  if (!Number.isInteger(n) || n < 1) throw new RangeError('muestras debe ser un entero >= 1')
  const semilla = opciones.semilla ?? SEMILLA_DE_PASIVO
  const ang = angulosDeLaPose(pose)
  const dom = dominioDeSilder(ang)
  const centro = momentosDeSilder(SILDER_MEDIA, ang)
  const azar = crearAzar(semilla)
  const muestras: Record<Articulacion, number[]> = { cadera: [], rodilla: [], tobillo: [] }
  if (dom.cadera || dom.rodilla || dom.tobillo) {
    for (let i = 0; i < n; i++) {
      const m = momentosDeSilder(muestraDeParametros(azar), ang)
      for (const a of ARTICULACIONES) if (Number.isFinite(m[a])) muestras[a].push(-2 * m[a])
    }
  }
  const salida = {} as Record<Articulacion, Cifra>
  for (const a of ARTICULACIONES) {
    if (!dom[a]) {
      salida[a] = noAfirmable(
        id(a),
        'N·m',
        `fuera del dominio ensayado por Silder 2007 (Tabla 2): cadera ${Math.round(gradosDe(ang.cadera))}°, rodilla ${Math.round(gradosDe(ang.rodilla))}°, tobillo ${Math.round(gradosDe(ang.tobillo))}°; el modelo extrapolaría exponenciales`,
        v,
      )
      continue
    }
    const valor = -2 * centro[a]
    const orden = [...muestras[a]].sort((x, y) => x - y)
    if (!Number.isFinite(valor) || orden.length < n * 0.9) {
      salida[a] = noAfirmable(id(a), 'N·m', 'el muestreo de parámetros no dio suficientes realizaciones finitas', v)
      continue
    }
    salida[a] = {
      id: id(a),
      valor,
      unidad: 'N·m',
      estado: 'estimado',
      fuente: fuentesDeSilder(a),
      supuestos: [...SUPUESTOS, `Monte Carlo de ${n} muestras, semilla ${semilla}: parámetros normales con la media y la sd de la Tabla 4`],
      banda: {
        inf: Math.min(percentil(orden, 0.05), valor),
        sup: Math.max(percentil(orden, 0.95), valor),
        nivel: 'percentil 5 a 95 de la población ensayada (jóvenes sanos), no de una persona',
      },
      version: v,
    }
  }
  return salida
}
