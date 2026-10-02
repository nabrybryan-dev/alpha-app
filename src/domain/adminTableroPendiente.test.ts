import { describe, expect, it } from 'vitest'
import { esTablaAusente, TEXTO_PENDIENTE_0102 } from './adminTablero'

describe('esTablaAusente', () => {
  it('reconoce que la tabla admin_tablero no existe (la 0102 no está aplicada)', () => {
    expect(esTablaAusente("finanzas: Could not find the table 'public.admin_tablero' in the schema cache")).toBe(true)
    expect(esTablaAusente('plan: relation "public.admin_tablero" does not exist')).toBe(true)
    expect(esTablaAusente('plan: PGRST205')).toBe(true)
  })
  it('un fallo de red o de permiso NO es «tabla ausente»: se dice como fallo', () => {
    expect(esTablaAusente('finanzas: permission denied for table admin_tablero')).toBe(false)
    expect(esTablaAusente('Failed to fetch')).toBe(false)
    expect(esTablaAusente('')).toBe(false)
  })
  it('el texto de la tarjeta gris nombra la migración', () => {
    expect(TEXTO_PENDIENTE_0102).toBe('Pendiente de activar (migración 0102)')
  })
})
