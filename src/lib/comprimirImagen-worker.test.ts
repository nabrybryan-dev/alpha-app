import { afterEach, describe, expect, it, vi } from 'vitest'
import { comprimirSiEsImagen } from './comprimirImagen'

/**
 * La compresión se salió del hilo principal.
 *
 * Una foto de móvil son ~4.000 × 3.000 píxeles: encogerla en el hilo principal
 * congela la interfaz durante cientos de milisegundos, y pasa justo cuando la
 * asesorada está en mitad del entreno.
 *
 * Lo que se prueba aquí es la CADENA DE VUELTA ATRÁS, que es lo que hace seguro
 * el cambio: worker → hilo principal → archivo original. jsdom no dibuja en
 * canvas, así que el hilo principal siempre devuelve el original, y eso vale
 * como «no se usó el worker».
 */

/** Un worker de mentira que contesta lo que se le diga. */
function workerQue(responde: (postMessage: (m: unknown) => void) => void) {
  const terminados: number[] = []
  class WorkerFalso {
    onmessage: ((e: MessageEvent<unknown>) => void) | null = null
    onerror: (() => void) | null = null
    postMessage() {
      responde((m) => this.onmessage?.({ data: m } as MessageEvent<unknown>))
    }
    terminate() {
      terminados.push(1)
    }
  }
  vi.stubGlobal('Worker', WorkerFalso)
  vi.stubGlobal('OffscreenCanvas', class {})
  return terminados
}

const foto = () => new File(['x'], 'f.jpg', { type: 'image/jpeg' })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('comprimirSiEsImagen · fuera del hilo principal', () => {
  it('usa el worker cuando el navegador puede', async () => {
    const encogida = new Blob(['reducida'], { type: 'image/jpeg' })
    workerQue((post) => post({ ok: true, blob: encogida }))

    expect(await comprimirSiEsImagen(foto())).toBe(encogida)
  })

  /** Si el worker no puede, se comprime aquí; y en jsdom eso da el original. */
  it('si el worker dice que no puede, cae al hilo principal', async () => {
    workerQue((post) => post({ ok: false }))

    const original = foto()
    expect(await comprimirSiEsImagen(original)).toBe(original)
  })

  it('si el worker revienta, cae al hilo principal', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: unknown = null
        onerror: (() => void) | null = null
        postMessage() {
          this.onerror?.()
        }
        terminate() {}
      },
    )
    vi.stubGlobal('OffscreenCanvas', class {})

    const original = foto()
    expect(await comprimirSiEsImagen(original)).toBe(original)
  })

  /**
   * LA QUE EVITA UN FALLO MUDO. Un worker colgado dejaría la promesa sin
   * resolver para siempre, y con ella la foto sin subir: el mensaje se quedaría
   * en «subiendo» sin un error que lo explicara. El tope lo rescata.
   */
  it('un worker colgado no deja la foto sin subir', async () => {
    vi.useFakeTimers()
    workerQue(() => {
      /* nunca contesta */
    })

    const original = foto()
    const enCurso = comprimirSiEsImagen(original)
    await vi.advanceTimersByTimeAsync(8_000)

    expect(await enCurso).toBe(original)
  })

  /** Uno por foto: si no se cerrara, cada envío dejaría un hilo vivo detrás. */
  it('el worker se cierra siempre, aunque falle', async () => {
    const terminados = workerQue((post) => post({ ok: false }))

    await comprimirSiEsImagen(foto())

    expect(terminados).toHaveLength(1)
  })

  /** El vídeo ni siquiera llega al worker. */
  it('el vídeo no pasa por el worker', async () => {
    const terminados = workerQue((post) => post({ ok: true, blob: new Blob(['x']) }))

    const video = new File(['x'], 'v.mp4', { type: 'video/mp4' })
    expect(await comprimirSiEsImagen(video)).toBe(video)
    expect(terminados).toHaveLength(0)
  })
})
