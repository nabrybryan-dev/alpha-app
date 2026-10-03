// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contextoDeCorpus } from '../../../../scripts/praxis-eval/contexto-corpus.ts'
import { DISCREPANCIAS_CONOCIDAS, EXTRACCIONES_GRABADAS } from '../../../../scripts/praxis-eval/extracciones-grabadas.ts'
import { numerosInventados, puntuarCE, type Caso } from '../../../../scripts/praxis-eval/puntuar.ts'
import { validarExtraccion } from './esquema.ts'
import { resolverPropuesta } from './resolver.ts'
import type { Propuesta, RegistroSeries } from './tipos.ts'

const corpus: Caso[] = JSON.parse(readFileSync(new URL('../../../../scripts/praxis-eval/corpus.json', import.meta.url), 'utf8'))
const caso = (id: string): Caso => corpus.find((c) => c.id === id)!

function correr(id: string): { p: Propuesta; invalidas: string[] } {
  const c = caso(id)
  const ctx = contextoDeCorpus(c.contexto)
  const { extraccion, citasInvalidas } = validarExtraccion(c.frase, EXTRACCIONES_GRABADAS[id])
  return { p: resolverPropuesta(c.frase, extraccion, ctx, citasInvalidas), invalidas: citasInvalidas }
}
const series = (p: Propuesta): RegistroSeries[] => p.registros.filter((r): r is RegistroSeries => r.campo === 'series')

describe('extracciones grabadas contra el corpus (sin modelo)', () => {
  const ids = Object.keys(EXTRACCIONES_GRABADAS).filter((id) => !(id in DISCREPANCIAS_CONOCIDAS))

  it.each(ids)('%s: toda cita es literal de la frase', (id) => {
    expect(correr(id).invalidas).toEqual([])
  })

  it.each(ids)('%s: cada campo coincide con lo esperado', (id) => {
    const { p } = correr(id)
    const r = puntuarCE(caso(id), p, false)
    const malos = r.campos.filter((c) => !c.ok)
    expect(malos, `${id} «${caso(id).frase}»\n${JSON.stringify(p, null, 1)}`).toEqual([])
  })

  it.each(ids)('%s: la confianza coincide', (id) => {
    const { p } = correr(id)
    const r = puntuarCE(caso(id), p, false)
    expect(r.confianza.filter((c) => !c.ok)).toEqual([])
  })

  it.each(ids)('%s: cero números inventados', (id) => {
    const c = caso(id)
    const { p } = correr(id)
    expect(numerosInventados(c.frase, contextoDeCorpus(c.contexto), p)).toEqual([])
  })
})

