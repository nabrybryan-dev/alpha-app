import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Anotacion } from '../../../domain/praxis/registro/anotaciones'
import type { Confirmado } from '../../../domain/praxis/registro/tarjetaCheckin'
import type { ConexionPraxis } from './conexion'

/**
 * El cuaderno de anotaciones en la conversación (Bryan, 8-nov): la tarjeta ofrece anotar «molida de las piernas» y
 * «pesada después del almuerzo»; nada se guarda sin el toque. La tarjeta y la voz se sustituyen para ver qué se llama.
 * Frases inventadas por IA: no sirven para entrenar.
 */
const mostrar = vi.fn<(...args: unknown[]) => void>()
const decir = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined)
const decirCorto = vi.fn<(...args: unknown[]) => void>()
vi.mock('./tarjetaCheckin', () => ({ mostrarTarjetaCheckin: (...a: unknown[]) => mostrar(...a) }))
vi.mock('./frase', () => ({ decir: (...a: unknown[]) => decir(...a), decirCorto: (...a: unknown[]) => decirCorto(...a) }))
vi.mock('./cabecera', () => ({ limpiarControles: vi.fn() }))

const { intentarCheckin, reiniciarCheckinConectado, FRASES } = await import('./checkinConectado')
const { S } = await import('./sesion')

const vacio: Confirmado = { parche: {}, anotadoHoy: [], pendientes: [], errores: [], parcial: true }
const conParche: Confirmado = { parche: { cansancio: 'MUCHO' }, anotadoHoy: [], pendientes: [], errores: [], parcial: true }

function conexion(over: Record<string, unknown> = {}) {
  const checkin = {
    yaHoy: vi.fn(() => []), lexico: vi.fn(async () => []),
    guardar: vi.fn(async () => ({ ok: true, parcial: false })),
    anotar: vi.fn(async () => ({ ok: true, anotadas: 1 })),
    ...over,
  }
  return { c: { checkin } as unknown as ConexionPraxis, checkin }
}

/** Abre la tarjeta con la frase y devuelve lo que se mostró y la función del toque en «Anotar». */
async function abrir(c: ConexionPraxis, frase: string) {
  const atendida = await intentarCheckin(c, frase, S.tok, () => 'm1')
  const llamada = mostrar.mock.calls[0]
  return { atendida, tarjeta: llamada?.[0] as { anotaciones: Anotacion[]; filas: unknown[] }, tocar: llamada?.[2] as ((c: Confirmado, e: unknown[], a: Anotacion[]) => void) | undefined }
}

beforeEach(() => { reiniciarCheckinConectado(); mostrar.mockClear(); decir.mockClear(); decirCorto.mockClear() })

describe('la tarjeta ofrece el cuaderno', () => {
  it('«molida de las piernas» abre la tarjeta con la anotación y SIN fila de cansancio', async () => {
    const { c, checkin } = conexion()
    const { atendida, tarjeta } = await abrir(c, 'estoy molida de las piernas')
    expect(atendida).toBe(true)
    expect(tarjeta.anotaciones).toEqual([{ tipo: 'recuperacion_zona', zona: 'piernas', cita: 'estoy molida de las piernas' }])
    expect(tarjeta.filas).toEqual([])
    expect(checkin.anotar).not.toHaveBeenCalled() // nada se anota sin el toque
    expect(checkin.guardar).not.toHaveBeenCalled()
  })

  it('sin `anotar` en la conexión no ofrece el cuaderno: la frase sigue el camino de siempre', async () => {
    const { c } = conexion({ anotar: undefined })
    const { atendida } = await abrir(c, 'estoy molida de las piernas')
    expect(atendida).toBe(false)
    expect(mostrar).not.toHaveBeenCalled()
  })
})

describe('tras el toque', () => {
  it('solo el cuaderno: anota con el id del mensaje, no guarda check-in y lo dice', async () => {
    const { c, checkin } = conexion()
    const { tocar } = await abrir(c, 'me sentí pesada después del almuerzo')
    const a: Anotacion = { tipo: 'reaccion_comida', momento: 'almuerzo', cita: 'me sentí pesada después del almuerzo' }
    tocar!(vacio, [], [a])
    await vi.waitFor(() => expect(decir).toHaveBeenCalledWith(FRASES.cuaderno, expect.anything()))
    expect(checkin.anotar).toHaveBeenCalledWith({ mensajeId: 'm1', anotaciones: [a] })
    expect(checkin.guardar).not.toHaveBeenCalled()
  })

  it('check-in y cuaderno a la vez: se hacen las dos cosas', async () => {
    const { c, checkin } = conexion()
    const { tocar } = await abrir(c, 'estoy muy cansada, molida de las piernas')
    const a: Anotacion = { tipo: 'recuperacion_zona', zona: 'piernas', cita: 'molida de las piernas' }
    tocar!(conParche, [{ campo: 'cansancio', valor: 'MUCHO' }], [a])
    await vi.waitFor(() => expect(checkin.guardar).toHaveBeenCalled())
    expect(checkin.anotar).toHaveBeenCalledTimes(1)
  })

  it('si la tarjeta se toca sin cuaderno, no se llama a anotar', async () => {
    const { c, checkin } = conexion()
    const { tocar } = await abrir(c, 'estoy muy cansada, molida de las piernas')
    tocar!(conParche, [{ campo: 'cansancio', valor: 'MUCHO' }], [])
    await vi.waitFor(() => expect(checkin.guardar).toHaveBeenCalled())
    expect(checkin.anotar).not.toHaveBeenCalled()
  })

  it('0175 sin aplicar: lo dice y no promete nada', async () => {
    const { c } = conexion({ anotar: vi.fn(async () => ({ ok: false, motivo: 'sin_migracion' })) })
    const { tocar } = await abrir(c, 'estoy molida de las piernas')
    tocar!(vacio, [], [{ tipo: 'recuperacion_zona', zona: 'piernas', cita: 'x' }])
    await vi.waitFor(() => expect(decirCorto).toHaveBeenCalledWith(FRASES.cuadernoSinMigracion))
    expect(decir).not.toHaveBeenCalledWith(FRASES.cuaderno, expect.anything())
  })

  it('si anotar lanza, no se rompe y avisa', async () => {
    const { c } = conexion({ anotar: vi.fn(async () => { throw new Error('red') }) })
    const { tocar } = await abrir(c, 'estoy molida de las piernas')
    tocar!(vacio, [], [{ tipo: 'recuperacion_zona', zona: 'piernas', cita: 'x' }])
    await vi.waitFor(() => expect(decirCorto).toHaveBeenCalledWith(FRASES.cuadernoNoSePudo))
  })
})
