/**
 * Qué rutas se abren sin sesión. Solo el espacio de interesados: cualquier otra ruta
 * sigue detrás de `SessionProvider`, y un prefijo parecido no cuela.
 */
import { describe, expect, it } from 'vitest'
import { esRutaPublica } from './rutasPublicas'

describe('esRutaPublica', () => {
  it('abre /interesados sin sesión', () => {
    expect(esRutaPublica('/interesados')).toBe(true)
    expect(esRutaPublica('/interesados/')).toBe(true)
  })

  it('no abre nada más, ni un prefijo parecido', () => {
    for (const ruta of ['/', '/coach', '/entrenar', '/interesadosx', '/coach/interesados']) {
      expect(esRutaPublica(ruta)).toBe(false)
    }
  })
})
