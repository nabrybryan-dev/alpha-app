import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useTemaDelDocumento } from './useTemaDelDocumento'

describe('useTemaDelDocumento', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'))

  it('sigue el data-theme de <html> y avisa al cambiar, sin recargar', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    const { result } = renderHook(() => useTemaDelDocumento())
    expect(result.current).toBe('dark')
    act(() => document.documentElement.setAttribute('data-theme', 'light'))
    await waitFor(() => expect(result.current).toBe('light'))
  })
})
