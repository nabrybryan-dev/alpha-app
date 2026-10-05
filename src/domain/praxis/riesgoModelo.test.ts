// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  NIVELES_MODELO, PROMPT_RIESGO, SHA16_PROMPT_RIESGO, leerSalidaRiesgo, marcaDesdeModelo, type NivelModelo,
} from './riesgoModelo'

describe('el prompt que corre es el que se midió', () => {
  it('su sha256 coincide con el del recibo de lenguaje/bateria/recibos', () => {
    const sha = createHash('sha256').update(PROMPT_RIESGO, 'utf8').digest('hex').slice(0, 16)
    expect(sha).toBe(SHA16_PROMPT_RIESGO)
  })
  it('nombra los ocho niveles y pide solo JSON', () => {
    for (const n of NIVELES_MODELO) expect(PROMPT_RIESGO).toContain(n)
    expect(PROMPT_RIESGO).toContain('Devuelve SOLO un objeto JSON')
  })
})

describe('leerSalidaRiesgo falla cerrando', () => {
  it('lee un JSON limpio', () => {
    expect(leerSalidaRiesgo('{"nivel":"RIESGO_VIDA","cita":"ni ganas de vivir","por_que":"x"}')).toEqual({ nivel: 'RIESGO_VIDA', cita: 'ni ganas de vivir' })
  })
  it('lee el JSON aunque venga con texto o con un bloque de código alrededor', () => {
    expect(leerSalidaRiesgo('```json\n{"nivel":"DERIVAR","cita":"","por_que":"x"}\n```')?.nivel).toBe('DERIVAR')
  })
  it('un nivel desconocido, un texto suelto o un JSON roto dan null (nunca NINGUNO)', () => {
    expect(leerSalidaRiesgo('{"nivel":"LEVE","cita":""}')).toBeNull()
    expect(leerSalidaRiesgo('NINGUNO')).toBeNull()
    expect(leerSalidaRiesgo('{"nivel": "NINGUNO", ')).toBeNull()
    expect(leerSalidaRiesgo('')).toBeNull()
  })
})

describe('del nivel del modelo a la marca de la pantalla', () => {
  const casos: [NivelModelo, ReturnType<typeof marcaDesdeModelo>][] = [
    ['URGENTE_FISICO', { tipo: 'quieta', linea: 'vida' }],
    ['RIESGO_VIDA', { tipo: 'quieta', linea: 'vida' }],
    ['RIESGO_VIOLENCIA', { tipo: 'quieta', linea: 'pareja' }],
    ['RIESGO_MENOR', { tipo: 'quieta', linea: 'nino' }],
    ['AMBIGUO_VIDA', { tipo: 'cuidado' }],
    ['PREGUNTAR_ANTES_DE_ENTRENAR', { tipo: 'salud', filtro: 'sintoma' }],
    ['DERIVAR', { tipo: 'salud', filtro: 'sintoma' }],
    ['NINGUNO', null],
  ]
  it.each(casos)('%s', (nivel, esperado) => {
    expect(marcaDesdeModelo(nivel)).toEqual(esperado)
  })
  it('a alguien con algo del cuerpo NUNCA se le hace la pregunta de riesgo de vida', () => {
    expect(marcaDesdeModelo('PREGUNTAR_ANTES_DE_ENTRENAR')?.tipo).not.toBe('cuidado')
  })
})
