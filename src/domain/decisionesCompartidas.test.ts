import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AREAS,
  DIRECCIONES,
  PALANCAS_CON_MONTO,
  PALANCAS_POR_AREA,
  PATRON_SUJETO,
  TABLAS_REFERENCIA,
  TAREAS_CLINICAS,
  fraseDeDecision,
  soloElCoach,
  textoVetado,
} from './decisionesCompartidas'

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0094_decisiones_compartidas.sql'), 'utf8')

const entreComillas = (texto: string) => [...texto.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])

describe('las listas cerradas salen de la migración 0094', () => {
  it('las palancas de cada área son las de decision_palancas()', () => {
    const inicio = SQL.indexOf('create or replace function public.decision_palancas')
    const cuerpo = SQL.slice(inicio, SQL.indexOf('$$;', inicio + 200))
    for (const area of AREAS) {
      const linea = cuerpo.split('\n').find((l) => l.includes(`when '${area}'`))
      expect(linea, `la 0094 no lista palancas de ${area}`).toBeDefined()
      // El primer texto entre comillas es el nombre del área.
      expect(entreComillas(linea as string).slice(1)).toEqual([...PALANCAS_POR_AREA[area]])
    }
  })

  it('direcciones, áreas, tablas de referencia y tareas clínicas son las del check', () => {
    const direccion = SQL.slice(SQL.indexOf('direccion           text not null'), SQL.indexOf('sujeto              text'))
    expect(entreComillas(direccion)).toEqual([...DIRECCIONES])
    const area = SQL.slice(SQL.indexOf('area                text not null'), SQL.indexOf('palanca             text'))
    expect(entreComillas(area)).toEqual([...AREAS])
    const ref = SQL.slice(SQL.indexOf('referencia_tabla    text'), SQL.indexOf('referencia_id       text'))
    expect(entreComillas(ref)).toEqual([...TABLAS_REFERENCIA])
    for (const tarea of TAREAS_CLINICAS) expect(SQL).toContain(`'${tarea}'`)
  })

  it('las palancas con monto son las mismas que la base exige (vista y check del cero)', () => {
    const inicio = SQL.indexOf('when d.palanca in (')
    const enLaVista = SQL.slice(inicio, SQL.indexOf('then', inicio))
    expect(entreComillas(enLaVista)).toEqual([...PALANCAS_CON_MONTO])
  })

  it('el patrón del sujeto es el mismo del check de la base', () => {
    const enElSql = SQL.match(/sujeto ~ '(\^\(cli-[^']+\$)'/)?.[1]
    expect(enElSql).toBeDefined()
    // El SQL usa [0-9] donde JavaScript usa \d: se comparan con la misma clase.
    const js = PATRON_SUJETO.source.replaceAll('\\d', '[0-9]').replaceAll('\\', '')
    expect(js).toBe((enElSql as string).replaceAll('\\', ''))
  })
})

describe('textoVetado: el aviso previo, con la misma lista que la base', () => {
  it.each([
    ['bajar a 1.900 kcal', 'carga o de comida'],
    ['subir 5 kg', 'carga o de comida'],
    ['3 series de 10 reps', 'carga o de comida'],
    ['tiene 20 % de grasa', 'grasa'],
    ['dolor en la zona lumbar', 'salud'],
    ['cuidar la rodilla', 'salud'],
    ['escríbele a persona@ejemplo.test', '@'],
    ['hablar con @alguien', '@'],
    ['llamarla al 300 123 4567', 'teléfono'],
    ['llamarla al +57 300-123-4567', 'teléfono'],
  ])('rechaza «%s»', (texto, motivo) => {
    expect(textoVetado(texto)).toContain(motivo)
  })

  it.each([
    'Entrenadores que venden coaching → oferta de alquiler',
    'comisión 10 %',
    'precio 1200000',
    'dec-20260928-4',
    'preparar el mensaje',
  ])('deja pasar «%s»', (texto) => {
    expect(textoVetado(texto)).toBeNull()
  })
})

describe('quién anota y cómo se dice', () => {
  it('finanzas y las altas de creadores son solo del coach; lo demás, no', () => {
    expect(soloElCoach('finanzas', 'bono')).toBe(true)
    expect(soloElCoach('creadores', 'incorporacion')).toBe(true)
    expect(soloElCoach('creadores', 'microprueba')).toBe(true)
    expect(soloElCoach('creadores', 'segmento')).toBe(false)
    expect(soloElCoach('nutricion', 'plan_nuevo')).toBe(false)
  })

  it('sin resumen (entrenamiento y nutrición), la frase se genera de los enums, sin texto libre', () => {
    expect(fraseDeDecision({ area: 'nutricion', palanca: 'plan_nuevo', direccion: 'inicia', resumen: null })).toBe(
      'Nutrición · plan nuevo · inicia',
    )
    expect(
      fraseDeDecision({ area: 'creadores', palanca: 'segmento', direccion: 'incluye', resumen: 'Oferta de alquiler' }),
    ).toBe('Oferta de alquiler')
  })
})
