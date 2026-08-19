/**
 * Fondos de las dos pantallas de entrada.
 *
 * Se centralizan aquí porque el loop es el mismo en las dos y porque activarlo
 * tiene que ser un cambio de una línea, no una búsqueda por el árbol.
 */

/**
 * Torre del rack, dirección C. Su mitad inferior es negra a propósito: ahí cae
 * la marca.
 *
 * No es una foto recortada, es el fotograma ancla rematado por
 * `ps-bridge/terminar-ancla.jsx`, que mide la banda con el histograma antes de
 * dar el archivo por bueno: media 9, pico 11 sobre unos umbrales de 12 y 40.
 * Si algún día se sustituye, la sustituta tiene que pasar la misma medición o
 * el lema se leerá sobre metal iluminado.
 */
export const POSTER_SPLASH = '/fondos/ancla-rack-splash.jpg'

/**
 * Fondo del login, dirección C.
 *
 * Su contrato es el contrario al del splash. Allí la marca cae abajo, así que se
 * reserva la banda inferior; aquí el formulario flota en el CENTRO y la imagen
 * va en `object-cover`, o sea que se recorta por los lados en vertical y por
 * abajo en apaisado. Por eso los dos montantes van pegados a los bordes y la
 * columna central queda negra de arriba abajo: lo que se recorta no importa y
 * lo que queda detrás del cristal no pelea con él.
 *
 * Medido en la columna central (25-75% del ancho) a la altura del formulario
 * (38-72%): media 8,3. El fondo anterior daba 74,3 ahí mismo — nueve veces más
 * brillante, que es la razón de que esta pantalla necesite un velo tan cargado
 * encima.
 */
export const POSTER_LOGIN = '/fondos/login-rack.jpg'

/**
 * Loop de 8 s de la dirección elegida — Despiece, Órbita o Ascenso.
 *
 * `null` hasta que el archivo exista. Apuntar a una ruta que todavía no está
 * significa un 404 en cada arranque de la app, así que el vídeo no se monta
 * mientras esto no tenga valor.
 *
 * Cuando el loop esté listo:
 *   1. Comprimirlo por debajo de **900 KB** en WebM/AV1. El repo ya se quemó con
 *      un `@import` de fuentes de 314 KB bloqueando el primer pintado; un loop
 *      de 8 s a 4K sin comprimir es mucho peor.
 *   2. Dejarlo en `public/hero/`.
 *   3. Poner aquí su ruta.
 *
 * No hace falta tocar nada más: `Splash` y `LoginPage` ya lo esperan.
 */
export const LOOP_HERO: string | null = null
