import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El desenfoque no puede volver a montarse sobre algo que scrollea.
 *
 * LA REGLA YA ESTABA ESCRITA, y en el sitio correcto. `tokens.css` lo dice al
 * declarar `.glass-blur`: «el blur solo se aplica en superficies fijas (nav,
 * topbar, sheets) para no castigar el scroll en móvil». Lo que faltaba era algo
 * que lo hiciera cumplir.
 *
 * EL HUECO QUE CIERRA (2026-08-27). La flecha de volver de la sesión llevaba
 * `backdrop-blur` y es `absolute` dentro de `.tarjeta-foto`, que es contenido
 * normal de la página: se desplaza con el scroll. Un `backdrop-filter` ahí
 * obliga al navegador a remuestrear y desenfocar esa región **en cada fotograma
 * del scroll**, y encima sobre una fotografía a sangre. Son 38×38 px, así que
 * el coste es pequeño — pero la pantalla de sesión se scrollea entre serie y
 * serie, y la regla que rompía era del propio repo.
 *
 * LA LÍNEA QUE SE TRAZA: dentro de `features/entrenar/` el desenfoque se pide
 * con la clase `.glass-blur`, que existe para eso y está documentada. La
 * utilidad suelta `backdrop-blur` queda fuera. No es que una sea más rápida que
 * la otra —hacen lo mismo—: es que `.glass-blur` obliga a pasar por el sitio
 * donde está escrito cuándo vale usarla, y una utilidad suelta no.
 *
 * ESTE TEST NO PROHÍBE NADA. Si una superficie fija de verdad la necesita, se
 * añade aquí con su motivo y el test pasa — igual que `emojis-como-iconos`.
 */

const RAIZ = join(process.cwd(), 'src/features/entrenar')

/** Archivos con desenfoque suelto justificado. Vacío, y ojalá siga así. */
const PERMITIDOS: readonly string[] = []

function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) return tsx(ruta)
    return ruta.endsWith('.tsx') && !ruta.endsWith('.test.tsx') ? [ruta] : []
  })
}

describe('el blur solo va en superficies fijas', () => {
  it('nadie usa la utilidad suelta `backdrop-blur` dentro de entrenar', () => {
    const culpables = tsx(RAIZ)
      .filter((ruta) => !PERMITIDOS.some((p) => ruta.endsWith(p)))
      .filter((ruta) => {
        const fuente = readFileSync(ruta, 'utf8')
        // Solo en código, no en los comentarios que explican por qué no se usa.
        const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        return /\bbackdrop-blur\b/.test(sinComentarios)
      })
      .map((ruta) => ruta.slice(RAIZ.length + 1))

    expect(
      culpables,
      `Usan \`backdrop-blur\` suelto: ${culpables.join(', ')}.\n` +
        'Si la superficie es FIJA (nav, topbar, sheet), usa la clase `.glass-blur`.\n' +
        'Si scrollea, no lleva desenfoque: sube el fondo a `--ink-900` y ya.\n' +
        'Y si es una excepción de verdad, añádela a PERMITIDOS con su motivo.',
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
