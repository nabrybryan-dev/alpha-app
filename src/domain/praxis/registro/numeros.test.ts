import { describe, expect, it } from 'vitest'
import { horaDeCita, minutosDeCita, numeroDeCita, ordinalDeCita, valorDeCita } from './numeros.ts'
import { dichoEnLibras, librasAKg, normalizarUnidadCarga, porDeCita, resolverUnidad } from './unidad.ts'
import { revisarAguaDeltaMl, revisarCarga, revisarHorasSueno, revisarPasos, revisarReps, revisarRpeSesion } from './limites.ts'
import { etiquetaDeFecha, resolverFecha, sumarDias } from './fecha.ts'
import { resolverReserva } from './rir.ts'

describe('numeros en letras y cifras (es-CO)', () => {
  it.each([
    ['cuarenta', 40], ['cuarenta y cinco', 45], ['cincuenta y cinco', 55], ['doce y medio', 12.5], ['una y media', 1.5],
    ['medio', 0.5], ['un cuarto', 0.25], ['tres cuartos', 0.75], ['veintiuno', 21], ['ciento veinte', 120],
    ['doscientos cincuenta mil', 250000], ['nueve mil', 9000], ['9 mil', 9000], ['78 y medio', 78.5], ['1½', 1.5],
    ['80,2', 80.2], ['12.350', 12350], ['12.5', 12.5], ['40 kilos', 40], ['52,5', 52.5], ['1/2', 0.5], ['dos', 2], ['las tres', 3],
  ])('«%s» = %s', (cita, esperado) => {
    expect(valorDeCita(cita)).toBe(esperado)
  })

  it('«un 9» es el 9, no el artículo', () => expect(valorDeCita('un 9')).toBe(9))
  it('«un par» es 2 y aproximado', () => expect(numeroDeCita('un par')).toEqual({ valor: 2, aproximado: true }))
  it('«como 5 horas» es 5 aproximado', () => expect(numeroDeCita('como 5 horas')).toEqual({ valor: 5, aproximado: true }))
  it('«y pico» se rechaza: no hay número exacto', () => expect(numeroDeCita('cuarenta y pico')).toBeNull())
  it('sin número no inventa uno', () => {
    expect(valorDeCita('bastante')).toBeNull()
    expect(valorDeCita('')).toBeNull()
    expect(valorDeCita(null)).toBeNull()
    expect(valorDeCita('caminé harto')).toBeNull()
  })
  it('«10, 8 y 6»: el primero es 10', () => expect(valorDeCita('10, 8 y 6')).toBe(10))

  it('ordinales', () => {
    expect(ordinalDeCita('la tercera')).toBe(3)
    expect(ordinalDeCita('la última')).toBe('ultima')
    expect(ordinalDeCita('otra')).toBe('otra')
    expect(ordinalDeCita('una cuarta')).toBe(4)
    expect(ordinalDeCita(null)).toBeNull()
  })

  it('duraciones', () => {
    expect(minutosDeCita('una hora y diez')).toBe(70)
    expect(minutosDeCita('media hora')).toBe(30)
    expect(minutosDeCita('hora y media')).toBe(90)
    expect(minutosDeCita('45 minutos')).toBe(45)
    expect(minutosDeCita('dos horas')).toBe(120)
    expect(minutosDeCita('ahorita')).toBeNull()
  })

  it('horas de reloj según acostarse o levantarse', () => {
    expect(horaDeCita('a las once', 'acostarse')).toBe('23:00')
    expect(horaDeCita('a las cinco y media', 'levantarse')).toBe('05:30')
    expect(horaDeCita('a las cuatro', 'levantarse')).toBe('04:00')
    expect(horaDeCita('a la una', 'acostarse')).toBe('01:00')
    expect(horaDeCita('las 10:30 pm', 'acostarse')).toBe('22:30')
    expect(horaDeCita('a las 12', 'acostarse')).toBe('00:00')
  })
})