describe('reglas que importan', () => {
  it('el RIR nunca sale de la pauta (CE-001, CE-020)', () => {
    for (const id of ['CE-001', 'CE-011', 'CE-020']) {
      for (const r of series(correr(id).p)) for (const s of r.valor) expect(s.rir).toBeUndefined()
    }
  })

  it('«llegué al fallo» no es RIR 0 y avisa al coach (CE-017)', () => {
    const { p } = correr('CE-017')
    expect(series(p)[0].valor[0].rir).toBeUndefined()
    expect(p.notas_coach.join(' ')).toMatch(/fallo/)
  })

  it('RIR 6 se guarda como 5 con aviso (CE-019)', () => {
    const r = series(correr('CE-019').p)[0]
    expect(r.valor[0].rir).toBe(5)
    expect(r.avisos.join(' ')).toMatch(/llega a 5/)
  })

  it('135 libras son 61,2 kg y se muestra lo dicho (CE-008)', () => {
    const r = series(correr('CE-008').p)[0]
    expect(r.valor[0].cargaKg).toBe(61.2)
    expect(r.dicho).toEqual({ valor: 135, unidad: 'libras' })
    expect(r.desglose).toBe('135 lb = 61,2 kg')
  })

  it('discos: barra 20 + 2 lados × 2 discos × 10 = 60 con desglose (CE-009)', () => {
    const r = series(correr('CE-009').p)[0]
    expect(r.valor[0].cargaKg).toBe(60)
    expect(r.desglose).toBe('20 + 40 = 60 kg')
  })

  it('la barra sola sin perfil pregunta y no adivina (CE-006)', () => {
    const { p } = correr('CE-006')
    expect(p.accion).toBe('preguntar')
    expect(p.pregunta?.campo_bloqueante).toBe('peso_barra')
    expect(p.registros).toEqual([])
    expect(p.borrador_pendiente).toMatchObject({ ejercicio_id: 'pa1', series: 3, reps: 15 })
  })

  it('con la barra en el perfil sale la tarjeta con media confianza (CE-007)', () => {
    const r = series(correr('CE-007').p)[0]
    expect(r.confianza).toBe('media')
    expect(r.desglose).toBe('barra sola = 20 kg')
  })

  it('dos ejercicios que encajan preguntan (CE-010, CE-036)', () => {
    expect(correr('CE-010').p.pregunta?.opciones).toEqual(['SENTADILLA BULGARA', 'SENTADILLA GOBLET'])
    expect(correr('CE-036').p.accion).toBe('preguntar')
  })

  it('sin nombre y sin pantalla pregunta con las dos opciones razonables (CE-029)', () => {
    const { p } = correr('CE-029')
    expect(p.pregunta?.opciones).toEqual(['SENTADILLA TRASERA, serie 2', 'PRENSA 45, serie 1'])
  })

  it('un ejercicio de otra sesión pide confirmar la sesión y avisa (CE-030)', () => {
    const { p } = correr('CE-030')
    expect(p.requiere_confirmacion_de_sesion).toBe(true)
    expect(p.aviso).toMatch(/S3|TRACCION/)
    expect(p.sesion_id).toBe('S3')
  })

  it('la variante que no está en la rutina no se fuerza en otro ejercicio (CE-031, CE-033, CE-041)', () => {
    for (const id of ['CE-031', 'CE-033', 'CE-041']) {
      const { p } = correr(id)
      expect(p.accion, id).toBe('preguntar')
      expect(p.registros, id).toEqual([])
    }
  })

  it('no crea series por encima de sets sin preguntar (CE-045)', () => {
    const { p } = correr('CE-045')
    expect(p.accion).toBe('preguntar')
    expect(p.borrador_pendiente).toMatchObject({ ejercicio_id: 'pb5', orden: 4, cargaKg: 25, reps: 8 })
  })

  it('el mismo mensaje que la serie recién guardada pregunta (CE-046)', () => {
    expect(correr('CE-046').p.pregunta?.campo_bloqueante).toBe('serie_repetida')
  })

  it('las correcciones sustituyen por orden y muestran el antes (CE-047, CE-048)', () => {
    const a = series(correr('CE-047').p)[0]
    expect(a.valor).toEqual([{ orden: 1, cargaKg: 45, reps: 12 }])
    expect(a.reemplaza).toEqual({ orden: 1, antes: { cargaKg: 40, reps: 12 } })
    const b = series(correr('CE-048').p)[0]
    expect(b.valor).toEqual([{ orden: 2, cargaKg: 65, reps: 12 }])
    expect(b.reemplaza?.antes).toEqual({ cargaKg: 65, reps: 10 })
  })

  it('borrar no existe: no se inventa la operación (CE-049)', () => {
    const { p } = correr('CE-049')
    expect(p.accion).toBe('nada')
    expect(p.motivo).toBe('no_soportado')
  })

  it('un microciclo vencido no escribe y guarda el borrador (CE-051)', () => {
    const { p } = correr('CE-051')
    expect(p.accion).toBe('nada')
    expect(p.motivo).toBe('microciclo_vencido')
    expect(p.borrador_pendiente).toEqual({ texto: 'hice sentadilla 60 por 10' })
  })

  it('no hacer un ejercicio no crea series con reps 0 (CE-053)', () => {
    const { p } = correr('CE-053')
    expect(p.registros).toEqual([])
    expect(p.notas_coach.join(' ')).toMatch(/pa3, pa4/)
  })

  it('el esfuerzo de sesión solo admite 1 a 10 (CE-054, CE-055)', () => {
    expect(correr('CE-054').p.registros[0]).toMatchObject({ campo: 'testPost.rpeSesion', valor: 9 })
    const { p } = correr('CE-055')
    expect(p.accion).toBe('preguntar')
    expect(p.pregunta?.opciones).toEqual(['9', '10'])
  })

  it('los calentamientos se oyen y se descartan (CE-044)', () => {
    const { p } = correr('CE-044')
    expect(series(p)[0].valor).toHaveLength(3)
    expect(p.descartado.length).toBe(2)
  })

  it('lo que sobra de la frase mixta va a su dominio y no ensucia la serie (CE-060, CE-062)', () => {
    const a = correr('CE-060').p
    expect(a.registros.map((r) => r.campo)).toEqual(['series', 'checkin'])
    const b = correr('CE-062').p
    expect(b.descartado[0].motivo).toMatch(/bastante/)
    expect(b.seguimiento?.texto).toMatch(/pasos/)
  })

  it('una consulta no es un registro (CE-077)', () => {
    const { p } = correr('CE-077')
    expect(p.accion).toBe('nada')
    expect(p.registros).toEqual([])
  })

  it('CE-025: «el remo» es ambiguo y se pregunta (discrepancia documentada con el corpus)', () => {
    const c = caso('CE-025')
    const { extraccion } = validarExtraccion(c.frase, EXTRACCIONES_GRABADAS['CE-025'])
    const p = resolverPropuesta(c.frase, extraccion, contextoDeCorpus(c.contexto))
    expect(p.accion).toBe('preguntar')
    expect(p.pregunta?.opciones).toEqual(['REMO CON BARRA', 'REMO EN POLEA BAJA'])
  })
})
