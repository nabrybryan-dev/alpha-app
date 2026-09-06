import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from './catalogo'
import { encuadrar, esqueletoEnFase, trazaDelPatron } from './escena'
import { ESQUELETO, INDICE_HUESO, puntoDeHueso, resolver, type DefinicionHueso } from './esqueleto'
import { construirHuesos } from './huesos'
import { esqueletoDe, JUEGOS, SEXOS } from './juegoDeHuesos'
import type { Malla } from './malla'
import { construirMusculos, longitudesEnReposo } from './musculos'

/**
 * CÓMO SE MIDE EL SUJETO: de pie, con la raíz en el suelo, leyendo dónde cae cada
 * articulación con `puntoDeHueso()`. Es la misma regla con la que se midió contra los
 * dos atlas el 2026-09-05. NO se mide la malla de `construirHuesos()`: dibuja en el
 * espacio local de cada hueso y ya engañó una vez —dijo que el sujeto medía 0,555—.
 */
function alturas(huesos?: readonly DefinicionHueso[]) {
  const esq = resolver({}, [0, 0, 0], [0, 0, 0], huesos)
  const y = (h: string, t: number) => puntoDeHueso(esq, h, t)[1]
  return {
    tobillo: y('tibiaD', 1),
    rodilla: y('musloD', 1),
    cadera: y('musloD', 0),
    hombro: y('brazoD', 0),
    codo: y('brazoD', 1),
    muneca: y('antebrazoD', 1),
    coronilla: y('craneo', 1),
    medioHombro: -puntoDeHueso(esq, 'brazoD', 0)[0],
  }
}
type Articulacion = keyof ReturnType<typeof alturas>

/**
 * Las alturas de referencia, en metros. Las del varón salen de BodyParts3D 4.0; las de
 * la mujer, del Human Reference Atlas v1.5, que no trae brazo. Están copiadas de la
 * tabla del encargo, no derivadas del código: si el código se equivoca, esto lo dice.
 */
const REFERENCIA: Record<'hombre' | 'mujer', Partial<Record<Articulacion, number>>> = {
  hombre: {
    tobillo: 0.072,
    rodilla: 0.449,
    cadera: 0.912,
    hombro: 1.415,
    codo: 1.11,
    muneca: 0.884,
    coronilla: 1.714,
    medioHombro: 0.19,
  },
  mujer: { tobillo: 0.074, rodilla: 0.415, cadera: 0.833, coronilla: 1.666 },
}

/** Un centímetro: es lo que pide el encargo, y menos de lo que separa a los dos atlas. */
const TOLERANCIA = 0.01

const huella = (numeros: ArrayLike<number>): string =>
  createHash('sha256').update(new Uint8Array(new Float64Array(numeros).buffer)).digest('hex')
const huellaDeMatrices = (m: number[][]): string => huella(m.flat())

/**
 * LO DE ANTES, byte a byte. Calculado sobre `9df953f` (2026-09-06), el último commit
 * ANTERIOR a que el esqueleto aceptara un juego de huesos, con este mismo procedimiento.
 * Si alguna vez cambia a propósito —otro rig, otro tempo—, se recalcula y se escribe
 * aquí con su fecha; lo que no puede pasar es que cambie sin que nadie lo note.
 */
const DE_ANTES = {
  poseVaciaEnElSuelo: '3fe4c00bf3b4db61d5c415bead8ad07142c66b30a601960efaf1b58aae173456',
  poseVaciaA095: 'd3c44c58b213f117e1c256816f510c167dc7b95dcafb58c30b96ac1772e31775',
  sentadillaAMedias: '6b60ab14f3b72513b4f7aaaf57c5a2daeb17a42e01a888ef43974cd099e6c332',
  bancaAUnCuarto: 'a606b86e3f70b8b2d4d5ebd932d8b3a13535eb367dafe360317bf2d82e6ce446',
  mallaPosiciones: '937e6ef37abad1c9f8d7984cf97f950ceea8b5d011bc53065a4e3a6aa42dc735',
  mallaNormales: '49a584d7433163348e5aa09f6f3b980bb6c85b31041ad4100514cded0192cebc',
  vertices: 13774,
}

/** Cuánto ocupa la geometría de un hueso en un eje de su espacio local. */
function extension(m: Malla, nombre: string, eje: 0 | 1 | 2): number {
  const h = INDICE_HUESO[nombre]
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < m.vertices; i++) {
    if (m.hueso[i] !== h) continue
    const v = m.posicion[i * 3 + eje]
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  return max - min
}

