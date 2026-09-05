import { describe, expect, it } from 'vitest'
import type { BrazoDeMomento } from '../biomecanica/brazosDeMomento'
import { mallasDeFuerzas, visibilidadDelPlano } from './fuerzas'
import { V, type Vec3 } from './algebra'

/** El fémur del sujeto del catálogo: 45 cm. El radio del arco sale de aquí, no de una tabla. */
const FEMUR = 0.45

const brazo = (
  metros: number,
  protagonismo: BrazoDeMomento['protagonismo'] = 'principal',
  largo = FEMUR,
): BrazoDeMomento => ({
  articulacion: 'cadera',
  protagonismo,
  eje: [0, 0.6, 0],
  pie: [0, 0.6, metros],
  metros,
  largo,
})

/** El plano del arco de este brazo es el X=0: de frente se mira desde el eje X. */
const DE_FRENTE: Vec3 = [5, 0.6, 0]
/** Y de canto, desde donde el aro se ve como un palito: el mismo eje Z del brazo. */
const DE_CANTO: Vec3 = [0, 0.6, 5]

const alturaMaxima = (posicion: Float32Array): number => {
  let y = -Infinity
  for (let i = 1; i < posicion.length; i += 3) if (posicion[i] > y) y = posicion[i]
  return y
}

