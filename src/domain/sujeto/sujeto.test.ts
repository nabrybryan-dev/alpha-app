import { describe, expect, it } from 'vitest'
import { _soloParaTests as dempster } from '../patrones/gravedad'
import { DE_LEVA, SEGMENTOS, SEGMENTOS_PARES, sumaDeFracciones } from './deleva'
import { construirSujeto, masaDeLosSegmentos } from './sujeto'

/**
 * ARNÉS DE LA FASE 1 (M3). Verdad: la propia tabla impresa de de Leva 1996 (suma de masas y
 * valores puntuales leídos en el PDF) y la aritmética de escala, que se escribe a mano.
 * El cotejo valor por valor contra el PDF lo hace `scripts/cotejar-deleva-con-pdf.py`.
 */

describe('la suma de fracciones de masa', () => {
  it('varones: 1,0000 dentro de 1,5e-4', () => {
    expect(Math.abs(sumaDeFracciones('h') - 1)).toBeLessThanOrEqual(1.5e-4)
  })
  it('mujeres: 0,9999 (redondeo del artículo), dentro de 1,5e-4 y SIN renormalizar', () => {
    const s = sumaDeFracciones('m')
    expect(Math.abs(s - 1)).toBeLessThanOrEqual(1.5e-4)
    expect(s).toBeCloseTo(0.9999, 10)
  })
  it('un varón de 80 kg: las masas de los segmentos suman masa x suma de fracciones', () => {
    const s = construirSujeto({ sexo: 'h', talla: 1.8, masa: 80 })!
    expect(Math.abs(masaDeLosSegmentos(s) - 80 * s.sumaDeFracciones) / 80).toBeLessThanOrEqual(1e-9)
  })
})

describe('valores puntuales leídos en el artículo (Tabla 4)', () => {
  // Escritos a mano desde la imagen de la página, no copiados del código.
  it('varones: muslo 14,16 % con CM al 40,95 %; tibia 4,33 % al 43,95 % (extremos KJC-AJC)', () => {
    const t = DE_LEVA.h.segmentos
    expect(t.muslo.masa).toBe(0.1416)
    expect(t.muslo.cm).toBe(0.4095)
    expect(t.tibia.masa).toBe(0.0433)
    expect(t.tibia.cm).toBe(0.4395)
  })
  it('mujeres: muslo 14,78 % al 36,12 %; tronco 42,57 % al 41,51 %', () => {
    const t = DE_LEVA.m.segmentos
    expect(t.muslo.masa).toBe(0.1478)
    expect(t.muslo.cm).toBe(0.3612)
    expect(t.tronco.masa).toBe(0.4257)
    expect(t.tronco.cm).toBe(0.4151)
  })
})

describe('escala a la talla', () => {
  it('en la estatura de referencia el largo es el de la tabla', () => {
    const s = construirSujeto({ sexo: 'h', talla: 1.741, masa: 73 })!
    for (const n of SEGMENTOS) expect(Math.abs(s.segmentos[n].largoM - DE_LEVA.h.segmentos[n].largo)).toBeLessThanOrEqual(1e-12)
  })
  it('a media estatura, medio largo; a doble, doble', () => {
    const a = construirSujeto({ sexo: 'm', talla: 1.735 / 2 + 0.9, masa: 60 })!
    const b = construirSujeto({ sexo: 'm', talla: 1.735, masa: 60 })!
    const razon = a.talla / b.talla
    expect(a.segmentos.muslo.largoM / b.segmentos.muslo.largoM).toBeCloseTo(razon, 12)
  })
  it('la masa no cambia los largos y la talla no cambia las masas', () => {
    const a = construirSujeto({ sexo: 'h', talla: 1.8, masa: 70 })!
    const b = construirSujeto({ sexo: 'h', talla: 1.8, masa: 90 })!
    const c = construirSujeto({ sexo: 'h', talla: 1.7, masa: 70 })!
    expect(a.segmentos.muslo.largoM).toBe(b.segmentos.muslo.largoM)
    expect(a.segmentos.muslo.masaKg).toBe(c.segmentos.muslo.masaKg)
  })
})

describe('sin dato no hay sujeto, y nunca un valor por defecto', () => {
  it.each([
    ['sin talla', { sexo: 'h' as const, talla: null, masa: 80 }],
    ['sin masa', { sexo: 'h' as const, talla: 1.8, masa: undefined }],
    ['talla cero', { sexo: 'h' as const, talla: 0, masa: 80 }],
    ['masa negativa', { sexo: 'm' as const, talla: 1.7, masa: -5 }],
    ['NaN', { sexo: 'm' as const, talla: NaN, masa: 60 }],
    ['talla en centímetros', { sexo: 'm' as const, talla: 170, masa: 60 }],
    ['masa en gramos', { sexo: 'm' as const, talla: 1.7, masa: 60000 }],
    ['sexo desconocido', { sexo: 'x' as never, talla: 1.7, masa: 60 }],
  ])('%s -> null', (_, e) => {
    expect(construirSujeto(e)).toBeNull()
  })
})

describe('cruce contra las fracciones redondeadas que usa hoy el salón (gravedad.ts, Dempster)', () => {
  // Las del salón están por hueso del rig; se agrupan a los segmentos de de Leva.
  const hoy = (huesos: string[]) =>
    dempster.SEGMENTOS.filter(([h]) => huesos.includes(h)).reduce((s, [, f]) => s + f, 0)
  const grupos: [string, string[], number][] = [
    ['cabeza y cuello', ['cuello', 'craneo'], DE_LEVA.h.segmentos.cabeza.masa],
    ['tronco con pelvis', ['pelvis', 'lumbar', 'torax'], DE_LEVA.h.segmentos.tronco.masa],
    ['muslo (uno)', ['musloD'], DE_LEVA.h.segmentos.muslo.masa],
    ['tibia (una)', ['tibiaD'], DE_LEVA.h.segmentos.tibia.masa],
    ['pie (uno)', ['pieD'], DE_LEVA.h.segmentos.pie.masa],
    ['brazo (uno)', ['brazoD'], DE_LEVA.h.segmentos.brazo.masa],
  ]
  it('la tabla actual del salón suma 1 (las dos mitades contadas)', () => {
    expect(dempster.SEGMENTOS.reduce((s, [, f]) => s + f, 0)).toBeCloseTo(1, 12)
  })
  it('DIFERENCIAS DECLARADAS > 0,01 de fracción (varones): tronco, muslo y cabeza; el resto coincide', () => {
    const grandes = grupos
      .map(([nombre, huesos, leva]) => ({ nombre, dif: hoy(huesos) - leva }))
      .filter((g) => Math.abs(g.dif) > 0.01)
      .map((g) => `${g.nombre}: ${g.dif.toFixed(4)}`)
    // Salón (Dempster) menos de Leva. El muslo del salón es 0,100 y el de de Leva 0,1416:
    // mueve el momento de cadera y de rodilla, y por eso importa declararlo.
    expect(grandes).toEqual(['cabeza y cuello: 0.0116', 'tronco con pelvis: 0.0624', 'muslo (uno): -0.0416'])
  })
  it('los pares y no pares están bien contados', () => {
    expect(SEGMENTOS_PARES).not.toContain('cabeza')
    expect(SEGMENTOS_PARES).not.toContain('tronco')
  })
})