describe('el juego neutro', () => {
  it('es el esqueleto de hoy, el mismo objeto, y es el que sale sin pedir nada', () => {
    expect(esqueletoDe('neutro')).toBe(ESQUELETO)
    expect(esqueletoDe()).toBe(ESQUELETO)
  })

  it('mide lo que el sujeto medía cuando se le comparó con los atlas', () => {
    // Es la columna «sujeto actual» de la tabla del encargo, al milímetro.
    const a = alturas()
    expect(a.tobillo).toBeCloseTo(0.076, 3)
    expect(a.rodilla).toBeCloseTo(0.505, 3)
    expect(a.cadera).toBeCloseTo(0.955, 3)
    expect(a.hombro).toBeCloseTo(1.412, 3)
    expect(a.codo).toBeCloseTo(1.104, 3)
    expect(a.muneca).toBeCloseTo(0.846, 3)
    expect(a.coronilla).toBeCloseTo(1.69, 3)
    expect(a.medioHombro).toBeCloseTo(0.168, 3)
  })
})

describe('los juegos con medida', () => {
  it('pone la rodilla del hombre a 0,449 y la de la mujer a 0,415', () => {
    // Son las dos cifras que separan un sujeto medido de uno inventado: la rodilla del
    // neutro está a 0,505, cinco centímetros y medio por encima del varón real.
    expect(Math.abs(alturas(esqueletoDe('hombre')).rodilla - 0.449)).toBeLessThan(TOLERANCIA)
    expect(Math.abs(alturas(esqueletoDe('mujer')).rodilla - 0.415)).toBeLessThan(TOLERANCIA)
  })

  for (const sexo of ['hombre', 'mujer'] as const) {
    it(`reproduce la tabla de referencia del juego «${sexo}» a menos de un centímetro`, () => {
      const medido = alturas(esqueletoDe(sexo))
      for (const [articulacion, esperado] of Object.entries(REFERENCIA[sexo])) {
        const valor = medido[articulacion as Articulacion]
        expect(
          Math.abs(valor - esperado),
          `${sexo}: ${articulacion} medido ${valor.toFixed(4)}, referencia ${esperado}`,
        ).toBeLessThan(TOLERANCIA)
      }
    })
  }

  it('saca cada largo de la resta de dos alturas del atlas', () => {
    const h = JUEGOS.hombre
    expect(h.femur).toBeCloseTo(0.912 - 0.449, 6)
    expect(h.tibia).toBeCloseTo(0.449 - 0.072, 6)
    expect(h.humero).toBeCloseTo(1.415 - 1.11, 6)
    expect(h.antebrazo).toBeCloseTo(1.11 - 0.884, 6)
    const m = JUEGOS.mujer
    expect(m.femur).toBeCloseTo(0.833 - 0.415, 6)
    expect(m.tibia).toBeCloseTo(0.415 - 0.074, 6)
  })

  it('deja escrito el brazo femenino como supuesto: el del varón a su estatura', () => {
    // El atlas femenino no trae húmero ni radio. Si algún día lo trae, este test cambia
    // con el número y el supuesto desaparece del código.
    const escala = JUEGOS.mujer.coronilla / JUEGOS.hombre.coronilla
    expect(JUEGOS.mujer.humero).toBeCloseTo(JUEGOS.hombre.humero * escala, 9)
    expect(JUEGOS.mujer.antebrazo).toBeCloseTo(JUEGOS.hombre.antebrazo * escala, 9)
    expect(JUEGOS.mujer.medioHombro).toBeCloseTo(JUEGOS.hombre.medioHombro * escala, 9)
    expect(JUEGOS.mujer.fuente).toMatch(/supuesto/i)
  })

  it('cita la fuente de cada medida', () => {
    expect(JUEGOS.hombre.fuente).toMatch(/BodyParts3D/)
    expect(JUEGOS.mujer.fuente).toMatch(/Human Reference Atlas/)
    for (const s of SEXOS) expect(JUEGOS[s].sexo).toBe(s)
  })

  it('conserva el rig: los mismos huesos, en el mismo orden, con los mismos padres', () => {
    // `INDICE_HUESO` y las 24 matrices del shader dependen de esto: un juego que
    // añadiera o reordenara un hueso dibujaría cada pieza con la matriz de otra.
    for (const s of SEXOS) {
      const e = esqueletoDe(s)
      expect(e.map((h) => h.nombre)).toEqual(ESQUELETO.map((h) => h.nombre))
      expect(e.map((h) => h.padre)).toEqual(ESQUELETO.map((h) => h.padre))
      expect(e.map((h) => h.reposo)).toEqual(ESQUELETO.map((h) => h.reposo))
    }
  })

  it('devuelve siempre el mismo objeto para el mismo sexo', () => {
    // El visor cachea la malla y las longitudes en reposo por juego: si cada llamada
    // devolviera una copia, la caché no serviría de nada.
    for (const s of SEXOS) expect(esqueletoDe(s)).toBe(esqueletoDe(s))
  })

  it('lleva la clavícula hasta el hombro en todos los juegos', () => {
    // Si los hombros se ensanchan y la clavícula no crece, se queda corta dos
    // centímetros y el hombro flota separado del tórax.
    for (const s of SEXOS) {
      const esq = resolver({}, [0, 0, 0], [0, 0, 0], esqueletoDe(s))
      const clavicula = puntoDeHueso(esq, 'claviculaD', 1)
      const hombro = puntoDeHueso(esq, 'brazoD', 0)
      expect(Math.abs(clavicula[0] - hombro[0]), `${s}: la clavícula no llega`).toBeLessThan(0.005)
    }
  })
})

