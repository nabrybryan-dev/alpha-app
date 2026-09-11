import { describe, expect, it } from 'vitest'
import type { ResumenSemanal } from './calcular'
import { guionSemanal } from './guion'

const COMPLETO: ResumenSemanal = {
  sesionesHechas: 4,
  sesionesPautadas: 5,
  adherenciaPct: 82,
  checkinsDeLaSemana: 6,
  regularidad: { estado: 'medido', indice: 78, nochesConDato: 9, diasComparados: 7 },
}

const SIN_NADA: ResumenSemanal = {
  sesionesHechas: 0,
  sesionesPautadas: 0,
  checkinsDeLaSemana: 0,
  regularidad: { estado: 'sin-datos', nochesConDato: 0, motivo: 'llevas 0 de 7 noches registradas' },
}

describe('el guion del vídeo semanal', () => {
  it('dice los números que hay, y los dice bien', () => {
    const g = guionSemanal(COMPLETO, 'Valentina Cruz')
    expect(g.texto).toContain('Hola Valentina')
    expect(g.texto).toContain('5 sesiones y completaste 4')
    expect(g.texto).toContain('82 por ciento')
    expect(g.texto).toContain('78 sobre 100')
    expect(g.omitidas).toBe(0)
  })

  it('la frase a la que le falta su dato se CAE entera', () => {
    // Nunca un cero de relleno, nunca un hueco a la vista. Es la misma regla
    // que ya usan las fichas del chat.
    const g = guionSemanal({ ...COMPLETO, adherenciaPct: undefined }, 'Valentina')
    expect(g.texto).not.toContain('por ciento')
    expect(g.texto).not.toContain('undefined')
    expect(g.omitidas).toBe(1)
    // Y lo demás sigue en pie: una frase que se cae no se lleva el vídeo.
    expect(g.texto).toContain('5 sesiones')
  })

  it('sin ningún dato, el vídeo sigue teniendo principio y final', () => {
    const g = guionSemanal(SIN_NADA, 'Mateo')
    expect(g.frases).toHaveLength(2)
    expect(g.texto).toContain('Hola Mateo')
    expect(g.texto).toContain('Tu plan sigue en pie')
    expect(g.omitidas).toBe(3)
  })

  it('el sueño a medias invita en vez de excusarse', () => {
    const g = guionSemanal(
      {
        ...COMPLETO,
        regularidad: { estado: 'sin-datos', nochesConDato: 3, motivo: 'llevas 3 de 7' },
      },
      'Valentina',
    )
    expect(g.texto).toContain('3 de 7 noches')
    expect(g.texto).toContain('esto ya es un número')
  })

  it('no reparte adjetivos sobre la semana de nadie', () => {
    const g = guionSemanal(COMPLETO, 'Valentina')
    expect(g.texto.toLowerCase()).not.toMatch(/\b(bien|mal|buena|mala|excelente|flojo|floja|felicidades|enhorabuena)\b/)
  })

  it('sin nombre no se rompe ni saluda al vacío', () => {
    expect(guionSemanal(COMPLETO, '').texto).toContain('Hola atleta')
    expect(guionSemanal(COMPLETO, '   ').texto).toContain('Hola atleta')
  })

  it('cada número del guion está en el resumen: no puede inventar ninguno', () => {
    // El test que de verdad protege: cualquier cifra que salga por la boca del
    // vídeo tiene que existir en los datos de entrada.
    const g = guionSemanal(COMPLETO, 'Valentina')
    const delGuion = (g.texto.match(/\d+/g) ?? []).map(Number)
    const permitidos = new Set([
      COMPLETO.sesionesHechas,
      COMPLETO.sesionesPautadas,
      COMPLETO.adherenciaPct,
      COMPLETO.regularidad.estado === 'medido' ? COMPLETO.regularidad.indice : undefined,
      COMPLETO.regularidad.estado === 'medido' ? COMPLETO.regularidad.nochesConDato : undefined,
      100,
      7,
    ])
    for (const n of delGuion) expect(permitidos.has(n)).toBe(true)
  })
})
