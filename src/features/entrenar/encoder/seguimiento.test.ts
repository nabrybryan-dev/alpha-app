import { describe, expect, it } from 'vitest'
import { rgbAHsv } from './nucleo/analisis'
import {
  esPareja,
  nubeEnRecuadro,
  nuevoSeguimiento,
  recuadroDe,
  umbralesDelColor,
  type AjustesSeguimiento,
} from './seguimiento'

/* Estos casos documentan tres formas de medir mal que NO fallaban: devolvían un
 * número con su calidad y su %PV, y el número estaba mal. Los tres se
 * reprodujeron primero en `scripts/banco-encoder.mjs`, que corre la cadena
 * entera con `node` a secas; aquí quedan clavados los que caben en un test
 * unitario, para que el CI los defienda.
 *
 * `scripts/banco-encoder.mjs` es el otro lado de esto: la batería de 56 casos
 * que valida el núcleo vive en `herramientas/encoder-camara`, otro repo, y no
 * siempre está a mano. Ver `nucleo/ORIGEN.md`. */

const MAGENTA: [number, number, number] = [220, 30, 190]
const PALIDO: [number, number, number] = [225, 175, 215]

const AJUSTES: AjustesSeguimiento = {
  referencia: 'marcadores',
  dianaMm: [300, 200],
  tolTono: 22,
}

function lienzo(ancho: number, alto: number, fondo: [number, number, number]) {
  const datos = new Uint8ClampedArray(ancho * alto * 4)
  for (let i = 0; i < datos.length; i += 4) {
    datos[i] = fondo[0]
    datos[i + 1] = fondo[1]
    datos[i + 2] = fondo[2]
    datos[i + 3] = 255
  }
  return datos
}

function pintar(
  datos: Uint8ClampedArray,
  ancho: number,
  cx: number,
  cy: number,
  radio: number,
  color: [number, number, number],
) {
  for (let y = Math.floor(cy - radio); y <= Math.ceil(cy + radio); y++) {
    for (let x = Math.floor(cx - radio); x <= Math.ceil(cx + radio); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radio * radio) continue
      const i = (y * ancho + x) * 4
      datos[i] = color[0]
      datos[i + 1] = color[1]
      datos[i + 2] = color[2]
    }
  }
}

/** Una barra con sus dos marcas a la altura `y`, y opcionalmente un intruso del
 *  mismo color parado en una esquina. */
function escena({
  y,
  intruso = false,
  color = MAGENTA,
  fondo = [40, 42, 46] as [number, number, number],
}: {
  y: number
  intruso?: boolean
  color?: [number, number, number]
  fondo?: [number, number, number]
}) {
  const ancho = 640
  const alto = 360
  const datos = lienzo(ancho, alto, fondo)
  pintar(datos, ancho, 200, y, 7, color)
  pintar(datos, ancho, 440, y, 7, color)
  if (intruso) pintar(datos, ancho, 560, 70, 24, color)
  return { datos, ancho, alto }
}

describe('umbralesDelColor', () => {
  it('no afloja nada con un color saturado', () => {
    const { minSat, minVal } = umbralesDelColor(rgbAHsv(...MAGENTA))
    expect(minSat).toBe(0.35)
    expect(minVal).toBe(0.25)
  })

  it('baja el minimo cuando la marca es palida, que es cuando se perdia entera', () => {
    const color = rgbAHsv(...PALIDO)
    const { minSat } = umbralesDelColor(color)
    // La marca tiene un 22 % de saturacion: con el minimo fijo de 0,35 no casa
    // NUNCA, ni un pixel, y en pantalla eso se lee como que la camara va mal.
    expect(color.s).toBeLessThan(0.35)
    expect(minSat).toBeLessThan(color.s)
  })

  it('nunca baja de un suelo, o casaria con el fondo gris', () => {
    const { minSat, minVal } = umbralesDelColor({ h: 200, s: 0.001, v: 0.001 })
    expect(minSat).toBeGreaterThanOrEqual(0.08)
    expect(minVal).toBeGreaterThanOrEqual(0.08)
  })
})

describe('recuadroDe', () => {
  it('envuelve los puntos con margen y se queda dentro de la imagen', () => {
    const r = recuadroDe([{ x: 10, y: 10 }, { x: 30, y: 40 }], 20, 640, 360)!
    expect(r).toEqual({ x0: 0, y0: 0, x1: 50, y1: 60 })
  })

  it('sin puntos no hay recuadro, en vez de un recuadro de todo', () => {
    expect(recuadroDe([], 20, 640, 360)).toBeUndefined()
  })

  it('un punto sin coordenadas no arrastra el recuadro al infinito', () => {
    const r = recuadroDe([{ x: 100, y: 100 }, { x: NaN, y: 5 }], 10, 640, 360)!
    expect(r).toEqual({ x0: 90, y0: 90, x1: 110, y1: 110 })
  })
})

