import { describe, expect, it } from 'vitest'
import {
  ESTADO_INICIAL, TARJETA_OPTIMISTA, TOPE_TARJETA_OPTIMISTA_MS, guardarDisponible, hayTarjeta, transicionar,
  type EstadoTarjeta, type EventoTarjeta, type NombreEstado,
} from './tarjetaOptimista'

const T0 = 1_000
const bloqueada: EstadoTarjeta = { estado: 'optimista_bloqueada', mensajeId: 'm1', desdeMs: T0 }
const confirmada: EstadoTarjeta = { estado: 'confirmada', mensajeId: 'm1', guardadoPedido: false }
const guardando: EstadoTarjeta = { estado: 'confirmada', mensajeId: 'm1', guardadoPedido: true }
const porRiesgo: EstadoTarjeta = { estado: 'retirada_por_riesgo' }
const porError: EstadoTarjeta = { estado: 'retirada_por_error', motivo: 'red' }

describe('bandera', () => {
  it('nace apagada', () => expect(TARJETA_OPTIMISTA).toBe(false))
})

describe('transiciones', () => {
  it('sin_tarjeta + propuesta_local -> optimista_bloqueada, sin Guardar', () => {
    const t = transicionar(ESTADO_INICIAL, { tipo: 'propuesta_local', mensajeId: 'm1', ahoraMs: T0 })
    expect(t.estado).toEqual(bloqueada)
    expect(t.efectos).toEqual(['mostrar_tarjeta_bloqueada'])
    expect(guardarDisponible(t.estado)).toBe(false)
  })

  it('propuesta_local con otra tarjeta visible la reemplaza', () => {
    const t = transicionar(confirmada, { tipo: 'propuesta_local', mensajeId: 'm2', ahoraMs: 5 })
    expect(t.estado).toMatchObject({ estado: 'optimista_bloqueada', mensajeId: 'm2' })
    expect(t.efectos).toEqual(['retirar_tarjeta', 'mostrar_tarjeta_bloqueada'])
  })

  it('bloqueada + confirmacion que coincide -> confirmada y desbloquea', () => {
    const t = transicionar(bloqueada, { tipo: 'confirmacion_servidor', mensajeId: 'm1', coincide: true })
    expect(t.estado).toEqual(confirmada)
    expect(t.efectos).toEqual(['desbloquear_guardar'])
    expect(guardarDisponible(t.estado)).toBe(true)
  })

  it('bloqueada + confirmacion distinta -> retirada_por_error(distinta)', () => {
    const t = transicionar(bloqueada, { tipo: 'confirmacion_servidor', mensajeId: 'm1', coincide: false })
    expect(t.estado).toEqual({ estado: 'retirada_por_error', motivo: 'distinta' })
    expect(t.efectos).toEqual(['retirar_tarjeta', 'mostrar_camino_de_siempre'])
  })

  it('confirmacion con mensajeId viejo se ignora', () => {
    expect(transicionar(bloqueada, { tipo: 'confirmacion_servidor', mensajeId: 'otro', coincide: true })).toEqual({ estado: bloqueada, efectos: [] })
  })

  it.each([
    ['sin_tarjeta', ESTADO_INICIAL], ['confirmada', confirmada], ['por_riesgo', porRiesgo], ['por_error (tardia)', porError],
  ])('confirmacion en %s no resucita nada', (_n, e) => {
    expect(transicionar(e, { tipo: 'confirmacion_servidor', mensajeId: 'm1', coincide: true })).toEqual({ estado: e, efectos: [] })
  })

  it.each([
    ['sin_tarjeta', ESTADO_INICIAL, ['mostrar_camino_seguro']],
    ['bloqueada', bloqueada, ['retirar_tarjeta', 'mostrar_camino_seguro']],
    ['confirmada', confirmada, ['retirar_tarjeta', 'mostrar_camino_seguro']],
    ['guardando', guardando, ['retirar_tarjeta', 'mostrar_camino_seguro']],
    ['por_error', porError, ['mostrar_camino_seguro']],
    ['por_riesgo', porRiesgo, []],
  ] as const)('riesgo en %s -> retirada_por_riesgo', (_n, e, efectos) => {
    const t = transicionar(e, { tipo: 'riesgo_marco' })
    expect(t.estado).toEqual(porRiesgo)
    expect(t.efectos).toEqual(efectos)
  })

  it('riesgo con mensajeId de otra frase tambien retira', () => {
    expect(transicionar(confirmada, { tipo: 'riesgo_marco', mensajeId: 'otra' }).estado).toEqual(porRiesgo)
  })

  it.each(['error', 'red'] as const)('bloqueada + error_servidor(%s) -> retirada_por_error', (motivo) => {
    const t = transicionar(bloqueada, { tipo: 'error_servidor', mensajeId: 'm1', motivo })
    expect(t.estado).toEqual({ estado: 'retirada_por_error', motivo })
    expect(t.efectos).toEqual(['retirar_tarjeta', 'mostrar_camino_de_siempre'])
  })

  it.each([['confirmada', confirmada], ['sin_tarjeta', ESTADO_INICIAL], ['por_riesgo', porRiesgo]])('error_servidor en %s se ignora', (_n, e) => {
    expect(transicionar(e, { tipo: 'error_servidor', mensajeId: 'm1', motivo: 'red' })).toEqual({ estado: e, efectos: [] })
  })

  it('error_servidor con mensajeId viejo se ignora', () => {
    expect(transicionar(bloqueada, { tipo: 'error_servidor', mensajeId: 'x', motivo: 'red' }).estado).toEqual(bloqueada)
  })

  it('tic: antes del tope no pasa nada; en el tope retira', () => {
    expect(transicionar(bloqueada, { tipo: 'tic', ahoraMs: T0 + TOPE_TARJETA_OPTIMISTA_MS - 1 }).estado).toEqual(bloqueada)
    const t = transicionar(bloqueada, { tipo: 'tic', ahoraMs: T0 + TOPE_TARJETA_OPTIMISTA_MS })
    expect(t.estado).toEqual({ estado: 'retirada_por_error', motivo: 'tope' })
    expect(t.efectos).toEqual(['retirar_tarjeta', 'mostrar_camino_de_siempre'])
  })

  it.each([['confirmada', confirmada], ['sin_tarjeta', ESTADO_INICIAL], ['por_error', porError]])('tic en %s no hace nada', (_n, e) => {
    expect(transicionar(e, { tipo: 'tic', ahoraMs: 10 ** 9 })).toEqual({ estado: e, efectos: [] })
  })

  it.each([
    ['bloqueada', bloqueada, ['retirar_tarjeta']], ['confirmada', confirmada, ['retirar_tarjeta']], ['guardando', guardando, ['retirar_tarjeta']],
    ['por_riesgo', porRiesgo, []], ['por_error', porError, []], ['sin_tarjeta', ESTADO_INICIAL, []],
  ] as const)('persona_siguio en %s -> sin_tarjeta', (_n, e, efectos) => {
    expect(transicionar(e, { tipo: 'persona_siguio' })).toEqual({ estado: ESTADO_INICIAL, efectos })
  })

  it('toque_guardar en confirmada pide el guardado UNA vez (doble toque)', () => {
    const a = transicionar(confirmada, { tipo: 'toque_guardar' })
    expect(a.efectos).toEqual(['pedir_guardado'])
    expect(guardarDisponible(a.estado)).toBe(false)
    expect(transicionar(a.estado, { tipo: 'toque_guardar' })).toEqual({ estado: a.estado, efectos: [] })
  })

  it.each([['sin_tarjeta', ESTADO_INICIAL], ['bloqueada', bloqueada], ['por_riesgo', porRiesgo], ['por_error', porError]])('toque_guardar en %s no guarda', (_n, e) => {
    expect(transicionar(e, { tipo: 'toque_guardar' })).toEqual({ estado: e, efectos: [] })
  })

  it('guardado ok -> sin_tarjeta; fallo -> confirmada con Guardar de nuevo', () => {
    expect(transicionar(guardando, { tipo: 'guardado_terminado', ok: true }).estado).toEqual(ESTADO_INICIAL)
    expect(transicionar(guardando, { tipo: 'guardado_terminado', ok: false }).estado).toEqual(confirmada)
  })

  it.each([['sin_tarjeta', ESTADO_INICIAL], ['bloqueada', bloqueada], ['confirmada sin pedido', confirmada], ['por_riesgo', porRiesgo], ['por_error', porError]])(
    'guardado_terminado en %s se ignora', (_n, e) => {
      expect(transicionar(e, { tipo: 'guardado_terminado', ok: true })).toEqual({ estado: e, efectos: [] })
    })

  it('hayTarjeta solo en bloqueada y confirmada', () => {
    expect([ESTADO_INICIAL, bloqueada, confirmada, porRiesgo, porError].map(hayTarjeta)).toEqual([false, true, true, false, false])
  })
})

