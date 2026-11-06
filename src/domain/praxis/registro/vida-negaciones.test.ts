import { describe, expect, it } from 'vitest'
import { calidadDeSueno, resolverVida } from './vida.ts'
import type { ContextoRegistro, VidaExtraida } from './tipos.ts'

/**
 * Dos lecturas al revés de la tabla cerrada de vida, halladas el 5-nov-2026 al construir `mensajeLargo.ts`.
 * Bryan aprobó arreglarlas primero con la prueba que las muestra:
 *   1. «no dormí bien» salía BUENA: solo se reconocía la negación de «mal», y «bien» ganaba.
 *   2. «súper», suelta, era BUENA en el rendimiento: «súper pesado» salía como un buen entreno.
 * Frases inventadas.
 */
const ctx = (): ContextoRegistro => ({
  ahora: '2026-09-30T14:00:00-05:00', microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null },
  ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: null },
})
const vida = (o: Partial<VidaExtraida>): VidaExtraida => ({
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: null, escalas: [], senales: [], ...o,
})
const rendimiento = (cita: string) =>
  (resolverVida(vida({ escalas: [{ campo: 'rendimiento', cita }] }), ctx()).registros[0] as { parche?: { rendimiento?: string } } | undefined)?.parche?.rendimiento

describe('sueño: la negación de lo bueno no es buena', () => {
  it.each(['no dormí bien', 'no he dormido bien', 'anoche no dormí muy bien', 'no descansé bien'])('«%s» → MALA', (cita) => {
    expect(calidadDeSueno(cita)).toBe('MALA')
  })
  it('lo que ya funcionaba sigue igual', () => {
    expect(calidadDeSueno('dormí bien')).toBe('BUENA')
    expect(calidadDeSueno('no dormí mal')).toBe('REGULAR')
    expect(calidadDeSueno('dormí fatal')).toBe('MALA')
  })
})

describe('rendimiento: «súper» solo intensifica, no da valor', () => {
  it('«súper pesado» no sale BUENA', () => {
    expect(rendimiento('súper pesado')).not.toBe('BUENA')
  })
  it('«súper» suelta no da valor', () => {
    expect(rendimiento('súper')).toBeUndefined()
  })
  it('«súper bien» sigue siendo BUENA', () => {
    expect(rendimiento('me fue súper bien')).toBe('BUENA')
  })
  it('«súper mal» es MALA', () => {
    expect(rendimiento('súper mal')).toBe('MALA')
  })
})
