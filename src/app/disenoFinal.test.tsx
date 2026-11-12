import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CUENTAS_CON_DISENO_FINAL, disenoFinalEncendidoPara } from '../domain/praxis/rapidezLocal'
import { clasesDeLaHoja } from '../features/entrenar/salon/panel/portadaMaqueta'
import { reiniciarOrganizacionViva, useDisenoFinal, useOrganizacionVisible } from './organizacionViva'

const [PERSONAL] = [...CUENTAS_CON_DISENO_FINAL]
const OTRA = '00000000-0000-0000-0000-0000000000bb'
afterEach(() => reiniciarOrganizacionViva())

describe('el diseño final, encendido solo en la cuenta personal de Bryan', () => {
  it('solo una cuenta está en la lista', () => {
    expect(CUENTAS_CON_DISENO_FINAL.size).toBe(1)
    expect(disenoFinalEncendidoPara(PERSONAL!)).toBe(true)
    expect(disenoFinalEncendidoPara(OTRA)).toBe(false)
    expect(disenoFinalEncendidoPara(null)).toBe(false)
  })

  it('la cuenta personal lo ve encendido; cualquier otra, no', () => {
    const a = renderHook(() => { useOrganizacionVisible(PERSONAL!); return useDisenoFinal() })
    expect(a.result.current).toBe(true)
    a.unmount()
    reiniciarOrganizacionViva()
    const b = renderHook(() => { useOrganizacionVisible(OTRA); return useDisenoFinal() })
    expect(b.result.current).toBe(false)
  })

  it('lo que se pide explícito manda sobre la cuenta', () => {
    const { result } = renderHook(() => { useOrganizacionVisible(PERSONAL!); return useDisenoFinal(false) })
    expect(result.current).toBe(false)
  })

  it('la hoja del salón cambia de piel solo cuando el diseño final está encendido', () => {
    expect(clasesDeLaHoja(true).hoja).toContain('hoja-portada')
    expect(clasesDeLaHoja(false).hoja).not.toContain('hoja-portada')
    act(() => undefined)
  })
})

describe('«Praxis a un toque» en la cuenta personal', () => {
  it('la cuenta con el diseño final monta la capa y la otra no', async () => {
    const { CapaDeUnToque } = await import('../features/praxis/unToque/CapaDeUnToque')
    expect(typeof CapaDeUnToque).toBe('function')
    const a = renderHook(() => { useOrganizacionVisible(PERSONAL!); return useDisenoFinal() })
    expect(a.result.current).toBe(true)
    a.unmount()
    reiniciarOrganizacionViva()
    const b = renderHook(() => { useOrganizacionVisible(OTRA); return useDisenoFinal() })
    expect(b.result.current).toBe(false)
  })
})