describe('carreras', () => {
  const correr = (evs: EventoTarjeta[], desde: EstadoTarjeta = ESTADO_INICIAL) => {
    let e = desde
    const efectos: string[] = []
    for (const ev of evs) { const t = transicionar(e, ev); e = t.estado; efectos.push(...t.efectos) }
    return { e, efectos }
  }
  const prop: EventoTarjeta = { tipo: 'propuesta_local', mensajeId: 'm1', ahoraMs: T0 }

  it('riesgo tras confirmar y antes de tocar: Guardar ya no existe', () => {
    const r = correr([prop, { tipo: 'confirmacion_servidor', mensajeId: 'm1', coincide: true }, { tipo: 'riesgo_marco' }, { tipo: 'toque_guardar' }])
    expect(r.e).toEqual(porRiesgo)
    expect(r.efectos).not.toContain('pedir_guardado')
  })
  it('confirmacion tardia tras el tope no resucita la tarjeta', () => {
    const r = correr([prop, { tipo: 'tic', ahoraMs: T0 + TOPE_TARJETA_OPTIMISTA_MS }, { tipo: 'confirmacion_servidor', mensajeId: 'm1', coincide: true }, { tipo: 'toque_guardar' }])
    expect(r.e.estado).toBe('retirada_por_error')
    expect(r.efectos).not.toContain('pedir_guardado')
  })
  it('la persona sigue con otra cosa y llega la confirmacion vieja: no vuelve la tarjeta', () => {
    const r = correr([prop, { tipo: 'persona_siguio' }, { tipo: 'confirmacion_servidor', mensajeId: 'm1', coincide: true }])
    expect(r.e).toEqual(ESTADO_INICIAL)
  })
  it('camino feliz guarda exactamente una vez', () => {
    const r = correr([prop, { tipo: 'confirmacion_servidor', mensajeId: 'm1', coincide: true }, { tipo: 'toque_guardar' }, { tipo: 'toque_guardar' }, { tipo: 'guardado_terminado', ok: true }])
    expect(r.efectos.filter((x) => x === 'pedir_guardado')).toHaveLength(1)
    expect(r.e).toEqual(ESTADO_INICIAL)
  })
})

