/**
 * Que la cámara esté capturando es un hecho GLOBAL, no una prop de una tarjeta.
 *
 * Le importa a cosas que no tienen relación de parentesco con quien abre la
 * cámara: el gabinete que está al lado en la misma pantalla, la profundidad de
 * toda el área de entrenamiento, y cualquier cosa que se mueva mientras el
 * encoder captura a 50 fps. Cablearlo por seis componentes se habría olvidado en
 * el séptimo.
 *
 * Así que se publica como atributo en el `<body>` y quien lo necesite lo lee:
 * el CSS con `[data-camara-abierta]`, y el JS con `camaraAbierta()`.
 *
 * ESTE ARCHIVO EXISTE POR EL NOMBRE. El atributo aparece en `tokens.css`, aquí
 * al escribirlo y aquí al leerlo — tres sitios, y el CSS no puede importar del
 * TS. Lo que se puede centralizar se centraliza: si alguien lo renombra, rompe
 * una sola línea de TypeScript en vez de dejar la puerta abierta en silencio,
 * que es el modo de fallo que de verdad duele aquí.
 */

/** La clave en `dataset`. En CSS es `[data-camara-abierta]`. */
const CLAVE = 'camaraAbierta'

/**
 * Marca el documento mientras la cámara captura. Devuelve la función de
 * limpieza, pensada para devolverla tal cual desde un `useEffect`.
 *
 * Si el atributo se quedara pegado, la app entera se quedaría sin animaciones y
 * sin profundidad hasta recargar — por eso la limpieza no es opcional.
 */
export function marcarCamaraAbierta(): () => void {
  document.body.dataset[CLAVE] = 'si'
  return () => {
    delete document.body.dataset[CLAVE]
  }
}

/**
 * Si la cámara está capturando ahora mismo.
 *
 * Para lo que el CSS no alcanza: una cadena de temporizadores no es una
 * animación, así que `animation-play-state` no la para. Quien programe trabajo
 * repetido tiene que preguntarlo él.
 */
export function camaraAbierta(): boolean {
  return typeof document !== 'undefined' && document.body.dataset[CLAVE] === 'si'
}
