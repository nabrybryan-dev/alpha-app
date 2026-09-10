import { beforeEach, describe, expect, it, vi } from 'vitest'
import { medioPublicado, olvidarMediosFirmados } from './medios'

let fila: { path: string; grabado_el: string | null } | null
let urlQueDevuelve: string | undefined
let firmas = 0
let consultas = 0
let ultimaClave: string | undefined

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: () => ({
      select: () => ({
        eq: (_columna: string, valor: string) => {
          ultimaClave = valor
          return {
            maybeSingle: () => {
              consultas += 1
              return Promise.resolve({ data: fila })
            },
          }
        },
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrl: () => {
          firmas += 1
          return Promise.resolve({ data: urlQueDevuelve ? { signedUrl: urlQueDevuelve } : null })
        },
      }),
    },
  }),
}))

beforeEach(() => {
  fila = { path: 'cabecera/2026-09-10.mp4', grabado_el: '2026-09-07' }
  urlQueDevuelve = 'https://storage/firmada'
  firmas = 0
  consultas = 0
  ultimaClave = undefined
  olvidarMediosFirmados()
})

describe('el vídeo publicado', () => {
  it('mira primero QUÉ hay publicado y solo después firma ese archivo', async () => {
    const medio = await medioPublicado('cabecera-semanal')
    expect(ultimaClave).toBe('cabecera-semanal')
    expect(medio).toEqual({ url: 'https://storage/firmada', grabadoEl: '2026-09-07' })
  })

  it('sin nada publicado devuelve null y NO firma nada', async () => {
    // Si firmara una ruta que la app se sabe de memoria, despublicar el vídeo
    // no lo apagaría: seguiría abriéndose.
    fila = null
    expect(await medioPublicado('cabecera-semanal')).toBeNull()
    expect(firmas).toBe(0)
  })

  it('si la firma falla no revienta: la pantalla sigue viva', async () => {
    urlQueDevuelve = undefined
    expect(await medioPublicado('cabecera-semanal')).toBeNull()
  })

  it('reutiliza la firma en vez de pedir una por cada montaje', async () => {
    await medioPublicado('cabecera-semanal')
    await medioPublicado('cabecera-semanal')
    expect(firmas).toBe(1)
    expect(consultas).toBe(1)
  })

  it('un fallo NO se cachea: al siguiente intento se vuelve a pedir', async () => {
    urlQueDevuelve = undefined
    await medioPublicado('cabecera-semanal')
    urlQueDevuelve = 'https://storage/ya-va'
    const medio = await medioPublicado('cabecera-semanal')
    expect(medio?.url).toBe('https://storage/ya-va')
  })

  it('dos montajes a la vez comparten una sola petición', async () => {
    const [a, b] = await Promise.all([
      medioPublicado('cabecera-semanal'),
      medioPublicado('cabecera-semanal'),
    ])
    expect(a).toEqual(b)
    expect(consultas).toBe(1)
  })
})
