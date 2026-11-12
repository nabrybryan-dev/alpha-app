import { describe, expect, it, vi } from 'vitest'
import { deshacerUltimoCambioDeOrganizacion, guardarCambioDeOrganizacion, leerOrganizacion, RPC_APLICAR_ORGANIZACION } from './organizacion'

const sinError = (data: unknown) => async () => ({ data, error: null })

describe('organización guardada (0179)', () => {
  it('lee la fila propia y si hay algo que deshacer', async () => {
    const leerFila = vi.fn(sinError({ version: 3, ocultas: ['hoy.cifras', 7] }))
    const o = await leerOrganizacion('u1', { leerFila, hayCambioSinDeshacer: sinError([{ id: 1 }]) })
    expect(o).toEqual({ version: 3, ocultas: ['hoy.cifras'], hayCambiosParaDeshacer: true })
    expect(leerFila).toHaveBeenCalledWith('u1')
  })

  it('sin fila o con error: nada escondido, nada que deshacer (nunca lanza)', async () => {
    expect(await leerOrganizacion('u1', { leerFila: sinError(null), hayCambioSinDeshacer: sinError([]) })).toEqual({ version: 0, ocultas: [], hayCambiosParaDeshacer: false })
    expect(await leerOrganizacion('u1', { leerFila: async () => { throw new Error('red') }, hayCambioSinDeshacer: sinError([]) })).toEqual({ version: 0, ocultas: [], hayCambiosParaDeshacer: false })
  })

  it('guarda con la función y la versión, y solo «aplicado» con versión es aplicado', async () => {
    const rpc = vi.fn(async () => ({ data: { resultado: 'aplicado', version: 4 }, error: null }))
    expect(await guardarCambioDeOrganizacion({ tipo: 'pieza', accion: 'ocultar', pieza: 'hoy.cifras' }, 3, { rpc })).toEqual({ resultado: 'aplicado', version: 4 })
    expect(rpc).toHaveBeenCalledWith(RPC_APLICAR_ORGANIZACION, { p_cambio: { tipo: 'pieza', accion: 'ocultar', pieza: 'hoy.cifras' }, p_version: 3 })
    expect(await guardarCambioDeOrganizacion({ tipo: 'restablecer' }, 3, { rpc: async () => ({ data: { resultado: 'choque', version: 9 }, error: null }) })).toEqual({ resultado: 'choque' })
    expect(await guardarCambioDeOrganizacion({ tipo: 'restablecer' }, 3, { rpc: async () => ({ data: { resultado: 'aplicado' }, error: null }) })).toEqual({ resultado: 'no_se_pudo' })
  })

  it('sin migración, con regla rota o red caída: «no se pudo»', async () => {
    for (const code of ['PGRST202', '22023', 'sin_nube']) {
      expect(await guardarCambioDeOrganizacion({ tipo: 'restablecer' }, null, { rpc: async () => ({ data: null, error: { code } }) })).toEqual({ resultado: 'no_se_pudo' })
    }
    expect(await deshacerUltimoCambioDeOrganizacion({ rpc: async () => { throw new Error('red') } })).toEqual({ resultado: 'no_se_pudo' })
    expect(await deshacerUltimoCambioDeOrganizacion({ rpc: async () => ({ data: { resultado: 'nada', version: 1 }, error: null }) })).toEqual({ resultado: 'no_se_pudo' })
  })
})
