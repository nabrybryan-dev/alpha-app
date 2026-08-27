/**
 * El aviso de la captura, SOBRE la imagen y no debajo de ella.
 *
 * ## El fallo que cierra
 *
 * Vivía como un párrafo entre la barra de medidas y el botón de grabar, así que
 * al aparecer **empujaba el botón hacia abajo**. Y aparece en el peor momento
 * posible: al fijar el disco, o sea el instante justo antes de que la mano vaya a
 * Grabar. Los avisos son largos —el del disco con esquinas pasa de 300
 * caracteres—, así que el botón se movía decenas de píxeles bajo el pulgar, en un
 * gimnasio y con la barra en las manos. Y volvía a moverse al parar, cuando el
 * aviso de escala reescribe el texto.
 *
 * ## Por qué encima y no reservando hueco
 *
 * Reservar el alto del aviso más largo son unos 150 px de vacío permanente sobre
 * el botón. Encima de la imagen no cuesta ni un píxel de maquetación: **el botón
 * no se mueve nunca**, y de paso el aviso aparece donde la persona ya está
 * mirando. Hasta hoy, el del disco no ajustable se pintaba a unos 300 px por
 * debajo, mientras ella miraba la imagen.
 *
 * Es además el sitio que esta pantalla ya usa para hablar: la pastilla de «toca
 * el disco» vive justo aquí. Por eso se turnan — dos mensajes a la vez en el
 * mismo borde serían ruido.
 *
 * ## El movimiento
 *
 * Entra con `transition` y no con `@keyframes`, porque un segundo aviso que
 * sustituye al primero tiene que poder redirigirse a mitad de camino. El
 * `@starting-style` da el estado de salida sin necesidad de un doble render; el
 * navegador que no lo entienda pinta el aviso sin más, que es exactamente lo que
 * hacía antes.
 */
export function AvisoDeCaptura({ aviso }: { aviso?: string | null }) {
  if (!aviso) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
      <p
        // La `key` hace que un aviso nuevo entre como nuevo en vez de cambiar el
        // texto por debajo sin que se note que ha cambiado.
        key={aviso}
        className="aviso-captura rounded-boton bg-black/80 px-3 py-2.5 text-[13px] leading-snug text-white"
      >
        {aviso}
      </p>
    </div>
  )
}
