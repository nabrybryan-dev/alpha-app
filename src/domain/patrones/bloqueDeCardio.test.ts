import { describe, expect, it } from 'vitest'
import { patronDeBloque, patronDeLosBloques } from './bloqueDeCardio'

/**
 * LA MODALIDAD SALE DEL TEXTO DEL BLOQUE, y el texto lo escribe el coach a mano.
 *
 * Los casos son las FORMAS de los 44 títulos reales de los microciclos activos del
 * 2026-09-07 —sin personas, sin cifras que identifiquen a nadie—: lo que cuenta es la
 * variedad de cómo se nombra una caminadora, y cuántos bloques no son cardio en absoluto.
 */

const bloque = (titulo: string, indicaciones = '') => ({ titulo, indicaciones })

describe('patronDeBloque', () => {
  it('reconoce las cinco modalidades por el título', () => {
    expect(patronDeBloque(bloque('40 min caminadora velocidad 6-7'))?.id).toBe('caminata_en_cinta')
    expect(patronDeBloque(bloque('LISS EN CAMINADORA CON PENDIENTE — 20-25 min'))?.id).toBe('caminata_en_cinta')
    expect(patronDeBloque(bloque('40 min escaladora velocidad 8'))?.id).toBe('escaladora')
    expect(patronDeBloque(bloque('CARDIO ZONA 2 - BICICLETA O CAMINADORA SIN INCLINAR — 1×30 min'))?.id).toBe('bicicleta_estatica')
    expect(patronDeBloque(bloque('Elíptica 25 min a ritmo constante'))?.id).toBe('eliptica')
    expect(patronDeBloque(bloque('CARRERA — 5 km, el largo de la semana'))?.id).toBe('carrera_en_cinta')
  })

  it('«caminadora velocidad» es andar, no correr: la carrera solo entra por su palabra', () => {
    expect(patronDeBloque(bloque('40 min caminadora velocidad 6-7'))?.id).toBe('caminata_en_cinta')
    expect(patronDeBloque(bloque('INTERVALOS LARGOS: 5 × 3 min FUERTE / 2 min SUAVE', 'Trote en cinta, el tramo fuerte a RPE 7-8'))?.id).toBe('carrera_en_cinta')
  })

  it('el título manda sobre las indicaciones: la zona 2 se anda aunque las opciones digan bici', () => {
    expect(
      patronDeBloque(bloque('Zona 2 · 30 min', 'Caminadora en pendiente, bici o elíptica, a ritmo conversacional.'))?.id,
    ).toBe('caminata_en_cinta')
  })

  it('y las indicaciones cuentan cuando el título no dice nada', () => {
    expect(patronDeBloque(bloque('CARDIO PEGADO AL FINAL — 1×15 min estado estable', '15 min de bici a ritmo sostenible'))?.id).toBe('bicicleta_estatica')
  })

  it('lo que no es cardio no tiene sujeto, y en la cartera es la mayoría', () => {
    // Notas del coach, pasos diarios, estiramientos, propiocepción: `bloquesCardio` lo lleva
    // todo, y a nada de esto le toca un muñeco andando.
    for (const titulo of [
      'LO PRIMERO: TU ESPALDA MANDA ESTA SEMANA',
      'PASOS: 10.000 AL DÍA COMO PISO',
      'STRETCHING PASIVO — 1×5 min',
      'PROPIOCEPCIÓN — 3×30 seg por pierna',
      'MOVILIDAD DE CIERRE: cadera, tobillo y torácica — 1×10 min',
      'EVA LUMBAR EN CADA DÍA DE PIERNA',
    ]) {
      expect(patronDeBloque(bloque(titulo, 'Léelo antes de empezar.')), titulo).toBeUndefined()
    }
  })

  it('«8.000 PASOS AL DÍA» no es una caminata en cinta', () => {
    // «Pasos» no es una modalidad: es el NEAT del día, y no ocurre en el salón.
    expect(patronDeBloque(bloque('8.000 PASOS AL DÍA', 'Repártelos en caminatas cortas por la calle.'))).toBeUndefined()
  })

  it('de una sesión, el primer bloque con sujeto', () => {
    expect(
      patronDeLosBloques([bloque('LEE ESTO PRIMERO'), bloque('35 min escaladora + 10.000 pasos/día'), bloque('40 min caminadora')])?.id,
    ).toBe('escaladora')
    expect(patronDeLosBloques([bloque('STRETCHING FINAL DE SEMANA — 1×10 min')])).toBeUndefined()
    expect(patronDeLosBloques(undefined)).toBeUndefined()
  })
})
