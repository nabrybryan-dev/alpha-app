import { describe, expect, it } from 'vitest'
import { regularidadDelSueno, type NocheRegistrada } from './regularidad'

/** Una semana con el mismo horario todas las noches. */
function semana(
  desde: string,
  dias: number,
  horario: (i: number) => { acostarse: string; levantarse: string },
): NocheRegistrada[] {
  const base = new Date(`${desde}T00:00:00Z`).getTime()
  return Array.from({ length: dias }, (_, i) => {
    const fecha = new Date(base + i * 86_400_000).toISOString().slice(0, 10)
    const h = horario(i)
    return { fecha, horaAcostarse: h.acostarse, horaLevantarse: h.levantarse }
  })
}

const CLAVADA = () => ({ acostarse: '23:00', levantarse: '07:00' })

describe('índice de regularidad del sueño', () => {
  it('con menos de siete noches dice SIN DATOS, no un cero', () => {
    // Un cero es una acusación —«te acuestas a una hora distinta cada día»— y
    // no es lo mismo que «no lo sabemos». Este es el fallo que más caro sale.
    const r = regularidadDelSueno(semana('2026-09-01', 6, CLAVADA))
    expect(r.estado).toBe('sin-datos')
    if (r.estado === 'sin-datos') {
      expect(r.nochesConDato).toBe(6)
      expect(r.motivo).toContain('6 de 7')
    }
  })

  it('la misma hora todas las noches puntúa 100', () => {
    const r = regularidadDelSueno(semana('2026-09-01', 10, CLAVADA))
    expect(r).toMatchObject({ estado: 'medido', indice: 100 })
  })

  it('una semana caótica puntúa mucho menos que una regular', () => {
    const caotica = regularidadDelSueno(
      semana('2026-09-01', 10, (i) =>
        i % 2 === 0
          ? { acostarse: '22:00', levantarse: '06:00' }
          : { acostarse: '04:00', levantarse: '12:00' },
      ),
    )
    const regular = regularidadDelSueno(semana('2026-09-01', 10, CLAVADA))
    expect(caotica.estado).toBe('medido')
    if (caotica.estado === 'medido' && regular.estado === 'medido') {
      expect(caotica.indice).toBeLessThan(regular.indice - 40)
    }
  })

  it('la escala es la publicada: el caos cae a CERO, no a la mitad', () => {
    // Este caso existe por un mutante que sobrevivió: cambiando la fórmula
    // publicada (200·acuerdo − 100) por un porcentaje de acuerdo a secas, la
    // semana más caótica posible puntuaba ~50 y ninguna prueba se enteraba.
    // Un 50 se lee como «vas regular»; el número real es 0.
    const caos = regularidadDelSueno(
      semana('2026-09-01', 10, (i) =>
        i % 2 === 0
          ? { acostarse: '22:00', levantarse: '06:00' }
          : { acostarse: '04:00', levantarse: '12:00' },
      ),
    )
    expect(caos).toMatchObject({ estado: 'medido', indice: 0 })

    // Y un caso intermedio, para que la escala no se pueda estirar sin que se note:
    // dormir a otra hora uno de cada tres días da 69, no el 84 del acuerdo crudo.
    const turnos = regularidadDelSueno(
      semana('2026-09-01', 10, (i) =>
        i % 3 === 0
          ? { acostarse: '02:00', levantarse: '10:00' }
          : { acostarse: '23:00', levantarse: '07:00' },
      ),
    )
    expect(turnos).toMatchObject({ estado: 'medido', indice: 69 })
  })

  it('media hora de diferencia baja poco: la escala tiene que distinguir grados', () => {
    const casi = regularidadDelSueno(
      semana('2026-09-01', 10, (i) =>
        i % 2 === 0
          ? { acostarse: '23:00', levantarse: '07:00' }
          : { acostarse: '23:30', levantarse: '07:30' },
      ),
    )
    expect(casi.estado).toBe('medido')
    if (casi.estado === 'medido') {
      expect(casi.indice).toBeGreaterThan(85)
      expect(casi.indice).toBeLessThan(100)
    }
  })

  it('cruzar la medianoche se cuenta bien: 23:00→07:00 son ocho horas, no dieciséis', () => {
    const cruzada = regularidadDelSueno(semana('2026-09-01', 10, CLAVADA))
    const diurna = regularidadDelSueno(
      semana('2026-09-01', 10, () => ({ acostarse: '01:00', levantarse: '09:00' })),
    )
    // Las dos son igual de regulares aunque una cruce la medianoche.
    expect(cruzada).toMatchObject({ estado: 'medido', indice: 100 })
    expect(diurna).toMatchObject({ estado: 'medido', indice: 100 })
  })

  it('una noche a medias no cuenta, y sin siete completas no hay número', () => {
    const noches = semana('2026-09-01', 8, CLAVADA)
    for (const n of noches.slice(0, 2)) delete n.horaAcostarse
    const r = regularidadDelSueno(noches)
    expect(r).toMatchObject({ estado: 'sin-datos', nochesConDato: 6 })
  })

  it('el mismo dato en otro orden da el mismo número', () => {
    const noches = semana('2026-09-01', 10, (i) =>
      i % 3 === 0
        ? { acostarse: '23:00', levantarse: '07:00' }
        : { acostarse: '00:30', levantarse: '08:00' },
    )
    const derecho = regularidadDelSueno(noches)
    const revés = regularidadDelSueno([...noches].reverse())
    expect(revés).toEqual(derecho)
  })

  it('siete noches sueltas por el calendario no dan número: el índice compara días vecinos', () => {
    const sueltas = semana('2026-09-01', 14, CLAVADA).filter((_, i) => i % 2 === 0)
    const r = regularidadDelSueno(sueltas)
    expect(r.estado).toBe('sin-datos')
    if (r.estado === 'sin-datos') expect(r.motivo).toContain('seguidas')
  })

  it('una hora imposible o mal escrita no cuenta como noche', () => {
    const noches = semana('2026-09-01', 9, CLAVADA)
    noches[0].horaAcostarse = '25:00'
    noches[1].horaLevantarse = 'siete'
    // Y una noche de duración cero tampoco es una noche.
    noches[2] = { fecha: noches[2].fecha, horaAcostarse: '23:00', horaLevantarse: '23:00' }
    const r = regularidadDelSueno(noches)
    expect(r).toMatchObject({ nochesConDato: 6 })
  })

  it('no existe ninguna función que recomiende a qué hora despertarse', async () => {
    // Las calculadoras de ciclos de 90 minutos no tienen base: los ciclos van
    // de 80 a 150 minutos y cambian dentro de la misma noche. Si alguien añade
    // aquí una, este test lo dice.
    const modulo = await import('./regularidad')
    const nombres = Object.keys(modulo).join(' ').toLowerCase()
    expect(nombres).not.toMatch(/ciclo|despertar|alarma/)
  })
})
