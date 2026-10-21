import { describe, expect, it } from 'vitest'
import { isValidElement } from 'react'
import { banderaDeMomentos, capaDelSalon } from './capaDelSalon'
import { LecturaDeMomentos } from './LecturaDeMomentos'

describe('la bandera que enciende la capa', () => {
  it('solo ?momentos=ejemplo la enciende', () => {
    expect(banderaDeMomentos('?momentos=ejemplo')).toBe(true)
    expect(banderaDeMomentos('?medir=1&momentos=ejemplo')).toBe(true)
    expect(banderaDeMomentos('')).toBe(false)
    expect(banderaDeMomentos('?momentos=1')).toBe(false)
    expect(banderaDeMomentos('?momentos=real')).toBe(false)
    expect(banderaDeMomentos('?momentos=')).toBe(false)
  })
})

describe('la capa del salón', () => {
  it('apagada: vacía, aunque el ejercicio sea el bueno', () => {
    expect(capaDelSalon(false, 'SENTADILLA', 'Sentadilla con barra')).toEqual({ elementos: [], lineas: [] })
  })
  it('encendida con la sentadilla con barra: tres articulaciones y el texto', () => {
    const c = capaDelSalon(true, 'SENTADILLA', 'Sentadilla con barra')
    expect(c.elementos).toHaveLength(3)
    expect(c.lineas.length).toBe(4)
  })
  it('encendida con otro ejercicio o sin ejercicio: vacía', () => {
    expect(capaDelSalon(true, 'SENTADILLA', 'Sentadilla goblet con mancuerna').elementos).toEqual([])
    expect(capaDelSalon(true, 'PRENSA', 'Prensa de piernas').elementos).toEqual([])
    expect(capaDelSalon(true, undefined, 'Sentadilla con barra').elementos).toEqual([])
    expect(capaDelSalon(true, 'SENTADILLA', undefined).elementos).toEqual([])
  })
})

describe('el texto de la capa', () => {
  it('sin líneas no crea nada', () => {
    expect(LecturaDeMomentos({ capa: { elementos: [], lineas: [] } })).toBeNull()
  })
  it('con líneas crea un nodo que dice que es un sujeto de ejemplo', () => {
    const el = LecturaDeMomentos({ capa: { elementos: [], lineas: ['Cadera: no se dibuja. carga ausente'] } })
    expect(isValidElement(el)).toBe(true)
    expect(JSON.stringify(el)).toContain('Sujeto de ejemplo')
    expect(JSON.stringify(el)).toContain('carga ausente')
  })
})
