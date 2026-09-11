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
    // Con kilómetros de por medio ya no es la cinta: ver «la carrera de la calle» más abajo.
    expect(patronDeBloque(bloque('CARRERA — 40 min de trote'))?.id).toBe('carrera_en_cinta')
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

  it('lo que no es MOVIMIENTO no tiene sujeto: notas, pasos y estiramiento global', () => {
    // Esta prueba pedía antes que la propiocepción y la movilidad tampoco tuvieran sujeto, y
    // eso CAMBIÓ el 2026-09-10: los dos son gestos, los dos ya tenían ficha en el catálogo y
    // los dos se prescriben en la cartera. Lo que sigue sin muñeco es lo que no es un gesto.
    for (const titulo of [
      'LO PRIMERO: TU ESPALDA MANDA ESTA SEMANA',
      'PASOS: 10.000 AL DÍA COMO PISO',
      'STRETCHING PASIVO — 1×5 min',
      'CIRCUITO 20/10 × 4 RONDAS — 6 ejercicios',
      'EVA LUMBAR EN CADA DÍA DE PIERNA',
    ]) {
      expect(patronDeBloque(bloque(titulo, 'Léelo antes de empezar.')), titulo).toBeUndefined()
    }
  })

  it('la movilidad y la propiocepción SÍ son gestos, y su ficha ya existía', () => {
    // Cinco bloques de la cartera activa se quedaban sin muñeco por no tener camino hasta
    // una ficha que llevaba meses escrita. No hubo que dibujar nada nuevo: hubo que llegar.
    expect(patronDeBloque(bloque('PROPIOCEPCIÓN — 3×30 seg por pierna'))?.id).toBe('apoyo_una_pierna')
    expect(patronDeBloque(bloque('EQUILIBRIO MONOPODAL — 3×30 seg'))?.id).toBe('apoyo_una_pierna')
    expect(patronDeBloque(bloque('MOVILIDAD DINÁMICA + CARDIO SUAVE — 1×8 min'))?.id).toBe('movilidad_toracica')
  })

  it('en una secuencia de movilidad manda la región que va PRIMERA en el texto', () => {
    // «Cadera, tobillo y torácica» no son alternativas: se hacen las tres, y la primera es
    // por donde se empieza. Es lo contrario que en las modalidades, donde manda la lista
    // porque «bici o caminadora» es elegir una.
    expect(patronDeBloque(bloque('MOVILIDAD DE CIERRE: cadera, tobillo y torácica — 1×10 min'))?.id).toBe('rotacion_cadera')
    expect(patronDeBloque(bloque('MOVILIDAD: tobillo y cadera — 1×8 min'))?.id).toBe('dorsiflexion')
    expect(patronDeBloque(bloque('MOVILIDAD TORÁCICA — 1×6 min'))?.id).toBe('movilidad_toracica')
  })

  it('la carrera de la calle no lleva cinta debajo', () => {
    // Cuatro bloques de la cartera son salidas a correr —«5 km por la tarde»— y se dibujaban
    // encima de una caminadora. El salón es un gimnasio, así que sin ninguna pista la cinta
    // sigue siendo lo que toca; lo que no puede pasar es dibujar lo que el texto desmiente.
    expect(patronDeBloque(bloque('CARRERA — 5 km, el largo de la semana'))?.id).toBe('carrera_al_aire')
    expect(patronDeBloque(bloque('CARRERA — 3 km con cambios de ritmo', 'Por la tarde.'))?.id).toBe('carrera_al_aire')
    expect(patronDeBloque(bloque('TROTE POR EL PARQUE — 30 min'))?.id).toBe('carrera_al_aire')
    expect(patronDeBloque(bloque('CARRERA EN CINTA — 30 min'))?.id).toBe('carrera_en_cinta')
    // «Cinta» a secas es andar en esta casa —«40 min caminadora velocidad 6-7»—, así que
    // para que sea correr hay que decirlo: la carrera va antes que la caminata en la lista.
    expect(patronDeBloque(bloque('INTERVALOS DE CARRERA EN CINTA — 8 × 400'))?.id).toBe('carrera_en_cinta')
    expect(patronDeBloque(bloque('INTERVALOS EN CINTA — 8 × 400'))?.id).toBe('caminata_en_cinta')
  })

  it('una NOTA que habla de un gesto sigue siendo una nota', () => {
    // «POR QUÉ HOY NO HAY CIRCUITO», cuyas indicaciones dicen «hoy caminas y trabajas
    // equilibrio», salía con muñeco de apoyo monopodal: la nota EXPLICA el trabajo, no lo es.
    // Por eso los gestos se leen solo del título.
    expect(
      patronDeBloque(bloque('POR QUÉ HOY NO HAY CIRCUITO — léelo', 'Hoy caminas y trabajas equilibrio, que suma y no castiga.')),
    ).toBeUndefined()
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
