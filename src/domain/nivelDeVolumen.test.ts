import { describe, expect, it } from 'vitest'
import { nivelDeSeries } from './nivelDeVolumen'

/**
 * Progreso y PERFIL hablaban idiomas distintos: PERFIL usa Muy Bajo / Bajo /
 * Normal / Alto / Muy Alto, y Progreso usaba Bajo / Medio / Alto / Muy alto. Ni
 * "Normal" existia en una ni "Medio" en la otra, asi que el mismo grupo podia
 * leerse distinto en dos pantallas el mismo dia.
 *
 * Los cortes se anclan en los landmarks del motor: MEV ~10 series por grupo y
 * semana, MRV ~22. "Normal" empieza donde empieza el minimo efectivo.
 */
describe('nivelDeSeries', () => {
  it('por debajo del minimo efectivo, el volumen es bajo', () => {
    expect(nivelDeSeries(0)).toBe('Muy Bajo')
    expect(nivelDeSeries(5)).toBe('Muy Bajo')
    expect(nivelDeSeries(6)).toBe('Bajo')
    expect(nivelDeSeries(9)).toBe('Bajo')
  })

  it('a partir del MEV el volumen es normal', () => {
    expect(nivelDeSeries(10)).toBe('Normal')
    expect(nivelDeSeries(14)).toBe('Normal')
  })

  it('la parte alta de la onda es alta, y cerca del MRV muy alta', () => {
    expect(nivelDeSeries(15)).toBe('Alto')
    expect(nivelDeSeries(19)).toBe('Alto')
    expect(nivelDeSeries(20)).toBe('Muy Alto')
    expect(nivelDeSeries(26)).toBe('Muy Alto')
  })

  /** El vocabulario tiene que ser EL MISMO que el de la hoja PERFIL. */
  it('solo devuelve etiquetas que PERFIL tambien usa', () => {
    const deSerie = [0, 5, 8, 12, 17, 24].map(nivelDeSeries)
    for (const etiqueta of deSerie) {
      expect(['Muy Bajo', 'Bajo', 'Normal', 'Alto', 'Muy Alto']).toContain(etiqueta)
    }
  })

  it('nunca baja al subir las series', () => {
    const orden = ['Muy Bajo', 'Bajo', 'Normal', 'Alto', 'Muy Alto']
    let previo = -1
    for (let series = 0; series <= 30; series += 1) {
      const actual = orden.indexOf(nivelDeSeries(series))
      expect(actual).toBeGreaterThanOrEqual(previo)
      previo = actual
    }
  })
})
