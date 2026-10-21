import { describe, expect, it } from 'vitest'
import { VERSION_DEL_MODELO } from './convenciones'
import type { Cifra } from './contrato'
import {
  bandaDibujable,
  capaDeMomentos,
  escalaDelArco,
  esSentadillaConBarra,
  INCERTIDUMBRE_DE_EJEMPLO,
  SUJETO_DE_EJEMPLO,
  type ContextoDeLaCapa,
} from './capaDeMomentos'

const ctx: ContextoDeLaCapa = { categoria: 'SENTADILLA', nombre: 'Sentadilla con barra', sujetoDeEjemplo: true }
const opc = { muestras: 300 }
const VACIA = { elementos: [], lineas: [], escala: 0, poseDelCalculo: null }

describe('la capa de momentos con el sujeto de ejemplo', () => {
  const capa = capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)

  it('dibuja tobillo, rodilla y cadera, todos estimados (salen de una tabla poblacional)', () => {
    expect(capa.elementos.map((e) => e.articulacion)).toEqual(['tobillo', 'rodilla', 'cadera'])
    expect(capa.elementos.every((e) => e.estado === 'estimado')).toBe(true)
  })

  it('el orden de magnitud sale de la mano: cadera ~497, rodilla ~188, tobillo ~151 N·m', () => {
    // Recalculados a mano por Opus (REVISION-OPUS-FASE5-21OCT.md) para el sujeto de ejemplo.
    expect(capa.lineas[0]).toMatch(/^Tobillo: 151 N·m/)
    expect(capa.lineas[1]).toMatch(/^Rodilla: 188 N·m/)
    expect(capa.lineas[2]).toMatch(/^Cadera: 497 N·m/)
  })

  it('C-1: ninguna fracción se satura y la banda de la cadera se dibuja de verdad', () => {
    for (const e of capa.elementos) {
      expect(e.fraccion).toBeGreaterThan(0)
      expect(e.fraccion).toBeLessThanOrEqual(1)
      expect(e.banda).not.toBeNull()
      expect(e.banda!.sup).toBeLessThanOrEqual(1)
      expect(e.banda!.inf).toBeLessThan(e.fraccion)
      expect(e.banda!.sup).toBeGreaterThan(e.fraccion)
    }
    // La escala contiene a la cadera con holgura: 497 N·m ya no llena un arco de 300.
    expect(capa.escala).toBeGreaterThanOrEqual(500)
    expect(capa.escala % 100).toBe(0)
  })

  it('el texto dice que es el total de las dos piernas, la escala y la pose del cálculo', () => {
    expect(capa.lineas).toHaveLength(8)
    expect(capa.lineas[0]).toContain('total de las dos piernas')
    expect(capa.lineas[2]).toMatch(/banda \d+ a \d+ N·m/)
    expect(capa.lineas[6]).toContain(String(capa.escala))
    expect(capa.lineas[7]).toMatch(/muslo -83°/)
    expect(capa.lineas.join(' ')).not.toMatch(/cuádriceps|cuadriceps|gl[uú]teo|isquio|aductor/i)
  })

  it('el pasivo (Silder 2007) se dice y NO se dibuja: la pose del ejemplo está fuera de su dominio', () => {
    const pasivas = capa.lineas.slice(3, 6)
    expect(pasivas.map((l) => l.split(':')[0])).toEqual(['Pasivo de tobillo', 'Pasivo de rodilla', 'Pasivo de cadera'])
    for (const l of pasivas) expect(l).toMatch(/no se dibuja\. fuera del dominio ensayado por Silder 2007/)
    expect(pasivas[2]).toContain('cadera 126°')
    // Nada del pasivo llega a los elementos: los arcos son solo los tres momentos activos.
    expect(capa.elementos).toHaveLength(3)
  })

  it('C-3: lleva la pose del cálculo para que el dibujo solo salga cuando se pasa por ella', () => {
    expect(capa.poseDelCalculo).toEqual({ tibia: 0.45, muslo: -1.45 })
  })

  it('con la misma semilla sale lo mismo', () => {
    expect(capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)).toEqual(capa)
  })
})

