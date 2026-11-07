/**
 * El sueño, las horas, los pasos y el agua DICTADOS, medidos contra lo que la persona dijo (7-nov-2026).
 *
 * POR QUÉ EXISTE. La medición del 7-nov (F:\alpha-corridas\REDISENO-APP-20261021\biblioteca-praxis\registro-medido\
 * MEDICION-20261107.md, 1.034 citas inventadas por gramática) encontró 66 datos distintos de lo dicho y 110 silencios:
 * «4h», «9pm», «8k» y «2L» no se leían; «8,000» y «8 000» pasos daban 8; «8 mil quinientos» daba 8.000; «6 horas 40»
 * perdía los minutos; «un litro 200 ml» daba 1 mL; «las doce de la noche» daba mediodía; «10 o 11» daba 22:11.
 * Estas pruebas fijan lo que Bryan decidió el 7-nov-2026 (selector en el chat, DECISIONES-BRYAN-REGISTRO-20261107.md):
 *  - Lectura literal (sin decisión): número pegado a la unidad, miles con coma o espacio, «mil quinientos», medianoche
 *    y mediodía, «un litro 200 ml», «5 vasos de 250 ml».
 *  - Regla 1: un RANGO («6 o 7 horas», «8 o 9 mil», «uno o dos vasos») se PREGUNTA con los dos números como botones
 *    (el «Otro» lo pone la tarjeta). Nunca se anota el primero, el menor ni el medio. La pregunta no bloquea lo demás.
 *  - Regla 2: los minutos y fracciones del sueño se suman y se guardan con UN decimal (6 h 40 = 6,7; siete y cuarto = 7,3).
 *  - Regla 3: lo vago y el «y pico» en sueño y pasos quedan visibles en «no se guardó» con su motivo, y se ofrece el campo.
 * También fija lo que ya funcionaba, para que el arreglo no lo rompa. Fuera de alcance (no se prueba aquí): «ayer» en
 * agua y pasos (regla 4), la confianza de la hora aproximada y los topes de limites.ts.
 */
import { describe, expect, it } from 'vitest'
import { resolverVida, type ResultadoVida } from './vida.ts'
import { leerPasos, leerSueno } from './dictado.ts'
import { redondear1 } from './numeros.ts'
import type { ContextoRegistro, RegistroCheckin, VidaExtraida } from './tipos.ts'

const ctx = (): ContextoRegistro => ({
  ahora: '2026-11-07T12:00:00-05:00', microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null },
  ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: null },
} as unknown as ContextoRegistro)
const vacio = (): VidaExtraida => ({
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: null, escalas: [], senales: [],
})
const correr = (extra: Partial<VidaExtraida>): ResultadoVida => resolverVida({ ...vacio(), ...extra }, ctx())
const parche = (r: ResultadoVida): Record<string, string | number> =>
  (r.registros.find((x) => x.campo === 'checkin') as RegistroCheckin | undefined)?.parche ?? {}
const aguaMl = (cantidad: string, medida: string | null = null): number | undefined =>
  (correr({ agua: { cantidad, medida } }).registros.find((x) => x.campo === 'hidratacion') as { delta_ml?: number } | undefined)?.delta_ml

describe('sueño dictado: se anota lo dicho (reglas 2 y lectura literal)', () => {
  it.each([
    // ya funcionaba
    ['siete horas', 7], ['dormi como 6 horas', 6], ['6,5 horas', 6.5], ['ocho horas y media', 8.5], ['seis y media', 6.5],
    ['hora y media', 1.5], ['media hora', 0.5], ['ocho horas, mas o menos', 8], ['2 horitas', 2],
    // pegado a la unidad
    ['4h', 4], ['8 h', 8], ['9horas', 9], ['cuatrohoras', 4], ['7hrs', 7],
    // minutos y fracciones: se suman, un decimal
    ['cuatro horas y cuarto', 4.3], ['4 horas y 30 minutos', 4.5], ['4 horas 15 min', 4.3], ['6 horas 40', 6.7],
    ['siete y cuarto', 7.3], ['siete y veinte', 7.3], ['siete horas menos cuarto', 6.8], ['240 minutos', 4],
  ] as [string, number][])('«%s» = %d horas', (cita, horas) => {
    const r = correr({ sueno_horas: cita })
    expect(parche(r).horasSueno).toBe(horas)
    expect(r.pregunta).toBeUndefined()
  })
  it('propiedad: «N horas y M minutos» = N + M/60 con un decimal (N de 1 a 23, M de 0 a 45 de 15 en 15)', () => {
    for (let n = 1; n <= 23; n++) {
      for (const m of [0, 15, 30, 45]) {
        const cita = m === 0 ? `${n} horas` : `${n} horas y ${m} minutos`
        expect(leerSueno(cita), cita).toEqual({ tipo: 'valor', valor: redondear1(n + m / 60), aproximado: false })
        if (m > 0) expect(leerSueno(`${n} horas ${m} min`), `${n} horas ${m} min`).toMatchObject({ tipo: 'valor', valor: redondear1(n + m / 60) })
        expect(leerSueno(`${n}h`), `${n}h`).toMatchObject({ tipo: 'valor', valor: n })
      }
    }
  })
  it('sin número nada se anota ni se inventa: «cero» es 0 y «nada» no se pregunta', () => {
    expect(parche(correr({ sueno_horas: 'cero' })).horasSueno).toBe(0)
    const r = correr({ sueno_horas: 'nada' })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(r.descartado).toEqual([])
    expect(r.seguimiento).toBeUndefined()
  })
  it('un valor imposible sigue preguntando y bloqueando', () => {
    expect(correr({ sueno_horas: '20 horas' }).pregunta?.campo_bloqueante).toBe('horasSueno')
  })
})

