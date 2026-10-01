// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contextoDeCorpus } from '../../../../scripts/praxis-eval/contexto-corpus.ts'
import { EXTRACCIONES_GRABADAS } from '../../../../scripts/praxis-eval/extracciones-grabadas.ts'
import type { Caso } from '../../../../scripts/praxis-eval/puntuar.ts'
import { validarExtraccion } from './esquema.ts'
import { derivarPorFiltro, filtrarClinico } from './filtroClinico.ts'
import { resolverPropuesta } from './resolver.ts'
import { construirTarjeta, fmt, idDeTarjeta } from './tarjeta.ts'

const corpus: Caso[] = JSON.parse(readFileSync(new URL('../../../../scripts/praxis-eval/corpus.json', import.meta.url), 'utf8'))
function tarjetaDe(id: string) {
  const c = corpus.find((x) => x.id === id)!
  const { extraccion } = validarExtraccion(c.frase, EXTRACCIONES_GRABADAS[id])
  const p = resolverPropuesta(c.frase, extraccion, contextoDeCorpus(c.contexto))
  return { p, t: construirTarjeta(p, 'm1') }
}

describe('constructor de la tarjeta', () => {
  it('formatea con coma decimal', () => {
    expect(fmt(61.2)).toBe('61,2')
    expect(fmt(40)).toBe('40')
    expect(fmt(12.5)).toBe('12,5')
    expect(idDeTarjeta('m1', 2)).toBe('m1:2')
  })

  it('CE-001: «SENTADILLA TRASERA · serie 1 · 40 kg × 12», con Guardar y Descartar', () => {
    const { t } = tarjetaDe('CE-001')
    expect(t.tipo).toBe('confirmacion')
    expect(t.lineas[0].texto).toBe('SENTADILLA TRASERA · serie 1 · 40 kg × 12')
    expect(t.lineas[0].tarjeta_id).toBe('m1:0')
    expect(t.botones.map((b) => b.id)).toEqual(['guardar', 'descartar'])
    expect(t.guardable).toBe(true)
    expect(t.avisos.join(' ')).toMatch(/Quedan 3 series/)
  })

  it('CE-004: dice «20 kg por mano» y cuántas series quedan', () => {
    const { t } = tarjetaDe('CE-004')
    expect(t.lineas[0].texto).toContain('20 kg por mano × 12')
    expect(t.avisos.join(' ')).toMatch(/Queda 1 serie de PRESS INCLINADO/)
  })

  it('CE-008: muestra «135 lb = 61,2 kg»', () => {
    expect(tarjetaDe('CE-008').t.lineas[0].detalle).toContain('135 lb = 61,2 kg')
  })

  it('CE-009: muestra el desglose 20 + 40 = 60 kg', () => {
    expect(tarjetaDe('CE-009').t.lineas[0].detalle).toContain('20 + 40 = 60 kg')
  })

  it('CE-007: «barra sola = 20 kg»', () => {
    expect(tarjetaDe('CE-007').t.lineas[0].detalle).toContain('barra sola = 20 kg')
  })

  it('CE-011: lo copiado se marca como copiado y no trae RIR', () => {
    const { t } = tarjetaDe('CE-011')
    expect(t.lineas).toHaveLength(4)
    for (const l of t.lineas) {
      expect(l.origen).toBe('copiado de tu pauta')
      expect(l.texto).not.toMatch(/RIR/)
    }
  })

  it('CE-013: copiado de la semana pasada', () => {
    expect(tarjetaDe('CE-013').t.lineas[0].origen).toBe('copiado de la semana pasada')
  })

  it('CE-047: el reemplazo se ve como «40 → 45»', () => {
    const { t } = tarjetaDe('CE-047')
    expect(t.lineas[0].detalle).toBe('Reemplaza la serie 1: 40 × 12 → 45 × 12')
  })

  it('CE-016: el RIR dicho se ve; CE-019 avisa que se recortó y marca estimado', () => {
    expect(tarjetaDe('CE-016').t.lineas[0].texto).toContain('RIR 2')
    const { t } = tarjetaDe('CE-019')
    expect(t.lineas[0].texto).toContain('RIR 5')
    expect(t.avisos.join(' ')).toMatch(/llega a 5/)
    expect(t.lineas[0].detalle).toMatch(/Estimado/)
  })

  it('CE-037/038/039: peso corporal, lastre y banda no se pintan como kilos falsos', () => {
    expect(tarjetaDe('CE-037').t.lineas[0].texto).toContain('peso corporal ×')
    expect(tarjetaDe('CE-038').t.lineas[0].texto).toContain('+10 kg de lastre')
    expect(tarjetaDe('CE-039').t.lineas[0].texto).toContain('con banda roja')
  })

  it('CE-042: el drop set va como extra y no como serie', () => {
    const { t } = tarjetaDe('CE-042')
    expect(t.lineas).toHaveLength(1)
    expect(t.lineas[0].texto).toContain('+ 6 × 40 kg (extra, no cuenta como serie)')
  })

  it('CE-030: otra sesión: avisa y el botón principal pide confirmar la sesión', () => {
    const { t } = tarjetaDe('CE-030')
    expect(t.requiereConfirmarSesion).toBe(true)
    expect(t.botones[0]).toMatchObject({ id: 'guardar', confirma_sesion: true })
    expect(t.avisos.join(' ')).toMatch(/sellaría la fecha/)
  })

  it('CE-050: registro tardío muestra «ayer, lunes 28-sep»', () => {
    expect(tarjetaDe('CE-050').t.avisos.join(' ')).toContain('lunes 28-sep')
  })

  it('CE-044: lo descartado se muestra, no se esconde', () => {
    expect(tarjetaDe('CE-044').t.descartado.join(' ')).toMatch(/calentamiento/)
  })

  it('una pregunta se muestra con hasta tres opciones más «Otro» y sin poder guardar', () => {
    const { t } = tarjetaDe('CE-010')
    expect(t.tipo).toBe('pregunta')
    expect(t.guardable).toBe(false)
    expect(t.botones.map((b) => b.texto)).toEqual(['SENTADILLA BULGARA', 'SENTADILLA GOBLET', 'Otro', 'Descartar'])
  })

  it('CE-054: el esfuerzo de sesión sale en la tarjeta', () => {
    expect(tarjetaDe('CE-054').t.lineas[0].texto).toBe('Esfuerzo de la sesión: 9 (escala 6-10)')
  })

  it('CE-060: el sueño va en su línea, aparte de la serie', () => {
    const t = tarjetaDe('CE-060').t
    expect(t.lineas.map((l) => l.texto)).toEqual(['SENTADILLA TRASERA · serie 1 · 60 kg × 10', 'Horas de sueño: 5'])
  })

  it('una derivación no es guardable y ofrece el formulario, salvo crisis', () => {
    const dolor = construirTarjeta(derivarPorFiltro(filtrarClinico('me molestó el hombro')!))
    expect(dolor.tipo).toBe('derivacion')
    expect(dolor.guardable).toBe(false)
    expect(dolor.botones[0].id).toBe('abrir_formulario')
    const crisis = construirTarjeta(derivarPorFiltro(filtrarClinico('no quiero vivir')!))
    expect(crisis.botones).toEqual([])
    expect(crisis.mensaje).toMatch(/Línea 106/)
  })

  it('una consulta es informativa y sin botones', () => {
    const t = tarjetaDe('CE-077').t
    expect(t.tipo).toBe('informativa')
    expect(t.botones).toEqual([])
  })
})
