import { beforeEach, describe, expect, it } from 'vitest'
import { guardarHuellaArticular, leerHuellaArticular } from './huellasArticulares'

describe('huellasArticulares', () => {
  beforeEach(() => localStorage.clear())

  const huella = { duracionSeg: 2.2, fase: [1, 0, 1], articular: { rodillaFlex: [0, 110, 0] } }

  it('se guarda por ejercicio y se lee por el mismo nombre, aunque cambie la forma de escribirlo', () => {
    guardarHuellaArticular('Sentadilla goblet', huella)
    expect(leerHuellaArticular('  SENTADILLA  GOBLET ')).toEqual(huella)
    expect(leerHuellaArticular('Remo con barra')).toBeUndefined()
    expect(leerHuellaArticular(undefined)).toBeUndefined()
  })

  it('una huella sin ángulos no cuenta como articular', () => {
    guardarHuellaArticular('Prensa', { duracionSeg: 2, fase: [1, 0, 1] })
    expect(leerHuellaArticular('Prensa')).toBeUndefined()
  })
})
