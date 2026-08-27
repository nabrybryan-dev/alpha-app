import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `@starting-style` solo puede quitar la ENTRADA, nunca la pieza.
 *
 * Tres clases de `tokens.css` estrenan con `@starting-style` en vez de con una
 * keyframe: `.aparece-pieza`, `.aviso-captura` y `.desplegar`. La razón está escrita
 * al lado de cada una y es la misma: una pieza que se sustituye por otra tiene que
 * poder REDIRIGIRSE a mitad de camino, y un keyframe reinicia desde cero.
 *
 * El precio es que `@starting-style` no está en todas partes. Safari y iOS lo traen
 * desde **17.5**; Chrome y Edge desde 117 y Firefox desde 129 (~90 % de uso global).
 * O sea que hay asesorados —un iPhone en iOS 17.4 o menos— que abren esto sin la
 * regla. Y ahí es donde esto se puede romper de una forma que no se ve desde aquí:
 * un navegador que ignora `@starting-style` **pinta la regla base y nada más**.
 *
 * Con lo que hay hoy eso es inofensivo: la regla base es el estado final VISIBLE
 * —`opacity: 1`, sin desplazamiento— y el `@starting-style` solo guarda el estado
 * previo. Sin la regla, el bloque aparece en su sitio, sin animarse. Se pierde la
 * entrada, no el contenido.
 *
 * Pero eso es una propiedad de cómo están escritas, no una garantía del lenguaje.
 * El día que alguien invierta el par —la base con `opacity: 0` y el estado visible
 * dentro del `@starting-style`, que es la forma «natural» de escribirlo si vienes
 * de un `from`/`to`— en Chrome se vería idéntico y en un iPhone viejo **el bloque
 * quedaría invisible para siempre**. Sin error de consola, sin test rojo, y en
 * pantallas donde lo invisible es una nota de ejecución o el aviso de la captura.
 *
 * Este guardián convierte esa propiedad en un contrato: la degradación deja de ser
 * una promesa en un comentario y pasa a estar comprobada.
 */

// Vitest corre desde la raíz del proyecto. Se usa `cwd` y no `import.meta.url`
// porque en Windows ese devuelve una ruta con prefijo `/@fs/` que `node:fs` no abre.
const RAIZ = process.cwd()
const CSS = readFileSync(join(RAIZ, 'src/styles/tokens.css'), 'utf8')

/** Un valor de `transform` que no mueve nada: la pieza está donde le toca. */
const TRANSFORMES_QUIETOS = /^(none|translateY\(0(px)?\)|translateX\(0(px)?\)|scale\(1\)|translate\(0(px)?,\s*0(px)?\))$/

interface Regla {
  selector: string
  declaraciones: Map<string, string>
}

/** Quita comentarios `/ * ... * /` para que un ejemplo dentro de uno no cuente. */
function sinComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function declaracionesDe(cuerpo: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const trozo of cuerpo.split(';')) {
    const i = trozo.indexOf(':')
    if (i === -1) continue
    m.set(trozo.slice(0, i).trim(), trozo.slice(i + 1).trim().replace(/\s+/g, ' '))
  }
  return m
}

/** Las reglas de dentro de cada bloque `@starting-style`. */
function reglasEnStartingStyle(css: string): Regla[] {
  const fuera: Regla[] = []
  const re = /@starting-style\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    // Recorrer llaves para cerrar el bloque: `@starting-style` anida reglas dentro.
    let prof = 1
    let i = m.index + m[0].length
    const desde = i
    while (i < css.length && prof > 0) {
      if (css[i] === '{') prof++
      else if (css[i] === '}') prof--
      i++
    }
    const dentro = css.slice(desde, i - 1)
    const reRegla = /([^{}]+)\{([^{}]*)\}/g
    let r: RegExpExecArray | null
    while ((r = reRegla.exec(dentro))) {
      fuera.push({ selector: r[1].trim(), declaraciones: declaracionesDe(r[2]) })
    }
  }
  return fuera
}

/** La regla base de un selector: la que se aplica cuando `@starting-style` no existe. */
function reglaBase(css: string, selector: string): Map<string, string> | null {
  // Se busca fuera de cualquier `@`: es la declaración de nivel superior.
  const sinArrancadas = css.replace(/@starting-style\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[};])\\s*${escapado}\\s*\\{([^{}]*)\\}`, 'm')
  const m = re.exec(sinArrancadas)
  return m ? declaracionesDe(m[2]) : null
}

const CSS_LIMPIO = sinComentarios(CSS)
const ARRANCADAS = reglasEnStartingStyle(CSS_LIMPIO)

describe('@starting-style se degrada a la pieza visible', () => {
  it('hay bloques que vigilar (si no, este guardián estaría de adorno)', () => {
    expect(ARRANCADAS.length).toBeGreaterThan(0)
  })

  it.each(ARRANCADAS.map((r) => [r.selector, r] as const))(
    '%s tiene regla base y esa base es el estado visible',
    (selector, arrancada) => {
      const base = reglaBase(CSS_LIMPIO, selector)

      // 1. Sin regla base no hay a qué degradarse: el navegador que ignora
      //    `@starting-style` no pinta NADA de esto.
      expect(base, `\`${selector}\` aparece en @starting-style sin regla base`).not.toBeNull()

      for (const [prop, valorInicial] of arrancada.declaraciones) {
        // 2. Toda propiedad que arranca tiene que tener su estado final en la base.
        //    Si falta, el valor de partida se queda como valor definitivo allí donde
        //    no hay transición que lo mueva.
        const valorFinal = base!.get(prop)
        expect(
          valorFinal,
          `\`${selector}\` arranca con \`${prop}\` pero la regla base no lo declara`,
        ).toBeDefined()

        // 3. Y ese estado final tiene que ser el VISIBLE, no el de partida.
        if (prop === 'opacity') {
          expect(Number(valorFinal), `\`${selector}\` se quedaría transparente sin @starting-style`).toBe(1)
        }
        if (prop === 'transform') {
          expect(valorFinal, `\`${selector}\` se quedaría desplazado sin @starting-style`).toMatch(
            TRANSFORMES_QUIETOS,
          )
        }
        // 4. Y tienen que ser distintos, o no hay entrada que animar.
        expect(valorFinal, `\`${selector}\` arranca en el mismo \`${prop}\` en el que acaba`).not.toBe(
          valorInicial,
        )
      }
    },
  )

  it('lo que arranca se anima con transición, no con keyframe', () => {
    // La otra mitad del razonamiento escrito en `tokens.css`: estas piezas se
    // sustituyen unas a otras, así que la entrada tiene que poder redirigirse a
    // mitad de camino. Un `animation` aquí sería un reinicio desde cero.
    for (const { selector } of ARRANCADAS) {
      const base = reglaBase(CSS_LIMPIO, selector)!
      expect(base.has('transition'), `\`${selector}\` arranca sin \`transition\``).toBe(true)
      expect(base.has('animation'), `\`${selector}\` mezcla @starting-style con \`animation\``).toBe(false)
    }
  })
})
