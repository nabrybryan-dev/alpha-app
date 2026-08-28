import { describe, expect, it } from 'vitest'
import { Malla } from '../patrones/malla'
import { BAHIA, construirLaboratorio } from './laboratorio'

/**
 * El escenario no se prueba «a ver si se ve bonito» —eso se mira— sino contra las
 * cuatro cosas que, si se rompen, rompen el visor entero y **no se notan mirando**:
 *
 * 1. Que la geometría quepa en el búfer de índices, que es de 16 bits y lo comparte
 *    con el sujeto.
 * 2. Que todo vaya con el hueso identidad. Un vértice del suelo con el índice del
 *    fémur se deformaría con la sentadilla, y sería un suelo que se mueve.
 * 3. Que nada se interponga entre la cámara y el sujeto. Es la razón de que aquí haya
 *    un bordillo y no unas paredes.
 * 4. Que la retícula mida de verdad, porque su único trabajo es dar escala.
 */

function laboratorio(): Malla {
  const m = new Malla()
  construirLaboratorio(m)
  return m
}

const posiciones = (m: Malla): [number, number, number][] => {
  const p: [number, number, number][] = []
  for (let i = 0; i < m.posicion.length; i += 3) {
    p.push([m.posicion[i], m.posicion[i + 1], m.posicion[i + 2]])
  }
  return p
}

describe('la bahía de medida', () => {
  it('cabe en el búfer de 16 bits dejándole sitio al sujeto', () => {
    const m = laboratorio()
    // `arrays()` devuelve los índices como Uint16Array, así que el vértice 65.536 se
    // referenciaría como el 0 y la malla se plegaría sobre sí misma sin ningún error:
    // aparecerían triángulos que cruzan la escena de punta a punta. El sujeto ya gasta
    // su parte, así que el escenario se queda con la mitad del presupuesto y sobra.
    expect(m.vertices).toBeLessThan(32768)
    expect(Math.max(...m.indice)).toBeLessThan(65536)
  })

  it('todo va con el hueso identidad', () => {
    // El slot 0 del array de huesos es la identidad, y es lo que permite meter esta
    // geometría en la misma malla que el sujeto sin que la anime el esqueleto. Un solo
    // vértice con otro índice y ese trozo de suelo se agacharía con la sentadilla.
    const m = laboratorio()
    expect(new Set(m.hueso)).toEqual(new Set([0]))
  })

  it('nada dentro de la bahía se levanta por encima del bordillo, salvo el estadiómetro', () => {
    // LA REGLA QUE DECIDE LA FORMA DE TODO ESTO. La cámara orbita 360° y baja hasta
    // ras de suelo: cualquier cosa alta dentro de la bahía se cruza por delante del
    // sujeto en media vuelta. Por eso hay bordillo de 30 cm y no paredes.
    //
    // El estadiómetro es la excepción declarada: se le paga un arco estrecho de órbita
    // a cambio de poder leer alturas, que la retícula no puede dar.
    const m = laboratorio()
    const anguloEstadiometro = Math.atan2(Math.sin((215 * Math.PI) / 180), Math.cos((215 * Math.PI) / 180))

    const intrusos = posiciones(m).filter(([x, y, z]) => {
      if (y <= BAHIA.altoBordillo + 1e-9) return false
      const r = Math.hypot(x, z)
      if (r > BAHIA.radioBahia) return false
      // Todo lo alto que quede tiene que estar en la columna del estadiómetro.
      const dif = Math.abs(Math.atan2(z, x) - anguloEstadiometro)
      const separacion = Math.min(dif, Math.PI * 2 - dif)
      return separacion > 0.25
    })

    expect(intrusos).toEqual([])
  })

  it('nada se sale del suelo', () => {
    // Si algo asoma por fuera del disco, se ve un trozo de geometría flotando en la
    // bruma sin suelo debajo.
    const m = laboratorio()
    const fuera = posiciones(m).filter(([x, , z]) => Math.hypot(x, z) > BAHIA.radioSuelo + 1e-6)
    expect(fuera).toEqual([])
  })

  it('la retícula mide: hay líneas cada 10 cm y cada 50', () => {
    // Su único trabajo es dar escala, así que el paso tiene que ser el declarado. Una
    // retícula «decorativa» con un paso cualquiera convierte la lectura de profundidad
    // de una sentadilla en una impresión.
    const m = laboratorio()
    const alturas = new Set(posiciones(m).map(([, y]) => Number(y.toFixed(4))))
    // Menor y mayor viven a alturas distintas a propósito, para que el cruce no
    // parpadee: si esto deja de haber dos planos, volvió el z-fighting.
    expect(alturas.has(0.002)).toBe(true)
    expect(alturas.has(0.003)).toBe(true)
    expect(BAHIA.pasoMayor / BAHIA.pasoMenor).toBe(5)
  })

  it('el sujeto se para en algo, no en el vacío', () => {
    // La placa tiene que ser más ancha que una postura de sentadilla —los pies se
    // abren— o el sujeto parecería en equilibrio sobre una moneda.
    expect(BAHIA.radioPlaca * 2).toBeGreaterThan(0.6)
  })
})
