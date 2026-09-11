import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  medioPublicado,
  miVideoDeLaSemana,
  olvidarElAviso,
  olvidarMediosFirmados,
} from './medios'

let fila: { path: string; grabado_el: string | null } | null
let filaPropia: { path: string; semana: string } | null
let errorPropio: { code: string; message: string } | null
let urlQueDevuelve: string | undefined
let firmas = 0
let consultas = 0
let ultimaClave: string | undefined

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    from: () => ({
      select: () => ({
        // La consulta del vídeo propio no filtra por persona: lo hace la
        // política de la base. Por eso encadena order/limit y no `eq`.
        order: () => ({
          limit: () => ({
            maybeSingle: () => {
              consultas += 1
              return Promise.resolve({ data: filaPropia, error: errorPropio })
            },
          }),
        }),
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
  fila = { path: 'comunes/cabecera-2026-09-10.mp4', grabado_el: '2026-09-07' }
  filaPropia = { path: 'personas/u-1/2026-09-07.mp4', semana: '2026-09-07' }
  errorPropio = null
  urlQueDevuelve = 'https://storage/firmada'
  firmas = 0
  consultas = 0
  ultimaClave = undefined
  olvidarMediosFirmados()
  olvidarElAviso()
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

describe('el vídeo de cada quien', () => {
  it('devuelve el suyo, firmado, sin decirle a la base de quién es', () => {
    // Quién es lo decide la política de la 0065 con la sesión: si el cliente
    // pudiera pedir el de otro id, el vídeo de una persona —que dice sus
    // cargas y su sueño en voz alta— lo abriría cualquiera.
    return miVideoDeLaSemana().then((v) => {
      expect(v).toEqual({ url: 'https://storage/firmada', grabadoEl: '2026-09-07' })
    })
  })

  it('sin vídeo propio todavía devuelve null y no firma nada', () => {
    filaPropia = null
    return miVideoDeLaSemana().then((v) => {
      expect(v).toBeNull()
      expect(firmas).toBe(0)
    })
  })

  /**
   * EL PAR QUE IMPORTA. Los dos casos devuelven `null` —y tienen que seguir
   * devolviendolo: un video no puede tumbar el chat— pero NO son lo mismo, y
   * confundirlos ya salio caro. El codigo del video se fusiono y se sirvio en
   * produccion el 2026-09-10 con la migracion `0065` sin aplicar: `videos_semanales`
   * no existia, la pantalla decia exactamente lo mismo que un domingo sin video, y
   * la funcion estuvo muerta sin que nadie lo notara.
   *
   * Las dos pruebas van juntas a proposito. Una sola no prueba nada: si el aviso
   * saltara siempre, la primera pasaria igual y seguiriamos sin poder distinguir.
   */
  it('la tabla ausente AVISA, aunque siga devolviendo null', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    filaPropia = null
    errorPropio = { code: '42P01', message: 'relation "videos_semanales" does not exist' }

    expect(await miVideoDeLaSemana()).toBeNull()
    expect(firmas).toBe(0)
    expect(aviso).toHaveBeenCalledTimes(1)
    expect(aviso.mock.calls[0]?.[0]).toContain('0065')
    aviso.mockRestore()
  })

  it('y una semana sin video NO avisa: el silencio es el caso normal', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    filaPropia = null
    errorPropio = null

    expect(await miVideoDeLaSemana()).toBeNull()
    expect(aviso).not.toHaveBeenCalled()
    aviso.mockRestore()
  })

  it('el aviso sale UNA vez por sesion, no en cada montaje', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    filaPropia = null
    errorPropio = { code: 'PGRST205', message: 'schema cache' }

    await miVideoDeLaSemana()
    await miVideoDeLaSemana()
    expect(aviso).toHaveBeenCalledTimes(1)
    aviso.mockRestore()
  })
})