/** Exhaustivo: todas las secuencias de hasta 5 eventos desde el inicio. */
describe('invariantes de seguridad en TODAS las rutas', () => {
  const eventos: EventoTarjeta[] = [
    { tipo: 'propuesta_local', mensajeId: 'm1', ahoraMs: T0 },
    { tipo: 'propuesta_local', mensajeId: 'm2', ahoraMs: T0 },
    { tipo: 'confirmacion_servidor', mensajeId: 'm1', coincide: true },
    { tipo: 'confirmacion_servidor', mensajeId: 'm2', coincide: true },
    { tipo: 'confirmacion_servidor', mensajeId: 'm1', coincide: false },
    { tipo: 'riesgo_marco' },
    { tipo: 'error_servidor', mensajeId: 'm1', motivo: 'red' },
    { tipo: 'tic', ahoraMs: T0 + TOPE_TARJETA_OPTIMISTA_MS },
    { tipo: 'persona_siguio' },
    { tipo: 'toque_guardar' },
    { tipo: 'guardado_terminado', ok: true },
    { tipo: 'guardado_terminado', ok: false },
  ]
  const PROFUNDIDAD = 5
  const vistos = new Set<NombreEstado>()
  const violaciones: string[] = []
  let rutas = 0

  const recorrer = (e: EstadoTarjeta, prof: number): void => {
    vistos.add(e.estado)
    if (prof === 0) return
    for (const ev of eventos) {
      rutas++
      const t = transicionar(e, ev)
      const mal = (m: string) => violaciones.push(`${m}: ${JSON.stringify(e)} + ${JSON.stringify(ev)}`)
      // 1. Guardar solo se pide desde `confirmada`, con un toque, y el boton estaba disponible.
      if (t.efectos.includes('pedir_guardado') && !(ev.tipo === 'toque_guardar' && e.estado === 'confirmada' && guardarDisponible(e))) mal('guarda fuera de confirmada')
      // 2. `confirmada` solo se alcanza desde bloqueada con confirmacion que coincide (o se permanece en ella).
      if (t.estado.estado === 'confirmada' && e.estado !== 'confirmada' && !(e.estado === 'optimista_bloqueada' && ev.tipo === 'confirmacion_servidor' && ev.coincide)) mal('confirmada sin confirmacion')
      // 3. Riesgo siempre retira.
      if (ev.tipo === 'riesgo_marco' && (t.estado.estado !== 'retirada_por_riesgo' || hayTarjeta(t.estado))) mal('riesgo no retira')
      // 4. Guardar disponible implica confirmada.
      if (guardarDisponible(t.estado) && t.estado.estado !== 'confirmada') mal('Guardar fuera de confirmada')
      // 5. Un desbloqueo solo existe junto a confirmada.
      if (t.efectos.includes('desbloquear_guardar') && t.estado.estado !== 'confirmada') mal('desbloqueo sin confirmada')
      // 6. Retirar la tarjeta nunca deja una visible (salvo el reemplazo por una bloqueada nueva).
      if (t.efectos.includes('retirar_tarjeta') && ev.tipo !== 'propuesta_local' && hayTarjeta(t.estado)) mal('retiro con tarjeta visible')
      recorrer(t.estado, prof - 1)
    }
  }

  it(`recorre las secuencias de hasta ${PROFUNDIDAD} eventos sin violar ninguna`, () => {
    recorrer(ESTADO_INICIAL, PROFUNDIDAD)
    expect(violaciones).toEqual([])
    expect(rutas).toBeGreaterThan(200_000)
    expect([...vistos].sort()).toEqual(['confirmada', 'optimista_bloqueada', 'retirada_por_error', 'retirada_por_riesgo', 'sin_tarjeta'])
  })
})
