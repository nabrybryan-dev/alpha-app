import { describe, expect, it } from 'vitest'
import { decidirTurno, pasoTrasProponer, SALUD_SIN_REGISTRO, type RespuestaDelRegistrador } from './conversacion'
import type { LoQuePraxisVe } from './plan/listaBlanca'

const ve: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_activo'] }
function servidor(orientacion: string): RespuestaDelRegistrador {
  return { ok: true, mensajeId: 's', propuesta: { accion: 'derivar', filtro: 'sintoma', orientacion_salud: orientacion, registros: [], descartado: [], notas_coach: [], citas_invalidas: [] }, tarjeta: { tipo: 'derivacion', guardable: false, lineas: [], avisos: [], descartado: [], botones: [], requiereConfirmarSesion: false, titulo: '' } } as unknown as RespuestaDelRegistrador
}

describe('la pantalla conserva la orientación de salud', () => {
  it.each([
    ['En la prensa sentí presión.', '¿En qué parte del cuerpo'],
    ['Sentí presión en el muslo durante la prensa.', '¿Te impide apoyar'],
  ])('una sensación explícita no depende del modelo para aclarar: %s', (frase, pregunta) => {
    const t = decidirTurno(frase, ve, '2026-10-05')
    expect(t.paso).toBe('salud')
    expect(t.paso === 'salud' && t.texto).toContain(pregunta)
    expect(t.vaAlModelo).toBe(false)
  })
  it('presión sin zona pregunta la zona y no interpreta ausencia de dolor como autorización', () => {
    const t = decidirTurno('En la prensa sentí presión, no dolor.', ve, '2026-10-05')
    expect(t.paso).toBe('salud')
    expect(t.paso === 'salud' && t.texto).toContain('¿En qué parte del cuerpo')
  })
  it('no obliga a esperar al coach tampoco en el texto local', () => {
    for (const t of Object.values(SALUD_SIN_REGISTRO)) expect(t).toMatch(/No espere(?:s)? una respuesta de .*coach para buscar atención médica/)
  })
  it('la orientación de preguntar no se pierde al recibir una derivación del servidor', () => {
    const p = pasoTrasProponer(servidor('preguntar_zona'), 'tu')
    expect(p.paso === 'salud' && p.texto).toContain('¿En qué parte del cuerpo')
  })
  it('la orientación de función no usa una pregunta de riesgo de vida', () => {
    const p = pasoTrasProponer(servidor('preguntar_funcion'), 'usted')
    expect(p.paso === 'salud' && p.texto).toContain('¿Le impide apoyar')
    expect(p.paso === 'salud' && p.texto).not.toContain('hacerse daño')
  })
})