describe('sueño dictado: rango = pregunta con los dos números (regla 1)', () => {
  it.each([
    ['6 o 7 horas', ['6 horas', '7 horas']], ['entre 6 y 7 horas', ['6 horas', '7 horas']],
    ['de 6 a 7 horas', ['6 horas', '7 horas']], ['seis o siete horas', ['6 horas', '7 horas']],
    ['entre 7 y 8', ['7 horas', '8 horas']],
  ] as [string, string[]][])('«%s» no anota nada y ofrece %j', (cita, opciones) => {
    const r = correr({ sueno_horas: cita })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(r.seguimiento?.opciones).toEqual(opciones)
    expect(r.seguimiento?.campo_bloqueante).toBe('horasSueno')
    expect(r.pregunta).toBeUndefined()
  })
  it('la pregunta no bloquea lo demás: los pasos dichos en la misma frase se anotan', () => {
    const r = correr({ sueno_horas: '6 o 7 horas', pasos: '8000' })
    expect(parche(r).pasos).toBe(8000)
    expect(r.seguimiento?.campo_bloqueante).toBe('horasSueno')
  })
  it('dos rangos en la misma frase: uno pregunta y el otro queda visible, ninguno se calla', () => {
    const r = correr({ sueno_horas: '6 o 7 horas', pasos: '8 o 9 mil' })
    expect(r.seguimiento).toBeDefined()
    expect(r.descartado.map((d) => d.cita)).toContain('8 o 9 mil')
    expect(parche(r).pasos).toBeUndefined()
  })
  it('propiedad: «N o N+1 horas» siempre pregunta N y N+1', () => {
    for (let n = 1; n <= 13; n++) {
      expect(leerSueno(`${n} o ${n + 1} horas`), `${n} o ${n + 1}`).toEqual({ tipo: 'rango', etiquetas: [`${n} horas`, `${n + 1} horas`] })
    }
  })
})

describe('sueño dictado: lo vago y «y pico» se descartan visibles (regla 3)', () => {
  it.each(['cuatro horas y pico', '7 horas y pico', 'poquito', 'harto', 'bastante'])('«%s» no se guarda, se dice por qué y se ofrece el campo', (cita) => {
    const r = correr({ sueno_horas: cita })
    expect(parche(r).horasSueno).toBeUndefined()
    expect(r.descartado).toHaveLength(1)
    expect(r.descartado[0].cita).toBe(cita)
    expect(r.descartado[0].motivo).toMatch(/número/)
    expect(r.seguimiento?.campo_bloqueante).toBe('horasSueno')
    expect(r.pregunta).toBeUndefined()
  })
})

