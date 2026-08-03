import { describe, expect, it } from 'vitest'
import { dimensionesDestino, extensionDe, LADO_MAXIMO, validarAdjunto } from './adjuntos'

describe('validarAdjunto', () => {
  it('acepta una imagen normal', () => {
    expect(validarAdjunto({ type: 'image/jpeg', size: 2_000_000 })).toEqual({
      ok: true,
      tipo: 'imagen',
    })
  })

  it('acepta un video por debajo del tope', () => {
    expect(validarAdjunto({ type: 'video/mp4', size: 20_000_000 })).toEqual({
      ok: true,
      tipo: 'video',
    })
  })

  it('rechaza un video que pasa los 25 MB, diciendo cuánto pesa', () => {
    const resultado = validarAdjunto({ type: 'video/mp4', size: 40_000_000 })
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.motivo).toContain('25')
  })

  it('rechaza un tipo que no es imagen ni video', () => {
    const resultado = validarAdjunto({ type: 'application/pdf', size: 1000 })
    expect(resultado.ok).toBe(false)
  })

  it('rechaza un archivo vacío', () => {
    expect(validarAdjunto({ type: 'image/jpeg', size: 0 }).ok).toBe(false)
  })
})

describe('dimensionesDestino', () => {
  it('no agranda una imagen que ya es pequeña', () => {
    expect(dimensionesDestino(800, 600)).toEqual({ ancho: 800, alto: 600 })
  })

  it('reduce por el lado mayor y conserva la proporción', () => {
    expect(dimensionesDestino(3200, 1600)).toEqual({ ancho: LADO_MAXIMO, alto: LADO_MAXIMO / 2 })
  })

  it('reduce por el alto cuando la foto es vertical', () => {
    expect(dimensionesDestino(600, 2400)).toEqual({ ancho: 400, alto: LADO_MAXIMO })
  })
})

describe('extensionDe', () => {
  it('saca la extensión del tipo MIME', () => {
    expect(extensionDe('image/jpeg')).toBe('jpg')
    expect(extensionDe('video/mp4')).toBe('mp4')
  })

  it('cae en una extensión genérica si el tipo es raro', () => {
    expect(extensionDe('image/vnd.rarito')).toBe('bin')
  })
})
