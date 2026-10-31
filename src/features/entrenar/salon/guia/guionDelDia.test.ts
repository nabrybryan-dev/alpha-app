import { describe, expect, it } from 'vitest'
import type { EjercicioPrescrito, Microciclo, Sesion } from '../../../../domain/types'
import { cambiosDelEjercicio, guionDelDia } from './guionDelDia'

function ejercicio(sobre: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e',
    nombre: 'Remo con barra',
    categoria: 'Espalda',
    cues: '',
    prescripcion: '40KG A 10 REPS; 3 SERIES',
    cargaKg: 40,
    sets: 3,
    rango: '',
    repsDiana: 10,
    descansoMin: 2,
    rirObjetivo: 2,
    series: [],
    ...sobre,
  } as EjercicioPrescrito
}

const sesion = (ejercicios: EjercicioPrescrito[], sobre: Partial<Sesion> = {}) =>
  ({ id: 's', nombre: 'FULL C', orden: 1, ejercicios, ...sobre }) as Sesion

const previoCon = (e: EjercicioPrescrito) => ({ sesiones: [sesion([e])] }) as unknown as Microciclo

describe('lo nuevo de un ejercicio', () => {
  it('sin microciclo anterior no se afirma nada: no se sabe qué cambió', () => {
    expect(cambiosDelEjercicio(ejercicio(), undefined)).toEqual([])
  })

  it('un ejercicio que no estaba se dice nuevo', () => {
    expect(cambiosDelEjercicio(ejercicio(), previoCon(ejercicio({ nombre: 'Otro' })))).toEqual(['Este ejercicio es nuevo.'])
  })

  it('compara carga, series, repeticiones e intensidad con lo pautado antes', () => {
    const antes = ejercicio({ cargaKg: 37.5, sets: 4, repsDiana: 12, rirObjetivo: 3 })
    expect(cambiosDelEjercicio(ejercicio(), previoCon(antes))).toEqual([
      'La carga pasa de 37,5 a 40 kg.',
      'Las series pasan de 4 a 3.',
      'Las repeticiones pasan de 12 a 10.',
      'El RIR pasa de 3 a 2.',
    ])
  })

  it('sin cambios no dice nada, y sin carga escrita en una de las dos no compara carga', () => {
    expect(cambiosDelEjercicio(ejercicio(), previoCon(ejercicio()))).toEqual([])
    expect(cambiosDelEjercicio(ejercicio(), previoCon(ejercicio({ cargaKg: undefined })))).toEqual([])
  })

  it('en otra unidad no escribe kilos que no son', () => {
    const e = ejercicio({ unidadCarga: 'por mano' })
    expect(cambiosDelEjercicio(e, previoCon(ejercicio({ cargaKg: 35, unidadCarga: 'por mano' })))).toEqual([
      'La carga pasa de 35 a 40 kg por mano.',
    ])
  })

  it('llevar otra unidad no se compara: 40 total no es más que 35 por mano', () => {
    const e = ejercicio({ unidadCarga: 'total' })
    expect(cambiosDelEjercicio(e, previoCon(ejercicio({ cargaKg: 35, unidadCarga: 'por mano' })))).toEqual([])
  })
})

describe('el guion del día', () => {
  it('abre con la sesión, sigue con cada ejercicio y cierra diciendo cómo empezar', () => {
    const g = guionDelDia(sesion([ejercicio(), ejercicio({ id: 'e2', nombre: 'Press de pecho', categoria: 'Pecho' })]), undefined)
    expect(g.map((p) => p.tipo)).toEqual(['apertura', 'ejercicio', 'ejercicio', 'cierre'])
    expect(g[0].titulo).toBe('FULL C: 2 ejercicios')
    expect(g[0].frases[0]).toBe('Son 6 series pautadas.')
    expect(g[3].frases.join(' ')).toMatch(/Empezar sesión/)
  })

  it('cada ejercicio lleva su frase exacta, su zona y su lugar en la sesión', () => {
    const paso = guionDelDia(sesion([ejercicio()]), undefined)[1]
    expect(paso).toMatchObject({ titulo: 'Remo con barra', prescripcion: '40KG A 10 REPS; 3 SERIES', zona: 'dors', indice: 0 })
  })

  it('la nota del coach y la técnica pasan tal cual: Praxis no las reescribe', () => {
    const paso = guionDelDia(sesion([ejercicio({ notaCoach: 'Pausa de un segundo arriba.', cues: 'Pecho alto.' })]), undefined)[1]
    expect(paso.notaCoach).toBe('Pausa de un segundo arriba.')
    expect(paso.tecnica).toBe('Pecho alto.')
  })

  it('responde las dudas técnicas con la lectura de la prescripción, también el fallo', () => {
    const normal = guionDelDia(sesion([ejercicio()]), undefined)[1].dudas
    expect(normal.map((d) => d.pregunta)).toEqual([
      '¿Por qué 3 series?',
      '¿Por qué 10 repeticiones?',
      '¿Por qué 2 minutos de descanso?',
      '¿Qué significa RIR 2?',
    ])
    expect(normal[3].respuesta).toMatch(/guardándote 2 repeticiones/)
    const alFallo = guionDelDia(sesion([ejercicio({ rirObjetivo: 'FALLO' })]), undefined)[1].dudas
    expect(alFallo[3].pregunta).toBe('¿Qué significa ir al fallo?')
  })

  it('la apertura dice qué zonas se trabajan y si hay cambios, sin inventar cuando no los hay', () => {
    const hoy = sesion([ejercicio()])
    expect(guionDelDia(hoy, undefined)[0].frases).toContain('Trabajas: Dorsal.')
    expect(guionDelDia(hoy, undefined)[0].frases.join(' ')).not.toMatch(/cambios/)
    const conCambio = guionDelDia(hoy, previoCon(ejercicio({ cargaKg: 35 })))[0].frases.join(' ')
    expect(conCambio).toMatch(/Hay cambios en 1 ejercicio frente a la semana pasada/)
  })

  it('cuenta lo que ya se anotó', () => {
    const g = guionDelDia(sesion([ejercicio({ series: [{}, {}] as EjercicioPrescrito['series'] })]), undefined)
    expect(g[0].frases.join(' ')).toMatch(/Ya anotaste 2 de 3/)
  })

  it('un día de cardio cuenta sus bloques, y el calentamiento va antes de empezar', () => {
    const cardio = sesion([], {
      nombre: 'METABÓLICO A',
      bloquesCardio: [{ id: 'b', titulo: 'Bicicleta', indicaciones: 'Ritmo cómodo.', duracionMin: 20 }],
      preparacion: [{ id: 'p', titulo: 'Movilidad de cadera', indicaciones: '', tipo: 'movilidad' }],
    } as Partial<Sesion>)
    const g = guionDelDia(cardio, undefined)
    expect(g[0].titulo).toBe('METABÓLICO A')
    expect(g[0].frases.join(' ')).toMatch(/Antes de empezar: Movilidad de cadera/)
    expect(g[0].frases.join(' ')).toMatch(/Bicicleta: Ritmo cómodo\. 20 minutos\./)
  })

  it('sin sesión lo dice y no inventa nada', () => {
    const g = guionDelDia(undefined, undefined)
    expect(g).toHaveLength(1)
    expect(g[0].titulo).toBe('Hoy no hay sesión')
  })
})
