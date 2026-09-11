import { describe, expect, it } from 'vitest'
import {
  DIAS_PARA_SEGUIR_VIVO,
  embudoDeAvisos,
  veredictoDelEmbudo,
  type DecisionDeAviso,
} from './embudo'

const AHORA = Date.parse('2026-09-30T12:00:00Z')
const haceDias = (n: number) => new Date(AHORA - n * 86_400_000).toISOString()

function decision(
  usuarioId: string,
  dijoSi: boolean,
  diasDesdeQueDecidio: number,
  diasDesdeLaUltimaSenal?: number,
): DecisionDeAviso {
  return {
    usuarioId,
    dijoSi,
    vioEn: haceDias(diasDesdeQueDecidio),
    vivoEn: diasDesdeLaUltimaSenal === undefined ? undefined : haceDias(diasDesdeLaUltimaSenal),
  }
}

describe('el embudo del permiso de avisos', () => {
  it('cuenta los tres números, no solo los que aceptaron', () => {
    const e = embudoDeAvisos(
      [decision('a', true, 30, 1), decision('b', true, 30, 20), decision('c', false, 30)],
      23,
      AHORA,
    )
    expect(e).toEqual({ vieron: 3, dijeronSi: 2, vivosALosSieteDias: 1, cartera: 23 })
  })

  it('quien aceptó ayer NO cuenta como muerto: aún no ha llegado su séptimo día', () => {
    // Contarlo hundiría el número por el simple hecho de ser reciente.
    const e = embudoDeAvisos([decision('a', true, 1, 1)], 23, AHORA)
    expect(e.dijeronSi).toBe(1)
    expect(e.vivosALosSieteDias).toBe(0)
  })

  it('aceptar y seguir llegándole son cosas distintas', () => {
    // El caso que de verdad se rompe: dijo que sí hace un mes y su teléfono
    // lleva veinte días sin dar señales. El navegador rotó la suscripción.
    const e = embudoDeAvisos([decision('a', true, 30, 20)], 23, AHORA)
    expect(e.dijeronSi).toBe(1)
    expect(e.vivosALosSieteDias).toBe(0)
  })

  it('quien dijo que sí y nunca dio señal no cuenta como vivo', () => {
    const e = embudoDeAvisos([decision('a', true, 30)], 23, AHORA)
    expect(e.vivosALosSieteDias).toBe(0)
  })

  it('una persona es una persona, aunque vea la pantalla dos veces', () => {
    const e = embudoDeAvisos(
      [decision('a', false, 20), decision('a', true, 10, 1)],
      23,
      AHORA,
    )
    expect(e.vieron).toBe(1)
    // Y manda la decisión MÁS RECIENTE: cambió de opinión y dijo que sí.
    expect(e.dijeronSi).toBe(1)
  })

  it('sin nadie todavía, no revienta y no inventa', () => {
    expect(embudoDeAvisos([], 23, AHORA)).toEqual({
      vieron: 0,
      dijeronSi: 0,
      vivosALosSieteDias: 0,
      cartera: 23,
    })
  })
})

describe('la línea, escrita antes de ver el número', () => {
  const conSies = (n: number) =>
    embudoDeAvisos(
      Array.from({ length: n }, (_, i) => decision(`u${i}`, true, 30, 1)),
      23,
      AHORA,
    )

  it('doce o más: se construye el empuje', () => {
    expect(veredictoDelEmbudo(conSies(12), 10)).toBe('construir')
  })

  it('once: se aparca, y no se discute', () => {
    expect(veredictoDelEmbudo(conSies(11), 10)).toBe('aparcar')
  })

  it('antes de la semana no se decide nada', () => {
    // Decidir con el número de dos días es echarlo a cara o cruz.
    expect(veredictoDelEmbudo(conSies(3), DIAS_PARA_SEGUIR_VIVO - 1)).toBe('todavia-no-toca')
    expect(veredictoDelEmbudo(conSies(20), DIAS_PARA_SEGUIR_VIVO - 1)).toBe('todavia-no-toca')
  })
})