describe('unidades de carga', () => {
  it('135 lb = 61,2 kg con un decimal', () => expect(librasAKg(135)).toBe(61.2))
  it('lee libras y «por mano»', () => {
    expect(dichoEnLibras('185 libras')).toBe(true)
    expect(dichoEnLibras('kilos')).toBe(false)
    expect(porDeCita('en cada mano')).toBe('mano')
    expect(porDeCita('por lado')).toBe('lado')
    expect(porDeCita('en total')).toBe('total')
    expect(porDeCita('kilos')).toBe('no_dicho')
  })
  it('tolera las escrituras de unidadCarga', () => {
    expect(normalizarUnidadCarga('por mano')).toBe('por_mano')
    expect(normalizarUnidadCarga('POR_MANO')).toBe('por_mano')
    expect(normalizarUnidadCarga('por lado')).toBe('por_lado')
    expect(normalizarUnidadCarga(null)).toBeNull()
  })
  it('«en cada mano» en un ejercicio por mano no se duplica ni se parte', () => {
    expect(resolverUnidad({ nombre: 'X', unidad: 'por_mano' }, 'mano', 20)).toEqual({ unidad: 'por_mano', delEjercicio: false })
  })
  it('«en total» en un ejercicio por mano pregunta con el cálculo a la vista', () => {
    const r = resolverUnidad({ nombre: 'PRESS INCLINADO', unidad: 'por_mano' }, 'total', 20)
    expect(r.pregunta?.texto).toMatch(/20 en total son 10 por mano/)
  })
  it('sin decir la unidad usa la del ejercicio', () => {
    expect(resolverUnidad({ nombre: 'X', unidad: 'por_mano' }, 'no_dicho', 12)).toEqual({ unidad: 'por_mano', delEjercicio: true })
    expect(resolverUnidad({ nombre: 'X', unidad: 'total' }, 'no_dicho', 12).unidad).toBe('kg')
  })
})

describe('límites', () => {
  it('900 kg es imposible; 300 kg es un aviso', () => {
    expect(revisarCarga(900).tipo).toBe('imposible')
    expect(revisarCarga(300).tipo).toBe('aviso')
    expect(revisarCarga(60, 20).tipo).toBe('aviso')
    expect(revisarCarga(60, 55).tipo).toBe('ok')
  })
  it('reps: fuera del rango se guarda con aviso, 400 no cabe', () => {
    expect(revisarReps(15, '8-12').tipo).toBe('aviso')
    expect(revisarReps(10, '8-12').tipo).toBe('ok')
    expect(revisarReps(400).tipo).toBe('imposible')
  })
  it('sueño, pasos, agua, esfuerzo', () => {
    expect(revisarHorasSueno(30).tipo).toBe('imposible')
    expect(revisarHorasSueno(2).tipo).toBe('aviso')
    expect(revisarPasos(250000).tipo).toBe('imposible')
    expect(revisarAguaDeltaMl(4000).tipo).toBe('imposible')
    expect(revisarAguaDeltaMl(1000, 5500).tipo).toBe('aviso')
    expect(revisarRpeSesion(5).tipo).toBe('imposible')
    expect(revisarRpeSesion(6).tipo).toBe('ok')
  })
})

describe('fechas relativas', () => {
  const ahora = '2026-09-29T09:00:00-05:00'
  it('ayer, anoche, hoy, día de la semana', () => {
    expect(resolverFecha('ayer', ahora)?.fecha).toBe('2026-09-28')
    expect(resolverFecha('ayer', ahora)?.etiqueta).toBe('ayer, lunes 28-sep')
    expect(resolverFecha('anoche', ahora)?.fecha).toBe('2026-09-28')
    expect(resolverFecha(null, ahora)?.esHoy).toBe(true)
    expect(resolverFecha('el lunes', ahora)?.fecha).toBe('2026-09-28')
    expect(resolverFecha('el martes', ahora)?.esHoy).toBe(true)
    expect(resolverFecha('quién sabe cuándo', ahora)).toBeNull()
  })
  it('usa la fecha LOCAL: «ayer» a las 11 de la noche', () => {
    expect(resolverFecha('ayer', '2026-09-28T23:30:00-05:00')?.fecha).toBe('2026-09-27')
  })
  it('sumar días cruza meses', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01')
    expect(etiquetaDeFecha('2026-10-01')).toBe('jueves 1-oct')
  })
})

describe('RIR', () => {
  it('lo no dicho, el fallo y el RIR de la pauta quedan ausentes', () => {
    expect(resolverReserva({ tipo: 'no_dicha', cita: null }, [])).toEqual({})
    expect(resolverReserva({ tipo: 'rir_de_pauta', cita: 'el RIR' }, [])).toEqual({})
    expect(resolverReserva({ tipo: 'fallo', cita: 'fallo' }, []).rir).toBeUndefined()
  })
  it('«como 2» es 2 con confianza media; «una máximo» es 1 baja; 6 se recorta a 5', () => {
    expect(resolverReserva({ tipo: 'reserva_dicha', cita: 'como 2 en reserva' }, ['aproximado'])).toMatchObject({ rir: 2, confianza: 'media' })
    expect(resolverReserva({ tipo: 'reserva_dicha', cita: 'una máximo' }, ['maximo_o_minimo'])).toMatchObject({ rir: 1, confianza: 'baja' })
    expect(resolverReserva({ tipo: 'reserva_dicha', cita: '6 más' }, [])).toMatchObject({ rir: 5, confianza: 'baja' })
    expect(resolverReserva({ tipo: 'reserva_dicha', cita: '0' }, [])).toMatchObject({ rir: 0, confianza: 'alta' })
  })
})
