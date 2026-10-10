import { describe, expect, it } from 'vitest'
import { fechasEnClaro, textoDeLoHecho, textoDeLoPedido } from './lecturaDeSemana'
import type { EjercicioPrescrito, Microciclo } from './types'

function micro(fechaInicio: string, cadenciaDias: Microciclo['cadenciaDias'] = 7): Microciclo {
  return { id: 'm', usuarioId: 'u', numero: 1, cadenciaDias, estado: 'activo', fechaInicio, sesiones: [] }
}

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e',
    categoria: 'X',
    nombre: 'Prensa',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets: 3,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

describe('fechasEnClaro', () => {
  it('dentro de un mes lo dice una sola vez', () => {
    expect(fechasEnClaro(micro('2026-10-05'))).toBe('del lunes 5 al domingo 11 de octubre')
  })
  it('si cruza de mes dice los dos', () => {
    expect(fechasEnClaro(micro('2026-09-28'))).toBe('del lunes 28 de septiembre al domingo 4 de octubre')
  })
  it('si cruza de año dice los dos años', () => {
    expect(fechasEnClaro(micro('2026-12-28'))).toBe('del lunes 28 de diciembre de 2026 al domingo 3 de enero de 2027')
  })
  it('un microciclo de 15 días termina donde termina de verdad', () => {
    expect(fechasEnClaro(micro('2026-10-05', 15))).toBe('del lunes 5 al lunes 19 de octubre')
  })
})

describe('textoDeLoPedido', () => {
  it('series, repeticiones y carga tal como está prescrito', () => {
    expect(textoDeLoPedido(ejercicio({ cargaKg: 62.5 }))).toBe('3 series de 8-10 repeticiones · 62,5 kg')
  })
  it('la unidad de carga cambia lo que se pone en la barra, y «kg» no se repite', () => {
    expect(textoDeLoPedido(ejercicio({ cargaKg: 20, unidadCarga: 'por lado' }))).toBe('3 series de 8-10 repeticiones · 20 kg (por lado)')
    expect(textoDeLoPedido(ejercicio({ cargaKg: 20, unidadCarga: 'kg' }))).toBe('3 series de 8-10 repeticiones · 20 kg')
  })
  it('el rango entre paréntesis y el «reps» sobrante no se duplican', () => {
    expect(textoDeLoPedido(ejercicio({ rango: '(10-12) reps', cargaKg: 40 }))).toBe('3 series de 10-12 repeticiones · 40 kg')
  })
  it('un ejercicio por tiempo no habla de repeticiones', () => {
    expect(textoDeLoPedido(ejercicio({ rango: '30 seg', sets: 2 }))).toBe('2 series de 30 seg · sin carga fija')
  })
  it('sin carga no inventa kilos: ni «0 kg» ni «null kg»', () => {
    const t = textoDeLoPedido(ejercicio({ cargaKg: undefined }))
    expect(t).toBe('3 series de 8-10 repeticiones · sin carga fija')
    expect(textoDeLoPedido(ejercicio({ cargaKg: null as unknown as undefined }))).toBe(t)
  })
  it('ondulado sin carga única: la horquilla de sus series', () => {
    const e = ejercicio({
      cargaKg: undefined,
      seriesPrescritas: [
        { orden: 1, reps: 12, cargaKg: 50, rir: 2 },
        { orden: 2, reps: 10, cargaKg: 55, rir: 2 },
      ],
    })
    expect(textoDeLoPedido(e)).toBe('3 series de 8-10 repeticiones · 50 a 55 kg')
  })
  it('una sola serie, en singular', () => {
    expect(textoDeLoPedido(ejercicio({ sets: 1, cargaKg: 10 }))).toBe('1 serie de 8-10 repeticiones · 10 kg')
  })
})

describe('textoDeLoHecho', () => {
  it('sin series anotadas no hay texto', () => {
    expect(textoDeLoHecho(ejercicio())).toBeUndefined()
  })
  it('cuántas y carga × repeticiones, en el orden en que se hicieron', () => {
    const e = ejercicio({
      series: [
        { orden: 2, cargaKg: 60, reps: 9 },
        { orden: 1, cargaKg: 62.5, reps: 10 },
      ],
    })
    expect(textoDeLoHecho(e)).toBe('2 series · 62,5 kg × 10 · 60 kg × 9')
  })
  it('una serie sin repeticiones (una plancha) cuenta y no inventa un número', () => {
    expect(textoDeLoHecho(ejercicio({ series: [{ orden: 1, cargaKg: 20 }] }))).toBe('1 serie · 20 kg')
  })
})
