import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from '../src/domain/patrones/catalogo'
import {
  angulosArticulares,
  claveDeCuerpo,
  definicionDe,
  encuadreDe,
  esqueletoDeFase,
  trazaDe,
} from '../src/domain/patrones/definicionCorporal'
import { puntoDeHueso } from '../src/domain/patrones/esqueleto'
import { ESQUELETO } from '../src/domain/patrones/esqueleto'
import { esqueletoDe, JUEGOS } from '../src/domain/patrones/juegoDeHuesos'
import type { ProporcionesDelCuerpo } from '../src/domain/patrones/huellaArticular'

/**
 * VERIFICACIÓN INDEPENDIENTE de `src/domain/patrones/definicionCorporal.ts` (rama
 * `capa/datos`, ya fusionada aquí). El módulo ya trae su propio
 * `src/domain/patrones/definicionCorporal.test.ts`, con su propia prueba de fémur ±15 %
 * sobre la MALLA (extensión geométrica del hueso). Esta capa no repite esa prueba: verifica
 * el mismo contrato desde fuera, con otro ángulo —identidad de caché, el punto exacto donde
 * `claveDeCuerpo` redondea, y que encuadre/traza/ángulos salen de la MISMA definición y no
 * de un cuerpo genérico, que es «el fallo que cierra» según el propio módulo.
 *
 * Contra `origin/capa/datos`:
 *   npx vitest run pruebas/definicion-corporal.test.ts pruebas/encuesta-de-medidas.test.ts
 */

const PATRON = PATRON_POR_ID.sentadilla

/** Un juego de proporciones de mentira, con el fémur como único grado de libertad. */
function proporciones(femur: number): ProporcionesDelCuerpo {
  return { femur, tibia: 0.24, torso: 0.32, humero: 0.11, antebrazo: 0.1, fotogramas: 30 }
}

describe('caso feliz: el camino por defecto no cambia ni un byte', () => {
  it('sin estatura ni proporciones, definicionDe da el esqueleto de siempre', () => {
    expect(definicionDe('hombre').huesos).toBe(esqueletoDe('hombre'))
    expect(definicionDe('neutro').huesos).toBe(ESQUELETO)
    expect(definicionDe().huesos).toBe(esqueletoDe('hombre'))
    expect(definicionDe('hombre').juego).toBe(JUEGOS.hombre)
  })

  it('claveDeCuerpo sin estatura ni proporciones es solo el sexo', () => {
    expect(claveDeCuerpo('hombre')).toBe('hombre')
    expect(claveDeCuerpo('mujer')).toBe('mujer')
  })
})

describe('identidad estable: el mismo cuerpo es el mismo objeto', () => {
  it('devuelve el mismo objeto para las mismas tres entradas', () => {
    const a = definicionDe('hombre', 180, proporciones(0.26))
    const b = definicionDe('hombre', 180, proporciones(0.26))
    expect(a).toBe(b)
  })

  it('y otro objeto para un cuerpo distinto', () => {
    const a = definicionDe('hombre', 180, proporciones(0.26))
    const b = definicionDe('hombre', 180, proporciones(0.22))
    expect(a).not.toBe(b)
    expect(a.huesos).not.toBe(b.huesos)
  })
})

describe('borde: dónde redondea claveDeCuerpo a la milésima', () => {
  // `claveDeCuerpo` usa `toFixed(3)` sobre cada razón. Dos proporciones que caigan en el
  // mismo milésimo son, a todos los efectos, el mismo cuerpo — y dos que caigan en
  // milésimos distintos, dos cuerpos, aunque la diferencia de entrada sea mínima.
  it('dos proporciones que redondean al mismo milésimo comparten clave y definición cacheada', () => {
    const clave1 = claveDeCuerpo('hombre', 175, proporciones(0.25051))
    const clave2 = claveDeCuerpo('hombre', 175, proporciones(0.25054))
    expect(clave1).toBe(clave2)
    expect(definicionDe('hombre', 175, proporciones(0.25051))).toBe(
      definicionDe('hombre', 175, proporciones(0.25054)),
    )
  })

  it('dos proporciones que redondean a milésimos distintos son claves distintas', () => {
    const clave1 = claveDeCuerpo('hombre', 175, proporciones(0.2505))
    const clave2 = claveDeCuerpo('hombre', 175, proporciones(0.2495))
    expect(clave1).not.toBe(clave2)
  })
})

