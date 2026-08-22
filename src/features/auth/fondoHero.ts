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
 * Loop del hero. **Ascenso**, la dirección C.
 *
 * Se elige esa y no otra por una razón que no es de gusto: los dos pósters de
 * arriba SON fotogramas de la dirección C. Un loop de otra dirección arrancaría
 * con un salto visible en cuanto el vídeo relevara al póster, porque el primer
 * fotograma del vídeo no sería el que ya estaba en pantalla.
 *
 * Producido el 20-08-2026. Cumple lo que este archivo pedía:
 *   - 1280×720, WebM/AV1, **746 KB** — por debajo del techo de 900 KB.
 *   - En `public/hero/`.
 *
 * Las otras cuatro —A, B, D y E— ya tienen sitio, y no aquí: van en bandas
 * apaisadas por la app (Entrenar, Progreso, Contenidos y el manual de marca).
 * El catálogo con sus pósters está en `src/lib/direccionesVisuales.ts`.
 *
 * Estas dos pantallas siguen aparte a propósito: son verticales a pantalla
 * completa y sus pósters son renders verticales de 1080x1920, no los fotogramas
 * apaisados del catálogo.
 */
export const LOOP_HERO: string | null = '/hero/hero-loop-ascenso.webm'
