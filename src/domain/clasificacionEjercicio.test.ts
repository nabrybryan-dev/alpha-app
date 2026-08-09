import { describe, expect, it } from 'vitest'
import { claseDeEjercicio } from './clasificacionEjercicio'

describe('claseDeEjercicio', () => {
  it('la bisagra de cadera es compuesta y de cadena posterior', () => {
    expect(claseDeEjercicio('BISAGRA DE CADERA')).toBe('Compuesto · Cadena posterior')
  })

  it('la sentadilla es compuesta y de cadena anterior', () => {
    expect(claseDeEjercicio('SENTADILLAS')).toBe('Compuesto · Cadena anterior')
  })

  it('la extensión de rodilla es aislamiento, no compuesto: mueve una articulación', () => {
    expect(claseDeEjercicio('AISLAMIENTO CUÁDRICEPS')).toBe('Aislamiento · Cadena anterior')
  })

  it('la tracción vertical es compuesta y posterior', () => {
    expect(claseDeEjercicio('TRACCIÓN VERTICAL')).toBe('Compuesto · Cadena posterior')
  })

  it('el glúteo aislado es aislamiento y posterior', () => {
    expect(claseDeEjercicio('AISLAMIENTO GLÚTEOS')).toBe('Aislamiento · Cadena posterior')
  })

  it('aductores y deltoides lateral caen en cadena lateral', () => {
    expect(claseDeEjercicio('ADUCTORES')).toBe('Aislamiento · Cadena lateral')
    expect(claseDeEjercicio('DELTOIDES LATERALES')).toBe('Aislamiento · Cadena lateral')
  })

  it('el abdomen es core', () => {
    expect(claseDeEjercicio('ABDOMEN')).toBe('Aislamiento · Core')
  })

  it('funciona con o sin tildes: en la base conviven las dos formas', () => {
    expect(claseDeEjercicio('TRACCION HORIZONTAL')).toBe(claseDeEjercicio('TRACCIÓN HORIZONTAL'))
  })

  it('la pierna unilateral es compuesta', () => {
    expect(claseDeEjercicio('PIERNA UNILATERAL')).toBe('Compuesto · Cadena anterior')
  })

  // Inventarle una clase a un patrón desconocido sería peor que no decir nada:
  // el asesorado leería una categoría que nadie decidió.
  it('un patrón fuera de la taxonomía devuelve undefined, no una clase inventada', () => {
    expect(claseDeEjercicio('PREV/REHAB')).toBeUndefined()
    expect(claseDeEjercicio('ACONDICIONAMIENTO')).toBeUndefined()
    expect(claseDeEjercicio('CUALQUIER COSA')).toBeUndefined()
  })

  it('sin patrón devuelve undefined', () => {
    expect(claseDeEjercicio(undefined)).toBeUndefined()
    expect(claseDeEjercicio('')).toBeUndefined()
  })
})
