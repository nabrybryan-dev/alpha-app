import { describe, expect, it } from 'vitest'
import { derivarPorFiltro } from './filtroClinico.ts'

describe('la atención sanitaria no depende de la respuesta del coach', () => {
  it.each(['dolor', 'lesion', 'sintoma'] as const)('%s deja explícito que no debe esperar al coach', (filtro) => {
    const p = derivarPorFiltro({ filtro, marca: filtro })
    expect(p.respuesta).toContain('No esperes una respuesta de Bryan para buscar atención médica')
    expect(p.registros).toEqual([])
  })

  it('urgencia alta indica emergencia antes del aviso al coach, sin esperar persistencia', () => {
    const p = derivarPorFiltro({ filtro: 'sintoma', marca: 'pecho', urgencia: 'alta' })
    expect(p.respuesta).toMatch(/^Lo que describes necesita atención médica urgente\. Llama al 123 ahora\./)
    expect(p.respuesta).not.toMatch(/si sigue|pronto/i)
    expect(p.respuesta).toContain('No esperes una respuesta de Bryan')
    expect(p.registros).toEqual([])
  })
})
