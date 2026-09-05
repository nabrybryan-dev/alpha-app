/**
 * LA SALA NO LLEVA EMOJI.
 *
 * `frasePorSerie` reparte frases con emoji —«Vas como un crack 🔥», «Máquina 🦅»— y en la
 * pantalla de sesión están bien: es una tarjeta de aplicación y ahí el emoji es tono.
 *
 * En el salón, la misma frase sale a 32 px sobre el muro, en la letra de la marca y con el
 * resplandor de la sala detrás. Ahí un emoji no es tono: es un dibujo de otro sistema
 * pegado en una pared de hormigón, en colores que no son los tres de esta sala —negro
 * mate, carmín y plata—. Es exactamente la queja de «recortes de la app», con pictograma.
 *
 * ## Por qué se quita AQUÍ y no en las frases
 *
 * Porque la pantalla de sesión las sigue usando tal cual, y quitarles el emoji allí sería
 * cambiarle el tono a una pantalla que nadie ha pedido cambiar. La frase es compartida; lo
 * que cambia es la superficie sobre la que se escribe. Quien pinta decide con qué materia
 * escribe, y una sala escribe sin emoji.
 *
 * ## Qué se borra exactamente
 *
 * Los rangos de pictogramas, símbolos y banderas, más los selectores de variación y el
 * unión de cero ancho que los encadenan. NO se tocan los signos de puntuación ni los
 * acentos: una frase en español tiene que salir entera.
 */

/**
 * Los bloques Unicode que son PICTOGRAMAS.
 *
 * Van explícitos y no como `\p{Emoji}`: esa propiedad casa también con los dígitos del 0
 * al 9 y con la almohadilla —llevan `Emoji=Yes` por los teclados de emoji con
 * variación—, así que «Serie 3» se habría quedado en «Serie ». Es un caso conocido de la
 * propiedad y el motivo de que exista `\p{Extended_Pictographic}`, pero escribir los
 * rangos deja ver qué se borra sin tener que saberse la tabla.
 */
const PICTOGRAMAS = new RegExp(
  '(?:' +
    // Los bloques de pictogramas, símbolos y flechas decorativas.
    '[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]' +
    // El selector de variación y el unión de ancho cero, que encadenan emoji
    // compuestos. Van FUERA de la clase de caracteres: dentro, ESLint los marca
    // con `no-misleading-character-class`, y con razón — una clase que mezcla
    // caracteres combinantes con rangos se lee como si casara pares y no lo hace.
    '|\u{FE0F}|\u{200D}' +
    // Las etiquetas de las banderas de subregión.
    '|[\u{E0020}-\u{E007F}]' +
    ')',
  'gu',
)

export function sinEmoji(frase: string): string {
  return frase.replace(PICTOGRAMAS, '').replace(/\s+/g, ' ').trim()
}
