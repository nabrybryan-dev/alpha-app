import { describe, expect, it } from 'vitest'
import { loQuePasaAlGuardar } from './despuesDeGuardar'
import type { EjercicioPrescrito, SerieRegistrada } from '../../../../domain/types'

/**
 * LO QUE PASA AL GUARDAR, PROBADO.
 *
 * Las cuatro cosas que dispara guardar una serie no ocurren todas siempre, y la que más
 * duele si se equivoca es el descanso: una cuenta atrás que arranca donde no toca es una
 * instrucción que el coach no dio y que el asesorado va a obedecer.
 */

function serie(orden: number): SerieRegistrada {
  return { orden, cargaKg: 80, reps: 8, rir: 2 }
}

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

describe('loQuePasaAlGuardar', () => {
  it('una serie intermedia arranca el descanso pautado y dice por dónde vas', () => {
    const r = loQuePasaAlGuardar(ejercicio({ series: [serie(1)] }), 'Eso ya no te lo quita nadie')
    expect(r.descansoSeg).toBe(180)
    expect(r.cierraElEjercicio).toBe(false)
    expect(r.rotulo).toBe('Serie 1 de 3')
  })

  it('la ÚLTIMA serie no arranca descanso, y esa es la regla que más importa', () => {
    // El descanso pautado es el que va ENTRE series del mismo ejercicio. Al cerrar el
    // ejercicio lo que viene es otro, con su propia primera serie: tres minutos de cuenta
    // atrás ahí serían una instrucción que nadie prescribió.
    const r = loQuePasaAlGuardar(ejercicio({ series: [serie(1), serie(2), serie(3)] }), 'Serie firmada')
    expect(r.descansoSeg).toBe(0)
    expect(r.cierraElEjercicio).toBe(true)
    expect(r.rotulo).toBe('Press de banca con barra · completado')
  })

  it('un ejercicio de una sola serie se cierra con la primera', () => {
    const r = loQuePasaAlGuardar(ejercicio({ sets: 1, series: [serie(1)] }), 'Ahí se construye')
    expect(r.cierraElEjercicio).toBe(true)
    expect(r.descansoSeg).toBe(0)
  })

  it('sin descanso prescrito no arranca ninguna cuenta', () => {
    // Hay trabajo que no descansa. Cero es cero, no «el de por defecto».
    const r = loQuePasaAlGuardar(ejercicio({ descansoMin: 0, series: [serie(1)] }), 'Una menos')
    expect(r.descansoSeg).toBe(0)
    expect(r.cierraElEjercicio).toBe(false)
  })

  it('la cuenta sale de las series ESCRITAS, no de sumar uno a mano', () => {
    // Se relee de la base después de registrar. Si esto contara por su cuenta, un guardado
    // que fallara a medias dejaría al salón diciendo una serie que no existe.
    const r = loQuePasaAlGuardar(ejercicio({ series: [serie(1), serie(2)] }), 'Ahí se construye')
    expect(r.rotulo).toBe('Serie 2 de 3')
  })

  it('la frase se transporta tal cual: aquí no se sortea ninguna', () => {
    expect(loQuePasaAlGuardar(ejercicio({ series: [serie(1)] }), 'Eso es disciplina alfa').frase).toBe(
      'Eso es disciplina alfa',
    )
  })
})