describe('sin juego, o con el neutro, nada cambia', () => {
  it('la pose vacía da las matrices de antes, byte a byte', () => {
    expect(huellaDeMatrices(resolver({}, [0, 0, 0], [0, 0, 0]).matrices)).toBe(DE_ANTES.poseVaciaEnElSuelo)
    expect(huellaDeMatrices(resolver({}, [0, 0, 0], [0, 0, 0], esqueletoDe('neutro')).matrices)).toBe(
      DE_ANTES.poseVaciaEnElSuelo,
    )
    expect(huellaDeMatrices(resolver({}, [0, 0.95, 0], [0, 0, 0]).matrices)).toBe(DE_ANTES.poseVaciaA095)
  })

  it('dos patrones dan las matrices de antes, con parámetro y sin él', () => {
    const sentadilla = esqueletoEnFase(PATRON_POR_ID.sentadilla, 0.5)
    expect(huellaDeMatrices([...sentadilla.matrices, sentadilla.raiz])).toBe(DE_ANTES.sentadillaAMedias)
    const sentadillaNeutra = esqueletoEnFase(PATRON_POR_ID.sentadilla, 0.5, 1, 0, undefined, esqueletoDe('neutro'))
    expect(sentadillaNeutra.matrices).toStrictEqual(sentadilla.matrices)
    expect(sentadillaNeutra.raiz).toStrictEqual(sentadilla.raiz)

    const banca = esqueletoEnFase(PATRON_POR_ID.empuje_horizontal, 0.25)
    expect(huellaDeMatrices([...banca.matrices, banca.raiz])).toBe(DE_ANTES.bancaAUnCuarto)
    const bancaNeutra = esqueletoEnFase(PATRON_POR_ID.empuje_horizontal, 0.25, 1, 0, undefined, ESQUELETO)
    expect(bancaNeutra.matrices).toStrictEqual(banca.matrices)
  })

  it('la malla ósea es la de antes, vértice a vértice', () => {
    for (const malla of [construirHuesos(), construirHuesos(esqueletoDe('neutro'))]) {
      expect(malla.vertices).toBe(DE_ANTES.vertices)
      expect(huella(malla.posicion)).toBe(DE_ANTES.mallaPosiciones)
      expect(huella(malla.normal)).toBe(DE_ANTES.mallaNormales)
    }
  })

  it('el encuadre y la traza tampoco cambian', () => {
    const p = PATRON_POR_ID.sentadilla
    expect(encuadrar(p, esqueletoDe('neutro'))).toStrictEqual(encuadrar(p))
    expect(trazaDelPatron(p, ESQUELETO)).toStrictEqual(trazaDelPatron(p))
  })

  it('y el guardián no está vacío: con el hombre las matrices SÍ cambian', () => {
    // Un test de identidad que pasara también con otro juego no estaría midiendo nada.
    const hombre = esqueletoEnFase(PATRON_POR_ID.sentadilla, 0.5, 1, 0, undefined, esqueletoDe('hombre'))
    expect(huellaDeMatrices([...hombre.matrices, hombre.raiz])).not.toBe(DE_ANTES.sentadillaAMedias)
    expect(huella(construirHuesos(esqueletoDe('hombre')).posicion)).not.toBe(DE_ANTES.mallaPosiciones)
  })
})

