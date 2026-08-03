import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { pathDeAdjunto, subirAdjunto } from './adjuntos'

describe('pathDeAdjunto', () => {
  /**
   * La primera carpeta es el id de quien sube porque la política de Storage
   * decide por prefijo. Y el nombre original del archivo NO se usa: suele traer
   * el nombre de la persona o la fecha.
   */
  it('arma la ruta con el remitente y el id del mensaje', () => {
    expect(pathDeAdjunto('u-valentina', 'msg-9', 'image/jpeg')).toBe('u-valentina/msg-9.jpg')
  })

  it('un tipo desconocido no rompe la ruta', () => {
    expect(pathDeAdjunto('u-valentina', 'msg-9', 'image/vnd.rarito')).toBe('u-valentina/msg-9.bin')
  })
})

describe('subirAdjunto', () => {
  const clienteQue = (resultado: { error: { message: string } | null }) =>
    ({
      storage: { from: () => ({ upload: vi.fn().mockResolvedValue(resultado) }) },
    }) as unknown as SupabaseClient

  it('devuelve el path cuando la subida sale bien', async () => {
    const path = await subirAdjunto(
      clienteQue({ error: null }),
      'u-valentina/msg-9.jpg',
      new Blob(['x'], { type: 'image/jpeg' }),
    )
    expect(path).toBe('u-valentina/msg-9.jpg')
  })

  /** Lanzar es lo correcto: quien llama decide reintentar y NO borra el archivo. */
  it('lanza si el bucket la rechaza', async () => {
    await expect(
      subirAdjunto(
        clienteQue({ error: { message: 'no autorizado' } }),
        'u-valentina/msg-9.jpg',
        new Blob(['x'], { type: 'image/jpeg' }),
      ),
    ).rejects.toThrow('no autorizado')
  })
})
