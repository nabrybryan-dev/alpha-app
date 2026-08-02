import { beforeEach, describe, expect, it } from 'vitest'
import { borrar, guardar, leer, pendientesDe, vaciarDeposito } from './depositoAdjuntos'

const blobDe = (texto: string) => new Blob([texto], { type: 'image/jpeg' })

describe('depositoAdjuntos', () => {
  beforeEach(async () => {
    await vaciarDeposito()
  })

  it('guarda un archivo y lo devuelve igual', async () => {
    await guardar('msg-1', blobDe('foto'), 'u-valentina')
    const recuperado = await leer('msg-1')
    expect(await recuperado?.text()).toBe('foto')
  })

  it('devuelve undefined si no hay nada con ese id', async () => {
    expect(await leer('msg-inexistente')).toBeUndefined()
  })

  it('borra lo que ya subió', async () => {
    await guardar('msg-1', blobDe('foto'), 'u-valentina')
    await borrar('msg-1')
    expect(await leer('msg-1')).toBeUndefined()
  })

  /**
   * Móvil compartido: los archivos de una persona no pueden subirse con la
   * sesión de la siguiente. Es la misma regla que ya protege la cola de sync.
   */
  it('no mezcla los pendientes de dos personas', async () => {
    await guardar('msg-1', blobDe('suya'), 'u-valentina')
    await guardar('msg-2', blobDe('del otro'), 'u-camilo')
    expect(await pendientesDe('u-valentina')).toEqual(['msg-1'])
  })
})
