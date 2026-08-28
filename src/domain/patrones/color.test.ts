import { describe, expect, it } from 'vitest'
import { acabado, ACES, aLineal, aPantalla, GAMMA, GLSL_ACABADO, tonemap } from './color'

describe('el acabado de la imagen', () => {
  it('deja el negro en negro', () => {
    // Si el negro se levanta, el fondo del estudio deja de ser fondo y toda la
    // escena se vuelve gris.
    expect(acabado(0)).toBe(0)
  })

  it('no quema los claros: los comprime', () => {
    // La iluminación se calcula sin techo. Antes, un brillo por encima de 1 se
    // recortaba y la zona clara se quedaba plana y sin color.
    expect(tonemap(1.5)).toBeLessThan(1)
    expect(tonemap(4)).toBeLessThan(1)
    // Y sigue distinguiendo entre un claro y un claro más claro, que es
    // justamente lo que el recorte destruía.
    expect(tonemap(4)).toBeGreaterThan(tonemap(1.5) + 0.02)
  })

  it('sube los medios tonos, que es lo que se veía apagado', () => {
    // Sin codificar, un 0,5 lineal se muestra mucho más oscuro de lo que
    // debería: es lo que hacía que la imagen se viera lechosa y sin cuerpo.
    expect(aPantalla(0.5)).toBeGreaterThan(0.7)
    expect(aPantalla(0.25)).toBeGreaterThan(0.5)
  })

  it('nunca da marcha atrás', () => {
    // Más luz tiene que dar siempre más color: una curva que baje en algún
    // tramo invertiría el sombreado ahí.
    let previo = -1
    for (let i = 0; i <= 200; i++) {
      const v = acabado((i / 200) * 4)
      expect(v).toBeGreaterThanOrEqual(previo)
      previo = v
    }
  })

  it('se queda dentro del rango que se puede escribir', () => {
    for (const x of [0, 0.1, 0.5, 1, 2, 10, 1000]) {
      expect(acabado(x)).toBeGreaterThanOrEqual(0)
      expect(acabado(x)).toBeLessThanOrEqual(1)
    }
  })

  it('trata valores absurdos sin romperse', () => {
    // El color sale de un cálculo de iluminación; un negativo por redondeo no
    // puede pintar un agujero.
    expect(acabado(-1)).toBe(0)
    expect(Number.isFinite(acabado(1e9))).toBe(true)
  })

  it('deshace la codificación antes de iluminar', () => {
    // Los colores del hueso y del músculo se eligieron a ojo mirando la
    // pantalla, así que ya venían codificados. La primera vez que se aplicó el
    // acabado sin esto, la imagen salió LAVADA —los músculos en rosa pálido—
    // porque se corregía dos veces. Ida y vuelta tienen que devolver lo mismo.
    for (const x of [0, 0.1, 0.35, 0.69, 1]) {
      expect(aPantalla(aLineal(x))).toBeCloseTo(x, 6)
    }
    // Y un color de en medio pesa menos en lineal de lo que aparenta en pantalla.
    expect(aLineal(0.5)).toBeLessThan(0.25)
  })

  it('genera el GLSL con los mismos coeficientes que usa el test', () => {
    // Es la razón de que vivan en un solo sitio: si alguien ajusta la curva,
    // la tarjeta y esta prueba cambian a la vez en vez de divergir en silencio.
    for (const v of Object.values(ACES)) expect(GLSL_ACABADO).toContain(String(v))
    expect(GLSL_ACABADO).toContain((1 / GAMMA).toFixed(6))
    // Y tiene que ser GLSL válido de una función, no un fragmento suelto.
    expect(GLSL_ACABADO).toContain('vec3 acabado(vec3 x)')
    expect(GLSL_ACABADO).toContain('vec3 aLineal(vec3 x)')
    expect(GLSL_ACABADO).toContain(String(GAMMA))
  })
})
