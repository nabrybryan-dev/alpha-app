import { describe, expect, it } from 'vitest'
import { PIEZAS_DE_OTRAS_PANTALLAS } from './catalogoDePiezas'
import { aplicarCambio, comoEstadoDeOrganizacion, deshacerUltimo, ESTADO_INICIAL, ordenDeFabrica, ordenVisible, ultimoCambio } from './organizacionLocal'

const agua = PIEZAS_DE_OTRAS_PANTALLAS.find((p) => p.id === 'nutricion.agua')!
const recetas = PIEZAS_DE_OTRAS_PANTALLAS.find((p) => p.id === 'nutricion.recetas')!

describe('organizacionLocal', () => {
  it('ocultar saca la pieza del orden visible y deshacer la devuelve', () => {
    const a = aplicarCambio(ESTADO_INICIAL, 'ocultar', agua, 'ocultar el agua')
    expect(a.ocultas).toEqual(['nutricion.agua'])
    expect(ordenVisible(a, '/nutricion')).not.toContain('nutricion.agua')
    expect(comoEstadoDeOrganizacion(a).hayCambiosParaDeshacer).toBe(true)
    const b = deshacerUltimo(a)
    expect(b.ocultas).toEqual([])
    expect(ordenVisible(b, '/nutricion')).toEqual(ordenDeFabrica('/nutricion'))
    expect(comoEstadoDeOrganizacion(b).hayCambiosParaDeshacer).toBe(false)
  })

  it('mover arriba y abajo cambia el orden y deshacer vuelve al de fábrica', () => {
    const arriba = aplicarCambio(ESTADO_INICIAL, 'mover_arriba', agua, 'subir el agua')
    expect(ordenVisible(arriba, '/nutricion')[0]).toBe('nutricion.agua')
    const abajo = aplicarCambio(arriba, 'mover_abajo', agua, 'bajar el agua')
    const o = ordenVisible(abajo, '/nutricion')
    expect(o[o.length - 1]).toBe('nutricion.agua')
    expect(ordenVisible(deshacerUltimo(deshacerUltimo(abajo)), '/nutricion')).toEqual(ordenDeFabrica('/nutricion'))
  })

  it('no muta el estado recibido y deshacer sin cambios no hace nada', () => {
    const antes = JSON.stringify(ESTADO_INICIAL)
    aplicarCambio(ESTADO_INICIAL, 'ocultar', recetas, 'x')
    expect(JSON.stringify(ESTADO_INICIAL)).toBe(antes)
    expect(deshacerUltimo(ESTADO_INICIAL)).toBe(ESTADO_INICIAL)
    expect(ultimoCambio(ESTADO_INICIAL)).toBeNull()
  })
})