describe('el fallo que cierra: encuadre y traza salen del MISMO cuerpo que la malla', () => {
  // Antes de este módulo, el encuadre y la traza salían de `esqueletoDe(sexo)` —un cuerpo
  // genérico— mientras la malla salía de la definición real. Si esto sigue roto, un cuerpo
  // con un fémur muy distinto del atlas tendría el MISMO encuadre y la MISMA traza que el
  // cuerpo por defecto, porque ninguno de los dos miraría sus proporciones.
  const porDefecto = definicionDe('hombre', 175)
  const conFemurCorto = definicionDe('hombre', 175, proporciones(0.19))

  it('el encuadre de un cuerpo con proporciones marcadas no es el del cuerpo por defecto', () => {
    expect(encuadreDe(conFemurCorto, PATRON)).not.toEqual(encuadreDe(porDefecto, PATRON))
  })

  it('la traza tampoco lo es', () => {
    expect(trazaDe(conFemurCorto, PATRON)).not.toEqual(trazaDe(porDefecto, PATRON))
  })

  it('y el esqueleto resuelto en fase usa los huesos de SU PROPIA definición', () => {
    const esq = esqueletoDeFase(conFemurCorto, PATRON, 0.5)
    // Verificable desde fuera sin abrir la función: el largo del fémur en el esqueleto
    // resuelto tiene que coincidir con el largo que trae la propia definición, no con el
    // del cuerpo por defecto.
    const largoFemurPropio = conFemurCorto.huesos.find((h) => h.nombre === 'musloD')?.largo
    const largoFemurDefecto = porDefecto.huesos.find((h) => h.nombre === 'musloD')?.largo
    expect(largoFemurPropio).toBeDefined()
    expect(largoFemurPropio).not.toBeCloseTo(largoFemurDefecto ?? -1, 3)
    expect(esq.largo.musloD).toBeCloseTo(largoFemurPropio ?? -1, 6)
  })
})

describe('invariante: mismos ángulos, palancas distintas', () => {
  // Es la frase literal del módulo: «la persona alta y la baja hacen el mismo ejercicio
  // —los mismos ángulos en las mismas fases— con palancas distintas». Si esto se rompiera,
  // el catálogo de patrones habría dejado de mandar sobre la pose y cada estatura haría
  // silenciosamente un ejercicio distinto.
  const baja = definicionDe('hombre', 160)
  const alta = definicionDe('hombre', 200)

  it.each([0, 0.5, 1])('en la fase %s, los ángulos coinciden aunque el cuerpo no', (fase) => {
    const esqBaja = esqueletoDeFase(baja, PATRON, fase)
    const esqAlta = esqueletoDeFase(alta, PATRON, fase)
    const angBaja = angulosArticulares(esqBaja, baja.huesos)
    const angAlta = angulosArticulares(esqAlta, alta.huesos)
    const huesos = Object.keys(angBaja)
    expect(huesos.length).toBeGreaterThan(0)
    for (const hueso of huesos) {
      expect(angAlta[hueso]).toBeCloseTo(angBaja[hueso], 3)
    }
  })

  it('pero las posiciones del mundo SÍ difieren: no son el mismo cuerpo', () => {
    const esqBaja = esqueletoDeFase(baja, PATRON, 0.5)
    const esqAlta = esqueletoDeFase(alta, PATRON, 0.5)
    const rodillaBaja = puntoDeHueso(esqBaja, 'tibiaD', 0)
    const rodillaAlta = puntoDeHueso(esqAlta, 'tibiaD', 0)
    expect(rodillaAlta).not.toEqual(rodillaBaja)
  })
})