describe('cuándo una banda se puede dibujar (C-6)', () => {
  const cifra = (valor: number, inf: number, sup: number): Cifra => ({
    id: 'x',
    valor,
    unidad: 'N·m',
    estado: 'estimado',
    fuente: ['convenciones.gravedad'],
    supuestos: [],
    banda: { inf, sup, nivel: 'p5-p95' },
    version: VERSION_DEL_MODELO,
  })
  it('una banda ordenada que contiene al valor y no cruza el cero, sí', () => {
    expect(bandaDibujable(cifra(100, 80, 130))).toBe(true)
    expect(bandaDibujable(cifra(-100, -130, -80))).toBe(true)
  })
  it('una banda que cruza el cero NO: con el valor absoluto quedaría invertida', () => {
    expect(bandaDibujable(cifra(10, -20, 40))).toBe(false)
  })
  it('una banda que no contiene al valor, o desordenada, o no finita, NO', () => {
    expect(bandaDibujable(cifra(200, 80, 130))).toBe(false)
    expect(bandaDibujable(cifra(100, 130, 80))).toBe(false)
    expect(bandaDibujable(cifra(100, 80, Infinity))).toBe(false)
    expect(bandaDibujable({ ...cifra(100, 80, 130), banda: null })).toBe(false)
    expect(bandaDibujable({ ...cifra(100, 80, 130), estado: 'no_afirmable' })).toBe(false)
  })
})

describe('momentos negativos (revision de Codex del 21-oct)', () => {
  // Tronco inclinado hacia atras y muslo vertical: el momento de rodilla sale negativo y su banda tambien.
  const inclinada = { ...SUJETO_DE_EJEMPLO, pose: { tibia: 0.2, muslo: 0, tronco: 0.3, cabeza: 0.2, barraT: 0.1, pieZ: 0.05 } }
  const r = capaDeMomentos(inclinada, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)
  it('hay al menos un momento con la banda negativa en este caso', () => {
    expect(r.lineas.some((l) => /^Rodilla: -\d+ N·m.*banda -\d+ a -\d+/.test(l))).toBe(true)
  })
  it('las fracciones de la banda quedan ordenadas (inf <= sup) y la banda se dibuja', () => {
    const rodilla = r.elementos.find((e) => e.articulacion === 'rodilla')!
    expect(rodilla.banda).not.toBeNull()
    expect(rodilla.banda!.inf).toBeLessThanOrEqual(rodilla.banda!.sup)
    for (const e of r.elementos) if (e.banda) expect(e.banda.inf).toBeLessThanOrEqual(e.banda.sup)
  })
})

describe('la escala del arco', () => {
  it('es el múltiplo de 100 que contiene al mayor, y nunca menos de 100', () => {
    expect(escalaDelArco(497)).toBe(500)
    expect(escalaDelArco(500)).toBe(500)
    expect(escalaDelArco(500.1)).toBe(600)
    expect(escalaDelArco(12)).toBe(100)
    expect(escalaDelArco(0)).toBe(100)
  })
  it('una carga enorme agranda la escala y las fracciones siguen en [0, 1]', () => {
    const r = capaDeMomentos({ ...SUJETO_DE_EJEMPLO, cargaKg: 2000 }, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)
    expect(r.escala).toBeGreaterThan(3000)
    expect(r.elementos.every((e) => e.fraccion > 0 && e.fraccion <= 1)).toBe(true)
    expect(r.elementos.some((e) => e.fraccion > 0.8)).toBe(true)
  })
})

