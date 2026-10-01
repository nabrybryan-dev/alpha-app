// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { horaDeCita, minutosDeCita, ordinalDeCita, valorDeCita, valorLiteral } from './numeros.ts'

/**
 * Los números que el registrador saca de una frase acaban en un registro de entreno o de
 * salud. Las formas habituales ya las prueba `numeros.test.ts`; aquí están las raras, que
 * es donde un lector de números se equivoca en silencio: miles con punto, fracciones,
 * «menos cuarto», una hora que no existe.
 *
 * La regla en todas: lo que no se entiende es `null`. Nunca un número parecido.
 */
describe('cifras escritas', () => {
  it('miles con punto y decimales con coma, a la colombiana', () => {
    expect(valorLiteral('12.500')).toBe(12500)
    expect(valorLiteral('1.234,5')).toBe(1234.5)
    expect(valorLiteral('61,2')).toBe(61.2)
  })

  it('una fracción vale lo que vale, y dividir por cero no es un número', () => {
    expect(valorLiteral('3/4')).toBe(0.75)
    expect(valorLiteral('1/0')).toBeNull()
  })

  it('lo que no es una cifra es null', () => {
    expect(valorLiteral('doce')).toBeNull()
    expect(valorLiteral('12kg')).toBeNull()
  })
})

describe('números dichos con palabras', () => {
  it('«mil» solo y con algo delante', () => {
    expect(valorDeCita('mil pasos')).toBe(1000)
    expect(valorDeCita('dos mil quinientos pasos')).toBe(2500)
    expect(valorDeCita('doce mil')).toBe(12000)
  })

  it('«un cuarto» y «tres cuartos»', () => {
    expect(valorDeCita('un cuarto de taza')).toBe(0.25)
    expect(valorDeCita('tres cuartos de taza')).toBe(0.75)
  })
})

describe('el orden de la serie', () => {
  it('ordinales altos, «otra» y «la última»', () => {
    expect(ordinalDeCita('la séptima')).toBe(7)
    expect(ordinalDeCita('en la octava')).toBe(8)
    expect(ordinalDeCita('hice otra')).toBe('otra')
    expect(ordinalDeCita('la última')).toBe('ultima')
  })

  it('un número suelto también vale como orden, y nada es null', () => {
    expect(ordinalDeCita('la 3')).toBe(3)
    expect(ordinalDeCita('la de después')).toBeNull()
    expect(ordinalDeCita(null)).toBeNull()
    expect(ordinalDeCita('')).toBeNull()
  })
})

describe('duraciones', () => {
  it('«hora y cuarto» y «una hora y un cuarto» son 75 minutos', () => {
    expect(minutosDeCita('hora y cuarto')).toBe(75)
    expect(minutosDeCita('una hora y un cuarto')).toBe(75)
  })

  it('«una hora y veinte» son 80, y «dos horas» sin más son 120', () => {
    expect(minutosDeCita('una hora y veinte')).toBe(80)
    expect(minutosDeCita('dos horas')).toBe(120)
  })

  it('unas horas que no dicen cuántas no son una duración', () => {
    expect(minutosDeCita('muchas horas')).toBeNull()
    expect(minutosDeCita('un rato largo')).toBeNull()
    expect(minutosDeCita(undefined)).toBeNull()
  })
})

describe('la hora de acostarse y de levantarse', () => {
  it('una hora de reloj se respeta; al acostarse, las diez y media son de la noche', () => {
    expect(horaDeCita('a las 10:30', 'acostarse')).toBe('22:30')
    expect(horaDeCita('a las 6.15', 'levantarse')).toBe('06:15')
  })

  it('«y cuarto» y «menos cuarto» no se cuelan en la hora', () => {
    expect(horaDeCita('a las seis y cuarto', 'levantarse')).toBe('06:15')
    expect(horaDeCita('a las siete menos cuarto', 'levantarse')).toBe('06:45')
  })

  it('LÍMITE CONOCIDO: «las cinco y veinte» no se entiende, y por eso no se anota', () => {
    // El lector de números une «cinco y veinte» como si fuera «cuarenta y cinco» y le sale 25,
    // que no es una hora. Devuelve null —no inventa las 05:20 ni las 01:00—, así que la persona
    // tendría que decirla de otra forma («5:20»). Si un día se arregla, esta prueba cambia a '05:20'.
    expect(horaDeCita('a las cinco y veinte', 'levantarse')).toBeNull()
    expect(horaDeCita('a las 5:20', 'levantarse')).toBe('05:20')
  })

  it('las doce de la noche al acostarse son las 00:00, y «de la mañana» manda sobre el contexto', () => {
    expect(horaDeCita('a las doce', 'acostarse')).toBe('00:00')
    expect(horaDeCita('a las doce de la mañana', 'levantarse')).toBe('00:00')
    expect(horaDeCita('a las dos de la mañana', 'acostarse')).toBe('02:00')
    expect(horaDeCita('a las ocho de la noche', 'levantarse')).toBe('20:00')
  })

  it('una hora que no existe o que no trae número es null, no una hora parecida', () => {
    expect(horaDeCita('a las 26', 'acostarse')).toBeNull()
    expect(horaDeCita('a las 11:75', 'acostarse')).toBeNull()
    expect(horaDeCita('tarde', 'acostarse')).toBeNull()
    expect(horaDeCita('a las 25:10', 'levantarse')).toBeNull()
    expect(horaDeCita(null, 'levantarse')).toBeNull()
  })
})
