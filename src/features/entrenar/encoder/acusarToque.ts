/** Cuánto dura el anillo. Es `--dur-toque`, la misma que `.press`. */
const MS = 160

/**
 * El anillo que dice «te he oído» al tocar la imagen del visor.
 *
 * ## Por qué hace falta
 *
 * Tocar la imagen para fijar el disco es **uno de los dos toques que la doctrina
 * permite en una medición**, y hoy no se mueve nada bajo el dedo. Si acierta, la
 * confirmación llega un fotograma después, dibujada dentro del lienzo por el
 * bucle. Si falla hay dos caminos y **ninguno acusa**: el toque en la banda negra
 * sale por un `return` sin decir nada, y el disco no ajustable pinta un párrafo
 * a unos 300 px de distancia mientras la persona mira la imagen, con la barra en
 * las manos.
 *
 * ## Dice «te he oído», no «ha salido bien»
 *
 * Es idéntico en el acierto y en el fallo, a propósito. El veredicto lo dan la
 * materia y el aviso; el movimiento solo confirma que el toque llegó. Un anillo
 * que cambiara según el resultado sería un semáforo con otra forma.
 *
 * ## Dos reglas que lo mantienen fuera de la ruta de medida
 *
 * 1. Va en un **hermano** del lienzo, nunca dibujado DENTRO del canvas. Lo que
 *    se pinta en el lienzo lo lee el bucle de captura; un adorno ahí dentro es
 *    ruido en la imagen que se mide.
 * 2. Se coloca con las coordenadas **crudas** del evento, no con la salida de
 *    `puntoDeLaImagen`. El adorno no toca la conversión de coordenadas ni la
 *    necesita — y así no puede desplazarla ni depender de ella.
 *
 * Y se dispara ANTES de decidir si el punto es válido: el caso sin acuse era
 * justamente el toque que no vale.
 */
export function acusarToque(lienzo: HTMLCanvasElement, clientX: number, clientY: number): void {
  const escena = lienzo.parentElement
  if (!escena) return

  const r = lienzo.getBoundingClientRect()
  const anillo = document.createElement('span')
  anillo.setAttribute('aria-hidden', 'true')
  // 44 px es el objetivo táctil de la app: el anillo mide lo que mide el dedo.
  Object.assign(anillo.style, {
    position: 'absolute',
    left: `${clientX - r.left - 22}px`,
    top: `${clientY - r.top - 22}px`,
    width: '44px',
    height: '44px',
    borderRadius: '999px',
    border: '1px solid var(--placa-muerta)',
    pointerEvents: 'none',
    zIndex: '5',
  })
  escena.appendChild(anillo)

  const reducido =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (typeof anillo.animate === 'function') {
    anillo.animate(
      // Con movimiento reducido nace ya a tamaño y solo se desvanece: se pierde
      // el pulso, no el acuse. Y nunca arranca en `scale(0)` — un adorno que
      // nace de un punto se lee como un truco.
      [
        { transform: reducido ? 'scale(1)' : 'scale(0.9)', opacity: 0.9 },
        { transform: 'scale(1)', opacity: 0 },
      ],
      { duration: MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    )
  }

  // Se retira por reloj y NO encadenando `.finished`. Esa promesa puede no
  // resolver nunca —una pestaña en segundo plano, un navegador sin la API— y
  // entonces el anillo se quedaría clavado sobre la imagen que hay que medir.
  window.setTimeout(() => anillo.remove(), MS + 20)
}