describe('los músculos siguen anclándose', () => {
  it('con los tres juegos: largos en reposo positivos, sin NaN, y una malla finita', () => {
    for (const s of SEXOS) {
      const huesos = esqueletoDe(s)
      const reposo = longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0], huesos))
      expect(Object.keys(reposo).length).toBeGreaterThan(100)
      for (const [clave, largo] of Object.entries(reposo)) {
        expect(Number.isFinite(largo), `${s}: ${clave} no es un número`).toBe(true)
        expect(largo, `${s}: ${clave} sin largo`).toBeGreaterThan(0)
      }
      // Y en una pose de verdad, a media sentadilla, la carne sale entera.
      const p = PATRON_POR_ID.sentadilla
      const malla = construirMusculos(esqueletoEnFase(p, 0.5, 1, 0, undefined, huesos), p.activacion, reposo)
      expect(malla.vertices, s).toBeGreaterThan(1000)
      expect(malla.posicion.every(Number.isFinite), `${s}: hay NaN en la musculatura`).toBe(true)
    }
  })

  it('un músculo que cruza la pierna se alarga o se acorta con ella', () => {
    // Los anclajes van en fracción del hueso, así que tienen que seguirlo. El recto
    // femoral cuelga de la pelvis a la tibia: sigue al fémur (0,45 → 0,463 → 0,418).
    // El gemelo va del fémur al calcáneo: sigue a la tibia (0,43 → 0,377 → 0,341).
    const reposoDe = (s: (typeof SEXOS)[number]) =>
      longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0], esqueletoDe(s)))
    const neutro = reposoDe('neutro')
    const hombre = reposoDe('hombre')
    const mujer = reposoDe('mujer')
    expect(hombre['cuadriceps.rectoD0']).toBeGreaterThan(neutro['cuadriceps.rectoD0'])
    expect(mujer['cuadriceps.rectoD0']).toBeLessThan(neutro['cuadriceps.rectoD0'])
    expect(hombre['triceps_sural.gastro_medialD0']).toBeLessThan(neutro['triceps_sural.gastro_medialD0'])
    expect(mujer['triceps_sural.gastro_medialD0']).toBeLessThan(hombre['triceps_sural.gastro_medialD0'])
  })
})

describe('la geometría ósea sigue al juego', () => {
  const neutro = construirHuesos()
  const hombre = construirHuesos(esqueletoDe('hombre'))

  it('estira cada hueso largo justo en la razón de su largo, y no toca su grosor', () => {
    const j = JUEGOS.hombre
    const n = JUEGOS.neutro
    for (const [nombre, razon] of [
      ['tibiaD', j.tibia / n.tibia],
      ['musloI', j.femur / n.femur],
      ['brazoD', j.humero / n.humero],
      ['antebrazoI', j.antebrazo / n.antebrazo],
    ] as const) {
      expect(extension(hombre, nombre, 1) / extension(neutro, nombre, 1), nombre).toBeCloseTo(razon, 4)
      expect(extension(hombre, nombre, 0), `${nombre} cambia de ancho`).toBe(extension(neutro, nombre, 0))
      expect(extension(hombre, nombre, 2), `${nombre} cambia de fondo`).toBe(extension(neutro, nombre, 2))
    }
  })

  it('deja quieto lo que no tiene medida: la mano y el pie', () => {
    for (const nombre of ['manoD', 'pieI']) {
      expect(extension(hombre, nombre, 1), nombre).toBe(extension(neutro, nombre, 1))
    }
  })

  it('conserva la topología y deja las normales unitarias', () => {
    expect(hombre.vertices).toBe(neutro.vertices)
    expect(hombre.indice).toStrictEqual(neutro.indice)
    expect(hombre.hueso).toStrictEqual(neutro.hueso)
    for (let i = 0; i < hombre.vertices; i++) {
      const l = Math.hypot(hombre.normal[i * 3], hombre.normal[i * 3 + 1], hombre.normal[i * 3 + 2])
      expect(Math.abs(l - 1), `normal ${i}`).toBeLessThan(1e-5)
    }
  })
})
