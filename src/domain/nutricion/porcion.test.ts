import { describe, expect, it } from 'vitest'
import { escalar, nutrientesAusentes, type Composicion } from './porcion'

// Lo que se protege sobre todo es el trato de los nulos: en este proyecto un
// nulo significa "no se midió" y un cero significa "no contiene". Escalar un
// nulo a cero convierte un hueco de datos en una afirmación falsa.

const ARROZ: Composicion = {
  kcal: 130.0,
  proteina_g: 2.7,
  carbos_g: 28.0,
  grasa_g: 0.3,
  hierro_mg: 1.2,
  vitamina_d_ug: null,
}

describe('escalar', () => {
  it('cien gramos es la composición tal cual', () => {
    expect(escalar(ARROZ, 100).kcal).toBe(130.0)
  })

  it('la mitad es la mitad', () => {
    expect(escalar(ARROZ, 50).kcal).toBe(65.0)
  })

  it('el doble es el doble', () => {
    expect(escalar(ARROZ, 200).kcal).toBe(260.0)
  })

  it('una cantidad cualquiera (60 g de arroz cocido, el caso que planteó Bryan)', () => {
    expect(escalar(ARROZ, 60).kcal).toBeCloseTo(78.0, 1)
    expect(escalar(ARROZ, 60).proteina_g).toBeCloseTo(1.62, 2)
  })

  it('redondea a tres decimales', () => {
    // 2.7 * 0.01 = 0.027000000000000003 sin redondear. Si se quita el
    // redondeo de escalar(), este toBe (no toBeCloseTo) falla.
    expect(escalar(ARROZ, 1).proteina_g).toBe(0.027)
  })

  it('UN NULO SIGUE SIENDO NULO', () => {
    // La regla que atraviesa todo el proyecto. La TCAC no mide vitamina D;
    // escalarla a 0 afirmaría que el arroz no la aporta, y eso no lo dice
    // ninguna fuente.
    expect(escalar(ARROZ, 60).vitamina_d_ug).toBeNull()
  })

  it('un cero sigue siendo cero', () => {
    expect(escalar({ sodio_mg: 0.0 }, 60).sodio_mg).toBe(0.0)
  })

  it('cero gramos da cero, no nulo', () => {
    // Comer 0 g de algo sí es una afirmación: no aportó nada.
    expect(escalar(ARROZ, 0).kcal).toBe(0.0)
  })

  it('no inventa nutrientes que no estaban', () => {
    expect(Object.hasOwn(escalar(ARROZ, 60), 'zinc_mg')).toBe(false)
  })

  it('gramos negativos no se aceptan', () => {
    expect(() => escalar(ARROZ, -10)).toThrow()
  })

  it('gramos no finitos no se aceptan', () => {
    // NaN e Infinity pasan "gramos < 0" sin problema (la comparación da
    // false para los dos). NaN contagiaría cualquier total que lo sume, e
    // Infinity convertiría un dato medido (0.0) en infinito: justo lo que
    // este módulo existe para evitar.
    expect(() => escalar(ARROZ, NaN)).toThrow()
    expect(() => escalar(ARROZ, Infinity)).toThrow()
  })
})

describe('nutrientesAusentes', () => {
  it('lista lo que no se puede sumar', () => {
    // Hace falta para avisar de que el total del día es parcial.
    expect(nutrientesAusentes(ARROZ)).toEqual(new Set(['vitamina_d_ug']))
  })

  it('una composición completa no tiene ausencias', () => {
    expect(nutrientesAusentes({ kcal: 130.0 })).toEqual(new Set())
  })
})

describe('entradas inválidas', () => {
  it('composición null revienta en vez de declararse completa', () => {
    // Un "?? {}" convertiría un alimento sin catalogar (null) en {}: las
    // funciones responderían "no le falta nada" / "no aporta nada" en vez
    // de fallar donde está el problema. Un alimento no encontrado pasaría
    // como si hubiera aportado cero de todo, y el total del día se
    // declararía completo estando en realidad incompleto.
    expect(() => escalar(null as unknown as Composicion, 60)).toThrow(TypeError)
    expect(() => nutrientesAusentes(null as unknown as Composicion)).toThrow(TypeError)
  })
})
