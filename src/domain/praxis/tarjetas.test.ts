import { describe, expect, it } from 'vitest'
import { tarjetasDe, temasDe, TARJETAS } from './tarjetas'

/**
 * Las tarjetas de Praxis: qué despierta la conversación y a dónde lleva cada una.
 *
 * Es dominio puro y no una lista de botones porque la regla que importa —la crisis las
 * retira TODAS— no se puede dejar al azar de un componente. La maqueta 7 las hace salir
 * solo al nombrar su tema; aquí se fija qué frases las encienden.
 */
describe('temas que despiertan tarjetas', () => {
  it('al abrir, sin texto, no hay ninguna', () => {
    expect(temasDe('')).toEqual([])
    expect(tarjetasDe('')).toEqual([])
  })

  it('un saludo no despierta tarjetas', () => {
    expect(tarjetasDe('hola, buenos días')).toEqual([])
  })

  it('nombrar el check-in despierta la suya, y solo la suya', () => {
    expect(tarjetasDe('quiero hacer mi check-in de hoy').map((t) => t.id)).toEqual(['checkin'])
  })

  it('«cómo voy» despierta progresión y progreso, en ese orden', () => {
    expect(tarjetasDe('¿cómo voy esta semana?').map((t) => t.id)).toEqual(['grafica', 'progreso'])
  })

  it('el dolor despierta dolor y escribir al coach', () => {
    expect(tarjetasDe('me duele el hombro derecho').map((t) => t.id)).toEqual(['dolor', 'coach'])
  })

  it('nombrar el peso despierta Mi progreso sin inventar una gráfica', () => {
    expect(tarjetasDe('no sé cuánto peso').map((t) => t.id)).toEqual(['progreso'])
  })

  it('nunca enseña más de tres, y la más reciente manda', () => {
    const r = tarjetasDe('me duele la rodilla, quiero ver mi progreso y hablar con mi coach')
    expect(r).toHaveLength(3)
    expect(r.map((t) => t.id)).toEqual(['dolor', 'coach', 'progreso'])
  })

  it('con una frase de crisis no queda ninguna: la Quieta manda', () => {
    for (const frase of ['ya no quiero vivir', 'pienso quitarme la vida', 'no aguanto más']) {
      expect(temasDe(frase), frase).toEqual([])
      expect(tarjetasDe(frase), frase).toEqual([])
    }
  })

  it('cada tarjeta lleva su nombre visible y un destino que existe', () => {
    expect(TARJETAS.checkin).toMatchObject({ titulo: 'Mi check-in', destino: '/bienestar' })
    expect(TARJETAS.grafica).toMatchObject({ titulo: '¿Cómo voy?', destino: '/progreso' })
    expect(TARJETAS.progreso).toMatchObject({ titulo: 'Mi progreso', destino: '/progreso' })
    expect(TARJETAS.dolor).toMatchObject({ titulo: 'Me duele algo', destino: '/bienestar' })
    expect(TARJETAS.coach).toMatchObject({ titulo: 'Escribir a mi coach', destino: '/chat' })
  })
})