describe('horas de acostarse y levantarse', () => {
  it.each([
    // ya funcionaba
    ['a las 10', 'acostarse', '22:00'], ['once y media', 'acostarse', '23:30'], ['11', 'acostarse', '23:00'],
    ['12 am', 'acostarse', '00:00'], ['12 pm', 'acostarse', '12:00'], ['1 am', 'acostarse', '01:00'],
    ['las 10 de la noche', 'acostarse', '22:00'], ['5:30', 'levantarse', '05:30'], ['6 y cuarto', 'levantarse', '06:15'],
    // pegado a la unidad
    ['9pm', 'acostarse', '21:00'], ['10pm', 'acostarse', '22:00'], ['9am', 'acostarse', '09:00'], ['12am', 'acostarse', '00:00'],
    ['12pm', 'acostarse', '12:00'], ['5am', 'levantarse', '05:00'], ['6pm', 'levantarse', '18:00'], ['10:30pm', 'acostarse', '22:30'],
    // medianoche y mediodía; la 12 de la noche es 00:00 y la 12 del día es 12:00
    ['medianoche', 'acostarse', '00:00'], ['mediodia', 'acostarse', '12:00'], ['las doce de la noche', 'acostarse', '00:00'],
    ['las 12 del dia', 'acostarse', '12:00'], ['las 12 de la noche', 'acostarse', '00:00'], ['las doce del dia', 'levantarse', '12:00'],
  ] as [string, 'acostarse' | 'levantarse', string][])('«%s» (%s) = %s', (cita, cual, hora) => {
    const r = correr(cual === 'acostarse' ? { hora_acostarse: cita } : { hora_levantarse: cita })
    expect(parche(r)[cual === 'acostarse' ? 'horaAcostarse' : 'horaLevantarse']).toBe(hora)
  })
  it('un rango NO se lee con el segundo número como minutos: pregunta con las dos horas', () => {
    for (const [cita, ops] of [['10 o 11', ['22:00', '23:00']], ['entre diez y once', ['22:00', '23:00']], ['entre las 11 y las 12', ['23:00', '00:00']]] as [string, string[]][]) {
      const r = correr({ hora_acostarse: cita })
      expect(parche(r).horaAcostarse, cita).toBeUndefined()
      expect(r.seguimiento?.opciones, cita).toEqual(ops)
      expect(r.seguimiento?.campo_bloqueante).toBe('horaAcostarse')
    }
    const l = correr({ hora_levantarse: '6 o 7' })
    expect(parche(l).horaLevantarse).toBeUndefined()
    expect(l.seguimiento?.opciones).toEqual(['06:00', '07:00'])
  })
  it('«hasta la una» sigue preguntando a qué hora se durmió, y bloquea', () => {
    expect(correr({ hora_acostarse: 'hasta la una' }).pregunta?.campo_bloqueante).toBe('horaAcostarse')
  })
  it('propiedad: «Npm» y «Nam» valen lo mismo que «N pm» y «N am» (N de 1 a 12)', () => {
    for (let n = 1; n <= 12; n++) {
      for (const suf of ['am', 'pm']) {
        const pegado = parche(correr({ hora_levantarse: `${n}${suf}` })).horaLevantarse
        const suelto = parche(correr({ hora_levantarse: `${n} ${suf}` })).horaLevantarse
        expect(pegado, `${n}${suf}`).toBeDefined()
        expect(pegado, `${n}${suf}`).toBe(suelto)
      }
    }
  })
})

describe('pasos dictados', () => {
  it.each([
    // ya funcionaba
    ['8 mil', 8000], ['ocho mil trescientos cincuenta', 8350], ['12.350', 12350], ['8.000', 8000], ['como 8.000, creo', 8000],
    ['mil quinientos', 1500], ['cuarenta y cinco mil', 45000], ['9500', 9500], ['unos ocho mil', 8000],
    // pegado a la unidad
    ['8k', 8000], ['8K', 8000], ['8,5k', 8500], ['8.5k', 8500], ['8000pasos', 8000], ['8000 pasos', 8000],
    // miles con coma o espacio
    ['8,000', 8000], ['8 000', 8000], ['12,350', 12350], ['20 000', 20000],
    // mil + resto
    ['8 mil quinientos', 8500], ['8 mil 500', 8500], ['ocho mil quinientos', 8500], ['6 mil y medio', 6500], ['seis mil y medio', 6500],
  ] as [string, number][])('«%s» = %d', (cita, pasos) => {
    const r = correr({ pasos: cita })
    expect(parche(r).pasos).toBe(pasos)
    expect(r.pregunta).toBeUndefined()
  })
  it('«como 8,000» queda con confianza media y «8,000» con alta', () => {
    const conf = (c: string) => ((correr({ pasos: c }).registros[0]) as RegistroCheckin).confianza_por_campo.pasos
    expect(conf('como 8,000')).toBe('media')
    expect(conf('8,000')).toBe('alta')
  })
  it('propiedad: «Nk», «N,000», «N 000», «N000pasos», «N mil» y «N mil quinientos» (N de 1 a 40)', () => {
    for (let n = 1; n <= 40; n++) {
      const mil = n * 1000
      for (const cita of [`${n}k`, `${n}K`, `${n},000`, `${n} 000`, `${n}000pasos`, `${n} mil`]) {
        expect(leerPasos(cita), cita).toMatchObject({ tipo: 'valor', valor: mil })
      }
      for (const cita of [`${n} mil quinientos`, `${n} mil 500`, `${n},5k`, `${n}.5k`, `${n} mil y medio`]) {
        expect(leerPasos(cita), cita).toMatchObject({ tipo: 'valor', valor: mil + 500 })
      }
    }
  })
  it.each([
    ['8 o 9 mil', ['8.000 pasos', '9.000 pasos']], ['entre 6 y 7 mil', ['6.000 pasos', '7.000 pasos']],
    ['7 a 8 mil', ['7.000 pasos', '8.000 pasos']], ['8,000 o 9,000', ['8.000 pasos', '9.000 pasos']],
    ['ocho o nueve mil', ['8.000 pasos', '9.000 pasos']],
  ] as [string, string[]][])('rango «%s» pregunta %j y no anota', (cita, opciones) => {
    const r = correr({ pasos: cita })
    expect(parche(r).pasos).toBeUndefined()
    expect(r.seguimiento?.opciones).toEqual(opciones)
    expect(r.seguimiento?.campo_bloqueante).toBe('pasos')
    expect(r.pregunta).toBeUndefined()
  })
  it.each(['8 mil y pico', '3.000 y pico', 'poquitos', 'bastantes'])('«%s» no se guarda, queda visible y se ofrece el campo', (cita) => {
    const r = correr({ pasos: cita })
    expect(parche(r).pasos).toBeUndefined()
    expect(r.descartado[0]?.cita).toBe(cita)
    expect(r.descartado[0]?.motivo).toMatch(/número/)
    expect(r.seguimiento?.campo_bloqueante).toBe('pasos')
  })
  it('lo que ya se descartaba sigue igual: «caminé bastante» ofrece el campo sin bloquear', () => {
    const r = correr({ actividad_sin_numero: 'caminé harto' })
    expect(r.descartado).toHaveLength(1)
    expect(r.seguimiento?.campo_bloqueante).toBe('pasos')
  })
  it('120.000 sigue siendo imposible: pregunta y bloquea', () => {
    expect(correr({ pasos: '120.000' }).pregunta?.campo_bloqueante).toBe('pasos')
  })
})

