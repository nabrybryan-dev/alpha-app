import { dimensionesDestino } from '../domain/adjuntos'

/**
 * Encoge la foto FUERA del hilo principal.
 *
 * Una foto de móvil son ~4.000 × 3.000 píxeles. Hacer esto en el hilo principal
 * congela la interfaz durante cientos de milisegundos, y ocurre en el peor
 * momento: la asesorada acaba de fotografiar algo para mandárselo al coach, en
 * mitad del entreno, y mientras tanto no le responde ni el cronómetro de
 * descanso.
 *
 * Quien llama (`comprimirSiEsImagen`) tiene su propia vuelta atrás: si este
 * worker no está disponible o contesta `{ ok: false }`, comprime en el hilo
 * principal, y si tampoco puede, sube el original. Perder la foto por no poder
 * encogerla sería peor que subirla grande.
 */
export type RespuestaCompresion = { ok: true; blob: Blob } | { ok: false }

/**
 * El `tsconfig` de este proyecto declara `lib: ["ES2023", "DOM"]`, sin
 * `WebWorker`, así que `DedicatedWorkerGlobalScope` no existe para el
 * compilador y `self` está tipado como ventana. Se acota aquí a lo único que
 * este archivo usa, en vez de meter la lib entera y arrastrar los choques de
 * declaraciones entre DOM y WebWorker a todo el proyecto.
 */
const hilo = self as unknown as {
  addEventListener(tipo: 'message', escucha: (evento: MessageEvent<Blob>) => void): void
  postMessage(mensaje: RespuestaCompresion): void
}

hilo.addEventListener('message', (evento) => {
  void (async () => {
    let bitmap: ImageBitmap | undefined
    try {
      bitmap = await createImageBitmap(evento.data)
      const { ancho, alto } = dimensionesDestino(bitmap.width, bitmap.height)

      const lienzo = new OffscreenCanvas(ancho, alto)
      const contexto = lienzo.getContext('2d')
      if (!contexto) {
        hilo.postMessage({ ok: false })
        return
      }

      contexto.drawImage(bitmap, 0, 0, ancho, alto)
      const blob = await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
      hilo.postMessage({ ok: true, blob })
    } catch {
      hilo.postMessage({ ok: false })
    } finally {
      // El bitmap descomprimido de una foto de 12 Mpx ocupa ~48 MB. Sin cerrarlo
      // se queda hasta que pase el recolector, y en un móvil de gama media eso
      // basta para que el navegador mate la pestaña a la tercera foto.
      bitmap?.close()
    }
  })()
})
