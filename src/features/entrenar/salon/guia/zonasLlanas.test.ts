import { describe, expect, it } from 'vitest'
import { REGIONES } from '../../sujeto/regiones'
import { CADENA_DE_REGION } from './zonasDePraxis'
import { ETIQUETA_LLANA_DE_RESPALDO, FICHA_LLANA_DE_REGION, NOTA_LLANA_DE_CADENAS } from './zonasLlanas'

/** Las palabras de la ficha técnica: ninguna puede colarse en el texto llano. */
const TERMINOS_TECNICOS = [
  'pectoral', 'deltoides', 'manguito', 'braquial', 'coracobraquial', 'ancóneo', 'braquiorradial', 'transverso',
  'oblicuo', 'serrato', 'romboides', 'escápula', 'multífido', 'cuadrado lumbar', 'vasto', 'recto femoral',
  'semitendinoso', 'semimembranoso', 'sóleo', 'tibial', 'peroneo', 'miofascial', 'fascia', 'toracolumbar',
]

describe('zonas en palabras llanas', () => {
  it.each(REGIONES.map((r) => r.id))('la zona %s trae nombre, qué hace y con quién va', (id) => {
    const f = FICHA_LLANA_DE_REGION[id]
    expect(f.nombre.trim()).not.toBe('')
    expect(f.queHace.trim()).not.toBe('')
    expect(f.conQuien.trim()).not.toBe('')
  })

  it('ningún texto llano lleva porcentajes ni términos técnicos de la ficha técnica', () => {
    const todo = [...Object.values(FICHA_LLANA_DE_REGION).flatMap((f) => [f.nombre, f.queHace, f.conQuien]), NOTA_LLANA_DE_CADENAS]
    for (const t of todo) {
      expect(t).not.toContain('%')
      for (const palabra of TERMINOS_TECNICOS) expect(t.toLowerCase()).not.toContain(palabra)
    }
  })

  it('la nota llana dice que no está demostrado y no afirma nada visto para todas las zonas', () => {
    expect(NOTA_LLANA_DE_CADENAS).toMatch(/No está demostrado/)
    expect(NOTA_LLANA_DE_CADENAS).not.toMatch(/se ha visto|se vieron/i)
  })

  it('lo que la versión llana dice haber visto nunca supera el nivel de la ficha técnica', () => {
    for (const { id } of REGIONES) {
      const nivel = CADENA_DE_REGION[id].respaldo
      const dice = ETIQUETA_LLANA_DE_RESPALDO[nivel]
      if (nivel === 'modelo' || nivel === 'sin_evaluar') expect(dice, id).toMatch(/^Es una idea/)
      if (nivel === 'parcial') expect(dice, id).toContain('solo en parte')
      if (nivel === 'verificada') expect(dice, id).toContain('se ha visto en cuerpos disecados')
    }
    expect(ETIQUETA_LLANA_DE_RESPALDO[CADENA_DE_REGION.cua.respaldo]).toMatch(/^Es una idea/)
    expect(ETIQUETA_LLANA_DE_RESPALDO[CADENA_DE_REGION.tri.respaldo]).toContain('cuerpos disecados')
  })
})
