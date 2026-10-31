import { describe, expect, it } from 'vitest'
import type { RespuestaDelRegistrador } from '../conversacion'
import { dudaAntesDeEnviar, dudaTrasResponder } from './dudaEnEntrenar'

function respuesta(tarjeta: Record<string, unknown>, propuesta: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): RespuestaDelRegistrador {
  return {
    ok: true,
    mensajeId: 'm',
    propuesta: { accion: 'nada', registros: [], descartado: [], notas_coach: [], citas_invalidas: [], ...propuesta },
    tarjeta: { lineas: [], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, guardable: false, titulo: '', ...tarjeta },
    ...extra,
  } as unknown as RespuestaDelRegistrador
}

describe('dudaAntesDeEnviar · la seguridad corre antes de la red', () => {
  it('una frase de riesgo se detiene', () => {
    expect(dudaAntesDeEnviar('¿qué hago si me quiero morir?')).toEqual({ tipo: 'quieta', linea: 'vida' })
  })

  it('lo ambiguo se pregunta', () => {
    expect(dudaAntesDeEnviar('ya no puedo más con todo')).toEqual({ tipo: 'cuidado' })
  })

  it('lo clínico no sale del teléfono', () => {
    expect(dudaAntesDeEnviar('me duele la rodilla en la sentadilla')?.tipo).toBe('salud')
  })

  it('una duda de entreno puede salir', () => {
    expect(dudaAntesDeEnviar('¿para qué sirve el RIR?')).toBeNull()
  })
})

describe('dudaTrasResponder · qué se dice con lo que devolvió la función', () => {
  it('la ficha del portero se muestra', () => {
    const r = respuesta({ tipo: 'informativa', mensaje: 'Una vez no obliga a bajar peso.' }, { motivo: 'consulta' }, { fichas: ['a'] })
    expect(dudaTrasResponder(r)).toEqual({ tipo: 'respuesta', texto: 'Una vez no obliga a bajar peso.', fichas: ['a'] })
  })

  it('sin ficha lo dice, y el texto de relleno de la función no se muestra', () => {
    const r = respuesta({ tipo: 'informativa', mensaje: 'Eso lo decide Bryan con tus números.' }, { motivo: 'consulta' })
    expect(dudaTrasResponder(r).tipo).toBe('no_se')
  })

  it('la charla libre del modelo no pasa como respuesta: no tiene respaldo', () => {
    const r = respuesta({ tipo: 'informativa' }, { motivo: 'charla' }, { charla: 'Yo creo que sí, súbele.' })
    expect(dudaTrasResponder(r).tipo).toBe('no_se')
  })

  it('un registro no se guarda aquí', () => {
    const r = respuesta({ tipo: 'confirmacion', guardable: true, lineas: [{ tarjeta_id: 'm:0', texto: 'SENTADILLA', editable: true }] }, { accion: 'tarjeta' })
    expect(dudaTrasResponder(r).tipo).toBe('anotar')
  })

  it('la crisis que marca el servidor se detiene', () => {
    const r = respuesta({ tipo: 'derivacion' }, { accion: 'derivar', filtro: 'crisis', urgencia: 'alta' })
    expect(dudaTrasResponder(r)).toEqual({ tipo: 'quieta', linea: 'vida' })
  })

  it('el tope por hora se distingue de los demás fallos', () => {
    expect(dudaTrasResponder({ ok: false, motivo: 'limite' })).toEqual({ tipo: 'fallo', texto: expect.stringMatching(/muchas preguntas/) })
    expect(dudaTrasResponder({ ok: false, motivo: 'red' })).toEqual({ tipo: 'fallo', texto: expect.stringMatching(/No pude preguntar/) })
  })
})
