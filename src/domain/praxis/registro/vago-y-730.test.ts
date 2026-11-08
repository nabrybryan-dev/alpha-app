// Decisión de Bryan (8-nov-2026, decisión 3 de DECISIONES-BRYAN-REGISTRO-20261107.md): lo vago en sueño y pasos queda
// visible en «no se guardó» con su razón, se ofrece el campo y no se inventa un valor.
//  (1) Tras un número, «y» + una palabra que no es cifra («y algo», «y poquito», «y tanto») es vago, igual que «y pico».
//  (2) «7:30» SIN unidad en el campo de sueño no se lee como 7 en silencio: se pregunta. «7:30 horas» sigue dando 7,5
//      y en el campo de HORA (acostarse/levantarse) «7:30» sigue siendo hora de reloj.
import { describe, expect, it } from 'vitest'
import { leerHora, leerPasos, leerSueno } from './dictado.ts'
import { resolverVida, type ResultadoVida } from './vida.ts'
import type { ContextoRegistro, VidaExtraida } from './tipos.ts'

describe('sueño: «y» + palabra sin cifra tras un número es vago', () => {
  it.each(['siete horas y algo', '7 horas y poquito', 'ocho horas y tanto', 'seis horas y pico', 'una hora y algo', '7 y algo'])(
    '«%s» es vago', (cita) => {
      expect(leerSueno(cita), cita).toEqual({ tipo: 'vago' })
    })

  it.each([
    ['siete horas y media', 7.5], ['ocho horas y cuarto', 8.3], ['siete horas y 30 minutos', 7.5],
    ['siete horas y 45', 7.8], ['siete y media', 7.5], ['dos horas y media', 2.5],
    ['siete horas y treinta', 7.5], ['seis horas y cuarenta y cinco', 6.8], ['siete horas y tres cuartos', 7.8],
    ['siete horas y un cuarto', 7.3], ['7 horas y 30 min', 7.5],
  ] as [string, number][])('«%s» se sigue leyendo = %d', (cita, horas) => {
    expect(leerSueno(cita), cita).toMatchObject({ tipo: 'valor', valor: horas })
  })
})

describe('pasos: «y» + palabra sin cifra tras un número es vago', () => {
  it.each(['10 mil pasos y algo', '8000 pasos y pico', '8000 pasos y poquito', 'diez mil y tanto'])('«%s» es vago', (cita) => {
    expect(leerPasos(cita), cita).toEqual({ tipo: 'vago' })
  })

  it.each([['8 mil pasos y 500', 8500], ['8000 pasos', 8000], ['ocho mil y medio', 8500], ['diez mil pasos', 10000]] as [string, number][])(
    '«%s» se sigue leyendo = %d', (cita, pasos) => {
      expect(leerPasos(cita), cita).toMatchObject({ tipo: 'valor', valor: pasos })
    })
})

const ctx = (): ContextoRegistro => ({
  ahora: '2026-11-07T12:00:00-05:00', microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null },
  ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: null },
} as unknown as ContextoRegistro)
const vacio = (): VidaExtraida => ({
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: null, escalas: [], senales: [],
})
const correr = (extra: Partial<VidaExtraida>): ResultadoVida => resolverVida({ ...vacio(), ...extra }, ctx())
const guardado = (r: ResultadoVida): Record<string, unknown> =>
  (r.registros.find((x) => x.campo === 'checkin') as { parche?: Record<string, unknown> } | undefined)?.parche ?? {}

describe('sueño: «7:30» sin unidad se pregunta, no se anota como 7', () => {
  it('«7:30» no es un valor', () => {
    expect(leerSueno('7:30')?.tipo).not.toBe('valor')
  })
  it.each(['7:30', 'dormí 7:30', '8:15'])('«%s» no guarda horas y pregunta', (cita) => {
    const r = correr({ sueno_horas: cita })
    expect(guardado(r).horasSueno, cita).toBeUndefined()
    expect(r.seguimiento?.campo_bloqueante, cita).toBe('horasSueno')
  })
  it('la pregunta nombra horas y minutos', () => {
    expect(correr({ sueno_horas: '7:30' }).seguimiento?.texto).toMatch(/7 horas y 30 minutos/)
  })
  it.each([['7:30 horas', 7.5], ['7h30', 7.5], ['7 horas', 7]] as [string, number][])('«%s» sigue = %d', (cita, h) => {
    expect(leerSueno(cita), cita).toMatchObject({ tipo: 'valor', valor: h })
  })
  it('en el campo de hora, «7:30» sigue siendo hora de reloj', () => {
    expect(leerHora('7:30', 'levantarse')).toMatchObject({ tipo: 'valor', valor: '07:30' })
  })
})
