/**
 * Qué mensaje del coach se enseña debajo del vídeo de la revisión.
 *
 * Decisión de Bryan (2026-09-12): la pregunta que el coach le deja a la persona —«¿del
 * 0 al 10, cuánto te duele la rodilla?», «¿ya retomaste?»— tiene que verse debajo del
 * vídeo, sin entrar al chat. Desde ese mismo día, con el riesgo escalonado, de esa
 * respuesta depende si el plan sigue o se para.
 *
 * Lo que estas pruebas fijan es lo que la tarjeta NO debe hacer: quedarse pegada
 * cuando la persona ya contestó, enseñar un saludo como si fuera una pregunta, o
 * presentar una respuesta automática del Centro como palabra del coach.
 */
import { describe, expect, it } from 'vitest'
import type { Mensaje } from './types'
import { preguntaPendienteDelCoach } from './preguntaDelCoach'

const COACH = 'u-coach'
const YO = 'u-yo'

function mensaje(parcial: Partial<Mensaje> & Pick<Mensaje, 'deId' | 'texto' | 'fechaIso'>): Mensaje {
  return {
    id: `m-${parcial.fechaIso}`,
    paraId: parcial.deId === COACH ? YO : COACH,
    leido: false,
    ...parcial,
  }
}

describe('la pregunta pendiente del coach', () => {
  it('es la última palabra del hilo, si es del coach y pregunta algo', () => {
    const hilo = [
      mensaje({ deId: YO, texto: 'Hola', fechaIso: '2026-09-10T10:00:00Z' }),
      mensaje({ deId: COACH, texto: '¿Del 0 al 10, cuánto te duele hoy?', fechaIso: '2026-09-12T20:00:00Z' }),
    ]
    expect(preguntaPendienteDelCoach(hilo, COACH)?.texto).toBe('¿Del 0 al 10, cuánto te duele hoy?')
  })

  it('desaparece en cuanto la persona contesta', () => {
    const hilo = [
      mensaje({ deId: COACH, texto: '¿Ya retomaste?', fechaIso: '2026-09-12T20:00:00Z' }),
      mensaje({ deId: YO, texto: 'Sí, desde el lunes', fechaIso: '2026-09-12T21:00:00Z' }),
    ]
    expect(preguntaPendienteDelCoach(hilo, COACH)).toBeUndefined()
  })

  it('un mensaje que no pregunta nada no se queda pegado debajo del vídeo', () => {
    const hilo = [mensaje({ deId: COACH, texto: 'Buen trabajo esta semana', fechaIso: '2026-09-12T20:00:00Z' })]
    expect(preguntaPendienteDelCoach(hilo, COACH)).toBeUndefined()
  })

  it('una respuesta automática del Centro no se presenta como pregunta del coach', () => {
    const hilo = [
      mensaje({ deId: COACH, texto: '¿Quieres que se lo pase al coach?', fechaIso: '2026-09-12T20:00:00Z', origen: 'alpha' }),
    ]
    expect(preguntaPendienteDelCoach(hilo, COACH)).toBeUndefined()
  })

  // 12-sep, segunda vuelta: Bryan escribe en el mismo hilo que la pregunta del cerebro.
  // Con la primera regla («solo el último mensaje»), un «buen trabajo» suyo detrás de la
  // pregunta la borraba de debajo del vídeo sin que nadie la hubiera contestado.
  it('un mensaje del coach detrás de la pregunta no la tapa: sigue sin contestar', () => {
    const hilo = [
      mensaje({ deId: COACH, texto: '¿Del 0 al 10, cuánto te duele hoy?', fechaIso: '2026-09-12T20:00:00Z' }),
      mensaje({ deId: COACH, texto: 'Buen trabajo esta semana', fechaIso: '2026-09-12T21:00:00Z' }),
    ]
    expect(preguntaPendienteDelCoach(hilo, COACH)?.texto).toBe('¿Del 0 al 10, cuánto te duele hoy?')
  })

  it('tampoco la tapa una respuesta automática del Centro', () => {
    const hilo = [
      mensaje({ deId: COACH, texto: '¿Ya retomaste?', fechaIso: '2026-09-12T20:00:00Z' }),
      mensaje({ deId: COACH, texto: 'Recibido, tu coach lo verá', fechaIso: '2026-09-12T21:00:00Z', origen: 'alpha' }),
    ]
    expect(preguntaPendienteDelCoach(hilo, COACH)?.texto).toBe('¿Ya retomaste?')
  })

  it('con dos preguntas sin contestar, se enseña la más reciente', () => {
    const hilo = [
      mensaje({ deId: COACH, texto: '¿Ya retomaste?', fechaIso: '2026-09-11T20:00:00Z' }),
      mensaje({ deId: COACH, texto: '¿Cuántos días pudiste entrenar?', fechaIso: '2026-09-12T20:00:00Z' }),
    ]
    expect(preguntaPendienteDelCoach(hilo, COACH)?.texto).toBe('¿Cuántos días pudiste entrenar?')
  })

  it('una pregunta anterior a la última palabra de la persona ya está contestada', () => {
    const hilo = [
      mensaje({ deId: COACH, texto: '¿Ya retomaste?', fechaIso: '2026-09-11T20:00:00Z' }),
      mensaje({ deId: YO, texto: 'Sí', fechaIso: '2026-09-11T21:00:00Z' }),
      mensaje({ deId: COACH, texto: 'Perfecto, sigue así', fechaIso: '2026-09-12T20:00:00Z' }),
    ]
    expect(preguntaPendienteDelCoach(hilo, COACH)).toBeUndefined()
  })

  it('no depende del orden en que llegaron los mensajes', () => {
    const hilo = [
      mensaje({ deId: COACH, texto: '¿Ya retomaste?', fechaIso: '2026-09-12T20:00:00Z' }),
      mensaje({ deId: YO, texto: 'Hola', fechaIso: '2026-09-10T10:00:00Z' }),
    ]
    expect(preguntaPendienteDelCoach(hilo, COACH)?.texto).toBe('¿Ya retomaste?')
  })

  it('sin mensajes no hay nada que enseñar', () => {
    expect(preguntaPendienteDelCoach([], COACH)).toBeUndefined()
  })
})
