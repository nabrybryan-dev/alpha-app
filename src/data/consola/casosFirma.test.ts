import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Mismo patrón que `revisiones.test.ts` y `ordenes.test.ts`: se mockea `../supabase`, no
 *  este archivo, para probar el camino real que arma cada llamada. */
const dobles = vi.hoisted(() => ({
  rpc: vi.fn(),
  createSignedUrl: vi.fn(),
  upload: vi.fn(),
}))

const estado = { activo: true, filasSelect: [] as unknown[], errorSelect: null as { message: string } | null }

vi.mock('../supabase', () => ({
  get modoNube() {
    return estado.activo
  },
  supabase: () => ({
    from: (tabla: string) => {
      if (tabla !== 'casos_firma') throw new Error(`tabla inesperada: ${tabla}`)
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: estado.filasSelect, error: estado.errorSelect }),
            }),
          }),
        }),
      }
    },
    storage: {
      from: (bucket: string) => {
        if (bucket !== 'firmas') throw new Error(`bucket inesperado: ${bucket}`)
        return {
          createSignedUrl: (...args: unknown[]) => dobles.createSignedUrl(...args),
          upload: (...args: unknown[]) => dobles.upload(...args),
        }
      },
    },
    rpc: (...args: unknown[]) => dobles.rpc(...args),
  }),
}))

const {
  casosFirmaDePersona,
  registrarFirma,
  subirFirma,
  urlDelCaso,
  validarArchivoFirma,
  TOPE_BYTES_FIRMA,
} = await import('./casosFirma')

function filaCasoCruda(extra: Record<string, unknown> = {}) {
  return {
    id: 'caso-1',
    usuario_id: 'u-1',
    semana_inicio: '2026-09-28',
    tipo: 'retiro',
    estado: 'listo_para_firmar',
    ruta_decision: 'casos/u-1/2026-09-28/caso-1.json',
    ruta_firma: null,
    valida_hasta: '2026-09-29T00:00:00Z',
    orden_id: 'orden-1',
    error: null,
    creado_en: '2026-09-28T12:00:00Z',
    actualizado_en: '2026-09-28T12:00:00Z',
    ...extra,
  }
}

beforeEach(() => {
  estado.activo = true
  estado.filasSelect = []
  estado.errorSelect = null
  vi.resetAllMocks()
})

describe('validarArchivoFirma', () => {
  it('acepta un .sig dentro del tope de peso', () => {
    expect(validarArchivoFirma({ name: 'caso-1.json.sig', size: 512 })).toEqual({ ok: true })
  })

  it('rechaza un archivo que no termina en .sig', () => {
    const resultado = validarArchivoFirma({ name: 'caso-1.json', size: 512 })
    expect(resultado).toEqual({ ok: false, motivo: 'El archivo debe terminar en «.sig».' })
  })

  it('rechaza un .sig vacío', () => {
    const resultado = validarArchivoFirma({ name: 'caso-1.json.sig', size: 0 })
    expect(resultado.ok).toBe(false)
  })

  it('rechaza un .sig que pesa más de 4 KB', () => {
    const resultado = validarArchivoFirma({ name: 'caso-1.json.sig', size: TOPE_BYTES_FIRMA + 1 })
    expect(resultado).toEqual({ ok: false, motivo: 'El archivo pesa más de 4 KB: no parece una firma.' })
  })

  it('un .sig justo en el tope (4096 bytes) se acepta', () => {
    expect(validarArchivoFirma({ name: 'x.sig', size: TOPE_BYTES_FIRMA })).toEqual({ ok: true })
  })

  it('la comparación de la extensión no distingue mayúsculas', () => {
    expect(validarArchivoFirma({ name: 'CASO-1.JSON.SIG', size: 10 })).toEqual({ ok: true })
  })
})

describe('casosFirmaDePersona', () => {
  it('en modo demo no consulta nada', async () => {
    estado.activo = false
    expect(await casosFirmaDePersona('u-1', '2026-09-28')).toEqual([])
  })

  it('traduce las filas a CasoFirma, más reciente primero (tal como llega de la base)', async () => {
    estado.filasSelect = [filaCasoCruda()]
    const casos = await casosFirmaDePersona('u-1', '2026-09-28')
    expect(casos).toEqual([
      {
        id: 'caso-1',
        usuarioId: 'u-1',
        semanaInicio: '2026-09-28',
        tipo: 'retiro',
        estado: 'listo_para_firmar',
        rutaDecision: 'casos/u-1/2026-09-28/caso-1.json',
        rutaFirma: null,
        validaHasta: '2026-09-29T00:00:00Z',
        ordenId: 'orden-1',
        error: null,
        creadoEn: '2026-09-28T12:00:00Z',
        actualizadoEn: '2026-09-28T12:00:00Z',
      },
    ])
  })

  it('descarta un tipo o un estado fuera del vocabulario conocido', async () => {
    estado.filasSelect = [filaCasoCruda({ id: 'caso-2', estado: 'algo-nuevo' })]
    expect(await casosFirmaDePersona('u-1', '2026-09-28')).toEqual([])
  })

  it('un caso rechazado con tipo null (nada que firmar esta semana) se traduce igual, con tipo: null', async () => {
    estado.filasSelect = [
      filaCasoCruda({ id: 'caso-3', tipo: null, estado: 'rechazado', ruta_decision: null, error: 'esta semana no tiene retiros ni recortes pendientes de firma' }),
    ]
    const casos = await casosFirmaDePersona('u-1', '2026-09-28')
    expect(casos).toEqual([
      expect.objectContaining({ id: 'caso-3', tipo: null, estado: 'rechazado', error: 'esta semana no tiene retiros ni recortes pendientes de firma' }),
    ])
  })

  it('ante un error de la base devuelve [], nunca lanza', async () => {
    estado.errorSelect = { message: 'tabla caída' }
    await expect(casosFirmaDePersona('u-1', '2026-09-28')).resolves.toEqual([])
  })
})

