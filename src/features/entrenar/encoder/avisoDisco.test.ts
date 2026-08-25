import { describe, expect, it } from 'vitest'
import { avisoDeDisco } from './avisoDisco'

describe('avisoDeDisco', () => {
  it('cuando no es redondo dice CUÁNTO se desvía y contra qué límite', () => {
    const t = avisoDeDisco({ tipo: 'no-circular', motivo: 'el contorno no es redondo', redondez: 0.14, cobertura: 0.72, ajuste: { r: 38 } })
    expect(t).toContain('14 %')
    expect(t).toContain('8 %')
  })

  it('da el radio encontrado, que es lo que separa el buje del disco', () => {
    // Sin este número los tres fallos posibles dan el mismo texto, y dos de
    // ellos no se arreglan moviendo la cámara.
    const t = avisoDeDisco({ tipo: 'no-circular', redondez: 0.2, cobertura: 0.8, ajuste: { r: 21 } })
    expect(t).toContain('21 px')
    expect(t).toContain('buje')
  })

  it('con poco borde a la vista culpa al contraste, no a la forma', () => {
    const t = avisoDeDisco({ tipo: 'desconocida', motivo: 'no se ve un contorno cerrado', cobertura: 0.31 })
    expect(t).toContain('31 %')
    expect(t).toContain('más claro que el suelo')
    expect(t).not.toContain('redondo')
  })

  it('«tiene esquinas» no manda a frotar el buje de algo que no es un disco', () => {
    // El nucleo distingue dos formas de no ser redondo y llevan a sitios
    // contrarios: «no es redondo» es un disco mal visto —buje o camara torcida—
    // y «tiene esquinas» es que eso NO es un disco. Con el mismo consejo para
    // los dos se manda a tocar la goma negra de un banco.
    const t = avisoDeDisco({
      tipo: 'no-circular',
      motivo: 'eso tiene esquinas: un disco no las tiene',
      redondez: 0.12,
      cobertura: 0.8,
      ajuste: { r: 140 },
    })
    expect(t).toMatch(/esquina/i)
    expect(t).not.toMatch(/buje/i)
    expect(t).not.toContain('undefined')
  })

  it('un motivo que no conoce se dice tal cual, sin inventarse un diagnóstico', () => {
    expect(avisoDeDisco({ tipo: 'desconocida', motivo: 'no se pudo ajustar' })).toContain('no se pudo ajustar')
  })

  it('sin datos no escribe «undefined» en la pantalla del gimnasio', () => {
    const t = avisoDeDisco({ tipo: 'no-circular' })
    expect(t).not.toContain('undefined')
    expect(t).not.toContain('NaN')
  })
})
