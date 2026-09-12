import { describe, expect, it } from 'vitest'
import {
  esSemanaMala,
  LARGO_MAXIMO,
  LARGO_MINIMO,
  revisarBorrador,
  SECCIONES,
  type Borrador,
  type Huecos,
} from './huecos'

const HUECOS: Huecos = {
  nombre: { valor: 'Valentina', significa: 'su nombre de pila' },
  registro_pct: { valor: '7,4 por ciento', significa: '% de ejercicios con registro propio' },
  meta_registro: { valor: '80 por ciento', significa: 'la meta de registro de su plan' },
  peso_kg_semana: { significa: 'tendencia de peso: SIN DATO esta semana' },
}

/** Un párrafo largo y limpio, sin cifras: para llegar a los 2-3 minutos. */
const RELLENO =
  'Lo importante es que sigas entrenando con la cabeza fría y que cada serie quede anotada como la hiciste, ' +
  'porque sin ese dato la programación se decide a ciegas y eso es justo lo que queremos evitar juntos. '

function borrador(extra: Partial<Borrador> = {}): Borrador {
  const base: Borrador = {}
  for (const s of SECCIONES) base[s] = `Hola {nombre}. ${RELLENO.repeat(2)}`
  base.progresion = `Tu registro propio quedó en {registro_pct} y tu meta es {meta_registro}. ${RELLENO.repeat(2)}`
  return { ...base, ...extra }
}

describe('la revisión larga: el modelo escribe, las cifras las pone la plantilla', () => {
  it('pone cada cifra en su hueco y cabe en 2-3 minutos', () => {
    const r = revisarBorrador(borrador(), HUECOS, { semanaMala: true })
    expect(r.problemas).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.texto).toContain('7,4 por ciento')
    expect(r.texto).toContain('Hola Valentina')
    expect(r.texto).not.toMatch(/[{}]/)
    expect(r.caracteres).toBeGreaterThanOrEqual(LARGO_MINIMO)
    expect(r.caracteres).toBeLessThanOrEqual(LARGO_MAXIMO)
  })

  it('rechaza una cifra escrita por el modelo', () => {
    const r = revisarBorrador(borrador({ semana: `Hiciste 3 sesiones. ${RELLENO.repeat(2)}` }), HUECOS, {
      semanaMala: false,
    })
    expect(r.ok).toBe(false)
    expect(r.problemas.join()).toMatch(/cifra/)
  })

  it('rechaza una cantidad escrita con letras', () => {
    const r = revisarBorrador(borrador({ semana: `Hiciste tres sesiones. ${RELLENO.repeat(2)}` }), HUECOS, {
      semanaMala: false,
    })
    expect(r.ok).toBe(false)
    expect(r.problemas.join()).toMatch(/con letras/)
  })

  it('rechaza un hueco inventado', () => {
    const r = revisarBorrador(borrador({ plan: `Levantaste {kilos_totales}. ${RELLENO.repeat(2)}` }), HUECOS, {
      semanaMala: false,
    })
    expect(r.ok).toBe(false)
    expect(r.problemas.join()).toMatch(/no existe/)
  })

  it('rechaza un hueco que existe pero no tiene dato', () => {
    const r = revisarBorrador(borrador({ plan: `Tu peso va a {peso_kg_semana}. ${RELLENO.repeat(2)}` }), HUECOS, {
      semanaMala: false,
    })
    expect(r.ok).toBe(false)
    expect(r.problemas.join()).toMatch(/no tiene dato/)
  })

  it('en una semana mala no felicita, y en una buena sí puede', () => {
    const felicita = borrador({ semana: `Muy bien, {nombre}. ${RELLENO.repeat(2)}` })
    expect(revisarBorrador(felicita, HUECOS, { semanaMala: true }).ok).toBe(false)
    expect(revisarBorrador(felicita, HUECOS, { semanaMala: false }).ok).toBe(true)
  })

  it('las cinco secciones son obligatorias', () => {
    const r = revisarBorrador(borrador({ cambiar: '   ' }), HUECOS, { semanaMala: false })
    expect(r.ok).toBe(false)
    expect(r.problemas).toContain('falta la sección «cambiar»')
  })

  it('una revisión de medio minuto no pasa', () => {
    const corto: Borrador = {}
    for (const s of SECCIONES) corto[s] = 'Hola {nombre}.'
    const r = revisarBorrador(corto, HUECOS, { semanaMala: false })
    expect(r.ok).toBe(false)
    expect(r.problemas.join()).toMatch(/tiene que durar entre 120 y 180 s/)
  })
})

describe('qué es una semana mala', () => {
  it('un eje ilegible o sin dato la hace mala', () => {
    expect(esSemanaMala([{ estado: 'medido', desvio_pct: 5 }, { estado: 'ilegible' }])).toBe(true)
  })
  it('ir por detrás más de la banda la hace mala', () => {
    expect(esSemanaMala([{ estado: 'medido', desvio_pct: -21.5 }])).toBe(true)
    expect(esSemanaMala([{ estado: 'medido', desvio_pct: -8 }])).toBe(false)
  })
  it('el aviso de registro calcado la hace mala aunque los ejes cuadren', () => {
    expect(esSemanaMala([{ estado: 'medido', desvio_pct: 0 }], ['el M24 en curso ya va calcado'])).toBe(true)
  })
})
