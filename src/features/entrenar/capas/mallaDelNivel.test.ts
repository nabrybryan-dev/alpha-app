import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from '../../../domain/patrones/catalogo'
import { esqueletoEnFase } from '../../../domain/patrones/escena'
import { resolver } from '../../../domain/patrones/esqueleto'
import { construirHuesos } from '../../../domain/patrones/huesos'
import type { Malla } from '../../../domain/patrones/malla'
import {
  PORCIONES,
  activacionDe,
  construirMusculos,
  longitudesEnReposo,
} from '../../../domain/patrones/musculos'
import type { NivelW } from '../salon/huecos'
import { NIVEL_POR_W } from './nivelesAnatomicos'
import {
  clavesDeNivel,
  construirMusculosDeNivel,
  construirMusculosFiltrado,
  huesosParcialesDeNivel,
  mallasDelSujeto,
  porcionesDeNivel,
} from './mallaDelNivel'

/**
 * EL EJE W, PERO EN LA MALLA: que atravesar el cuerpo cambie el cuerpo.
 *
 * `capas.test.ts` comprueba la DECLARACIÓN —los cinco niveles, el reparto, que ningún
 * identificador esté inventado—. Este archivo comprueba lo siguiente, que es donde el
 * eje se había quedado a medias: que esa declaración llega a ser geometría distinta.
 *
 * La diferencia importa porque el fallo que se está cerrando aquí pasaba con la
 * declaración entera en verde: los cinco niveles existían, la `w` cambiaba de número,
 * la escalera se movía, el velo se cerraba… y el modelo dibujaba siempre lo mismo. Un
 * test que solo mire que la `w` cambia de valor volvería a pasar el día que alguien
 * desconecte esto. Por eso lo que se compara aquí son los BÚFERES que se le suben al
 * motor —vértices, índices, posiciones y colores—, no las listas que los describen.
 *
 * Lo que sigue sin poderse comprobar en jsdom: que en la pantalla se VEA la diferencia.
 * No hay WebGL, así que nada de esto llega a pintarse. Lo medido es lo que ENTRA en
 * `Motor.subir()`, que es hasta donde alcanza un test; el píxel lo firma un ojo.
 */

const PATRON = PATRON_POR_ID.sentadilla
const NIVELES: NivelW[] = [0, 1, 2, 3, 4]

/** Las longitudes de referencia, calculadas como las calcula el visor. */
const REPOSO = longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0]))

/** El rig, que es geometría fija y la misma en los tres niveles que encienden hueso. */
const HUESOS = construirHuesos()

/**
 * Un resumen de 32 bits de un búfer de la malla.
 *
 * Comparar catorce mil vértices con `toEqual` en cada una de las diez parejas de
 * niveles costaría más que todo el resto del archivo junto. Lo que hace falta aquí no
 * es saber QUÉ vértice cambió sino si algo cambió, así que se compara un resumen. Los
 * números se cuantizan a la décima de milímetro antes de entrar: por debajo de eso no
 * hay diferencia que un ojo pueda ver, y sin cuantizar el último bit de un `float`
 * haría distintos dos búferes iguales.
 */
