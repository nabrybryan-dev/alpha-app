import { describe, expect, it } from 'vitest'
import { lecturaDeAngulo } from './motivosEncuadre'

/**
 * En la columna del ángulo solo cabe una cifra.
 *
 * El consejo iba DENTRO del valor y en un móvil de verdad reventó la barra: la frase
 * desbordaba la columna, se partía en cuatro líneas y empujaba a fps y marcas fuera de
 * su sitio. La barra que decide si la toma sirve dejaba de leerse justo con la cámara
 * abierta y el teléfono en el trípode — que es el único momento en que se mira.
 *
 * Se vio en una captura de un iPhone, no en un test, y por eso ahora hay test.
 */

const base = {
  inclinacionGrados: 8,
  giroGrados: 4,
  escorzoDescarta: false,
  escorzoAvisa: false,
  giroAvisa: false,
}

describe('la lectura del ángulo', () => {
  it('el valor es siempre corto, pase lo que pase', () => {
    // La condición que se rompió. Con los tres avisos encendidos a la vez —el caso
    // peor— el valor tiene que seguir cabiendo en una columna de instrumento.
    const peor = {
      inclinacionGrados: 81,
      giroGrados: -124,
      escorzoDescarta: true,
      escorzoAvisa: true,
      giroAvisa: true,
    }
    const l = lecturaDeAngulo(peor)
    expect(l.valor.length).toBeLessThanOrEqual(12)
    expect(l.valor).toBe('81° · 124°')
  })

  it('el giro se enseña en positivo: es cuánto está torcida, no hacia qué lado', () => {
    expect(lecturaDeAngulo({ ...base, giroGrados: -37 }).valor).toContain('37')
  })

  it('sin nada que avisar, el consejo va vacío y no ocupa alto', () => {
    expect(lecturaDeAngulo(base).consejo).toBe('')
  })

  it('el escorzo que descarta manda sobre el que solo avisa', () => {
    // Los dos hablan de lo mismo —la diana mirada de canto— así que enseñar los dos
    // sería decir dos veces lo mismo con distinta gravedad.
    const l = lecturaDeAngulo({ ...base, escorzoDescarta: true, escorzoAvisa: true })
    expect(l.consejo).toContain('endereza la cámara')
    expect(l.consejo).not.toContain('se descartará')
  })

  it('el giro es OTRA cosa que el escorzo, y se dicen los dos', () => {
    // Costó una sesión entera: la inclinación es escorzo —la diana de canto— y el giro
    // es la diana torcida como un cuadro mal colgado. La puerta tumba la toma por
    // cualquiera de los dos, así que enseñar solo uno deja grabar en verde tomas que
    // se descartan después.
    const l = lecturaDeAngulo({ ...base, escorzoAvisa: true, giroAvisa: true })
    expect(l.consejo).toContain('escorzo')
    expect(l.consejo).toContain('diana')
  })
})
