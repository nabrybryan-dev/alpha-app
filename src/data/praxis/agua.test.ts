import { describe, expect, it, vi } from 'vitest'
import type { ResultadoDeRegistro } from '../../domain/praxis/conversacion'
import type { RegistroPropuesto } from '../../domain/praxis/registro/tipos'
import { crearMockDb } from '../mockDb'
import { PRAXIS_AGUA_POR_RPC, aplicarAguaDePraxis, diaDeBogota, type DependenciasAgua } from './agua'

/**
 * El agua de Praxis por la RPC `praxis_aplicar_agua` (0161). La RPC se simula con el mismo libro que la real:
 * clave (usuario, mensaje, indice), día de Bogotá, total del día. Datos ficticios.
 */
const USUARIO = 'u-valentina'
const AHORA = new Date('2026-11-05T15:00:00Z') // 10:00 en Bogotá
const HOY = '2026-11-05'

const reg = (delta: number, fecha = HOY): RegistroPropuesto => ({ campo: 'hidratacion', fecha, delta_ml: delta, confianza: 'alta' })
const pendiente = (indice: number): ResultadoDeRegistro => ({ indice, campo: 'hidratacion', estado: 'pendiente_prerrequisito', motivo: 'P5' })

function rpcSimulada(ahora: () => Date) {
  const libro = new Set<string>()
  const dias = new Map<string, number>()
  const llamadas: { p_mensaje_id: string; p_indice: number; p_delta_ml: number }[] = []
  const rpc: DependenciasAgua['rpc'] = async (args) => {
    llamadas.push(args)
    const fecha = diaDeBogota(ahora())
    if (!dias.has(fecha)) dias.set(fecha, 0)
    const clave = args.p_mensaje_id + ':' + args.p_indice
    if (!libro.has(clave)) { libro.add(clave); dias.set(fecha, dias.get(fecha)! + args.p_delta_ml) }
    return { data: { ya_aplicado: false, registro_id: 'r', fecha, total_ml: dias.get(fecha)! }, error: null }
  }
  return { rpc, llamadas }
}

function montar(extra: Partial<DependenciasAgua> = {}, ahora = AHORA) {
  const db = crearMockDb()
  const sim = rpcSimulada(() => ahora)
  const fijar = vi.fn((u: string, f: string, ml: number) => db.nutricion.fijarHidratacion(u, f, ml))
  const anotarFallo = vi.fn()
  const deps: Partial<DependenciasAgua> = {
    encendido: true, rpc: sim.rpc, usuarioDeLaSesion: async () => USUARIO, fijar, anotarFallo, ahora: () => ahora, ...extra,
  }
  return { db, sim, fijar, anotarFallo, deps }
}

const entrada = (registros: RegistroPropuesto[], resultados: ResultadoDeRegistro[], usuarioId = USUARIO) =>
  ({ usuarioId, mensajeId: 'mensaje-1', registros, resultados })

describe('el interruptor nace apagado', () => {
  it('PRAXIS_AGUA_POR_RPC es false', () => expect(PRAXIS_AGUA_POR_RPC).toBe(false))

  it('apagado no llama, no fija y devuelve los resultados tal cual', async () => {
    const m = montar({ encendido: false })
    const resultados = [pendiente(0)]
    const r = await aplicarAguaDePraxis(entrada([reg(250)], resultados), m.deps)
    expect(r).toBe(resultados)
    expect(m.sim.llamadas).toHaveLength(0)
    expect(m.fijar).not.toHaveBeenCalled()
    expect(m.db.nutricion.hidratacionDe(USUARIO, HOY)).toBe(0)
  })

  it('sin deps, el valor por defecto (apagado) tampoco toca nada', async () => {
    const resultados = [pendiente(0)]
    expect(await aplicarAguaDePraxis(entrada([reg(250)], resultados))).toBe(resultados)
  })
})

describe('idempotencia y total fijado', () => {
  it('la misma tarjeta dos veces suma una sola vez', async () => {
    const m = montar()
    const e = entrada([reg(250)], [pendiente(0)])
    await aplicarAguaDePraxis(e, m.deps)
    await aplicarAguaDePraxis(e, m.deps)
    expect(m.sim.llamadas).toHaveLength(2)
    expect(m.db.nutricion.hidratacionDe(USUARIO, HOY)).toBe(250)
  })

  it('el total local queda igual al devuelto, no local + delta', async () => {
    const m = montar({ rpc: async () => ({ data: { ya_aplicado: false, registro_id: 'r', fecha: HOY, total_ml: 850 }, error: null }) })
    m.db.nutricion.registrarHidratacion(USUARIO, HOY, 100)
    const r = await aplicarAguaDePraxis(entrada([reg(250)], [pendiente(0)]), m.deps)
    expect(m.db.nutricion.hidratacionDe(USUARIO, HOY)).toBe(850)
    expect(r[0]).toEqual({ indice: 0, campo: 'hidratacion', estado: 'guardado' })
  })

  it('dos tarjetas de agua en el mismo guardado usan índices distintos', async () => {
    const m = montar()
    await aplicarAguaDePraxis(entrada([reg(250), reg(300)], [pendiente(0), pendiente(1)]), m.deps)
    expect(m.sim.llamadas.map((l) => l.p_indice)).toEqual([0, 1])
    expect(m.sim.llamadas.every((l) => l.p_mensaje_id === 'mensaje-1')).toBe(true)
    expect(m.db.nutricion.hidratacionDe(USUARIO, HOY)).toBe(550)
  })

  it('si el servidor ya lo guardó, no se vuelve a aplicar', async () => {
    const m = montar()
    await aplicarAguaDePraxis(entrada([reg(250)], [{ indice: 0, campo: 'hidratacion', estado: 'guardado' }]), m.deps)
    expect(m.sim.llamadas).toHaveLength(0)
  })

  it('no manda lo que la RPC rechazaría (0, negativo, más de 3000, no entero)', async () => {
    const m = montar()
    await aplicarAguaDePraxis(entrada([reg(0), reg(-200), reg(3001), reg(250.5)], [pendiente(0), pendiente(1), pendiente(2), pendiente(3)]), m.deps)
    expect(m.sim.llamadas).toHaveLength(0)
  })
})

