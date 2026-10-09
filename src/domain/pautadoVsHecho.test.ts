import { describe, expect, it } from 'vitest'
import { motivoSinBarras, pautadoVsHechoDe, pautadoVsHechoPorMicrociclo } from './pautadoVsHecho'
import type { EjercicioPrescrito, Microciclo, SerieRegistrada } from './types'

let contador = 0

function serie(cargaKg: number, reps?: number): SerieRegistrada {
  contador += 1
  return { orden: contador, cargaKg, reps }
}

function ejercicio(parcial: Partial<EjercicioPrescrito>): EjercicioPrescrito {
  contador += 1
  return {
    id: `e-${contador}`,
    categoria: 'SENTADILLA',
    nombre: 'Sentadilla',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets: 3,
    rango: '8-10',
    repsDiana: 10,
    rirObjetivo: 2,
    cargaKg: 50,
    series: [],
    ...parcial,
  }
}

function microciclo(numero: number, ejercicios: EjercicioPrescrito[], estado: Microciclo['estado'] = 'cerrado'): Microciclo {
  return {
    id: `m-${numero}`,
    usuarioId: 'u',
    numero,
    cadenciaDias: 7,
    estado,
    fechaInicio: '2026-09-01',
    sesiones: ejercicios.length === 0 ? [] : [{ id: `s-${numero}`, nombre: 'A', orden: 1, ejercicios }],
  }
}

