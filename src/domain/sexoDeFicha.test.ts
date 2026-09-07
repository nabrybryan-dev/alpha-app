import { describe, expect, it } from 'vitest'
import { SEXOS_DE_FICHA, esSexoDeFicha } from './sexoDeFicha'

describe('el sexo de la ficha', () => {
  it('admite exactamente lo que el coach puede indicar', () => {
    expect(SEXOS_DE_FICHA).toEqual(['hombre', 'mujer'])
    for (const sexo of SEXOS_DE_FICHA) expect(esSexoDeFicha(sexo)).toBe(true)
  })

  it('no confunde el genero de la encuesta de nutricion con el sexo de la ficha', () => {
    // La encuesta guarda 'M' y 'H'; si un dia una carga por SQL colara esos
    // codigos en la columna, el visor no debe dibujar nada con ellos.
    expect(esSexoDeFicha('M')).toBe(false)
    expect(esSexoDeFicha('H')).toBe(false)
    expect(esSexoDeFicha('F')).toBe(false)
  })

  it('lo que no es texto no es un sexo: null es «sin indicar»', () => {
    expect(esSexoDeFicha(null)).toBe(false)
    expect(esSexoDeFicha(undefined)).toBe(false)
    expect(esSexoDeFicha(1)).toBe(false)
    expect(esSexoDeFicha('')).toBe(false)
    expect(esSexoDeFicha('Mujer')).toBe(false)
  })
})
