import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from './mockDb'

/**
 * El adjunto guarda DÓNDE está el archivo, no cómo se llamaba.
 *
 * Hasta ahora `adjuntoUrl` guardaba el nombre que traía el archivo en el
 * teléfono y nada más: el mensaje decía "video-sentadilla.mp4" y no había video
 * en ningún sitio.
 */
describe('mensajes con adjunto', () => {
  beforeEach(() => localStorage.clear())

  it('guarda el tipo y lo marca como subiendo', () => {
    const db = crearMockDb()
    db.mensajes.enviar({
      deId: 'u-valentina',
      paraId: 'u-coach',
      texto: '',
      adjuntoTipo: 'imagen',
      adjuntoEstado: 'subiendo',
    })
    const hilo = db.mensajes.hilo('u-valentina', 'u-coach')
    expect(hilo[hilo.length - 1]).toMatchObject({
      adjuntoTipo: 'imagen',
      adjuntoEstado: 'subiendo',
    })
  })

  /** El path necesita el id del mensaje, que solo existe después de crearlo. */
  it('anota el path cuando ya se conoce', () => {
    const db = crearMockDb()
    db.mensajes.enviar({ deId: 'u-valentina', paraId: 'u-coach', texto: '', adjuntoTipo: 'imagen' })
    const id = db.mensajes.hilo('u-valentina', 'u-coach').at(-1)!.id
    db.mensajes.anotarPath(id, `u-valentina/${id}.jpg`)
    expect(db.mensajes.hilo('u-valentina', 'u-coach').at(-1)?.adjuntoPath).toBe(
      `u-valentina/${id}.jpg`,
    )
  })

  it('marca el adjunto como listo cuando termina de subir', () => {
    const db = crearMockDb()
    db.mensajes.enviar({
      deId: 'u-valentina',
      paraId: 'u-coach',
      texto: '',
      adjuntoTipo: 'imagen',
      adjuntoEstado: 'subiendo',
    })
    const id = db.mensajes.hilo('u-valentina', 'u-coach').at(-1)!.id
    db.mensajes.marcarAdjuntoListo(id)
    expect(db.mensajes.hilo('u-valentina', 'u-coach').at(-1)?.adjuntoEstado).toBe('listo')
  })

  it('un mensaje de solo texto no trae campos de adjunto', () => {
    const db = crearMockDb()
    db.mensajes.enviar({ deId: 'u-valentina', paraId: 'u-coach', texto: 'hola' })
    const ultimo = db.mensajes.hilo('u-valentina', 'u-coach').at(-1)
    expect(ultimo?.adjuntoPath).toBeUndefined()
    expect(ultimo?.adjuntoTipo).toBeUndefined()
  })
})