describe('pautadoVsHechoDe', () => {
  it('suma series y volumen de lo pautado y de lo registrado', () => {
    const m = microciclo(1, [
      ejercicio({ sets: 3, repsDiana: 10, cargaKg: 50, series: [serie(50, 10), serie(50, 10), serie(50, 8)] }),
      ejercicio({ sets: 2, repsDiana: 12, cargaKg: 20, series: [serie(20, 12)] }),
    ])
    const r = pautadoVsHechoDe(m)
    expect(r.situacion).toBe('con-datos')
    expect(r.series).toEqual({ pautado: 5, hecho: 4, cumplimientoPct: 80 })
    // pautado: 3×10×50 + 2×12×20 = 1500 + 480; hecho: 500+500+400 + 240
    expect(r.volumen.pautado).toBe(1980)
    expect(r.volumen.hecho).toBe(1640)
    expect(r.volumen.cumplimientoPct).toBe(83)
  })

  it('microciclo sin series registradas: «sin registros», no una barra en cero', () => {
    const r = pautadoVsHechoDe(microciclo(2, [ejercicio({ sets: 3 })]))
    expect(r.situacion).toBe('sin-registros')
    expect(r.series.pautado).toBe(3)
    expect(r.series.hecho).toBe(0)
    expect(motivoSinBarras(r, 'series')).toBe('sin registros')
    expect(motivoSinBarras(r, 'volumen')).toBe('sin registros')
  })

  it('cardio sin ejercicios: no hay pauta de series y nada se divide por cero', () => {
    const r = pautadoVsHechoDe(microciclo(3, []))
    expect(r.situacion).toBe('sin-pauta')
    expect(r.series).toEqual({ pautado: 0, hecho: 0, cumplimientoPct: undefined })
    expect(r.volumen.cumplimientoPct).toBeUndefined()
    expect(motivoSinBarras(r, 'series')).toBe('sin pauta')
  })

  it('un ejercicio sin carga prescrita cuenta en series pero no entra al volumen, ni por un lado ni por el otro', () => {
    const m = microciclo(4, [
      ejercicio({ sets: 3, repsDiana: 10, cargaKg: 40, series: [serie(40, 10), serie(40, 10), serie(40, 10)] }),
      // Peso corporal: sin cargaKg prescrita; la persona anotó 10 kg de lastre que NO debe inflar el hecho.
      ejercicio({ sets: 3, cargaKg: undefined, series: [serie(10, 12), serie(10, 12), serie(10, 12)] }),
    ])
    const r = pautadoVsHechoDe(m)
    expect(r.series).toEqual({ pautado: 6, hecho: 6, cumplimientoPct: 100 })
    expect(r.volumen).toEqual({ pautado: 1200, hecho: 1200, cumplimientoPct: 100 })
    expect(r.ejerciciosSinCarga).toBe(1)
  })

  it('si NINGÚN ejercicio trae kilos pautados, el volumen no se puede comparar', () => {
    const r = pautadoVsHechoDe(microciclo(5, [ejercicio({ cargaKg: undefined, series: [serie(0, 10)] })]))
    expect(r.situacion).toBe('con-datos')
    expect(r.volumen).toEqual({ pautado: 0, hecho: 0, cumplimientoPct: undefined })
    expect(motivoSinBarras(r, 'series')).toBeUndefined()
    expect(motivoSinBarras(r, 'volumen')).toBe('sin kilos pautados')
  })

  it('un ejercicio al FALLO pauta lo mismo: el fallo no cambia reps ni carga', () => {
    const m = microciclo(6, [
      ejercicio({ rirObjetivo: 'FALLO', sets: 2, repsDiana: 8, cargaKg: 30, series: [serie(30, 9), serie(30, 7)] }),
    ])
    const r = pautadoVsHechoDe(m)
    expect(r.volumen.pautado).toBe(480)
    expect(r.volumen.hecho).toBe(30 * 9 + 30 * 7)
  })

  it('una serie sin repeticiones (plancha) cuenta como serie hecha pero no suma volumen', () => {
    const m = microciclo(7, [ejercicio({ sets: 2, series: [serie(0, undefined), serie(50, 10)] })])
    const r = pautadoVsHechoDe(m)
    expect(r.series.hecho).toBe(2)
    expect(r.volumen.hecho).toBe(500)
  })

  it('los bloques extra de una técnica (myo-reps) no suman volumen', () => {
    const base = serie(50, 10)
    base.extra = [{ reps: 5 }, { reps: 4 }]
    const r = pautadoVsHechoDe(microciclo(8, [ejercicio({ sets: 1, series: [base] })]))
    expect(r.volumen.hecho).toBe(500)
  })

  it('un ejercicio ondulado pauta serie a serie', () => {
    const m = microciclo(9, [
      ejercicio({
        sets: 2,
        repsDiana: 10,
        cargaKg: 40,
        seriesPrescritas: [
          { orden: 1, reps: 12, rir: 3, cargaKg: 40 },
          { orden: 2, reps: 8, rir: 1, cargaKg: 50 },
        ],
        series: [serie(40, 12)],
      }),
    ])
    const r = pautadoVsHechoDe(m)
    expect(r.volumen.pautado).toBe(12 * 40 + 8 * 50)
    expect(r.volumen.hecho).toBe(480)
  })

  it('se puede hacer más de lo pedido: el cumplimiento pasa de 100 sin tope', () => {
    const m = microciclo(10, [ejercicio({ sets: 1, repsDiana: 10, cargaKg: 10, series: [serie(10, 10), serie(10, 10)] })])
    expect(pautadoVsHechoDe(m).series.cumplimientoPct).toBe(200)
  })

  it('ignora números rotos (NaN, texto) venidos de un JSONB sin validar', () => {
    const rota = { orden: 1, cargaKg: Number.NaN, reps: 10 } as SerieRegistrada
    const r = pautadoVsHechoDe(microciclo(11, [ejercicio({ sets: 1, repsDiana: 10, cargaKg: 10, series: [rota] })]))
    expect(r.series.hecho).toBe(1)
    expect(r.volumen.hecho).toBe(0)
  })
})

describe('pautadoVsHechoPorMicrociclo', () => {
  it('ordena por número y deja fuera los propuestos', () => {
    const lista = pautadoVsHechoPorMicrociclo([
      microciclo(3, [ejercicio({})], 'propuesto'),
      microciclo(2, [ejercicio({})], 'activo'),
      microciclo(1, [ejercicio({})]),
    ])
    expect(lista.map((f) => f.numero)).toEqual([1, 2])
    expect(lista[1].estado).toBe('activo')
  })

  it('sin historial devuelve una lista vacía', () => {
    expect(pautadoVsHechoPorMicrociclo([])).toEqual([])
  })
})
