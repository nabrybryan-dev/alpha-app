import { describe, expect, it } from 'vitest'
import { limpiarFrase } from './limpiador.ts'
import { PROMPT_PROVISIONAL, ROTULO_PROVISIONAL, armarPedidoProvisional, decidirProvisional, tieneContenido } from './provisional.ts'

const FRASE = '¿cuántas series por semana para el pecho?'

describe('armarPedidoProvisional', () => {
  it('max_tokens 200, sin JSON forzado, y solo frase limpia + prompt', () => {
    const p = armarPedidoProvisional(FRASE)
    expect(p.max_tokens).toBe(200)
    expect(p.stream).toBe(false)
    expect(p.thinking).toEqual({ type: 'disabled' }) // sin esto deepseek-flash gasta los 200 tokens razonando y devuelve vacio o cortado
    expect(p.messages.map((m) => m.role)).toEqual(['system', 'user'])
    expect(p.messages[0].content).toBe(PROMPT_PROVISIONAL)
    expect(p.messages[1].content).toContain('series')
    expect(JSON.stringify(p)).not.toContain('piezas')
  })
  it('reutiliza limpiador y vocabulario: nombre, correo y barrio sembrados no salen', () => {
    const p = armarPedidoProvisional('Soy zulema, vivo en chapinero, mi correo es zule@gmail.com, ¿cuántas series por semana?')
    const sale = JSON.stringify(p.messages[1])
    for (const secreto of ['zulema', 'chapinero', 'zule', 'gmail']) expect(sale.toLowerCase()).not.toContain(secreto)
  })
  it('el prompt pide lo acordado y no lleva datos personales', () => {
    for (const t of ['conocimiento general', 'cifras', 'autores', 'estudios', 'prescripción', '100 palabras', 'español', 'demostrado']) {
      expect(PROMPT_PROVISIONAL.toLowerCase()).toContain(t.toLowerCase())
    }
    expect(limpiarFrase(PROMPT_PROVISIONAL, [], { mayusculas: false }).tipos).toEqual([])
  })
  it('tieneContenido: una frase toda tapada no se manda', () => {
    expect(tieneContenido('[…] […]')).toBe(false)
    expect(tieneContenido('[NOMBRE]')).toBe(false)
    expect(tieneContenido('¿cuantas series?')).toBe(true)
  })
})

describe('decidirProvisional', () => {
  it('salida limpia: provisional con el rótulo, origen y exclusión del entrenamiento', () => {
    const r = decidirProvisional('El volumen es el trabajo total sobre un músculo en la semana.', FRASE)
    expect(r.tipo).toBe('provisional')
    if (r.tipo !== 'provisional') return
    expect(r.texto.startsWith(ROTULO_PROVISIONAL)).toBe(true)
    expect(r.texto).toContain('El volumen es el trabajo total')
    expect(r.origen).toBe('provisional')
    expect(r.excluirEntrenamiento).toBe(true)
  })
  it('el rótulo es una constante única', () => {
    expect(ROTULO_PROVISIONAL).toBe('Respuesta provisional, sin revisar. Tu coach puede verla.')
  })
  it('salida con cifra, autor, prescripción o salud: al coach, sin texto del modelo', () => {
    for (const mala of ['Suele ser un 40 % más.', 'Según Schoenfeld 2016.', 'Haz 4 series de 8 con 60 kg.', 'Puede ser una lesión.']) {
      const r = decidirProvisional(mala, FRASE)
      expect(r.tipo).toBe('al_coach')
      expect(JSON.stringify(r)).not.toContain(mala)
    }
  })
  it('salida no texto o vacía: al coach', () => {
    for (const x of [null, undefined, 5, {}, '', '  ']) expect(decidirProvisional(x, FRASE).tipo).toBe('al_coach')
  })
  it('constancia de exclusión: la provisional lleva excluirEntrenamiento:true y origen provisional', () => {
    const r = decidirProvisional('El descanso ayuda a recuperar entre sesiones.', FRASE)
    expect(r).toMatchObject({ tipo: 'provisional', excluirEntrenamiento: true, origen: 'provisional' })
  })
})