function resumen(buf: Float32Array | Uint32Array): number {
  let h = 0x811c9dc5
  for (let i = 0; i < buf.length; i += 1) {
    const v = Math.round(buf[i] * 10000)
    h ^= v & 0xffffffff
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** La huella de una malla: cuánta geometría es y cuál es. */
function huella(m: Malla): string {
  return [
    `v=${m.vertices}`,
    `i=${m.indice.length}`,
    `pos=${resumen(m.posicion)}`,
    `col=${resumen(m.color)}`,
  ].join(' ')
}

/**
 * LO QUE SE LE SUBE AL MOTOR en un nivel, construido como lo construye el visor.
 *
 * Recorre `mallasDelSujeto()` —la misma función pura que lee `VisorPatron`— y levanta
 * cada pieza con el constructor que le toca. Si el visor y esto se separaran, el
 * guardián de más abajo («la lista declarada es la que se construye») se pone rojo.
 */
function escenaDelNivel(w: NivelW, fase: number): { huella: string; vertices: number } {
  const esq = esqueletoEnFase(PATRON, fase)
  const piezas: string[] = []
  let vertices = 0
  for (const m of mallasDelSujeto(w, PATRON)) {
    const malla = m.pieza === 'huesos' ? HUESOS : construirMusculosDeNivel(w, esq, PATRON, REPOSO)
    piezas.push(`${m.pieza}:${huella(malla)}`)
    vertices += malla.vertices
  }
  return { huella: piezas.join(' | '), vertices }
}

/** Cuántas componentes difieren entre dos búferes del mismo tamaño. */
function componentesDistintas(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Math.max(a.length, b.length)
  let n = 0
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) n += 1
  return n
}

describe('atravesar el cuerpo cambia el cuerpo', () => {
  it('los cinco niveles suben al motor cinco escenas DISTINTAS', () => {
    // El corazón del encargo. No se compara la `w` ni la lista de nombres: se comparan
    // los búferes que acaban en `Motor.subir()`. Dos niveles con la misma huella son
    // dos niveles que se ven igual, y eso es el eje decorativo otra vez.
    const huellas = new Map<NivelW, string>()
    for (const w of NIVELES) huellas.set(w, escenaDelNivel(w, 0.35).huella)
    for (const a of NIVELES) {
      for (const b of NIVELES) {
        if (a >= b) continue
        expect(
          huellas.get(a),
          `el nivel ${a} (${NIVEL_POR_W[a].nombre}) y el ${b} (${NIVEL_POR_W[b].nombre}) suben la MISMA escena`,
        ).not.toBe(huellas.get(b))
      }
    }
    expect(new Set(huellas.values()).size).toBe(5)
  })

  it('la piel y el músculo superficial: los mismos músculos, y lo que cambia es el trabajo', () => {
    // Es la pareja que un resumen global podría estar separando por casualidad, así que
    // se mira componente a componente. Los dos niveles llevan los mismos veinte
    // músculos: misma topología —mismo número de vértices y los mismos índices— y lo
    // único que los separa es el acabado.
    const esq = esqueletoEnFase(PATRON, 0.35)
    const piel = construirMusculosDeNivel(0, esq, PATRON, REPOSO)
    const superficial = construirMusculosDeNivel(1, esq, PATRON, REPOSO)
    expect([...clavesDeNivel(0)]).toEqual([...clavesDeNivel(1)])
    expect(superficial.vertices).toBe(piel.vertices)
    let indicesDistintos = 0
    for (let i = 0; i < piel.indice.length; i += 1) {
      if (piel.indice[i] !== superficial.indice[i]) indicesDistintos += 1
    }
    expect(indicesDistintos).toBe(0)
    expect(componentesDistintas(piel.color, superficial.color)).toBeGreaterThan(0)
  })

  it('entre la piel y el músculo lo que se mueve es el vientre, no la pose', () => {
    // MEDIDO, y conviene tenerlo escrito: entre el nivel 0 y el 1 no cambia solo el
    // color, también la GEOMETRÍA —10 309 componentes de posición en la sentadilla—.
    // No es un fallo del filtro: `radioDePorcion()` multiplica el radio por el tono
    // (`0,86 + a·0,3`), así que el que trabaja se dibuja más grueso. La prueba de que es
    // eso y no un cambio de pose: una porción que este patrón NO activa sale idéntica en
    // las dos capas, y una que sí activa cambia.
    const esq = esqueletoEnFase(PATRON, 0.35)
    const deNivel = PORCIONES.filter((p) => clavesDeNivel(1).has(p.clave))
    const trabajo = (p: (typeof PORCIONES)[number]) =>
      Math.max(
        activacionDe(PATRON.activacion, p.musculo.id, p.porcion.id, 'D'),
        activacionDe(PATRON.activacion, p.musculo.id, p.porcion.id, 'I'),
      )
    const quieta = deNivel.find((p) => trabajo(p) === 0)
    const activa = deNivel.find((p) => trabajo(p) > 0)
    expect(quieta, 'la sentadilla activa las veinte: no hay porción quieta que comparar').toBeDefined()
    expect(activa, 'la sentadilla no activa ninguna porción superficial').toBeDefined()
    const sola = (clave: string, conTrabajo: boolean) =>
      construirMusculosFiltrado(
        esq,
        conTrabajo ? PATRON.activacion : {},
        REPOSO,
        new Set([clave]),
      )
    // La que no trabaja: misma malla en la piel y en el músculo superficial. Aquí es
    // donde se vería un cambio de pose si lo hubiera.
    expect(
      componentesDistintas(sola(quieta!.clave, false).posicion, sola(quieta!.clave, true).posicion),
    ).toBe(0)
    // La que trabaja: engorda.
    expect(
      componentesDistintas(sola(activa!.clave, false).posicion, sola(activa!.clave, true).posicion),
    ).toBeGreaterThan(0)
  })

  it('ningún nivel dibuja el cuerpo entero: el filtro recorta de verdad', () => {
    // Sin esto, «cinco escenas distintas» se podría cumplir solo con el color y las
    // setenta porciones seguirían dibujándose en las cinco capas.
    const esq = esqueletoEnFase(PATRON, 0.35)
    const cuerpoEntero = construirMusculos(esq, PATRON.activacion, REPOSO)
    for (const w of NIVELES) {
      if (!NIVEL_POR_W[w].piezas.includes('musculos')) continue
      const nivel = construirMusculosDeNivel(w, esq, PATRON, REPOSO)
      expect(nivel.vertices, `el nivel ${w} dibuja las setenta porciones`).toBeLessThan(
        cuerpoEntero.vertices,
      )
      expect(nivel.vertices, `el nivel ${w} no dibuja nada`).toBeGreaterThan(0)
    }
  })

  it('el hueso es el fondo del eje: sin una sola porción de músculo', () => {
    const escena = escenaDelNivel(4, 0.35)
    expect(mallasDelSujeto(4, PATRON).map((m) => m.pieza)).toEqual(['huesos'])
    expect(escena.vertices).toBe(HUESOS.vertices)
    expect(porcionesDeNivel(4)).toEqual([])
  })

  it('la lista que se declara es exactamente la geometría que se construye', () => {
    // La trampa que este test cierra: que `mallasDelSujeto()` diga una cosa —la lista
    // que se puede auditar sin pintar— y `construirMusculosDeNivel()` construya otra.
    // Se comprueba contando: la malla del nivel tiene que salir idéntica a la que da
    // filtrar por las claves que la lista declara.
    const esq = esqueletoEnFase(PATRON, 0.6)
    for (const w of NIVELES) {
      const declarada = mallasDelSujeto(w, PATRON).find((m) => m.pieza === 'musculos')
      if (!declarada) continue
      const porClaves = construirMusculosFiltrado(
        esq,
        declarada.activacion,
        REPOSO,
        new Set(declarada.porciones),
      )
      const construida = construirMusculosDeNivel(w, esq, PATRON, REPOSO)
      expect(huella(construida), `el nivel ${w} construye algo distinto de lo que declara`).toBe(
        huella(porClaves),
      )
      expect([...clavesDeNivel(w)].sort()).toEqual([...declarada.porciones].sort())
    }
  })

  it('los niveles con músculo reparten porciones del catálogo, sin inventarse ninguna', () => {
    const todas = new Set(PORCIONES.map((p) => p.clave))
    for (const w of NIVELES) {
      for (const clave of clavesDeNivel(w)) {
        expect(todas.has(clave), `la porción ${clave} del nivel ${w} no existe`).toBe(true)
      }
    }
    // Y el primer plano y el segundo no se solapan: son dos escenas, no una con encima.
    const superficial = clavesDeNivel(1)
    const profundo = clavesDeNivel(2)
    expect([...superficial].filter((c) => profundo.has(c))).toEqual([])
    expect(superficial.size + profundo.size).toBe(PORCIONES.length)
  })

  it('ningún nivel pide medio esqueleto, que es lo que no se sabría dibujar', () => {
    // `construirHuesos()` levanta los veintiún huesos de una pieza y no admite
    // subconjuntos. Mientras esto salga vacío, no hay nada declarado que no se pinte.
    const delRig = [...new Set(HUESOS.hueso)].length
    expect(delRig).toBeGreaterThan(1)
    for (const w of NIVELES) {
      expect(huesosParcialesDeNivel(w, NIVEL_POR_W[4].huesos)).toEqual([])
    }
  })
})

describe('el sujeto sigue ejecutando su gesto en las cinco capas', () => {
  it('en cada capa el cuerpo se mueve: dos fases del gesto dan dos mallas', () => {
    // El encargo dice «en cada una el sujeto sigue ejecutando su gesto». Si al recortar
    // una capa se congelara la pose, esto se vería aquí: la excéntrica y la concéntrica
    // darían la misma geometría.
    for (const w of NIVELES) {
      if (!NIVEL_POR_W[w].piezas.includes('musculos')) continue
      const bajando = escenaDelNivel(w, 0.15).huella
      const subiendo = escenaDelNivel(w, 0.65).huella
      expect(bajando, `el nivel ${w} dibuja lo mismo en dos fases distintas`).not.toBe(subiendo)
    }
  })

  it('en el hueso el gesto lo llevan las matrices, y también cambia con la fase', () => {
    // El rig es geometría fija: al hueso lo mueve el shader con la matriz de su hueso,
    // no un vértice nuevo. Así que aquí el gesto se comprueba donde está —en las
    // matrices— y en que la malla lleve el índice de hueso que las usa.
    const bajando = esqueletoEnFase(PATRON, 0.15).matrices
    const subiendo = esqueletoEnFase(PATRON, 0.65).matrices
    // Componente a componente y no matriz a matriz: `matrices` es un array de veintidós
    // matrices, cada una un objeto nuevo en cada llamada, así que compararlas con `!==`
    // sale siempre distinto y el test pasaría con las dos fases iguales. Medido: así
    // escrito, este test se ponía verde comparando 0,15 consigo misma.
    expect(bajando).toHaveLength(subiendo.length)
    let distintas = 0
    for (let i = 0; i < bajando.length; i += 1) {
      for (let k = 0; k < bajando[i].length; k += 1) {
        if (bajando[i][k] !== subiendo[i][k]) distintas += 1
      }
    }
    expect(distintas, 'el rig no se mueve entre la bajada y la subida').toBeGreaterThan(0)
    // Y la malla del hueso reparte sus vértices entre varios huesos: con un solo índice
    // el rig entero se movería en bloque y no habría gesto que ver.
    expect(new Set(HUESOS.hueso).size).toBeGreaterThan(1)
  })

  it('la capa decide QUÉ se ve, no QUÉ se hace: la topología no cambia con la fase', () => {
    // El cuerpo se mueve dentro de la capa, pero la capa no pierde ni gana estructuras
    // por el camino: en el fondo de la sentadilla se ven las mismas porciones que arriba.
    // Un recuento que cambiara con la fase sería un músculo que aparece a mitad de la
    // repetición, y el asesorado lo leería como un fallo del modelo.
    for (const w of NIVELES) {
      if (!NIVEL_POR_W[w].piezas.includes('musculos')) continue
      const cuentas = [0, 0.25, 0.5, 0.75].map(
        (f) => construirMusculosDeNivel(w, esqueletoEnFase(PATRON, f), PATRON, REPOSO).vertices,
      )
      expect(new Set(cuentas).size, `el nivel ${w} cambia de porciones a mitad del gesto`).toBe(1)
      expect(cuentas[0]).toBeGreaterThan(0)
    }
    // Y el mismo nivel con el mismo esqueleto da la misma malla dos veces: el eje no
    // arrastra estado de una llamada a la siguiente.
    const esq = esqueletoEnFase(PATRON, 0.4)
    expect(huella(construirMusculosDeNivel(2, esq, PATRON, REPOSO))).toBe(
      huella(construirMusculosDeNivel(2, esq, PATRON, REPOSO)),
    )
  })

  it('cambiar de capa no cambia de patrón: cada uno colorea el suyo', () => {
    // El nivel se resuelve contra el patrón que se le pase. Dos patrones distintos en la
    // misma capa tienen que dar colores distintos, o el modelo estaría enseñando el
    // trabajo de otro ejercicio.
    const esq = esqueletoEnFase(PATRON_POR_ID.sentadilla, 0.35)
    const sentadilla = construirMusculosDeNivel(1, esq, PATRON_POR_ID.sentadilla, REPOSO)
    const codo = construirMusculosDeNivel(1, esq, PATRON_POR_ID.flexion_codo, REPOSO)
    expect(codo.vertices).toBe(sentadilla.vertices)
    expect(componentesDistintas(sentadilla.color, codo.color)).toBeGreaterThan(0)
  })
})

/**
 * EL GUARDIÁN DE LA COPIA, que lo dejó pedido la capa motor.
 *
 * `dibujarPorcion()` repite el cuerpo del bucle de `construirMusculos()` —ensanche por
 * volumen constante, tono, resolución del tubo, ángulo de fibra— y `fibraDe()` está
 * copiada porque `musculos.ts` no la exporta. Esa copia se puede separar en silencio: se
 * afina el músculo en el dominio, el visor con `w` sigue llamando a la copia vieja y
 * nadie se entera hasta que dos capas del mismo cuerpo se ven distintas.
 *
 * Sin filtro, las dos rutas tienen que dar la MISMA malla. Es la única forma de que la
 * copia no se pueda separar sin que algo se ponga rojo.
 */
describe('el filtro no es un segundo modelo del cuerpo', () => {
  it('sin filtro, la malla filtrada es idéntica a la de `construirMusculos()`', () => {
    const esq = esqueletoEnFase(PATRON, 0.35)
    const original = construirMusculos(esq, PATRON.activacion, REPOSO)
    const sinFiltrar = construirMusculosFiltrado(esq, PATRON.activacion, REPOSO, null)
    expect(sinFiltrar.vertices).toBe(original.vertices)
    expect(sinFiltrar.indice.length).toBe(original.indice.length)
    // Los cinco búferes, componente a componente. Un `toEqual` sobre cuarenta mil floats
    // tarda y dice poco; lo que hace falta saber es cuántas componentes se han separado.
    expect(componentesDistintas(sinFiltrar.posicion, original.posicion)).toBe(0)
    expect(componentesDistintas(sinFiltrar.normal, original.normal)).toBe(0)
    expect(componentesDistintas(sinFiltrar.color, original.color)).toBe(0)
    expect(componentesDistintas(sinFiltrar.hueso, original.hueso)).toBe(0)
    expect(componentesDistintas(sinFiltrar.fibra, original.fibra)).toBe(0)
    let indicesDistintos = 0
    for (let i = 0; i < original.indice.length; i += 1) {
      if (original.indice[i] !== sinFiltrar.indice[i]) indicesDistintos += 1
    }
    expect(indicesDistintos).toBe(0)
  })

  it('y la comprobación no es vacía: el cuerpo entero son las setenta porciones', () => {
    // Si `construirMusculos()` devolviera una malla vacía, el test de arriba pasaría sin
    // decir nada. Aquí se fija que hay cuerpo que comparar.
    const esq = esqueletoEnFase(PATRON, 0.35)
    const original = construirMusculos(esq, PATRON.activacion, REPOSO)
    expect(original.vertices).toBeGreaterThan(10000)
    expect(PORCIONES.length).toBeGreaterThan(60)
  })

  it('el filtro se reparte el cuerpo sin perder ni repetir vértices', () => {
    // Superficial y profundo son una partición del catálogo, así que sus dos mallas
    // tienen que sumar exactamente el cuerpo entero. Un vértice de más sería una porción
    // dibujada dos veces; uno de menos, una porción que desaparece del salón.
    const esq = esqueletoEnFase(PATRON, 0.35)
    const entero = construirMusculosFiltrado(esq, PATRON.activacion, REPOSO, null)
    const superficial = construirMusculosFiltrado(esq, PATRON.activacion, REPOSO, clavesDeNivel(1))
    const profundo = construirMusculosFiltrado(esq, PATRON.activacion, REPOSO, clavesDeNivel(2))
    expect(superficial.vertices + profundo.vertices).toBe(entero.vertices)
  })
})