describe('mallasDeFuerzas', () => {
  it('sin brazos, dos mallas vacías: nada que subir', () => {
    const [p, s] = mallasDeFuerzas([])
    expect(p.vertices).toBe(0)
    expect(s.vertices).toBe(0)
  })

  it('el principal va opaco y el secundario translúcido, cada uno en su malla', () => {
    const [p, s] = mallasDeFuerzas([brazo(0.15), brazo(0.08, 'secundario')])
    expect(p.vertices).toBeGreaterThan(0)
    expect(s.vertices).toBeGreaterThan(0)
    expect(p.alfa).toBe(1)
    expect(s.alfa).toBeLessThan(1)
  })

  it('las dos mallas van encima del cuerpo: se leen aunque la carne las tape', () => {
    const [p, s] = mallasDeFuerzas([brazo(0.15), brazo(0.08, 'secundario')])
    expect(p.encima).toBe(true)
    expect(s.encima).toBe(true)
  })

  it('el arco de la cadera sale del volumen del glúteo: sube más de 12 cm sobre el eje', () => {
    const [p] = mallasDeFuerzas([brazo(0.25)])
    expect(alturaMaxima(p.posicion)).toBeGreaterThan(0.6 + 0.12)
  })

  it('el arco barre más con un brazo más largo: sube más alto sobre el eje', () => {
    const [corto] = mallasDeFuerzas([brazo(0.03)])
    const [largo] = mallasDeFuerzas([brazo(0.2)])
    expect(alturaMaxima(largo.posicion)).toBeGreaterThan(alturaMaxima(corto.posicion) + 0.02)
  })

  it('el barrido tiene tope: 25 cm y 60 cm suben igual', () => {
    const [a] = mallasDeFuerzas([brazo(0.25)])
    const [b] = mallasDeFuerzas([brazo(0.6)])
    expect(alturaMaxima(a.posicion)).toBeCloseTo(alturaMaxima(b.posicion), 3)
  })

  it('la vertical de la carga baja hasta el suelo', () => {
    const [p] = mallasDeFuerzas([brazo(0.1)])
    let yMin = Infinity
    for (let i = 1; i < p.posicion.length; i += 3) if (p.posicion[i] < yMin) yMin = p.posicion[i]
    expect(yMin).toBeLessThan(0.02)
  })


  /**
   * EL ARCO NO SE CIERRA EN RUEDA. Con el tope en 150 grados el aro pasaba tanto por
   * detrás del eje que dejaba de leerse como un giro y se leía como un objeto suelto en
   * la escena. Se mide por donde duele: cuánto se mete el arco DETRAS del eje, en la
   * direccion contraria a la carga. A 110 grados son 5 cm de un radio de 14; a 150, 13.
   */
  it('el arco no se cierra en rueda: no se mete mas de 7 cm detras del eje', () => {
    const [p] = mallasDeFuerzas([brazo(0.6)])
    let zMin = Infinity
    for (let i = 2; i < p.posicion.length; i += 3) if (p.posicion[i] < zMin) zMin = p.posicion[i]
    expect(zMin).toBeGreaterThan(-0.07)
  })

  /**
   * EL RADIO SALE DEL HUESO, no de una tabla de centímetros. Es lo que hace que el arco
   * encoja y crezca con la persona en pantalla: con centímetros fijos, al doblarse el
   * sujeto pasaba de 655 px de alto a 409 y el arco seguía igual.
   */
  it('con un hueso más corto el arco es más pequeño, con el mismo par', () => {
    const [grande] = mallasDeFuerzas([brazo(0.2, 'principal', 0.45)])
    const [chico] = mallasDeFuerzas([brazo(0.2, 'principal', 0.17)])
    // El mismo barrido: lo único que cambia es el radio, y con él lo que sube el arco.
    expect(alturaMaxima(grande.posicion) - 0.6).toBeGreaterThan((alturaMaxima(chico.posicion) - 0.6) * 2)
  })

  /**
   * EL ARCO ES DEL EJE PRINCIPAL. El tobillo de la sentadilla llegó a 20 cm de brazo y su
   * aro salía tumbado sobre la línea del suelo, al lado de los pies: parecía una rueda
   * apoyada en el salón. Los secundarios se quedan con la varilla y la marca del eje.
   */
  it('un eje secundario no lleva arco: se queda en la varilla y la marca', () => {
    const [, secundaria] = mallasDeFuerzas([brazo(0.25, 'secundario')])
    expect(secundaria.vertices).toBeGreaterThan(0)
    // La marca del eje son 11 mm; el arco subiría 14 cm.
    expect(alturaMaxima(secundaria.posicion)).toBeLessThan(0.6 + 0.02)
  })

  /**
   * DE CANTO SE RETIRA. El arco vive en el plano real del giro, así que hay cámaras desde
   * las que es un palito de 3 px: medido en el catálogo, elevaciones laterales 0-1 px y
   * press militar 1-15 px de ancho.
   */
  it('de frente dibuja el arco y de canto no', () => {
    const [deFrente] = mallasDeFuerzas([brazo(0.25)], DE_FRENTE)
    const [deCanto] = mallasDeFuerzas([brazo(0.25)], DE_CANTO)
    expect(alturaMaxima(deFrente.posicion)).toBeGreaterThan(0.6 + 0.12)
    // Lo más alto que queda de canto es el arranque de la vertical de la carga, 2 cm
    // sobre el eje; el arco subiría 14. El margen es para no medir contra el empate.
    expect(alturaMaxima(deCanto.posicion)).toBeLessThan(0.6 + 0.05)
    // Y lo que queda de canto no es nada: la varilla y la marca siguen ahí.
    expect(deCanto.vertices).toBeGreaterThan(0)
  })

  it('sin cámara se dibuja entero: la geometría pura no sabe de dónde se mira', () => {
    const [sinOjo] = mallasDeFuerzas([brazo(0.25)])
    const [deFrente] = mallasDeFuerzas([brazo(0.25)], DE_FRENTE)
    expect(alturaMaxima(sinOjo.posicion)).toBeCloseTo(alturaMaxima(deFrente.posicion), 6)
  })
})

describe('visibilidadDelPlano', () => {
  const normal: Vec3 = [1, 0, 0]

  it('de frente vale 1 y de canto vale 0', () => {
    expect(visibilidadDelPlano(normal, [1, 0, 0])).toBe(1)
    expect(visibilidadDelPlano(normal, [0, 0, 1])).toBe(0)
  })

  it('da igual por qué lado se mire el plano: es el mismo aro', () => {
    expect(visibilidadDelPlano(normal, [-1, 0, 0])).toBe(1)
  })

  /** La banda es lo que evita el salto: entre los dos topes el trazo se afina. */
  it('entre los dos topes sale a medias, y crece al ponerse de frente', () => {
    const casi = V.normalizar([0.55, 0, 0.835] as Vec3)
    const mas = V.normalizar([0.62, 0, 0.785] as Vec3)
    const a = visibilidadDelPlano(normal, casi)
    const b = visibilidadDelPlano(normal, mas)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(1)
    expect(b).toBeGreaterThan(a)
  })
})
