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
 * **El umbral es 20 ms y no 16 a propósito.** Este test corre junto a los otros
 * doscientos archivos y la máquina está saturada: aislado mide 5-6 ms y con la
 * suite entera en paralelo llega a 13. Un número pegado al valor real daría
 * fallos aleatorios, y un guardián intermitente se acaba ignorando, que es peor
 * que no tenerlo.
 *
 * Lo que este test caza es la **regresión grande**, no el milisegundo: al
 * detallar la anatomía por porciones el coste pasó de 4 a 35 ms de golpe y esto
 * es lo que lo destapó. Si vuelve a dispararse, algo se ha vuelto a construir
 * de más en cada cuadro.
 */
describe('el coste de un cuadro', () => {
  const reposo = longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0]))

  it('construye la musculatura de cualquier patrón sin dispararse', () => {
    const medidas: [string, number][] = []
    // Se mide reutilizando la malla, que es como corre en la app: la topología
    // no cambia entre cuadros y reservarla de nuevo cada vez costaba el doble.
    const malla = new Malla(16384)
    for (const p of PATRONES) {
      const esq = esqueletoEnFase(p, 0.5)
      // Se descarta la primera pasada: mide la compilación, no el trabajo.
      construirMusculos(esq, p.activacion, reposo, malla)
      const t0 = performance.now()
      const veces = 5
      for (let i = 0; i < veces; i++) construirMusculos(esq, p.activacion, reposo, malla)
      medidas.push([p.id, (performance.now() - t0) / veces])
    }
    const peor = medidas.sort((a, b) => b[1] - a[1])[0]
    expect(peor[1], `${peor[0]} tarda ${peor[1].toFixed(1)} ms`).toBeLessThan(20)
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
