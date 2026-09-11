import { describe, expect, it } from 'vitest'
import { lecturaDeLaPrescripcion } from './lecturaDeLaPrescripcion'
import type { EjercicioPrescrito } from '../../../../domain/types'

/**
 * LA LECTURA LARGA, PROBADA.
 *
 * Lo que se vigila aquí no es la prosa —esa se lee y se cambia— sino las tres cosas que
 * la harían MENTIR: que una prescripción al fallo se cuente como un RIR, que una cifra se
 * invente o se redondee, y que el texto no cambie cuando el campo cambia de naturaleza.
 */

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'EMPUJE HORIZONTAL',
    nombre: 'Press de banca con barra',
    cues: 'Escápulas retraídas.',
    prescripcion: '80KG A 8 REPS; 3 SERIES (RIR 2).',
    cargaKg: 80,
    descansoMin: 3,
    sets: 3,
    rango: '(8-10)',
    repsDiana: 8,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

describe('lecturaDeLaPrescripcion', () => {
  it('devuelve las cuatro, en el orden en que se leen', () => {
    expect(lecturaDeLaPrescripcion(ejercicio()).map((l) => l.id)).toEqual([
      'series',
      'reps',
      'descanso',
      'rir',
    ])
  })

  it('sin ejercicio no hay lectura, y no un texto en blanco', () => {
    expect(lecturaDeLaPrescripcion(undefined)).toEqual([])
  })

  it('cada fila trae sus tres niveles, y ninguno vacío', () => {
    for (const l of lecturaDeLaPrescripcion(ejercicio())) {
      expect(l.cifra.trim(), `${l.id} sin cifra`).not.toBe('')
      expect(l.que.trim(), `${l.id} sin QUÉ`).not.toBe('')
      expect(l.porque.trim(), `${l.id} sin POR QUÉ`).not.toBe('')
      expect(l.senal.trim(), `${l.id} sin SEÑAL`).not.toBe('')
    }
  })

  it('FALLO no se cuenta como un RIR, y ni siquiera se llama igual', () => {
    // `RIR 0` es la última repetición completa; `FALLO` es meterse en la parcial. Contar
    // el fallo como «te guardas 0 repeticiones» sería enseñar la orden contraria.
    const alFallo = lecturaDeLaPrescripcion(ejercicio({ rirObjetivo: 'FALLO' })).at(-1)
    expect(alFallo?.cifra).toBe('FALLO')
    expect(alFallo?.rotulo).toBe('Intensidad')
    expect(alFallo?.que).not.toMatch(/guard[aá]ndote 0|0 repeticiones/i)

    const rirCero = lecturaDeLaPrescripcion(ejercicio({ rirObjetivo: 0 })).at(-1)
    expect(rirCero?.cifra).toBe('0')
    expect(rirCero?.rotulo).toBe('RIR')
    expect(rirCero?.que).not.toBe(alFallo?.que)
  })

  it('una repetición en reserva se dice en singular', () => {
    const uno = lecturaDeLaPrescripcion(ejercicio({ rirObjetivo: 1 })).at(-1)
    expect(uno?.que).toContain('1 repetición')
    expect(uno?.que).not.toContain('1 repeticiones')
  })

  it('la franja cambia el POR QUÉ, no solo la cifra', () => {
    const fuerza = lecturaDeLaPrescripcion(ejercicio({ repsDiana: 5 }))[1]
    const hipertrofia = lecturaDeLaPrescripcion(ejercicio({ repsDiana: 12 }))[1]
    expect(fuerza.porque).toContain('fuerza')
    expect(hipertrofia.porque).toContain('hipertrofia')
    expect(fuerza.porque).not.toBe(hipertrofia.porque)
  })

  it('no redondea el descanso ni le cambia la coma', () => {
    // 1,5 min es 1,5, no 2. Y en español la coma decimal no es un punto.
    const descanso = lecturaDeLaPrescripcion(ejercicio({ descansoMin: 1.5 }))[2]
    expect(descanso.cifra).toBe('1,5')
    expect(descanso.matiz).toBe('min')
    expect(descanso.que).toContain('1,5')
  })

  it('una sola serie no se lee en plural', () => {
    expect(lecturaDeLaPrescripcion(ejercicio({ sets: 1 }))[0].que).toContain('1 bloque de')
  })

  it('el rango acompaña a la diana, pero NO va dentro de la cifra', () => {
    // Se separó mirando la pantalla: con el rango dentro, «8 (8-10)» no cabía en la
    // columna de 86 px y se partía en tres renglones. Una cifra que parte palabras deja
    // de leerse como una cifra — es el mismo fallo que ya se corrigió en el muro.
    const conRango = lecturaDeLaPrescripcion(ejercicio({ rango: '(8-10)' }))[1]
    expect(conRango.cifra).toBe('8')
    expect(conRango.matiz).toBe('(8-10)')
    const sinRango = lecturaDeLaPrescripcion(ejercicio({ rango: '' }))[1]
    expect(sinRango.cifra).toBe('8')
    expect(sinRango.matiz).toBeUndefined()
    expect(sinRango.que).not.toContain('rango')
  })

  it('ninguna cifra lleva unidad ni paréntesis dentro', () => {
    // La regla, para las cuatro y para las que vengan: la cifra es lo que se compara de
    // una semana a otra. La unidad y la horquilla van en el matiz.
    for (const l of lecturaDeLaPrescripcion(ejercicio({ descansoMin: 1.5 }))) {
      expect(l.cifra, `${l.id} mete algo más que la cifra`).not.toMatch(/[()\s]/)
    }
  })
})