describe('la puerta: basta con que falle UNA condición', () => {
  it('un asesorado real no dibuja nada, aunque el ejercicio sea el bueno', () => {
    const r = capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, { ...ctx, sujetoDeEjemplo: false }, opc)
    expect(r).toEqual(VACIA)
  })
  it('el sujeto de ejemplo con otro ejercicio no dibuja nada', () => {
    const otro = { categoria: 'SENTADILLA', nombre: 'Sentadilla goblet con mancuerna', sujetoDeEjemplo: true }
    expect(capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, otro, opc).elementos).toEqual([])
    const peso = { categoria: 'PESO MUERTO', nombre: 'Peso muerto con barra', sujetoDeEjemplo: true }
    expect(capaDeMomentos(SUJETO_DE_EJEMPLO, INCERTIDUMBRE_DE_EJEMPLO, peso, opc)).toEqual(VACIA)
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
    expect(esSentadillaConBarra('SENTADILLA', 'Sentadilla unilateral con barra')).toBe(false)
    expect(esSentadillaConBarra('SENTADILLA', 'Sentadilla con mancuerna')).toBe(false)
    expect(esSentadillaConBarra('PRENSA', 'Sentadilla con barra')).toBe(false)
  })
})

describe('lo que no es afirmable no se dibuja y se explica', () => {
  it('sin carga: nada en la escena, tres líneas con el porqué y ningún cero', () => {
    const r = capaDeMomentos({ ...SUJETO_DE_EJEMPLO, cargaKg: undefined }, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)
    expect(r.elementos).toEqual([])
    expect(r.escala).toBe(0)
    expect(r.poseDelCalculo).toBeNull()
    expect(r.lineas).toHaveLength(6)
    expect(r.lineas.slice(0, 3).every((l) => /no se dibuja\. carga ausente/.test(l))).toBe(true)
    expect(r.lineas.slice(3).every((l) => /^Pasivo de .*no se dibuja/.test(l))).toBe(true)
    expect(r.lineas.join(' ')).not.toMatch(/\b0 N·m/)
  })
  it('sin talla: lo mismo', () => {
    const r = capaDeMomentos({ ...SUJETO_DE_EJEMPLO, talla: null }, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)
    expect(r.elementos).toEqual([])
    expect(r.lineas[0]).toContain('no se dibuja')
  })
  it('si la banda no se puede estimar, se dibuja el valor sin banda y se dice por qué', () => {
    const rota = { ...INCERTIDUMBRE_DE_EJEMPLO, talla: 5 }
    const r = capaDeMomentos(SUJETO_DE_EJEMPLO, rota, ctx, opc)
    expect(r.elementos).toHaveLength(3)
    expect(r.elementos.every((e) => e.banda === null)).toBe(true)
    expect(r.lineas[0]).toMatch(/sin banda: .*muestras/)
  })
  it('una pose DENTRO del dominio de Silder da la cifra del pasivo con su banda y aun así no la dibuja', () => {
    const dentro = { ...SUJETO_DE_EJEMPLO, pose: { tibia: 0.3, muslo: -1.0, tronco: 0.4, cabeza: 0.2, barraT: 0.1, pieZ: 0.05 } }
    const r = capaDeMomentos(dentro, INCERTIDUMBRE_DE_EJEMPLO, ctx, opc)
    const cadera = r.lineas.find((l) => l.startsWith('Pasivo de cadera'))!
    expect(cadera).toMatch(/^Pasivo de cadera: 13 N·m, estimado \(Silder 2007, total de las dos piernas\), banda -?\d+ a \d+ N·m\. No se dibuja: la banda es más ancha que el valor\./)
    expect(r.elementos).toHaveLength(3)
  })
  it('C-6: una banda que cruza el cero no se dibuja invertida', () => {
    // Incertidumbre enorme en los ángulos: el momento de tobillo cruza el cero en parte de las muestras.
    const r = capaDeMomentos(SUJETO_DE_EJEMPLO, { ...INCERTIDUMBRE_DE_EJEMPLO, angulo: 0.6 }, ctx, { muestras: 500 })
    for (const e of r.elementos) {
      if (e.banda) {
        expect(e.banda.inf).toBeLessThanOrEqual(e.banda.sup)
        expect(e.banda.inf).toBeGreaterThanOrEqual(0)
      }
    }
    const cruza = r.lineas.filter((l) => /cruza el cero/.test(l))
    expect(cruza.length + r.elementos.filter((e) => e.banda).length).toBeGreaterThan(0)
  })
})
