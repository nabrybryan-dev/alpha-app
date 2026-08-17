import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperacionPendiente } from './cola'

/**
 * Qué sale hacia Supabase cuando alguien mete o saca algo de su despensa.
 *
 * La despensa se enchufó el 2026-08-16, once días después de que se escribieran
 * su migración (0024) y su módulo de dominio. Lo que se prueba aquí es la FORMA
 * de lo que se encola, no que "sincroniza": un `cliente_id` mal derivado no da
 * error en pantalla —el asesorado ve su despensa perfecta— y arriba se acumula
 * el mismo pollo cinco veces con cinco fechas, sin forma de saber cuál manda.
 */

const VALENTINA = 'u-valentina'

let modulos: { db: import('../repos').Db; cola: () => OperacionPendiente[] } | undefined

async function appEnModoNube() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  const { crearMockDb } = await import('../mockDb')
  return {
    db: sync.crearDbSincronizada(crearMockDb()),
    cola: () => JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[],
  }
}

const pollo = {
  alimentoId: 'pollo-pechuga-crudo',
  cantidadG: 1200,
  agregadoEn: '2026-08-16',
  origen: 'compra' as const,
}

const kefir = {
  alimentoId: null,
  textoPedido: 'Kefir',
  cantidadG: null,
  agregadoEn: '2026-08-16',
  origen: 'compra' as const,
}

const deDespensa = (cola: OperacionPendiente[]) => cola.filter((o) => o.tabla === 'despensa')

describe('la despensa sube a Supabase', () => {
  beforeEach(async () => {
    localStorage.clear()
    // Sin red: la cola se llena y no se drena, que es justo lo que se inspecciona.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin red'))))
    modulos = await appEnModoNube()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    modulos = undefined
  })

  it('meter algo lo encola con su cliente_id y su dueño', () => {
    const { db, cola } = modulos!
    db.despensa.agregar(VALENTINA, pollo)

    const [op] = deDespensa(cola())
    expect(op.tipo).toBe('upsert')
    expect(op.onConflict).toBe('cliente_id')
    expect(op.payload.asesorado_id).toBe(VALENTINA)
    expect(op.payload.alimento_id).toBe('pollo-pechuga-crudo')
    expect(op.payload.borrado).toBe(false)
  })

  it('EL cliente_id SALE DE LA CLAVE DEL DOMINIO, no de un aleatorio', () => {
    // Es lo que hace que volver a comprar algo refresque su fila en vez de
    // crear otra. Con un id aleatorio, la despensa crecería sola: el mismo
    // pollo cinco veces, cinco fechas distintas, y ninguna forma de saber cuál
    // manda. Arriba no daría error; el asesorado vería su despensa perfecta.
    const { db, cola } = modulos!
    db.despensa.agregar(VALENTINA, pollo)
    db.despensa.agregar(VALENTINA, { ...pollo, cantidadG: 800, agregadoEn: '2026-08-24' })

    const ids = deDespensa(cola()).map((o) => o.payload.cliente_id)
    expect(new Set(ids).size).toBe(1)
    expect(ids[0]).toBe(`${VALENTINA}:pollo-pechuga-crudo`)
  })

  it('y volver a comprarlo tampoco lo duplica en el dispositivo', () => {
    // La misma regla que aplica `agregar()` en el dominio: volver a comprar algo
    // no es tenerlo dos veces, es tenerlo otra vez.
    const { db } = modulos!
    db.despensa.agregar(VALENTINA, pollo)
    db.despensa.agregar(VALENTINA, { ...pollo, cantidadG: 800, agregadoEn: '2026-08-24' })

    const suya = db.despensa.byUsuario(VALENTINA)
    expect(suya).toHaveLength(1)
    expect(suya[0].cantidadG).toBe(800)
    expect(suya[0].agregadoEn).toBe('2026-08-24')
  })

  it('un pedido sin id de catálogo se identifica por su texto normalizado', () => {
    // «Kefir» y «kefir  » son la misma petición escrita dos veces. Contarlas por
    // separado llenaría de duplicados la cola de trabajo del staff.
    const { db, cola } = modulos!
    db.despensa.agregar(VALENTINA, kefir)
    db.despensa.agregar(VALENTINA, { ...kefir, textoPedido: '  kefir ' })

    const ids = deDespensa(cola()).map((o) => o.payload.cliente_id)
    expect(new Set(ids).size).toBe(1)
    expect(ids[0]).toBe(`${VALENTINA}:pedido:kefir`)
    expect(db.despensa.byUsuario(VALENTINA)).toHaveLength(1)
  })

  it('el pedido viaja con su texto y sin alimento_id', () => {
    const { db, cola } = modulos!
    db.despensa.agregar(VALENTINA, kefir)

    const [op] = deDespensa(cola())
    expect(op.payload.alimento_id).toBeNull()
    expect(op.payload.texto_pedido).toBe('Kefir')
  })

  it('SACAR ALGO ENCOLA UN UPDATE, no un upsert', () => {
    // Un upsert que no encontrara la fila la INSERTARÍA, y sin `alimento_id` ni
    // `texto_pedido` chocaría contra el check `despensa_alimento_o_pedido`. El
    // update solo toca lo que ya existe.
    //
    // Y es `borrado`, no un delete: la cola no sabe borrar (0042). Sin esa
    // columna, sacar el pollo desde el móvil no llegaría nunca a la base y
    // volvería en la siguiente hidratación.
    const { db, cola } = modulos!
    db.despensa.agregar(VALENTINA, pollo)
    db.despensa.quitar(VALENTINA, 'pollo-pechuga-crudo')

    const quitar = deDespensa(cola()).find((o) => o.tipo === 'update')
    expect(quitar?.payload.borrado).toBe(true)
    expect(quitar?.filtro?.cliente_id).toBe(`${VALENTINA}:pollo-pechuga-crudo`)
    expect(db.despensa.byUsuario(VALENTINA)).toHaveLength(0)
  })

  it('una cantidad sin decir viaja como null, no como cero', () => {
    // «No dijo cuánto» no es «compró cero». La columna lo admite a propósito, y
    // un `Number(null)` los habría vuelto lo mismo.
    const { db, cola } = modulos!
    db.despensa.agregar(VALENTINA, kefir)

    const [op] = deDespensa(cola())
    expect(op.payload.cantidad_g).toBeNull()
  })

  it('la despensa de una persona no se mezcla con la de otra', () => {
    // El aislamiento entre asesorados es la propiedad más importante de la app
    // y ya se rompió dos veces.
    const { db } = modulos!
    db.despensa.agregar(VALENTINA, pollo)
    db.despensa.agregar('u-mateo', kefir)

    expect(db.despensa.byUsuario(VALENTINA)).toHaveLength(1)
    expect(db.despensa.byUsuario(VALENTINA)[0].alimentoId).toBe('pollo-pechuga-crudo')
    expect(db.despensa.byUsuario('u-mateo')).toHaveLength(1)
  })

  it('sacar lo de uno no toca lo del otro', () => {
    const { db } = modulos!
    db.despensa.agregar(VALENTINA, pollo)
    db.despensa.agregar('u-mateo', pollo)

    db.despensa.quitar(VALENTINA, 'pollo-pechuga-crudo')

    expect(db.despensa.byUsuario(VALENTINA)).toHaveLength(0)
    expect(db.despensa.byUsuario('u-mateo')).toHaveLength(1)
  })
})