describe('nubeEnRecuadro', () => {
  it('devuelve coordenadas de la IMAGEN, no del recuadro', () => {
    const { datos, ancho, alto } = escena({ y: 180 })
    const nube = nubeEnRecuadro(datos, ancho, alto, rgbAHsv(...MAGENTA), {
      x0: 170,
      y0: 150,
      x1: 230,
      y1: 210,
    })
    expect(nube.n).toBeGreaterThan(100)
    // Si alguien olvidara deshacer el desplazamiento, estas x saldrian cerca de
    // 30 en vez de cerca de 200, y el centroide caeria en la esquina.
    const xs = Array.from(nube.xs)
    const media = xs.reduce((a, b) => a + b, 0) / nube.n
    expect(media).toBeGreaterThan(195)
    expect(media).toBeLessThan(205)
  })

  it('no ve lo que esta fuera del recuadro', () => {
    const { datos, ancho, alto } = escena({ y: 180, intruso: true })
    const nube = nubeEnRecuadro(datos, ancho, alto, rgbAHsv(...MAGENTA), {
      x0: 170,
      y0: 150,
      x1: 230,
      y1: 210,
    })
    expect(Math.max(...Array.from(nube.xs))).toBeLessThan(240)
  })
})

describe('fijar la referencia', () => {
  it('avisa en el acto de que ahi no hay nada de ese color', () => {
    const { datos, ancho, alto } = escena({ y: 180 })
    const seg = nuevoSeguimiento()
    // Se toca el fondo, no la marca. Antes esto devolvia «listo para grabar» y
    // el fallo aparecia DESPUES de la serie, con el asesorado ya sentado.
    const v = seg.fijarColor(datos, ancho, alto, 40, 300, AJUSTES)
    expect(v.ok).toBe(false)
  })

  it('un color que ocupa el encuadre entero se rechaza como fondo', () => {
    // Una pared del color de la marca. Es el contrapeso de `umbralesDelColor`:
    // al bajar los minimos para que una marca palida se vea, un fondo poco
    // saturado empieza a casar consigo mismo, `separarMarcadores` parte la nube
    // en dos mitades y devuelve una pareja impecable — que es suelo y pared.
    const ancho = 640
    const alto = 360
    const datos = lienzo(ancho, alto, MAGENTA)
    const seg = nuevoSeguimiento()
    const v = seg.fijarColor(datos, ancho, alto, 320, 180, AJUSTES)
    expect(v.ok).toBe(false)
    expect(v.esFondo).toBe(true)
    expect(seg.fijado).toBe(false)
  })

  it('con la marca tocada, ve las dos y da la separacion', () => {
    const { datos, ancho, alto } = escena({ y: 180 })
    const seg = nuevoSeguimiento()
    const v = seg.fijarColor(datos, ancho, alto, 200, 180, AJUSTES)
    expect(v.ok).toBe(true)
    expect(esPareja(v.det)).toBe(true)
    if (esPareja(v.det)) expect(v.det.sepPx).toBeCloseTo(240, 0)
  })

  it('un intruso del mismo color no se cuela como si fuera la otra marca', () => {
    const { datos, ancho, alto } = escena({ y: 180, intruso: true })
    const seg = nuevoSeguimiento()
    const v = seg.fijarColor(datos, ancho, alto, 200, 180, AJUSTES)
    expect(v.ok).toBe(true)
    // Con el fotograma entero, `separarMarcadores` emparejaba la marca de la
    // izquierda con el intruso de la esquina y devolvia una pareja perfecta:
    // su separacion, su angulo y su punto medio. Ese punto medio se mueve la
    // MITAD de lo que se mueve la barra, asi que la velocidad salia a dos
    // tercios de la verdadera sin que nada avisara.
    expect(esPareja(v.det)).toBe(true)
    if (esPareja(v.det)) {
      expect(v.det.a.x).toBeCloseTo(200, 0)
      expect(v.det.b.x).toBeCloseTo(440, 0)
    }
  })

  it('el marcador palido sobre fondo claro se fija, que antes no se veia', () => {
    const { datos, ancho, alto } = escena({ y: 180, color: PALIDO, fondo: [230, 230, 232] })
    const seg = nuevoSeguimiento()
    const v = seg.fijarColor(datos, ancho, alto, 200, 180, AJUSTES)
    expect(v.ok).toBe(true)
    expect(v.nPix).toBeGreaterThan(100)
  })
})

