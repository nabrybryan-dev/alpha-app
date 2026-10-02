import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Voz } from './voz'

/** Un teléfono de mentira: guarda lo que se le manda a decir y deja disparar sus eventos. */
class Dicho {
  text: string; voice: unknown = null; lang = ''; rate = 1; pitch = 1
  onboundary: ((e: { name: string; charIndex: number }) => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  onstart: (() => void) | null = null
  constructor(t: string) { this.text = t }
}
let cola: Dicho[] = []
let voces: { name: string; lang: string; localService: boolean }[] = []

beforeEach(() => {
  cola = []
  voces = [
    { name: 'Paulina', lang: 'es-MX', localService: true },
    { name: 'Paulina (Mejorada)', lang: 'es-MX', localService: true },
    { name: 'Google español en línea', lang: 'es-US', localService: false },
  ]
  vi.stubGlobal('SpeechSynthesisUtterance', Dicho)
  vi.stubGlobal('speechSynthesis', { getVoices: () => voces, speak: (u: Dicho) => cola.push(u), cancel: vi.fn() })
  Voz.activa = true
})
afterEach(() => { vi.unstubAllGlobals(); Voz.activa = false })

describe('la voz del prototipo de Praxis', () => {
  it('prefiere la voz mejorada del teléfono y nunca una en línea', () => {
    expect(Voz.elegir()?.name).toBe('Paulina (Mejorada)')
    voces = [{ name: 'Google español en línea', lang: 'es-US', localService: false }]
    expect(Voz.elegir()).toBeNull()
  })

  it('ya no habla al 95 %: va más rápido, y la pregunta final más pausada y un tono arriba', () => {
    Voz.decir('Listo, quedó anotado. ¿Cómo te sentiste en la última serie?', () => {}, () => {})
    expect(cola.map((u) => u.text)).toEqual(['Listo, quedó anotado.', '¿Cómo te sentiste en la última serie?'])
    expect(cola[0].rate).toBeGreaterThan(1)
    expect(cola[1].rate).toBeLessThan(cola[0].rate)
    expect(cola[1].pitch).toBeGreaterThan(1)
  })

  it('una frase larga se parte en su coma, para respirar donde cambia la idea', () => {
    Voz.decir('Hoy te tocó un día largo de trabajo y aun así llegaste a entrenar, y eso cuenta más de lo que parece.', () => {}, () => {})
    expect(cola).toHaveLength(2)
    expect(cola[0].text.endsWith(',')).toBe(true)
  })

  it('una frase corta va de un solo aliento', () => {
    Voz.decir('Bueno, sigamos.', () => {}, () => {})
    expect(cola).toHaveLength(1)
  })

  it('la pantalla recibe la posición en el texto entero, no en el trozo', () => {
    const vistos: number[] = []
    const texto = 'Listo, quedó anotado. ¿Cómo te sentiste?'
    Voz.decir(texto, (e) => vistos.push(e.charIndex), () => {})
    cola[1].onboundary?.({ name: 'word', charIndex: 0 })
    expect(vistos).toEqual([texto.indexOf('¿Cómo')])
  })

  it('avisa el final una sola vez, al terminar el último trozo', () => {
    const fin = vi.fn()
    Voz.decir('Uno. Dos. ¿Tres?', () => {}, fin)
    cola[0].onend?.(); cola[1].onend?.()
    expect(fin).not.toHaveBeenCalled()
    cola[2].onend?.()
    expect(fin).toHaveBeenCalledTimes(1)
  })

  it('lo que quedó en cola de un turno anterior ya no avisa a nadie', () => {
    const finViejo = vi.fn()
    Voz.decir('Primero. ¿Segundo?', () => {}, finViejo)
    const viejos = [...cola]
    Voz.decir('Otra cosa.', () => {}, () => {})
    viejos.forEach((u) => { u.onerror?.(); u.onend?.() })
    expect(finViejo).not.toHaveBeenCalled()
  })

  it('apagada no habla', () => {
    Voz.activa = false
    expect(Voz.decir('Hola.', () => {}, () => {})).toBe(false)
    expect(cola).toHaveLength(0)
  })
})
