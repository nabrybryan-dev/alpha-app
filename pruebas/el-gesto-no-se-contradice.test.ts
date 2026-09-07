import { describe, expect, it } from 'vitest'
import { PATRONES, PATRON_POR_ID, type Patron } from '../src/domain/patrones/catalogo'
import { esqueletoEnFase } from '../src/domain/patrones/escena'
import { puntoDeHueso, type EsqueletoResuelto } from '../src/domain/patrones/esqueleto'
import type { Vec3 } from '../src/domain/patrones/algebra'

/**
 * LO QUE HACE QUE UN GESTO SE VEA FALSO, partido en cosas que se miden.
 *
 * Bryan lo dijo así el 2026-09-06: «las diferentes elevaciones laterales o, de pronto,
 * aperturas... como conjugan muchos planos, las está haciendo de una forma poco asertiva y
 * poco natural». «Poco natural» no se puede comprobar, pero lo que lo produce sí, y al
 * medirlo salieron dos familias distintas:
 *
 * ## 1. El cuerpo atravesándose
 *
 * Es lo primero que ve el ojo y no hace falta saber de biomecánica para verlo. La rotación
 * externa de manguito ponía las dos manos **a 4,7 cm** una de otra: con 58° de rotación
 * interna y los dos codos pegados al costado, los antebrazos se cruzaban por delante de la
 * barriga y las manos se montaban. Y no era rango perdido: con el codo al costado, lo que
 * frena la rotación interna es el abdomen, no la cápsula.
 *
 * ## 2. La ficha animando el error que ella misma desaconseja
 *
 * Ésta es la que Bryan nombró, y es peor que la primera porque enseña algo. Cada ficha lleva
 * escrita una lista de `errores`, y varias los estaban animando:
 *
 * | patrón | su propio error | qué hacía |
 * | --- | --- | --- |
 * | elevación lateral | «Encoger el trapecio y subir el hombro entero con el brazo» | `escapulaElev` de 0 a 14 |
 * | apertura de pecho | «Doblar y estirar el codo, que lo convierte en un press» | `codoFlex` de 26 a 34 |
 * | apertura inversa | «Doblar el codo progresivamente y convertirlo en un remo» | `codoFlex` de 14 a 22 |
 *
 * El de la elevación lateral además tenía arreglo con contenido: lo que sí ocurre ahí es la
 * ROTACIÓN ASCENDENTE de la escápula —el omóplato gira para dejarle sitio al húmero— y es
 * otro canal. No se trataba de quitar el movimiento sino de ponerlo donde va.
 *
 * ## Por qué esto es un guardián y no una revisión
 *
 * Porque la contradicción no se ve leyendo la ficha: el texto está en un campo y los grados
 * en otro, a diez líneas de distancia, y los dos parecen correctos por separado. Se ve al
 * cruzarlos, y cruzarlos a mano en 38 fichas es exactamente lo que nadie vuelve a hacer.
 */

const FASES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

/** Distancia de un punto al eje del tronco: el segmento de la pelvis a la base del cuello. */
function alEjeDelTronco(esq: EsqueletoResuelto, p: Vec3): number {
  const a = puntoDeHueso(esq, 'pelvis', 0)
  const b = puntoDeHueso(esq, 'torax', 1)
  const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const largo2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / largo2))
  return Math.hypot(p[0] - (a[0] + ab[0] * t), p[1] - (a[1] + ab[1] * t), p[2] - (a[2] + ab[2] * t))
}

function loMasCerca(patron: Patron): { manos: number; alTronco: number } {
  let manos = Infinity
  let alTronco = Infinity
  for (const f of FASES) {
    const esq = esqueletoEnFase(patron, f)
    const d = puntoDeHueso(esq, 'manoD', 0.5)
    const i = puntoDeHueso(esq, 'manoI', 0.5)
    manos = Math.min(manos, Math.hypot(d[0] - i[0], d[1] - i[1], d[2] - i[2]))
    alTronco = Math.min(alTronco, alEjeDelTronco(esq, d), alEjeDelTronco(esq, i))
  }
  return { manos, alTronco }
}

describe('el cuerpo no se atraviesa a sí mismo', () => {
  /** Dos manos a menos de un palmo están la una dentro de la otra. */
  const MANOS = 0.08
  /**
   * Y una mano a menos de 13 cm del EJE del tronco está dentro del tronco: un pecho adulto
   * mide unos 32 cm de ancho, así que del eje al costado hay 16.
   */
  const TRONCO = 0.13

  it.each(PATRONES.map((p) => [p.id, p] as const))('%s', (_id, patron) => {
    const { manos, alTronco } = loMasCerca(patron)
    expect(manos, `${patron.id}: las manos se juntan a ${(manos * 100).toFixed(1)} cm`).toBeGreaterThan(
      MANOS,
    )
    expect(
      alTronco,
      `${patron.id}: una mano entra a ${(alTronco * 100).toFixed(1)} cm del eje del tronco`,
    ).toBeGreaterThan(TRONCO)
  })
})

