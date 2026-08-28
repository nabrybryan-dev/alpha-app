import { describe, expect, it } from 'vitest'
import { PATRONES } from './catalogo'
import { esqueletoEnFase } from './escena'
import { construirHuesos } from './huesos'
import { resolver } from './esqueleto'
import { construirMusculos, longitudesEnReposo, PORCIONES } from './musculos'
import { Malla } from './malla'

/**
 * Presupuesto por cuadro.
 *
 * El visor se abre en el móvil de alguien que está entrenando, y la musculatura
 * se regenera en cada cuadro. Si no cabe en los 16 ms que hay a 60 fps, se ve a
 * tirones justo en la pantalla donde el asesorado mira cómo se hace un
 * ejercicio.
 *
 * **Se mide en relativo, no en milisegundos.** Un umbral absoluto aquí es un
 * gate intermitente: aislado el cuadro sale en 5 ms y con los doscientos
 * archivos de la suite en paralelo llega a 14, así que el número dependía de lo
 * cargada que estuviera la máquina más que del código. Y un guardián que falla
 * a ratos se acaba ignorando, que es peor que no tenerlo.
 *
 * La referencia es construir el esqueleto, que es geometría fija y del mismo
 * orden de tamaño. Si la máquina va lenta, las dos medidas se ralentizan igual
 * y la proporción se mantiene.
 *
 * Lo que esto caza es la **regresión grande**: al detallar la anatomía por
 * porciones el coste pasó de 4 a 35 ms de golpe, y fue este test el que lo
 * destapó. Si vuelve a dispararse, algo se construye de más en cada cuadro.
 */
describe('el coste de un cuadro', () => {
  const reposo = longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0]))

  it('construye la musculatura de cualquier patrón sin dispararse', () => {
    const cronometrar = (veces: number, fn: () => void): number => {
      fn() // la primera pasada mide la compilación, no el trabajo
      const t0 = performance.now()
      for (let i = 0; i < veces; i++) fn()
      return (performance.now() - t0) / veces
    }

    // La referencia: el esqueleto entero, que son unos nueve mil vértices de
    // geometría fija. Se mide aquí y no antes para que sufra la misma carga.
    const referencia = cronometrar(5, () => construirHuesos())

    // Se mide reutilizando la malla, que es como corre en la app: la topología
    // no cambia entre cuadros y reservarla de nuevo cada vez costaba el doble.
    const malla = new Malla(16384)
    const medidas: [string, number][] = PATRONES.map((p) => {
      const esq = esqueletoEnFase(p, 0.5)
      return [p.id, cronometrar(5, () => construirMusculos(esq, p.activacion, reposo, malla))]
    })

    const [peorId, peor] = medidas.sort((a, b) => b[1] - a[1])[0]
    const veces = peor / referencia
    expect(
      veces,
      `${peorId} cuesta ${veces.toFixed(1)}× el esqueleto (${peor.toFixed(1)} ms frente a ${referencia.toFixed(1)})`,
    ).toBeLessThan(4)
  })

  it('mantiene la malla dentro de índices de 16 bits', () => {
    // Por encima de 65 535 vértices haría falta una extensión que no todos los
    // móviles traen, y la malla crece cada vez que se detalla una porción.
    const esq = esqueletoEnFase(PATRONES[0], 0.5)
    const musculos = construirMusculos(esq, PATRONES[0].activacion, reposo)
    const huesos = construirHuesos()
    const total = musculos.vertices + huesos.vertices
    expect(total, `${total} vértices entre huesos y músculo`).toBeLessThan(65535)
  })

  it('no crece sin control al detallar porciones', () => {
    // Cada porción nueva es geometría en cada cuadro. Este número es el que hay
    // que mirar antes de subdividir otro músculo.
    const fasciculos = PORCIONES.reduce((s, { porcion }) => s + (porcion.fasciculos ?? 1), 0)
    expect(fasciculos, `${PORCIONES.length} porciones, ${fasciculos} fascículos`).toBeLessThan(110)
  })
})
