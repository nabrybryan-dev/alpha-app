import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La conexión real de Praxis: lo que `PraxisPage` le entrega a la escena. Se prueba que el
 * cableado respeta las tres reglas: lee del almacén de la PERSONA CON SESIÓN por la lista
 * blanca, no manda al registrador más contexto del necesario, y no escribe nada por sí sola.
 */
const proponer = vi.fn(async () => ({ ok: false as const, motivo: 'no_desplegada' as const }))
const guardarRegistro = vi.fn(async () => ({ ok: false as const, motivo: 'no_desplegada' as const }))
const dejar = vi.fn(async () => ({ ok: false as const, motivo: 'sin_nube' as const }))
const preguntasDe = vi.fn(async () => [])

vi.mock('../../data/praxis/registrador', () => ({ proponerRegistro: proponer, guardarRegistro }))
vi.mock('../../data/praxis/preguntasEnEspera', () => ({ dejarPreguntaEnEspera: dejar, preguntasEnEsperaDe: preguntasDe }))
vi.mock('../../data/supabase', () => ({ modoNube: false, sesionDeFunciones: async () => ({ access_token: 'jwt', url: 'https://x.supabase.co' }) }))

const { crearConexionPraxis, horaLocalIso } = await import('./conexionReal')

describe('horaLocalIso', () => {
  it('da la hora del teléfono con su zona, no la de Greenwich', () => {
    const d = new Date(2026, 9, 1, 18, 40, 5)
    const iso = horaLocalIso(d)
    expect(iso).toMatch(/^2026-10-01T18:40:05[+-]\d{2}:\d{2}$/)
    expect(new Date(iso).getTime()).toBe(d.getTime())
  })
})

describe('crearConexionPraxis', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.clearAllMocks())

  it('lee lo de la persona con sesión, ya pasado por la lista blanca', () => {
    const c = crearConexionPraxis('u-valentina', () => {})
    const ve = c.leer()
    expect(ve.activo).not.toBeNull()
    // La forma es la de la lista blanca: el microciclo crudo trae `id`, `usuarioId` y `estado`; lo que Praxis ve, no.
    expect(ve.activo).not.toHaveProperty('usuarioId')
    expect(ve.activo).not.toHaveProperty('estado')
    expect(c.usuarioId).toBe('u-valentina')
    expect(c.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('al proponer manda la frase y lo mínimo: ni el plan, ni el check-in, ni quién es', async () => {
    const c = crearConexionPraxis('u-valentina', () => {})
    await c.proponer('le metí 40 a la sentadilla', 'm-1')
    expect(proponer).toHaveBeenCalledTimes(1)
    const [sesion, peticion] = proponer.mock.calls[0] as unknown as [{ access_token: string }, Record<string, unknown>]
    expect(sesion.access_token).toBe('jwt')
    expect(Object.keys(peticion).sort()).toEqual(['frase', 'hidratacionHoyMl', 'horaLocal', 'mensajeId', 'verComposicion'].sort())
    expect(peticion.frase).toBe('le metí 40 a la sentadilla')
    expect(JSON.stringify(peticion)).not.toMatch(/u-valentina|sesiones|comentarios|dolor/)
  })

  it('guardar pasa solo lo confirmado, con la hora local', async () => {
    const c = crearConexionPraxis('u-valentina', () => {})
    const registros = [{ campo: 'adherencia', fecha: '2026-10-01', estado: 'si', confianza: 'alta' }] as never
    await c.guardar({ mensajeId: 'm-1', registros, confirmaSesion: true })
    const [, peticion] = guardarRegistro.mock.calls[0] as unknown as [unknown, Record<string, unknown>]
    expect(peticion).toMatchObject({ mensajeId: 'm-1', registros, confirmaSesion: true })
    expect(peticion.horaLocal).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('la pregunta en espera se deja a nombre de la persona con sesión', async () => {
    const c = crearConexionPraxis('u-valentina', () => {})
    await c.preguntar({ frase: '¿por qué bajó el press?', queFalto: 'porque_no_escrito', citas: ['M5→M6'] })
    expect(dejar).toHaveBeenCalledWith({ usuarioId: 'u-valentina', frase: '¿por qué bajó el press?', queFalto: 'porque_no_escrito', citas: ['M5→M6'] })
    await c.preguntas()
    expect(preguntasDe).toHaveBeenCalledWith('u-valentina')
  })

  it('crear la conexión no llama a nadie: nada sale hasta que la persona escribe', () => {
    crearConexionPraxis('u-valentina', () => {})
    expect(proponer).not.toHaveBeenCalled()
    expect(guardarRegistro).not.toHaveBeenCalled()
    expect(dejar).not.toHaveBeenCalled()
  })
})
