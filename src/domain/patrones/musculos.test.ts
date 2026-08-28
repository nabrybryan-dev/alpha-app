import { describe, expect, it } from 'vitest'
import { PORCION_POR_CLAVE, PORCIONES, radioDePorcion } from './musculos'

describe('el grosor a lo largo del músculo', () => {
  const RADIO = 0.02

  it('es fino en los extremos y grueso en el vientre', () => {
    // Un músculo no es un tubo: son dos tendones y un vientre.
    const centro = radioDePorcion(0.5, RADIO, 1, 1)
    for (const t of [0, 1]) {
      expect(centro, `t=${t}`).toBeGreaterThan(radioDePorcion(t, RADIO, 1, 1) * 3)
    }
  })

  it('engorda el vientre al acortarse', () => {
    // Volumen constante: lo que pierde de largo lo gana de ancho, que es lo que
    // hay que ver de un patrón.
    const reposo = radioDePorcion(0.5, RADIO, 1, 1)
    const contraido = radioDePorcion(0.5, RADIO, 1.4, 1)
    expect(contraido).toBeGreaterThan(reposo * 1.3)
  })

  it('deja el tendón igual por mucho que se contraiga', () => {
    // Un tendón es colágeno: transmite fuerza y no cambia de grosor. Antes el
    // ensanche se aplicaba al tubo entero y el músculo se movía como una goma.
    for (const t of [0, 0.01, 0.99, 1]) {
      const reposo = radioDePorcion(t, RADIO, 1, 1)
      const contraido = radioDePorcion(t, RADIO, 1.55, 1)
      expect(contraido / reposo, `en t=${t} el tendón engorda`).toBeLessThan(1.06)
    }
  })

  it('reparte el engorde según lo carnoso que sea cada punto', () => {
    // No es un interruptor: entre el tendón y el vientre hay transición, o se
    // vería un escalón donde el músculo cambia de grosor de golpe.
    const razon = (t: number) => radioDePorcion(t, RADIO, 1.5, 1) / radioDePorcion(t, RADIO, 1, 1)
    expect(razon(0.5)).toBeGreaterThan(razon(0.25))
    expect(razon(0.25)).toBeGreaterThan(razon(0.05))
  })
})

describe('la arquitectura de las fibras', () => {
  const porcion = (clave: string) => PORCION_POR_CLAVE[clave].porcion

  it('declara penación solo donde las fibras van oblicuas', () => {
    // Un fusiforme tiene las fibras a lo largo del eje: darle un ángulo sería
    // decir que es penado.
    for (const { porcion: p, clave } of PORCIONES) {
      const arq = p.arquitectura ?? 'fusiforme'
      const oblicua = arq === 'unipenado' || arq === 'bipenado' || arq === 'multipenado'
      if (oblicua) {
        expect(p.penacion, `${clave} es ${arq} y no dice su ángulo`).toBeGreaterThan(0)
      } else {
        expect(p.penacion ?? 0, `${clave} es ${arq} y declara penación`).toBe(0)
      }
    }
  })

  it('mantiene los ángulos dentro de lo que existe en un cuerpo', () => {
    // Los penados humanos van de unos 10° a 30°. Fuera de ahí no es un músculo,
    // es un error de tecleo.
    for (const { porcion: p, clave } of PORCIONES) {
      if (!p.penacion) continue
      expect(p.penacion, clave).toBeGreaterThanOrEqual(8)
      expect(p.penacion, clave).toBeLessThanOrEqual(32)
    }
  })

  it('da a los de manual la arquitectura de manual', () => {
    // Los casos que cualquier libro usa como ejemplo. Si alguno cambia, es que
    // se ha tocado la tabla sin querer.
    expect(porcion('biceps.larga').arquitectura ?? 'fusiforme').toBe('fusiforme')
    expect(porcion('cuadriceps.recto').arquitectura).toBe('bipenado')
    expect(porcion('triceps_sural.gastro_medial').arquitectura).toBe('bipenado')
    expect(porcion('deltoides.medio').arquitectura).toBe('multipenado')
    expect(porcion('cuadriceps.vasto_lateral').arquitectura).toBe('unipenado')
    expect(porcion('pectoral_mayor.esternocostal').arquitectura).toBe('convergente')
  })

  it('el sóleo es el más penado de todos', () => {
    // Es lo que le permite meter tanta fuerza en tan poco recorrido, y es la
    // razón de que aguante el peso del cuerpo todo el día.
    const suyo = porcion('triceps_sural.soleo').penacion ?? 0
    for (const { porcion: p, clave } of PORCIONES) {
      if (clave === 'triceps_sural.soleo') continue
      expect(p.penacion ?? 0, clave).toBeLessThanOrEqual(suyo)
    }
  })
})