describe('seguir la referencia fotograma a fotograma', () => {
  it('la ventana sigue a la barra y deja fuera al intruso', () => {
    const seg = nuevoSeguimiento()
    const primera = escena({ y: 300, intruso: true })
    seg.fijarColor(primera.datos, primera.ancho, primera.alto, 200, 300, AJUSTES)

    const vistos: number[] = []
    for (let k = 1; k <= 20; k++) {
      const y = 300 - k * 8 // ocho pixeles por fotograma
      const f = escena({ y, intruso: true })
      const paso = seg.paso(f.datos, f.ancho, f.alto, AJUSTES)
      expect(paso.ventana).toBeDefined()
      // La ventana no puede llegar al intruso, que esta en (560, 70).
      expect(paso.ventana!.y0).toBeGreaterThan(90)
      if (esPareja(paso.det)) vistos.push(paso.det.y)
    }
    expect(vistos).toHaveLength(20)
    expect(vistos[0]).toBeCloseTo(292, 0)
    expect(vistos[19]).toBeCloseTo(140, 0)
  })

  it('si la referencia desaparece unos fotogramas, vuelve a mirar la imagen entera', () => {
    const seg = nuevoSeguimiento()
    const primera = escena({ y: 300 })
    seg.fijarColor(primera.datos, primera.ancho, primera.alto, 200, 300, AJUSTES)

    const vacia = { datos: lienzo(640, 360, [40, 42, 46]), ancho: 640, alto: 360 }
    let ultimo = seg.paso(vacia.datos, vacia.ancho, vacia.alto, AJUSTES)
    for (let k = 0; k < 6; k++) {
      ultimo = seg.paso(vacia.datos, vacia.ancho, vacia.alto, AJUSTES)
    }
    expect(ultimo.det).toBeUndefined()
    expect(ultimo.perdidos).toBeGreaterThanOrEqual(5)
    // Y sin ventana: mirar solo donde estaba es justamente lo que impide
    // recuperar una referencia que se movio mientras no se la veia.
    expect(ultimo.ventana).toBeUndefined()

    // Reaparece en otro sitio y se la vuelve a coger.
    const lejos = escena({ y: 120 })
    const reenganche = seg.paso(lejos.datos, lejos.ancho, lejos.alto, AJUSTES)
    expect(esPareja(reenganche.det)).toBe(true)
    if (esPareja(reenganche.det)) expect(reenganche.det.y).toBeCloseTo(120, 0)
  })

  it('si una marca se tapa unos fotogramas, la pareja se recupera', () => {
    const seg = nuevoSeguimiento()
    const primera = escena({ y: 300 })
    seg.fijarColor(primera.datos, primera.ancho, primera.alto, 200, 300, AJUSTES)

    // Tres fotogramas con una sola marca: la mano del que ayuda cruzando por
    // delante. `unSoloMarcador` devuelve un punto, y si la ventana se encogiera
    // alrededor de ese punto la otra marca ya no cabria dentro NUNCA MAS: la
    // serie entera seguiria midiendo con un solo marcador, sin escala, en
    // pixeles por segundo, y sin un mal aviso — un solo marcador es una
    // deteccion legitima.
    for (let k = 1; k <= 3; k++) {
      const y = 300 - k * 8
      const ancho = 640
      const alto = 360
      const datos = lienzo(ancho, alto, [40, 42, 46])
      pintar(datos, ancho, 200, y, 7, MAGENTA) // solo la de la izquierda
      seg.paso(datos, ancho, alto, AJUSTES)
    }

    const vuelve = escena({ y: 300 - 4 * 8 })
    const paso = seg.paso(vuelve.datos, vuelve.ancho, vuelve.alto, AJUSTES)
    expect(esPareja(paso.det)).toBe(true)
    if (esPareja(paso.det)) expect(paso.det.sepPx).toBeCloseTo(240, 0)
  })

  it('con una marca tapada NO se empareja la que queda con un intruso', () => {
    const seg = nuevoSeguimiento()
    const primera = escena({ y: 300, intruso: true })
    seg.fijarColor(primera.datos, primera.ancho, primera.alto, 200, 300, AJUSTES)

    // Aqui muerde de verdad. Al ver una sola marca dentro de la ventana hay que
    // reintentar el fotograma entero —la otra pudo salirse de la ventana— y ese
    // reintento es la puerta trasera del intruso: encuentra una pareja hecha de
    // la marca visible y el logo de la pared, y como es una PAREJA y no un
    // marcador suelto, gana a lo que traia la ventana. La separacion la delata:
    // una barra no se estira 300 px entre dos fotogramas.
    for (let k = 1; k <= 3; k++) {
      const y = 300 - k * 8
      const ancho = 640
      const alto = 360
      const datos = lienzo(ancho, alto, [40, 42, 46])
      pintar(datos, ancho, 200, y, 7, MAGENTA)
      pintar(datos, ancho, 560, 70, 24, MAGENTA) // el intruso sigue ahi
      const paso = seg.paso(datos, ancho, alto, AJUSTES)
      if (esPareja(paso.det)) {
        // Si sale una pareja, tiene que ser la de la barra, no la inventada.
        expect(paso.det.sepPx).toBeCloseTo(240, 0)
      } else if (paso.det) {
        expect(paso.det.x).toBeCloseTo(200, 0)
      }
    }

    const vuelve = escena({ y: 300 - 4 * 8, intruso: true })
    const paso = seg.paso(vuelve.datos, vuelve.ancho, vuelve.alto, AJUSTES)
    expect(esPareja(paso.det)).toBe(true)
    if (esPareja(paso.det)) expect(paso.det.sepPx).toBeCloseTo(240, 0)
  })

  it('reiniciar deja el seguimiento sin referencia', () => {
    const seg = nuevoSeguimiento()
    const f = escena({ y: 200 })
    seg.fijarColor(f.datos, f.ancho, f.alto, 200, 200, AJUSTES)
    expect(seg.fijado).toBe(true)
    seg.reiniciar()
    expect(seg.fijado).toBe(false)
    expect(seg.color).toBeNull()
  })
})
