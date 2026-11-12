import { describe, expect, it } from 'vitest'
import { limpiarFrase } from './limpiador.ts'

describe('limpiador de la charla', () => {
  it('CONTROL POSITIVO: un nombre sembrado desaparece, con o sin mayúsculas y tildes', () => {
    for (const f of ['Marcela dice que cuántas series por músculo', 'cuantas series por musculo, soy MARCELA', 'hola Mónica, ¿cuántas series?']) {
      const r = limpiarFrase(f)
      expect(r.texto).not.toMatch(/marcela|monica|mónica/i)
      expect(r.texto).toContain('[NOMBRE]')
      expect(r.tipos).toContain('nombre')
    }
  })

  it('un nombre que NO está en la lista pasa si nadie lo pasó aparte, y sale si se pasa aparte', () => {
    expect(limpiarFrase('Zacarías pregunta por el descanso').texto).toContain('Zacarías')
    expect(limpiarFrase('Zacarías pregunta por el descanso', ['Zacarias']).texto).not.toContain('Zacar')
  })

  it('«me llamo X» quita el nombre aunque no esté en la lista', () => {
    expect(limpiarFrase('me llamo Anselmo Ruiz y quiero saber del descanso').texto).toBe('me llamo [NOMBRE] y quiero saber del descanso')
  })

  it('no toca palabras que contienen un nombre dentro', () => {
    expect(limpiarFrase('la sarampión y la analogía').texto).toBe('la sarampión y la analogía')
    expect(limpiarFrase('sarita no es Sara').texto).toBe('sarita no es [NOMBRE]')
  })

  it('quita correos y teléfonos', () => {
    const r = limpiarFrase('escríbeme a pepe.gomez@correo.com o al 300 123 4567 o +57 310 555 12 34')
    expect(r.texto).not.toMatch(/@|300|4567|310/)
    expect(r.quitado.correo).toBe(1)
    expect(r.quitado.telefono).toBe(2)
  })

  it('quita peso, edad y medidas', () => {
    const r = limpiarFrase('tengo 34 años, peso 82 kg, mido 1.75 y mi cintura de 90 cm, 28% de grasa')
    expect(r.texto).not.toMatch(/34|82|1\.75|90|28/)
    expect(r.tipos).toEqual(expect.arrayContaining(['edad', 'peso', 'medida']))
  })

  it('NEGATIVO: una frase limpia no cambia', () => {
    for (const f of ['¿cuántas series por músculo a la semana?', 'es mejor entrenar en ayunas o después de comer', 'cuánto descanso entre series de sentadilla']) {
      const r = limpiarFrase(f)
      expect(r.texto).toBe(f)
      expect(r.tipos).toEqual([])
    }
  })

  it('los conteos nunca guardan lo quitado', () => {
    const r = limpiarFrase('soy Marcela, 3001234567')
    expect(JSON.stringify(r)).not.toMatch(/Marcela|3001234567/)
  })
})
