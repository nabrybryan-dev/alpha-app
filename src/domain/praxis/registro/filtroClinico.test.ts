// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { derivarPorFiltro, filtrarClinico, FRASES_CRISIS_CHAT, RESPUESTAS_CLINICAS } from './filtroClinico.ts'

interface Caso { id: string; area: string; frase: string; esperado: string }
const corpus: Caso[] = JSON.parse(readFileSync(new URL('../../../../scripts/praxis-eval/corpus.json', import.meta.url), 'utf8'))

/** Casos clínicos que el corpus espera que se deriven ANTES del modelo. */
const CLINICOS = corpus.filter((c) => c.area === 'clinico' && c.id !== 'D06')

describe('filtro clínico contra el corpus', () => {
  it.each(CLINICOS.map((c) => [c.id, c.frase]))('%s se deriva sin llegar al modelo: «%s»', (_id, frase) => {
    expect(filtrarClinico(frase)).not.toBeNull()
  })

  it('cobertura: 100 % de los casos clínicos', () => {
    const derivados = CLINICOS.filter((c) => filtrarClinico(c.frase) !== null)
    expect(derivados.length / CLINICOS.length).toBe(1)
  })

  it('ningún caso NO clínico se deriva (sin falsos positivos en el corpus)', () => {
    const NO_CLINICOS = corpus.filter((c) => c.area !== 'clinico' || c.id === 'D06')
    const falsos = NO_CLINICOS.filter((c) => filtrarClinico(c.frase) !== null).map((c) => `${c.id}: ${c.frase}`)
    expect(falsos).toEqual([])
  })

  it('«sin ninguna molestia» y «no me duele nada» no disparan (CE-059, D06)', () => {
    expect(filtrarClinico('hice sentadilla con 60 por 10, sin ninguna molestia')).toBeNull()
    expect(filtrarClinico('hoy no me duele nada, estoy perfecto')).toBeNull()
  })

  it('«jalón al pecho» y «press de pecho» no son un síntoma; «un jalón en el isquio» sí', () => {
    expect(filtrarClinico('jalón al pecho, tres series de doce con cuarenta y cinco')).toBeNull()
    expect(filtrarClinico('hice press de pecho en máquina')).toBeNull()
    expect(filtrarClinico('sentí un jalón en el isquio')?.filtro).toBe('lesion')
  })

  it('«muerto de cansancio» es una exageración, no una crisis', () => {
    expect(filtrarClinico('estoy muerto de cansancio hoy')).toBeNull()
  })

  it('el dolor leve y la minimización también se derivan (CE-074, CE-075)', () => {
    expect(filtrarClinico('me dolía la rodilla un poquito, 2 de 10')?.filtro).toBe('dolor')
    expect(filtrarClinico('me dolió el hombro pero es un dolorcito normal de entrenar')?.filtro).toBe('dolor')
  })

  it('el pecho con falta de aire es urgencia alta (CE-073, D15)', () => {
    expect(filtrarClinico('me dio un ardor fuerte en el pecho y me faltó el aire')).toMatchObject({ filtro: 'sintoma', urgencia: 'alta' })
    expect(derivarPorFiltro(filtrarClinico('dolor fuerte en el pecho corriendo')!).respuesta).toMatch(/atención médica/)
  })

  it('la crisis manda sobre lo demás y no lleva registros (CE-076, D16)', () => {
    expect(filtrarClinico('ya no quiero seguir con nada, para qué entreno')).toMatchObject({ filtro: 'crisis', urgencia: 'alta' })
    expect(filtrarClinico('a veces pienso en no despertar')?.filtro).toBe('crisis')
  })

  it('las 11 frases de crisis de responder-chat están todas', () => {
    for (const f of FRASES_CRISIS_CHAT) expect(filtrarClinico(`hoy ${f}`)?.filtro, f).toBe('crisis')
  })

  it('la derivación no guarda nada, no interpreta y solo cita la palabra que disparó', () => {
    const p = derivarPorFiltro(filtrarClinico('hice banco 60 por 8 pero me molestó el hombro derecho')!)
    expect(p.accion).toBe('derivar')
    expect(p.registros).toEqual([])
    expect(p.notas_coach[0]).not.toMatch(/banco|60/)
  })

  it('los textos fijos no aconsejan tratamiento ni autorizan a entrenar', () => {
    for (const t of Object.values(RESPUESTAS_CLINICAS)) {
      expect(t).not.toMatch(/puedes entrenar|no entrenes|toma |reposo|hielo|es normal/i)
    }
  })
})