describe('urlDelCaso', () => {
  it('devuelve la URL firmada', async () => {
    dobles.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/caso-1.json?firma' }, error: null })
    const resultado = await urlDelCaso('casos/u-1/2026-09-28/caso-1.json')
    expect(resultado).toEqual({ ok: true, url: 'https://x/caso-1.json?firma' })
  })

  it('un error de Storage se traduce a { ok: false }, nunca lanza', async () => {
    dobles.createSignedUrl.mockResolvedValue({ data: null, error: { message: '403' } })
    const resultado = await urlDelCaso('casos/u-1/2026-09-28/caso-1.json')
    expect(resultado).toEqual({ ok: false, error: '403' })
  })
})

describe('subirFirma', () => {
  const archivoValido = new File(['contenido'], 'caso-1.json.sig', { type: 'application/octet-stream' })

  it('sube a <rutaDecision>.sig, sin upsert', async () => {
    dobles.upload.mockResolvedValue({ error: null })
    const resultado = await subirFirma('casos/u-1/2026-09-28/caso-1.json', archivoValido)
    expect(resultado).toEqual({ ok: true })
    expect(dobles.upload).toHaveBeenCalledWith(
      'casos/u-1/2026-09-28/caso-1.json.sig',
      archivoValido,
      { contentType: 'application/octet-stream' },
    )
  })

  it('rechaza un archivo que no es .sig SIN llamar a la red', async () => {
    const archivoMalo = new File(['contenido'], 'caso-1.json', { type: 'application/json' })
    const resultado = await subirFirma('casos/u-1/2026-09-28/caso-1.json', archivoMalo)
    expect(resultado).toEqual({ ok: false, error: 'El archivo debe terminar en «.sig».' })
    expect(dobles.upload).not.toHaveBeenCalled()
  })

  it('rechaza un .sig demasiado pesado SIN llamar a la red', async () => {
    const grande = new File([new Uint8Array(TOPE_BYTES_FIRMA + 1)], 'caso-1.json.sig')
    const resultado = await subirFirma('casos/u-1/2026-09-28/caso-1.json', grande)
    expect(resultado.ok).toBe(false)
    expect(dobles.upload).not.toHaveBeenCalled()
  })

  it('un error de Storage (por ejemplo, ya existe: sin reemplazar nada) se traduce, no lanza', async () => {
    dobles.upload.mockResolvedValue({ error: { message: 'The resource already exists' } })
    const resultado = await subirFirma('casos/u-1/2026-09-28/caso-1.json', archivoValido)
    expect(resultado).toEqual({ ok: false, error: 'The resource already exists' })
  })
})

describe('registrarFirma', () => {
  it('llama a la RPC con caso_id y traduce la fila devuelta', async () => {
    dobles.rpc.mockResolvedValue({ data: filaCasoCruda({ estado: 'firmado', ruta_firma: 'casos/u-1/2026-09-28/caso-1.json.sig' }), error: null })
    const resultado = await registrarFirma('caso-1')
    expect(dobles.rpc).toHaveBeenCalledWith('registrar_firma', { caso_id: 'caso-1' })
    expect(resultado).toEqual({
      ok: true,
      caso: expect.objectContaining({ id: 'caso-1', estado: 'firmado', rutaFirma: 'casos/u-1/2026-09-28/caso-1.json.sig' }),
    })
  })

  it('42501 (sin permiso) se traduce a un mensaje legible', async () => {
    dobles.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'row-level security' } })
    const resultado = await registrarFirma('caso-1')
    expect(resultado).toEqual({ ok: false, error: 'No tienes permiso para registrar esta firma.' })
  })

  it('P0002 (sin .sig subido) se traduce a un mensaje legible', async () => {
    dobles.rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'no encontrado' } })
    const resultado = await registrarFirma('caso-1')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.error).toMatch(/no se encontró la firma/i)
  })

  it('en modo demo no llama a la RPC', async () => {
    estado.activo = false
    const resultado = await registrarFirma('caso-1')
    expect(resultado).toEqual({ ok: false, error: 'Sin conexión con la base: esto es un demo.' })
    expect(dobles.rpc).not.toHaveBeenCalled()
  })
})
