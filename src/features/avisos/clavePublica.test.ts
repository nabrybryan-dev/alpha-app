import { describe, expect, it } from 'vitest'
import { VAPID_PUBLICA_POR_DEFECTO, claveVapidPublica } from './clavePublica'

describe('clave VAPID pública', () => {
  it('tiene formato base64url de 87 caracteres que empieza por B', () => {
    expect(VAPID_PUBLICA_POR_DEFECTO).toMatch(/^B[A-Za-z0-9_-]{86}$/)
  })

  it('sin variable de entorno usa la constante', () => {
    expect(claveVapidPublica(undefined)).toBe(VAPID_PUBLICA_POR_DEFECTO)
    expect(claveVapidPublica('')).toBe(VAPID_PUBLICA_POR_DEFECTO)
  })

  it('con variable de entorno la sobrescribe', () => {
    expect(claveVapidPublica('otra-clave')).toBe('otra-clave')
  })
})
