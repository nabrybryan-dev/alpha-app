import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Dos reglas de movimiento que el repo ya tenía escritas y nadie hacía cumplir.
 *
 * ## El desenfoque no puede montarse sobre algo que scrollea
 *
 * `tokens.css` lo dice al declarar `.glass-blur`: «el blur solo se aplica en
 * superficies fijas (nav, topbar, sheets) para no castigar el scroll en móvil».
 *
 * EL HUECO QUE CERRÓ (2026-08-27): la flecha de volver de la sesión llevaba
 * `backdrop-blur` y es `absolute` dentro de `.tarjeta-foto`, que es contenido
 * normal de la página y se desplaza con el scroll. Un `backdrop-filter` ahí
 * obliga a remuestrear y desenfocar esa región **en cada fotograma del scroll**,
 * y encima sobre una fotografía a sangre. Son 38×38 px, así que el coste es
 * pequeño — pero la pantalla de sesión se scrollea entre serie y serie, y la
 * regla que rompía era del propio repo.
 *
 * LA LÍNEA QUE SE TRAZA: dentro de `features/entrenar/` el desenfoque se pide
 * con la clase `.glass-blur`. La utilidad suelta `backdrop-blur` queda fuera.
 * No es que una sea más rápida —hacen lo mismo—: es que `.glass-blur` obliga a
 * pasar por el sitio donde está escrito **cuándo** vale usarla.
 *
 * ## `transition: all` es hallazgo siempre
 *
 * EL HUECO QUE CERRÓ (2026-08-27): la ficha del Salón de Máquinas animaba con
 * `all` las cuatro propiedades que se escriben debajo, **tres de ellas de
 * pintado**, y una era un halo de 8 px que se re-rasteriza en cada fotograma por
 * cada ficha — en la misma pantalla que la cámara.
 *
 * Pero lo que de verdad se cierra no es esa ficha: es que `all` arrastra a la
 * transición **cualquier propiedad que alguien añada mañana**, sin que nadie lo
 * decida. Nombrarlas obliga a elegir, y elegir es lo que impide que se cuele un
 * `box-shadow` o un `filter` por la puerta de atrás.
 *
 * NINGUNO DE LOS DOS PROHÍBE NADA. Hay listas de permitidos, hoy vacías, para la
 * excepción que llegue con su motivo — el mismo trato que `emojis-como-iconos`.
 */

const RAIZ = join(process.cwd(), 'src/features/entrenar')

/** Archivos con desenfoque suelto justificado. Vacío, y ojalá siga así. */
const BLUR_PERMITIDO: readonly string[] = []

/** Archivos con `transition: all` justificado. Vacío, y ojalá siga así. */
const ALL_PERMITIDO: readonly string[] = []

function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) return tsx(ruta)
    return ruta.endsWith('.tsx') && !ruta.endsWith('.test.tsx') ? [ruta] : []
  })
}

/** El código sin comentarios: lo que explica por qué NO se usa algo no cuenta. */
function codigo(ruta: string): string {
  return readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function culpablesDe(patron: RegExp, permitidos: readonly string[]): string[] {
  return tsx(RAIZ)
    .filter((ruta) => !permitidos.some((p) => ruta.endsWith(p)))
    .filter((ruta) => patron.test(codigo(ruta)))
    .map((ruta) => ruta.slice(RAIZ.length + 1))
}

describe('las dos reglas de movimiento que el repo ya tenía escritas', () => {
  it('nadie usa la utilidad suelta `backdrop-blur` dentro de entrenar', () => {
    const culpables = culpablesDe(/\bbackdrop-blur\b/, BLUR_PERMITIDO)
    expect(
      culpables,
      `Usan \`backdrop-blur\` suelto: ${culpables.join(', ')}.\n` +
        'Si la superficie es FIJA (nav, topbar, sheet), usa la clase `.glass-blur`.\n' +
        'Si scrollea, no lleva desenfoque: sube el fondo a `--ink-900` y ya.\n' +
        'Y si es una excepción de verdad, añádela a BLUR_PERMITIDO con su motivo.',
    ).toEqual([])
  })

  it('nadie transiciona `all`: las propiedades se nombran', () => {
    // Tres formas de escribirlo, y las tres cuentan: la utilidad de Tailwind, el
    // CSS suelto, y el objeto de estilo inline —donde `all` va entre comillas y
    // se escapaba del patrón obvio—.
    const culpables = culpablesDe(
      /\btransition-all\b|transition:\s*['"`]?\s*all\b/,
      ALL_PERMITIDO,
    )
    expect(
      culpables,
      `Transicionan \`all\`: ${culpables.join(', ')}.\n` +
        'Nombra las propiedades y quédate con las baratas: opacity y transform.\n' +
        'Nunca `box-shadow` ni `filter` en la lista: se re-rasterizan cada fotograma.',
    ).toEqual([])
  })

  it('nadie transiciona `width` ni `height`: las barras escalan', () => {
    // Una barra que crece por `width` dispara layout + pintado + composición en
    // **cada fotograma** del recorrido. Con `scaleX` sobre un carril al 100 % se
    // queda en el compositor y hace exactamente lo mismo a la vista.
    //
    // EL HUECO QUE CERRÓ (2026-08-27): las tres barras de la Ruta lo hacían a
    // 700 ms —más del doble del techo de 300 del estándar— y una de ellas
    // arrastraba además un halo de 24 px que hay que re-rasterizar entero en
    // cada fotograma. Y esa pantalla corre con el lienzo cinemático haciendo
    // scrub dentro de su propio `requestAnimationFrame`: el layout de la barra
    // y el scrub se peleaban por el mismo hilo.
    //
    // El halo, cuando lo haya, va en el carril que NO se mueve: sobre el
    // elemento escalado la sombra se deforma con él.
    const culpables = culpablesDe(/transition-\[(width|height)\]|transition:\s*['"`]?\s*(width|height)\b/, [])
    expect(
      culpables,
      `Transicionan una medida: ${culpables.join(', ')}.\n` +
        'Carril al 100 % y `transform: scaleX(pct/100)` con `origin-left`.\n' +
        'Es lo que `.barra-crece` ya hace en tokens.css.',
    ).toEqual([])
  })

  it('`.glass-blur` sigue siendo la vía sancionada, y se usa', () => {
    // Si esto se pone rojo es que alguien retiró el último uso legítimo: o el
    // desenfoque dejó de hacer falta —y entonces `.glass-blur` sobra en
    // tokens.css— o se sustituyó por la utilidad suelta, que es el fallo que
    // este archivo existe para cazar.
    const conGlass = tsx(RAIZ).filter((ruta) => readFileSync(ruta, 'utf8').includes('glass-blur'))
    expect(conGlass.length).toBeGreaterThan(0)
  })
})
