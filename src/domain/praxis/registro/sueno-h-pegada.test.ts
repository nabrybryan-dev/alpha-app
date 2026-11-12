// «7h30» (hora pegada a los minutos) se leía como 7 horas: los 30 minutos se perdían en
// silencio. Decisión de Bryan 7-nov: los minutos del sueño se suman con un decimal.
import { describe, expect, it } from 'vitest'
import { leerSueno } from './dictado.ts'

describe('sueño: horas y minutos con la h pegada o con dos puntos', () => {
  it.each([
    ['7h30', 7.5], ['7h45', 7.8], ['8h15', 8.3], ['6h 30', 6.5], ['7 h 30', 7.5],
    ['7:30 horas', 7.5], ['siete h treinta', 7.5],
  ] as [string, number][])('«%s» = %d horas', (cita, horas) => {
    expect(leerSueno(cita), cita).toMatchObject({ tipo: 'valor', valor: horas })
  })

  it.each([['5h', 5], ['7h', 7], ['8 hrs', 8], ['siete h', 7], ['10 horas', 10]] as [string, number][])(
    '«%s» sigue siendo %d horas (sin minutos que sumar)', (cita, horas) => {
      expect(leerSueno(cita), cita).toMatchObject({ tipo: 'valor', valor: horas })
    })
})
