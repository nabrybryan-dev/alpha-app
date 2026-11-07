import { describe, expect, it, vi } from 'vitest'
import { camposLlenosHoy, guardarCheckinDePraxis, leerMiLexico, RPC_APLICAR_CHECKIN, RPC_APRENDER_FORMA, type DependenciasCheckin } from './checkin'
import type { Confirmado } from '../../domain/praxis/registro/tarjetaCheckin'

/** Guardar el check-in de Praxis por la 0170 y aprender por la 0171, con la red simulada. Datos inventados. */
const YO = 'u-prueba'
const CONF: Confirmado = { parche: { estres: 'REGULAR' }, anotadoHoy: [], pendientes: [], errores: [], parcial: true }
const FILA = { id: `ck-${YO}-2026-11-07`, usuarioId: YO, fecha: '2026-11-07', estres: 'REGULAR', parcial: true }

function deps(over: Partial<DependenciasCheckin> = {}) {
  const d = {
    rpc: vi.fn(async (nombre: string) => (nombre === RPC_APLICAR_CHECKIN ? { data: { datos: FILA }, error: null } : { data: {}, error: null })),
    leer: vi.fn(async () => ({ data: [], error: null })),
    usuarioDeLaSesion: vi.fn(async () => YO),
    fijar: vi.fn(),
    anotarFallo: vi.fn(),
    ...over,
  }
  return d
}

const entrada = (extra = {}) => ({ usuarioId: YO, mensajeId: 'm1', confirmado: CONF, aprendizajes: [{ campo: 'estres' as const, forma: 'como medio', valor: 'REGULAR' }], ...extra })

describe('guardar el check-in de Praxis', () => {
  it('manda solo el parche confirmado, fija la fila devuelta y anota lo aprendido', async () => {
    const d = deps()
    const r = await guardarCheckinDePraxis(entrada(), d)
    expect(r).toEqual({ ok: true, parcial: true })
    expect(d.rpc).toHaveBeenCalledWith(RPC_APLICAR_CHECKIN, { p_mensaje_id: 'm1', p_indice: 0, p_parche: { estres: 'REGULAR' } })
    expect(d.fijar).toHaveBeenCalledWith(FILA)
    expect(d.rpc).toHaveBeenCalledWith(RPC_APRENDER_FORMA, { p_campo: 'estres', p_forma: 'como medio', p_valor: 'REGULAR' })
  })

  it('nunca escribe si la sesión es de otra persona', async () => {
    const d = deps({ usuarioDeLaSesion: vi.fn(async () => 'u-otra') })
    expect(await guardarCheckinDePraxis(entrada(), d)).toEqual({ ok: false, motivo: 'otra_persona' })
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it('sin nada confirmado no llama a la base', async () => {
    const d = deps()
    expect(await guardarCheckinDePraxis(entrada({ confirmado: { ...CONF, parche: {} } }), d)).toEqual({ ok: false, motivo: 'nada' })
    expect(d.rpc).not.toHaveBeenCalled()
  })

  it('con la 0170 sin aplicar dice «sin migración» y no fija nada', async () => {
    const d = deps({ rpc: vi.fn(async () => ({ data: null, error: { code: 'PGRST202' } })) })
    expect(await guardarCheckinDePraxis(entrada(), d)).toEqual({ ok: false, motivo: 'sin_migracion' })
    expect(d.fijar).not.toHaveBeenCalled()
  })

  it('una fila devuelta de otra persona no se fija', async () => {
    const d = deps({ rpc: vi.fn(async () => ({ data: { datos: { ...FILA, usuarioId: 'u-otra' } }, error: null })) })
    expect(await guardarCheckinDePraxis(entrada(), d)).toEqual({ ok: false, motivo: 'no_se_pudo' })
    expect(d.fijar).not.toHaveBeenCalled()
    expect(d.anotarFallo).toHaveBeenCalledWith(expect.not.stringContaining(YO))
  })

  it('si aprender falla, el check-in queda guardado igual', async () => {
    const d = deps({
      rpc: vi.fn(async (nombre: string) => (nombre === RPC_APLICAR_CHECKIN ? { data: { datos: FILA }, error: null } : { data: null, error: { code: '22023' } })),
    })
    expect(await guardarCheckinDePraxis(entrada(), d)).toEqual({ ok: true, parcial: true })
    expect(d.fijar).toHaveBeenCalled()
    expect(d.anotarFallo).toHaveBeenCalledTimes(1)
  })
})

describe('lo aprendido y lo ya lleno', () => {
  it('leerMiLexico descarta filas mal formadas y campos que no aprenden; con error, vacío', async () => {
    const leer = vi.fn(async () => ({ data: [
      { campo: 'estres', forma: 'como medio', valor: 'MUCHO', confirmaciones: 3 },
      { campo: 'dolor', forma: 'ahi', valor: 'REGULAR', confirmaciones: 9 },
      { campo: 'estres', forma: 7 },
    ], error: null }))
    expect(await leerMiLexico({ leer })).toEqual([{ campo: 'estres', forma: 'como medio', valor: 'MUCHO', confirmaciones: 3 }])
    expect(await leerMiLexico({ leer: vi.fn(async () => ({ data: null, error: { code: '42P01' } })) })).toEqual([])
  })

  it('camposLlenosHoy: solo los 8 obligatorios que ya tienen valor (el cero de dolor cuenta)', () => {
    expect(camposLlenosHoy({ id: 'x', usuarioId: YO, fecha: '2026-11-07', estres: 'POCO', dolor: 0, pasos: 4000 })).toEqual(['estres', 'dolor'])
    expect(camposLlenosHoy(undefined)).toEqual([])
  })
})
