import { describe, expect, it } from 'vitest'
import { demoDeEjercicio, demoDePreparacion } from './demos'
import type { Contenido } from './types'

const BIBLIOTECA: Contenido[] = [
  {
    id: 'c-sentadilla',
    tipo: 'video',
    categoria: 'Patrones de movimiento',
    titulo: 'Patrón de sentadilla',
    descripcion: '',
    url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    patronMovimiento: 'Dominante de rodilla',
  },
  {
    id: 'c-bisagra',
    tipo: 'video',
    categoria: 'Patrones de movimiento',
    titulo: 'Patrón de bisagra de cadera',
    descripcion: '',
    url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb',
    patronMovimiento: 'Dominante de cadera',
  },
  {
    id: 'c-traccion',
    tipo: 'video',
    categoria: 'Patrones de movimiento',
    titulo: 'Patrón de tracción',
    descripcion: '',
    url: 'https://www.youtube.com/watch?v=ccccccccccc',
    patronMovimiento: 'Tracción',
  },
  {
    id: 'c-movilidad',
    tipo: 'video',
    categoria: 'Movilidad',
    titulo: 'Movilidad pre-entreno',
    descripcion: '',
    url: 'https://www.youtube.com/watch?v=ddddddddddd',
  },
]

/**
 * El botón «Técnica» dependía de `contenidoDemoId`, un campo que rellena quien
 * carga el microciclo. Los microciclos cargados desde el plan del coach no lo
 * traen, así que el botón no aparecía y el asesorado lo leía como que el vídeo
 * no estaba disponible. Ahora, sin ese id, se resuelve por patrón.
 */
describe('demoDeEjercicio', () => {
  it('respeta el id explícito cuando resuelve', () => {
    const demo = demoDeEjercicio(
      { categoria: 'DOMINANTE DE RODILLA', contenidoDemoId: 'c-bisagra' },
      BIBLIOTECA,
    )
    expect(demo?.id).toBe('c-bisagra')
  })

  it('cae al patrón cuando el ejercicio no trae id — el caso que estaba roto', () => {
    expect(demoDeEjercicio({ categoria: 'DOMINANTE DE CADERA' }, BIBLIOTECA)?.id).toBe('c-bisagra')
    expect(demoDeEjercicio({ categoria: 'DOMINANTE DE RODILLA' }, BIBLIOTECA)?.id).toBe(
      'c-sentadilla',
    )
  })

  it('cae al patrón cuando el id apunta a una ficha que ya no existe', () => {
    const demo = demoDeEjercicio(
      { categoria: 'DOMINANTE DE CADERA', contenidoDemoId: 'c-borrado' },
      BIBLIOTECA,
    )
    expect(demo?.id).toBe('c-bisagra')
  })

  it('las dos tracciones comparten el vídeo de tracción', () => {
    expect(demoDeEjercicio({ categoria: 'TRACCIÓN VERTICAL' }, BIBLIOTECA)?.id).toBe('c-traccion')
    expect(demoDeEjercicio({ categoria: 'TRACCIÓN HORIZONTAL' }, BIBLIOTECA)?.id).toBe('c-traccion')
  })

  it('no le importan las tildes ni las mayúsculas: las dos listas las escriben personas distintas', () => {
    expect(demoDeEjercicio({ categoria: 'traccion vertical' }, BIBLIOTECA)?.id).toBe('c-traccion')
    expect(demoDeEjercicio({ categoria: 'Dominante de Cadera' }, BIBLIOTECA)?.id).toBe('c-bisagra')
  })

  it('devuelve undefined donde no hay patrón que enseñar', () => {
    expect(demoDeEjercicio({ categoria: 'CORE' }, BIBLIOTECA)).toBeUndefined()
    expect(demoDeEjercicio({ categoria: '' }, BIBLIOTECA)).toBeUndefined()
  })
})

describe('demoDePreparacion', () => {
  it('la movilidad cae a la rutina de movilidad cuando el id no resuelve', () => {
    expect(demoDePreparacion({ tipo: 'movilidad' }, BIBLIOTECA)?.id).toBe('c-movilidad')
    expect(demoDePreparacion({ tipo: 'movilidad', contenidoDemoId: 'c-borrado' }, BIBLIOTECA)?.id).toBe(
      'c-movilidad',
    )
  })

  it('el calentamiento sin id se queda sin demo', () => {
    expect(demoDePreparacion({ tipo: 'calentamiento' }, BIBLIOTECA)).toBeUndefined()
  })
})
