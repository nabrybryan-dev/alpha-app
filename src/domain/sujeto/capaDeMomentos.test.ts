import { describe, expect, it } from 'vitest'
import {
  capaDeMomentos,
  esSentadillaConBarra,
  INCERTIDUMBRE_DE_EJEMPLO,
  MOMENTO_DE_ESCALA,
  SUJETO_DE_EJEMPLO,
  type ContextoDeLaCapa,
} from './capaDeMomentos'

const ctx: ContextoDeLaCapa = { categoria: 'SENTADILLA', nombre: 'Sentadilla con barra', sujetoDeEjemplo: true }
const opc = { muestras: 300 }

describe('la capa de momentos con el sujeto de ejemplo', () => {
  const capa = capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)

  it('dibuja tobillo, rodilla y cadera, cada uno con una fracción finita del arco', () => {
    expect(capa.elementos.map((e) => e.articulacion)).toEqual(['tobillo', 'rodilla', 'cadera'])
    for (const e of capa.elementos) {
      expect(Number.isFinite(e.fraccion)).toBe(true)
      expect(e.fraccion).toBeGreaterThan(0)
      expect(e.fraccion).toBeLessThanOrEqual(1)
    }
  })

  it('cada banda ordenada contiene el valor central', () => {
    for (const e of capa.elementos) {
      expect(e.banda).not.toBeNull()
      expect(e.banda!.inf).toBeLessThanOrEqual(e.fraccion)
      expect(e.banda!.sup).toBeGreaterThanOrEqual(e.fraccion)
    }
  })

  it('dice la cifra de cada articulación y la escala del dibujo, sin hablar de músculos ni de pasivo', () => {
    expect(capa.lineas).toHaveLength(4)
    expect(capa.lineas[0]).toMatch(/^Tobillo: \d+ N·m/)
    expect(capa.lineas[2]).toMatch(/banda estimada/)
    expect(capa.lineas[3]).toContain(String(MOMENTO_DE_ESCALA))
    expect(capa.lineas.join(' ')).not.toMatch(/cuádriceps|cuadriceps|gl[uú]teo|isquio|aductor|pasivo/i)
  })

  it('con la misma semilla sale lo mismo', () => {
    expect(capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)).toEqual(capa)
  })
})

describe('la puerta: basta con que falle UNA condición', () => {
  it('un asesorado real no dibuja nada, aunque el ejercicio sea el bueno', () => {
    const r = capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, { ...ctx, sujetoDeEjemplo: false }, opc)
    expect(r).toEqual({ elementos: [], lineas: [] })
  })
  it('el sujeto de ejemplo con otro ejercicio no dibuja nada', () => {
    const otro = { categoria: 'SENTADILLA', nombre: 'Sentadilla goblet con mancuerna', sujetoDeEjemplo: true }
    expect(capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, otro, opc).elementos).toEqual([])
    const peso = { categoria: 'PESO MUERTO', nombre: 'Peso muerto con barra', sujetoDeEjemplo: true }
    expect(capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, peso, opc)).toEqual({ elementos: [], lineas: [] })
  })
  it('ni asesorado real ni ejercicio bueno: tampoco', () => {
    const r = capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, { categoria: 'CURL', nombre: 'Curl', sujetoDeEjemplo: false }, opc)
    expect(r.elementos).toEqual([])
  })
  it('qué es una sentadilla con barra', () => {
    expect(esSentadillaConBarra('SENTADILLA', 'Sentadilla con barra')).toBe(true)
    expect(esSentadillaConBarra('sentadilla', 'SENTADILLA CON BARRA ALTA')).toBe(true)
    expect(esSentadillaConBarra('SENTADILLA', 'Sentadilla en Smith con barra')).toBe(false)
    expect(esSentadillaConBarra('SENTADILLA', 'Sentadilla goblet con barra')).toBe(false)
    expect(esSentadillaConBarra('SENTADILLA', 'Sentadilla con mancuerna')).toBe(false)
    expect(esSentadillaConBarra('PRENSA', 'Sentadilla con barra')).toBe(false)
  })
})

describe('lo que no es afirmable no se dibuja y se explica', () => {
  it('sin carga: nada en la escena, tres líneas con el porqué y ningún cero', () => {
    const r = capaDeMomentos({ ...SUJETO_DE_EJEMPLO, cargaKg: undefined }, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)
    expect(r.elementos).toEqual([])
    expect(r.lineas.slice(0, 3).every((l) => /no se dibuja\. carga ausente/.test(l))).toBe(true)
    expect(r.lineas.join(' ')).not.toMatch(/\b0 N·m/)
  })
  it('sin talla: lo mismo', () => {
    const r = capaDeMomentos({ ...SUJETO_DE_EJEMPLO, talla: null }, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)
    expect(r.elementos).toEqual([])
    expect(r.lineas[0]).toContain('no se dibuja')
  })
  it('si la banda no se puede estimar, se dibuja el valor sin banda y se dice', () => {
    const rota = { ...INCERTIDUMBRE_DE_EJEMPLO, talla: 5 }
    const r = capaDeMomentos(SUJETO_DE_EJEMPLO, rota, ctx, opc)
    expect(r.elementos).toHaveLength(3)
    expect(r.elementos.every((e) => e.banda === null)).toBe(true)
    expect(r.lineas[0]).toMatch(/sin banda/)
  })
})

describe('la escala', () => {
  it('una carga enorme llena el arco y no pasa de 1', () => {
    const r = capaDeMomentos({ ...SUJETO_DE_EJEMPLO, cargaKg: 2000 }, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)
    expect(r.elementos.every((e) => e.fraccion <= 1)).toBe(true)
    expect(r.elementos.some((e) => e.fraccion === 1)).toBe(true)
  })
})
