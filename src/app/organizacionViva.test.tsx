import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CUENTAS_DE_PRUEBA_ORGANIZAR, organizarEncendidoPara } from '../domain/praxis/rapidezLocal'
import { fijarOrganizacionViva, reiniciarOrganizacionViva, useOrganizacionVisible } from './organizacionViva'

const [PRUEBA] = [...CUENTAS_DE_PRUEBA_ORGANIZAR]
const OTRA = '00000000-0000-0000-0000-0000000000aa'
const guardada = { version: 1, ocultas: ['hoy.album'], movidas: { 'hoy.radar': -1 }, hayCambiosParaDeshacer: true }

afterEach(() => reiniciarOrganizacionViva())

describe('organización visible en Hoy y la barra', () => {
  it('la prueba solo se enciende para las dos cuentas de Bryan', () => {
    expect(CUENTAS_DE_PRUEBA_ORGANIZAR.size).toBe(2)
    for (const id of CUENTAS_DE_PRUEBA_ORGANIZAR) expect(organizarEncendidoPara(id, false)).toBe(true)
    expect(organizarEncendidoPara(OTRA, false)).toBe(false)
  })

  it('en una cuenta de prueba, lo guardado llega a la pantalla en el acto', () => {
    const { result } = renderHook(() => useOrganizacionVisible(PRUEBA!))
    expect(result.current.ocultas.size).toBe(0)
    act(() => fijarOrganizacionViva(PRUEBA!, guardada))
    expect([...result.current.ocultas]).toEqual(['hoy.album'])
    expect(result.current.movidas).toEqual({ 'hoy.radar': -1 })
  })

  it('cualquier otra persona nunca ve nada escondido, aunque llegue una organización', () => {
    const { result } = renderHook(() => useOrganizacionVisible(OTRA))
    act(() => fijarOrganizacionViva(OTRA, guardada))
    expect(result.current.ocultas.size).toBe(0)
  })
})