describe('el día es el de Bogotá', () => {
  it('23:30 en Bogotá (04:30 UTC del día siguiente) cae en el día de Bogotá', async () => {
    const tarde = new Date('2026-11-05T04:30:00Z')
    expect(diaDeBogota(tarde)).toBe('2026-11-04')
    const m = montar({}, tarde)
    const diaSiguienteAntes = m.db.nutricion.hidratacionDe(USUARIO, '2026-11-05') // el seed ya trae agua ese día
    await aplicarAguaDePraxis(entrada([reg(400, '2026-11-04')], [pendiente(0)]), m.deps)
    expect(m.db.nutricion.hidratacionDe(USUARIO, '2026-11-04')).toBe(400)
    expect(m.db.nutricion.hidratacionDe(USUARIO, '2026-11-05')).toBe(diaSiguienteAntes)
  })

  it('una tarjeta de otro día no se manda: la RPC siempre escribe hoy', async () => {
    const m = montar()
    const r = await aplicarAguaDePraxis(entrada([reg(400, '2026-11-04')], [pendiente(0)]), m.deps)
    expect(m.sim.llamadas).toHaveLength(0)
    expect(r[0].estado).toBe('pendiente_prerrequisito')
  })

  it('se fija en la fecha que devuelve la base', async () => {
    const m = montar({ rpc: async () => ({ data: { fecha: '2026-11-04', total_ml: 600 }, error: null }) })
    await aplicarAguaDePraxis(entrada([reg(250)], [pendiente(0)]), m.deps)
    expect(m.fijar).toHaveBeenCalledWith(USUARIO, '2026-11-04', 600)
  })
})

describe('aislamiento', () => {
  it('si la sesión no es la de la conexión, no se llama ni se fija', async () => {
    const m = montar({ usuarioDeLaSesion: async () => 'u-otra-persona' })
    const r = await aplicarAguaDePraxis(entrada([reg(250)], [pendiente(0)]), m.deps)
    expect(m.sim.llamadas).toHaveLength(0)
    expect(m.fijar).not.toHaveBeenCalled()
    expect(r[0].estado).toBe('pendiente_prerrequisito')
  })

  it('sin sesión conocida tampoco', async () => {
    const m = montar({ usuarioDeLaSesion: async () => null })
    await aplicarAguaDePraxis(entrada([reg(250)], [pendiente(0)]), m.deps)
    expect(m.sim.llamadas).toHaveLength(0)
  })

  it('solo se fija el agua de quien dicta, y nada cambia en la de otra persona', async () => {
    const m = montar()
    m.db.nutricion.registrarHidratacion('u-otra-persona', HOY, 700)
    await aplicarAguaDePraxis(entrada([reg(250)], [pendiente(0)]), m.deps)
    expect(m.fijar.mock.calls.every((c) => c[0] === USUARIO)).toBe(true)
    expect(m.db.nutricion.hidratacionDe('u-otra-persona', HOY)).toBe(700)
  })
})

describe('si la RPC falla, se comporta como hoy', () => {
  const casos: [string, DependenciasAgua['rpc']][] = [
    ['error de la base', async () => ({ data: null, error: { code: '22023' } })],
    ['lanza', async () => { throw new Error('Maria Perez 500 ml') }],
    ['respuesta sin total', async () => ({ data: { fecha: HOY }, error: null })],
    ['total fuera de tope', async () => ({ data: { fecha: HOY, total_ml: 10001 }, error: null })],
    ['total negativo', async () => ({ data: { fecha: HOY, total_ml: -5 }, error: null })],
    ['fecha rara', async () => ({ data: { fecha: 'hoy', total_ml: 500 }, error: null })],
  ]
  for (const [nombre, rpc] of casos) {
    it(nombre, async () => {
      const m = montar({ rpc })
      const r = await aplicarAguaDePraxis(entrada([reg(250)], [pendiente(0)]), m.deps)
      expect(r[0].estado).toBe('pendiente_prerrequisito')
      expect(m.fijar).not.toHaveBeenCalled()
      expect(m.anotarFallo).toHaveBeenCalledTimes(1)
      const aviso = String(m.anotarFallo.mock.calls[0][0])
      expect(aviso).not.toMatch(/Perez|u-valentina|mensaje-1|250|500/)
    })
  }
})

describe('fijarHidratacion del almacén', () => {
  it('fija en vez de sumar y no baja de cero', () => {
    const db = crearMockDb()
    db.nutricion.registrarHidratacion(USUARIO, HOY, 300)
    db.nutricion.fijarHidratacion(USUARIO, HOY, 900)
    db.nutricion.fijarHidratacion(USUARIO, HOY, 900)
    expect(db.nutricion.hidratacionDe(USUARIO, HOY)).toBe(900)
    db.nutricion.fijarHidratacion(USUARIO, HOY, -5)
    expect(db.nutricion.hidratacionDe(USUARIO, HOY)).toBe(0)
  })
})
