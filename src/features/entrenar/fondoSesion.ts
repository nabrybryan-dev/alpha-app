/**
 * Los dos fondos de la tarjeta de sesión, uno por tipo de sesión.
 *
 * Se centralizan aquí por la misma razón que `fondoHero.ts` centraliza los de
 * entrada: `fondos-de-tarjeta.test.ts` lee la variable `--foto` del propio
 * archivo de la pantalla con una expresión regular, y en cuanto la ruta deja de
 * ser un literal —porque se elige entre dos— esa lectura devuelve el texto de la
 * expresión y no un archivo. Con las rutas aquí, el test las importa y comprueba
 * las dos contra la misma geometría.
 *
 * **Los dos tienen que aguantar 1074x1002.** Es la tarjeta medida en el móvil de
 * referencia (358x334 pt a densidad 3). Por eso ninguno de los dos es una pieza
 * apaisada del catálogo del hero: a 1280x720 habría que ampliarlas 1,39x, que es
 * justo lo que ese test prohíbe.
 */

/**
 * Sesión de fuerza: el banco con la barra cargada, de la dirección visual actual.
 *
 * La foto anterior (`atleta-hombre.jpeg`) medía 590x1280 y se ampliaba 1,82x en un
 * móvil: se veía borrosa y nadie lo notaba, porque en el navegador se pinta a 1x.
 */
export const FONDO_SESION_FUERZA = '/fondos/sesion-banco.jpg'

/**
 * Sesión metabólica: el sprint resistido de la dirección F.
 *
 * No es un capricho estético. La app distingue `tipo: 'fuerza' | 'metabolica'`
 * desde `domain/types.ts`, y hasta ahora las dos pintaban el mismo banco cargado.
 * Una sesión metabólica enseñando una barra es un error de contenido: dice que
 * toca hierro cuando lo que toca es trabajo metabólico.
 *
 * Es un still, no el loop de la dirección F. La tarjeta monta su fondo como
 * `background-image` y el loop apaisado no cabe aquí sin ampliarse. Se produce
 * vertical a 1080x1920, la misma medida que el de fuerza, para que el
 * `--foto-pos` de la pantalla encuadre igual en los dos.
 */
export const FONDO_SESION_METABOLICA = '/fondos/sesion-sprint.jpg'
