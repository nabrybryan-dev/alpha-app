import { describe, expect, it } from 'vitest'
import { armarPedidoDeepseek, MODELO_CHARLA, validarRespuestaCharla, type PiezaDeLaBiblioteca } from './pedidoCharla.ts'

const P1: PiezaDeLaBiblioteca = { id: 'vol-01', respuesta: 'Resp uno', estudios: 'Est uno', criterio_de_practica: 'Crit uno' }
const P2: PiezaDeLaBiblioteca = { id: 'des-02', respuesta: 'Resp dos', estudios: '  ', criterio_de_practica: 'Crit dos' }

describe('pedido a DeepSeek: campo por campo', () => {
  const p = armarPedidoDeepseek('¿cuántas series?', [P1, P2])
  const usuario = JSON.parse(p.messages[1].content) as { frase: string; piezas: Record<string, string>[] }

  it('el cuerpo tiene solo las claves esperadas y el modelo pedido', () => {
    expect(Object.keys(p).sort()).toEqual(['max_tokens', 'messages', 'model', 'response_format', 'stream', 'temperature', 'thinking'])
    expect(p.model).toBe(MODELO_CHARLA)
    expect(p.messages.map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('lleva thinking disabled: deepseek-flash razona por defecto y el razonamiento se come max_tokens', () => {
    expect(p.thinking).toEqual({ type: 'disabled' })
  })

  it('el mensaje del usuario lleva solo frase y piezas', () => {
    expect(Object.keys(usuario).sort()).toEqual(['frase', 'piezas'])
    expect(usuario.frase).toBe('¿cuántas series?')
  })

  it('cada pieza lleva solo id, respuesta, estudios (si hay) y criterio, tal cual', () => {
    expect(usuario.piezas[0]).toEqual({ id: 'vol-01', respuesta: 'Resp uno', estudios: 'Est uno', criterio_de_practica: 'Crit uno' })
    expect(Object.keys(usuario.piezas[0]).sort()).toEqual(['criterio_de_practica', 'estudios', 'id', 'respuesta'])
  })

  it('estudios vacío: la clave no viaja, no se inventa el bloque', () => {
    expect(Object.keys(usuario.piezas[1]).sort()).toEqual(['criterio_de_practica', 'id', 'respuesta'])
  })

  it('una pieza con campos de más (persona, plan, perfil) no los cuela', () => {
    const sucia = { ...P1, usuario_id: 'u-123', perfil: 'x', plan: 'y', historial: ['a'] } as PiezaDeLaBiblioteca
    const t = JSON.stringify(armarPedidoDeepseek('hola', [sucia]))
    expect(t).not.toMatch(/u-123|perfil|plan|historial|usuario_id/)
  })

  it('con más de 3 piezas manda 3', () => {
    const u = JSON.parse(armarPedidoDeepseek('x', [P1, P1, P1, P1, P1]).messages[1].content) as { piezas: unknown[] }
    expect(u.piezas).toHaveLength(3)
  })
})

describe('respuesta del modelo: forma validada', () => {
  const ok = JSON.stringify({ respuesta: 'Depende; mira la pieza.', piezas_usadas: ['vol-01'] })

  it('acepta una respuesta válida y separa estudios y criterio de la pieza (no del modelo)', () => {
    const r = validarRespuestaCharla(ok, [P1, P2])
    expect(r).toEqual({
      respuesta: 'Depende; mira la pieza.',
      piezas_usadas: ['vol-01'],
      piezas: [{ id: 'vol-01', estudios: 'Est uno', criterio_de_practica: 'Crit uno' }],
      origen: 'modelo',
    })
  })

  it('pieza sin estudios: estudios null (no puede pintar ese bloque)', () => {
    const r = validarRespuestaCharla(JSON.stringify({ respuesta: 'ok', piezas_usadas: ['des-02'] }), [P1, P2])
    expect(r?.piezas[0].estudios).toBeNull()
  })

  it.each([
    ['no es texto', 5],
    ['no es JSON', 'hola'],
    ['sin respuesta', JSON.stringify({ piezas_usadas: ['vol-01'] })],
    ['respuesta vacía', JSON.stringify({ respuesta: ' ', piezas_usadas: ['vol-01'] })],
    ['respuesta larguísima', JSON.stringify({ respuesta: 'a'.repeat(901), piezas_usadas: ['vol-01'] })],
    ['pieza inventada', JSON.stringify({ respuesta: 'ok', piezas_usadas: ['inventada'] })],
    ['sin piezas', JSON.stringify({ respuesta: 'ok', piezas_usadas: [] })],
    ['piezas no texto', JSON.stringify({ respuesta: 'ok', piezas_usadas: [1] })],
    ['un arreglo', '[]'],
  ])('rechaza: %s', (_n, contenido) => {
    expect(validarRespuestaCharla(contenido, [P1, P2])).toBeNull()
  })
})
