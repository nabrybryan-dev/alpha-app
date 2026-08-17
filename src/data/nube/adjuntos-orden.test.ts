import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mensaje } from '../../domain/types'
import { guardar, leer, vaciarDeposito } from '../../lib/depositoAdjuntos'
import { subirAdjuntoPendiente } from './sync'

const mensajeCon = (extra: Partial<Mensaje> = {}): Mensaje => ({
  id: 'msg-1',
  deId: 'u-valentina',
  paraId: 'u-coach',
  fechaIso: '2026-08-02T10:00:00.000Z',
  texto: '',
  adjuntoPath: 'u-valentina/msg-1.jpg',
  adjuntoTipo: 'imagen',
  adjuntoEstado: 'subiendo',
  leido: false,
  ...extra,
})

/**
 * El orden importa y por eso tiene test propio: si la fila subiera antes que el
 * archivo, el coach veria en su hilo un mensaje con foto y al tocarlo no habria
 * nada. El archivo seguiria en el telefono de la otra persona.
 */
describe('subirAdjuntoPendiente', () => {
  beforeEach(async () => {
    localStorage.clear()
    await vaciarDeposito()
  })

  it('sube el archivo que estaba esperando, a la ruta del mensaje', async () => {
    await guardar('msg-1', new Blob(['foto'], { type: 'image/jpeg' }), 'u-valentina')
    const subir = vi.fn().mockResolvedValue(undefined)

    await subirAdjuntoPendiente(mensajeCon(), subir)

    expect(subir).toHaveBeenCalledTimes(1)
    const [path, blob] = subir.mock.calls[0] as [string, Blob]
    expect(path).toBe('u-valentina/msg-1.jpg')
    expect(await blob.text()).toBe('foto')
  })

  it('si el archivo no sube, la fila no se encola y el blob sobrevive', async () => {
    await guardar('msg-1', new Blob(['foto'], { type: 'image/jpeg' }), 'u-valentina')

    const subio = await subirAdjuntoPendiente(
      mensajeCon(),
      vi.fn().mockRejectedValue(new Error('sin red')),
    )

    expect(subio).toBe(false)
    expect(await leer('msg-1')).toBeDefined()
  })

  it('borra el blob solo cuando la fila ya se encoló', async () => {
    await guardar('msg-1', new Blob(['foto'], { type: 'image/jpeg' }), 'u-valentina')

    const subio = await subirAdjuntoPendiente(mensajeCon(), vi.fn().mockResolvedValue(undefined))

    expect(subio).toBe(true)
    expect(await leer('msg-1')).toBeUndefined()
  })

  it('no intenta nada si el mensaje no tiene archivo esperando', async () => {
    const subir = vi.fn()
    expect(await subirAdjuntoPendiente(mensajeCon(), subir)).toBe(false)
    expect(subir).not.toHaveBeenCalled()
  })
})
