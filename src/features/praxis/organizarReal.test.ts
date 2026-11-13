import { describe, expect, it, vi } from 'vitest'
import { PIEZAS_DE_HOY } from '../../app/catalogoDePiezas'
import type { PerfilAcceso } from '../../app/rutas'
import { RPC_APLICAR_ORGANIZACION, RPC_DESHACER_ORGANIZACION } from '../../data/praxis/organizacion'
import { cambioParaGuardar, crearOrganizarReal } from './organizarReal'

const perfil: PerfilAcceso = { rol: 'asesorado', capacidades: new Set() }
const pieza = PIEZAS_DE_HOY.find((p) => p.id === 'hoy.cifras')!
const esperar = () => new Promise((r) => setTimeout(r, 0))

describe('organizar real', () => {
  it('a la base solo viajan ids, nunca nombres ni frases', () => {
    expect(cambioParaGuardar({ tipo: 'pieza', accion: 'ocultar', pieza, avisaAlCoach: false })).toEqual({ tipo: 'pieza', accion: 'ocultar', pieza: 'hoy.cifras' })
    expect(cambioParaGuardar({ tipo: 'solo_lo_importante', piezas: [pieza] })).toEqual({ tipo: 'solo_lo_importante', piezas: ['hoy.cifras'] })
  })

  it('lee lo guardado, guarda con la versión leída y vuelve a leer', async () => {
    const filas = [{ version: 2, ocultas: [] }, { version: 3, ocultas: ['hoy.cifras'] }]
    const leerFila = vi.fn(async () => ({ data: filas.shift() ?? null, error: null }))
    const rpc = vi.fn(async () => ({ data: { resultado: 'aplicado', version: 3 }, error: null }))
    const o = crearOrganizarReal('u1', { perfil, navegar: () => {} }, { leerFila, rpc, hayCambioSinDeshacer: async () => ({ data: [{ id: 1 }], error: null }) })
    await esperar()
    expect(await o.aplicar!({ tipo: 'pieza', accion: 'ocultar', pieza, avisaAlCoach: false })).toBe('aplicado')
    expect(rpc).toHaveBeenCalledWith(RPC_APLICAR_ORGANIZACION, { p_cambio: { tipo: 'pieza', accion: 'ocultar', pieza: 'hoy.cifras' }, p_version: 2 })
    expect([...o.estado().ocultas]).toEqual(['hoy.cifras'])
    expect(o.estado().hayCambiosParaDeshacer).toBe(true)
  })

  it('«déjalo como estaba» y el botón Deshacer usan la función de deshacer', async () => {
    const rpc = vi.fn(async () => ({ data: { resultado: 'aplicado', version: 5 }, error: null }))
    const o = crearOrganizarReal('u1', { perfil, navegar: () => {} }, { leerFila: async () => ({ data: null, error: null }), hayCambioSinDeshacer: async () => ({ data: [], error: null }), rpc })
    await o.aplicar!({ tipo: 'deshacer' })
    await o.deshacerUltimo!()
    expect(rpc.mock.calls.map((c) => (c as unknown[])[0])).toEqual([RPC_DESHACER_ORGANIZACION, RPC_DESHACER_ORGANIZACION])
  })
})
