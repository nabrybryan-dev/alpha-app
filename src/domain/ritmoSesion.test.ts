import { describe, expect, it } from 'vitest'
import {
  bloqueDeEjercicio,
  calcularRitmo,
  duracionEjercicioSeg,
  duracionTotalSeg,
  formatoDuracion,
} from './ritmoSesion'
import type { EjercicioPrescrito, Sesion } from './types'

const ejercicio = (over: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito => ({
  id: 'e1',
  categoria: 'EMPUJE HORIZONTAL',
  nombre: 'Press plano',
  cues: '',
  prescripcion: '',
  descansoMin: 2,
  sets: 3,
  rango: '(8-10)',
  repsDiana: 10,
  rirObjetivo: 2,
  series: [],
  ...over,
})

const sesion = (ejercicios: EjercicioPrescrito[], over: Partial<Sesion> = {}): Sesion => ({
  id: 's1',
  nombre: 'UPPER A',
  orden: 1,
  ejercicios,
  ...over,
})

describe('duracionEjercicioSeg', () => {
  it('suma trabajo + descansos + montaje', () => {
    // 3 series × (10 reps × 3.5 = 35 s) + 3 × 2 min descanso + 60 s montaje
    // = 105 + 360 + 60 = 525 s
    expect(duracionEjercicioSeg(ejercicio())).toBe(525)
  })

  it('respeta el techo de trabajo por serie', () => {
    // 40 reps → 140 s pero se capa a 90 s
    const d = duracionEjercicioSeg(ejercicio({ repsDiana: 40, sets: 1, descansoMin: 0 }))
    expect(d).toBe(90 + 60) // trabajo capado + montaje
  })
})

describe('duracionTotalSeg / formatoDuracion', () => {
  it('incluye calentamiento por defecto cuando no hay duraciones', () => {
    const s = sesion([ejercicio()])
    // 12 min calentamiento (720 s) + 525 s ejercicio = 1245 s
    expect(duracionTotalSeg(s)).toBe(1245)
  })

  it('usa las duraciones marcadas del calentamiento si existen', () => {
    const s = sesion([ejercicio()], {
      preparacion: [{ id: 'p1', tipo: 'calentamiento', titulo: 'Remo', indicaciones: '', duracionMin: 6 }],
      bloquesCardio: [{ id: 'b1', titulo: 'Movilidad', indicaciones: '', duracionMin: 4 }],
    })
    // 10 min (600 s) + 525 s = 1125 s
    expect(duracionTotalSeg(s)).toBe(1125)
  })

  it('formatea con horas y minutos', () => {
    expect(formatoDuracion(5100)).toBe('1h 25m')
    expect(formatoDuracion(2880)).toBe('48m')
  })
})

describe('bloqueDeEjercicio', () => {
  it('clasifica fuerza, accesorio y dinámico', () => {
    expect(bloqueDeEjercicio(ejercicio({ categoria: 'BISAGRA DE CADERA' }))).toBe('FUERZA')
    expect(bloqueDeEjercicio(ejercicio({ categoria: 'AISLAMIENTO CUÁDRICEPS' }))).toBe('ACCESORIO')
    expect(bloqueDeEjercicio(ejercicio({ categoria: 'CONTROL ISOMÉTRICO' }))).toBe('DINÁMICO')
  })
})

describe('calcularRitmo', () => {
  it('marca el ejercicio en curso y el bloque', () => {
    const e1 = ejercicio({ id: 'e1', series: [{ orden: 1, cargaKg: 40, reps: 10, rir: 2 }, { orden: 2, cargaKg: 40, reps: 10, rir: 2 }, { orden: 3, cargaKg: 40, reps: 10, rir: 2 }] })
    const e2 = ejercicio({ id: 'e2', categoria: 'AISLAMIENTO BÍCEPS', series: [] })
    const r = calcularRitmo(sesion([e1, e2]), 600)
    expect(r.ejercicioActual).toBe(2)
    expect(r.bloqueActual).toBe('ACCESORIO')
    expect(r.totalEjercicios).toBe(2)
  })

  it('detecta acelerado, en ritmo y lento', () => {
    const s = sesion([ejercicio()])
    // esperado con 0 avance = solo calentamiento = 720 s
    expect(calcularRitmo(s, 300).estado).toBe('acelerado') // 300 < 720*0.82
    expect(calcularRitmo(s, 720).estado).toBe('en-ritmo')
    expect(calcularRitmo(s, 1000).estado).toBe('lento') // 1000 > 720*1.18
  })

  it('ejercicioActual 0 cuando la sesión está completa', () => {
    const completo = ejercicio({ series: [{ orden: 1, cargaKg: 40, reps: 10, rir: 2 }, { orden: 2, cargaKg: 40, reps: 10, rir: 2 }, { orden: 3, cargaKg: 40, reps: 10, rir: 2 }] })
    expect(calcularRitmo(sesion([completo]), 600).ejercicioActual).toBe(0)
  })
})
