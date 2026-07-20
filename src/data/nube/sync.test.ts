import { describe, expect, it } from 'vitest'
import { integrarEnCola, limpiarColasDeSync, pendientesDeSync, type OperacionPendiente } from './sync'

const upsertMicrociclo = (id: string, numero: number): OperacionPendiente => ({
  tabla: 'microciclos',
  tipo: 'upsert',
  payload: { id, numero },
})

describe('integrarEnCola', () => {
  it('agrega al final cuando la fila no estaba en cola', () => {
    const cola = integrarEnCola([], upsertMicrociclo('m1', 1))
    expect(cola).toHaveLength(1)
    expect(cola[0].payload.id).toBe('m1')
  })

  it('reemplaza el upsert pendiente de la misma fila en vez de acumular', () => {
    let cola: OperacionPendiente[] = []
    for (let serie = 1; serie <= 24; serie++) {
      cola = integrarEnCola(cola, upsertMicrociclo('m1', serie))
    }
    expect(cola).toHaveLength(1)
    expect(cola[0].payload.numero).toBe(24)
  })

  it('mantiene la posición original al reemplazar (no reordena escrituras)', () => {
    let cola = integrarEnCola([], upsertMicrociclo('m1', 1))
    cola = integrarEnCola(cola, upsertMicrociclo('m2', 1))
    cola = integrarEnCola(cola, upsertMicrociclo('m1', 2))
    expect(cola.map((o) => o.payload.id)).toEqual(['m1', 'm2'])
    expect(cola[0].payload.numero).toBe(2)
  })

  it('no mezcla filas distintas ni tablas distintas', () => {
    let cola = integrarEnCola([], upsertMicrociclo('m1', 1))
    cola = integrarEnCola(cola, {
      tabla: 'checkins',
      tipo: 'upsert',
      payload: { id: 'm1', datos: {} },
    })
    expect(cola).toHaveLength(2)
  })

  it('coalesce por usuario_id cuando el payload no trae id (perfiles)', () => {
    let cola = integrarEnCola([], {
      tabla: 'perfiles',
      tipo: 'upsert',
      payload: { usuario_id: 'u1', datos: { v: 1 } },
    })
    cola = integrarEnCola(cola, {
      tabla: 'perfiles',
      tipo: 'upsert',
      payload: { usuario_id: 'u1', datos: { v: 2 } },
    })
    expect(cola).toHaveLength(1)
    expect((cola[0].payload.datos as { v: number }).v).toBe(2)
  })

  it('nunca coalesce updates con filtro (marcar leídos)', () => {
    const update: OperacionPendiente = {
      tabla: 'mensajes',
      tipo: 'update',
      payload: { leido: true },
      filtro: { para_id: 'u1', de_id: 'u2' },
    }
    const cola = integrarEnCola(integrarEnCola([], update), update)
    expect(cola).toHaveLength(2)
  })
})

describe('limpiarColasDeSync', () => {
  it('borra la cola y los descartes de localStorage', () => {
    localStorage.setItem('alpha-cola-sync', JSON.stringify([upsertMicrociclo('m1', 1)]))
    localStorage.setItem('alpha-cola-descartes', JSON.stringify([upsertMicrociclo('m2', 1)]))
    expect(pendientesDeSync()).toBe(1)
    limpiarColasDeSync()
    expect(pendientesDeSync()).toBe(0)
    expect(localStorage.getItem('alpha-cola-descartes')).toBeNull()
  })
})
