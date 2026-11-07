/**
 * Sueño, horas y pasos dictados a Praxis, medidos contra lo que una persona espera (Claude, 7-nov-2026).
 *
 * POR QUÉ EXISTE. Igual que con el agua (vida-agua.test.ts), una batería de 51 formas habituales de decirlo dio
 * 13 errores en `resolverVida`. Los graves guardaban un dato FALSO sin avisar:
 *  - «hora y media» de sueño quedaba en 0,5 h; «5 horas y cuarto», en 5; «6 horas 40 minutos», en 6;
 *  - «8,000» pasos quedaba en 8 pasos (la coma de miles leída como decimal);
 *  - «unas 6 o 7 horas» y «entre 5 y 6 horas» se anotaban como el número menor, sin preguntar.
 * Y otros se perdían en silencio: «8h», «10k», «7.5k», «a medianoche», «al mediodía» y «y pico».
 * Reglas que se mantienen: no se adivina un número que la persona no dijo; si nombró el dato y no se entiende, se
 * pregunta (sin bloquear lo demás) en vez de callar.
 */
import { describe, expect, it } from 'vitest'
import { resolverVida } from './vida.ts'
import type { ContextoRegistro, VidaExtraida } from './tipos.ts'

const ctx = (): ContextoRegistro => ({
  ahora: '2026-11-07T09:00:00-05:00', microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null },
  ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: null },
})
const vacia: VidaExtraida = {
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: null, escalas: [], senales: [],
}
const CAMPO = { sueno_horas: 'horasSueno', hora_acostarse: 'horaAcostarse', hora_levantarse: 'horaLevantarse', pasos: 'pasos' } as const
type Dicho = keyof typeof CAMPO

/** Lo que queda anotado para ese campo, 'pregunta' si Praxis pregunta, o 'nada'. */
function anotado(campo: Dicho, cita: string): string | number {
  const r = resolverVida({ ...vacia, [campo]: cita }, ctx())
  if (r.pregunta || r.seguimiento) return 'pregunta'
  const valor = JSON.stringify(r.registros).match(new RegExp(`"${CAMPO[campo]}":("?[^,}"]+"?)`))?.[1]?.replace(/"/g, '')
  if (valor === undefined) return 'nada'
  return /^-?[\d.]+$/.test(valor) ? Number(valor) : valor
}

describe('lo que ya funcionaba sigue igual', () => {
  it.each([
    ['sueno_horas', '7 horas', 7], ['sueno_horas', 'siete horas y media', 7.5], ['sueno_horas', '7 y media', 7.5],
    ['sueno_horas', '6,5 horas', 6.5], ['sueno_horas', 'como 5 horas', 5], ['sueno_horas', 'ocho horitas', 8],
    ['sueno_horas', 'cuatro horas nada más', 4], ['sueno_horas', 'casi nada, 3 horas', 3], ['sueno_horas', '30 horas', 'pregunta'],
    ['hora_acostarse', 'a las 11', '23:00'], ['hora_acostarse', 'como a las 12 y media', '00:30'], ['hora_acostarse', 'a las 11 menos cuarto', '22:45'],
    ['hora_levantarse', 'a las 6 menos cuarto', '05:45'], ['hora_levantarse', 'a las 7 y 20', '07:20'],
    ['pasos', '8.000', 8000], ['pasos', '8 mil', 8000], ['pasos', 'ocho mil quinientos', 8500], ['pasos', '12.500', 12500],
    ['pasos', '3,5 mil', 3500], ['pasos', 'once mil doscientos', 11200],
  ] as const)('%s «%s» = %s', (campo, cita, esperado) => {
    expect(anotado(campo, cita)).toBe(esperado)
  })
})

describe('los 13 errores de la medición del 7-nov', () => {
  it('las horas con minutos se suman: «hora y media» es 1,5, no 0,5', () => {
    expect(anotado('sueno_horas', 'hora y media')).toBe(1.5)
    expect(anotado('sueno_horas', '5 horas y cuarto')).toBe(5.3)
    expect(anotado('sueno_horas', '6 horas 40 minutos')).toBe(6.7)
  })
  it('«8h» son 8 horas', () => {
    expect(anotado('sueno_horas', '8h')).toBe(8)
  })
  it('un rango («6 o 7», «entre 5 y 6») se pregunta, no se anota el menor', () => {
    expect(anotado('sueno_horas', 'unas 6 o 7 horas')).toBe('pregunta')
    expect(anotado('sueno_horas', 'entre 5 y 6 horas')).toBe('pregunta')
  })
  it('«y pico» se pregunta en vez de perderse', () => {
    expect(anotado('sueno_horas', 'seis horas y pico')).toBe('pregunta')
    expect(anotado('pasos', '5 mil y pico')).toBe('pregunta')
  })
  it('medianoche y mediodía son horas', () => {
    expect(anotado('hora_acostarse', 'a medianoche')).toBe('00:00')
    expect(anotado('hora_levantarse', 'al mediodía')).toBe('12:00')
  })
  it('pasos con coma de miles o con k', () => {
    expect(anotado('pasos', '8,000')).toBe(8000)
    expect(anotado('pasos', '10k')).toBe(10000)
    expect(anotado('pasos', '7.5k')).toBe(7500)
  })
  it('lo que sí se entendió se anota aunque otro dato se pregunte', () => {
    const r = resolverVida({ ...vacia, sueno_horas: 'seis horas y pico', pasos: '8 mil' }, ctx())
    expect(r.pregunta).toBeUndefined()
    expect(r.seguimiento?.campo_bloqueante).toBe('horasSueno')
    expect(JSON.stringify(r.registros)).toContain('"pasos":8000')
  })
})