/**
 * Los errores que las fichas escriben, y el canal en el que se verían si ocurrieran.
 *
 * Ninguna línea es una regla de estilo inventada aquí: cada `texto` es una frase que ya está
 * escrita en el campo `errores` de alguna ficha del catálogo, y el canal es dónde caería ese
 * gesto en el rig. `crece` distingue los errores que son direccionales —encoger el trapecio
 * es SUBIRLO— de los que son cualquier movimiento: en una apertura el codo no debe doblarse
 * ni estirarse, así que lo que se vigila es el valor absoluto.
 */
const ERRORES_QUE_LA_FICHA_DECLARA: readonly {
  texto: RegExp
  canal: string
  crece: boolean
  tope: number
}[] = [
  { texto: /encoger el trapecio|subir el hombro entero/i, canal: 'escapulaElev', crece: true, tope: 6 },
  // Seis grados, no diez: el codo de una apertura es una bisagra bloqueada, y lo que se
  // tolera es el ruido de una pose escrita a mano, no un cambio de ángulo. Con el tope en 10
  // los dos casos reales del catálogo —26→34 y 14→22— pasaban por dos grados.
  { texto: /doblar y estirar el codo|doblar el codo progresivamente/i, canal: 'codoFlex', crece: false, tope: 6 },
  { texto: /arquear la espalda|redondear la zona lumbar/i, canal: 'lumbarFlex', crece: false, tope: 12 },
  { texto: /impulsar con las piernas/i, canal: 'rodillaFlex', crece: false, tope: 12 },
]

describe('ninguna ficha anima el error que ella misma desaconseja', () => {
  const casos = PATRONES.flatMap((p) =>
    ERRORES_QUE_LA_FICHA_DECLARA.flatMap((e) => {
      const frase = p.errores.find((x) => e.texto.test(x))
      return frase ? [{ patron: p, error: e, frase }] : []
    }),
  )

  it('hay fichas que se declaran errores en canales que el rig sabe mirar', () => {
    // Si el cruce se quedara en cero —porque alguien reescribiera los textos, o cambiara un
    // nombre de canal— este archivo pasaría entero sin comprobar nada.
    expect(casos.length).toBeGreaterThanOrEqual(4)
  })

  it.each(casos.map((c) => [`${c.patron.id} · ${c.error.canal}`, c] as const))('%s', (_id, c) => {
    const desde = c.patron.inicio[c.error.canal] ?? 0
    const hasta = c.patron.fin[c.error.canal] ?? 0
    const cambio = c.error.crece ? hasta - desde : Math.abs(hasta - desde)
    expect(
      cambio,
      `${c.patron.id}: ${c.error.canal} va de ${desde}° a ${hasta}°, y su ficha dice «${c.frase}»`,
    ).toBeLessThanOrEqual(c.error.tope)
  })
})

describe('y lo que la elevación lateral sí hace, lo hace donde toca', () => {
  it('el omóplato ROTA en vez de encogerse', () => {
    // No era quitar el movimiento: era ponerlo en su canal. En una elevación lateral el
    // omóplato gira hacia arriba para dejarle sitio al húmero —eso es la ritmo escápulo-
    // humeral— y lo que la ficha desaconseja es encogerlo hacia la oreja. Son dos canales.
    const p = PATRON_POR_ID.abduccion_hombro
    expect(p.fin.escapulaRotAsc ?? 0).toBeGreaterThan(8)
    expect(p.fin.escapulaElev ?? 0).toBe(0)
  })

  it('sube hasta la altura del hombro, ni un dedo más, como dice su propia clave', () => {
    expect(PATRON_POR_ID.abduccion_hombro.fin.hombroAbd).toBeLessThanOrEqual(90)
  })

  it('y ocurre en UN plano: no se entra al plano escapular a mitad de camino', () => {
    // «Codo ligeramente por delante del cuerpo» es una posición de partida, no un destino.
    // Con `hombroFlex` yendo de 0 a 14 el brazo cambiaba de plano mientras subía, que es
    // exactamente lo que Bryan describió como «conjugan muchos planos».
    const p = PATRON_POR_ID.abduccion_hombro
    expect(Math.abs((p.fin.hombroFlex ?? 0) - (p.inicio.hombroFlex ?? 0))).toBeLessThanOrEqual(4)
    expect(p.inicio.hombroFlex ?? 0).toBeGreaterThan(10)
  })
})