describe('agua dictada', () => {
  it.each([
    // ya funcionaba
    ['2', 'vasos', 400], ['litro y medio', null, 1500], ['dos litros y medio', null, 2500], ['1,5', 'litros', 1500],
    ['tres vasos y una botella de 600', null, 1200], ['500', 'ml', 500], ['vaso y medio', null, 300], ['una taza', null, 200],
    // pegado a la unidad
    ['2L', null, 2000], ['2 L', null, 2000], ['2 lts', null, 2000], ['250ml', null, 250], ['250cc', null, 250], ['3vasos', null, 600],
    ['1.5L', null, 1500],
    // un litro 200 ml; 5 vasos de 250 ml
    ['un litro 200 ml', null, 1200], ['1 litro y 200 ml', null, 1200], ['5 vasos de 250 ml', null, 1250], ['dos vasos de 250', null, 500],
    // «y media» y «y cuarto» con la unidad
    ['una taza y media', null, 300], ['dos litros y cuarto', null, 2250], ['un litros y cuarto', null, 1250], ['litro y cuarto', null, 1250],
    ['tres litros y cuarto', null, 3250 > 3000 ? undefined : 3250],
  ] as [string, string | null, number | undefined][])('«%s %s» = %s mL', (c, m, ml) => {
    expect(aguaMl(c, m)).toBe(ml)
  })
  it('propiedad: «N litros y cuarto» = N·1000+250 y «N vasos de 250 ml» = N·250', () => {
    for (let n = 1; n <= 2; n++) expect(aguaMl(`${n} litros y cuarto`), `${n} litros y cuarto`).toBe(n * 1000 + 250)
    for (let n = 1; n <= 12; n++) expect(aguaMl(`${n} vasos de 250 ml`), `${n} vasos de 250 ml`).toBe(n * 250)
  })
  it.each([
    ['2 o 3', 'vasos', ['2 vasos', '3 vasos']], ['uno o dos', 'vasos', ['uno vasos', 'dos vasos']],
    ['2 o 3 litros', null, ['2 litros', '3 litros']], ['entre 2 y 3 litros', null, ['2 litros', '3 litros']],
    ['medio o un litro', null, ['medio litro', 'un litro']],
  ] as [string, string | null, string[]][])('rango «%s %s» pregunta %j y no anota', (c, m, opciones) => {
    const r = correr({ agua: { cantidad: c, medida: m } })
    expect(r.registros.find((x) => x.campo === 'hidratacion')).toBeUndefined()
    expect(r.seguimiento?.opciones).toEqual(opciones)
    expect(r.seguimiento?.campo_bloqueante).toBe('agua_cantidad')
  })
  it('una botella sin tamaño sigue preguntando el tamaño', () => {
    expect(correr({ agua: { cantidad: 'una botella', medida: null } }).seguimiento?.campo_bloqueante).toBe('botella_ml')
  })
})
