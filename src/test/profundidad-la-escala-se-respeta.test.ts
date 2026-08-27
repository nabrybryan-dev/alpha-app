import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Los dos guardianes de la escala de profundidad.
 *
 * `tokens.css` deja escrito el criterio de revisión: «si un `translateZ` del área
 * de entrenamiento no es una de estas cinco variables, está mal». Un criterio que
 * solo vive en un comentario se cumple mientras alguien se acuerde. Esto lo mide.
 *
 * Y el segundo guardián cubre una colisión que **no se pone roja en ninguna parte**
 * y que ya mordió una vez: ver abajo.
 */

const RAIZ = join(process.cwd(), 'src', 'features', 'entrenar')

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name)
    if (e.isDirectory()) return fuentes(ruta)
    if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) return []
    return [ruta]
  })
}

const ARCHIVOS = fuentes(RAIZ).map((ruta) => ({ ruta, texto: readFileSync(ruta, 'utf8') }))

describe('la escala de profundidad', () => {
  it('hay archivos que mirar (si no, el resto de este archivo miente)', () => {
    expect(ARCHIVOS.length).toBeGreaterThan(20)
  })

  /**
   * La ÚNICA excepción, y con motivo escrito.
   *
   * `GraficaBrazo` no apila superficies: es una escena de datos con su propia
   * `perspective` (1000 px, no los 900 del sistema) donde el eje Z representa un
   * plano de medición, no un escalón de interfaz. Su `translateZ(-64px)` coloca «el
   * plano que no se midió» detrás del medido; obligarlo a `--prof-fondo` no lo haría
   * más coherente, lo haría mentir sobre una distancia.
   *
   * Va nombrado y no como patrón: una excepción que se puede grepear es una
   * excepción; una regla laxa deja de guardar nada.
   */
  const FUERA_DE_LA_ESCALA_CON_MOTIVO = ['GraficaBrazo.tsx']

  it('ningún translateZ de superficie se sale de los cinco escalones', () => {
    // Los cinco y nada más. Un valor suelto —`translateZ(20px)`— rompe la escala sin
    // romper nada visible: se ve «parecido», y cinco pantallas con profundidad pasan
    // a notarse cinco pantallas distintas, que es justo lo que la escala evita.
    //
    // `translateZ(0)` se admite: no es un escalón, es el modismo de toda la vida para
    // promover una capa de composición. No dice «esto está a tal altura».
    //
    // Y se admite elegir ENTRE escalones con una plantilla —`var(${a ? '--prof-plano'
    // : '--prof-relieve'})`, que es como `DescansoTimer` distingue pausado de
    // corriendo—: los dos extremos siguen siendo de la escala.
    const ESCALON = String.raw`var\(--prof-(fondo|hueco|plano|relieve|sujeto)\)`
    const ADMITIDO = new RegExp(
      `^(?:0|${ESCALON}|var\\(\\$\\{[^}]*--prof-(fondo|hueco|plano|relieve|sujeto)[^}]*\\}\\))$`,
    )
    const sueltos: string[] = []

    for (const { ruta, texto } of ARCHIVOS) {
      if (FUERA_DE_LA_ESCALA_CON_MOTIVO.some((n) => ruta.endsWith(n))) continue
      for (const m of texto.matchAll(/translateZ\(((?:[^()]|\([^()]*\)|\$\{[^}]*\})*)\)/g)) {
        const valor = m[1].trim()
        if (!ADMITIDO.test(valor)) sueltos.push(`${ruta}: translateZ(${valor})`)
      }
    }

    expect(sueltos).toEqual([])
  })

  it('`al-fondo` nunca va sin `escena-prof`', () => {
    // La puerta de cámara se cuelga de `.escena-prof`: es esa clase, y solo esa, la
    // que `[data-camara-abierta]` aplana. Un `.al-fondo` suelto tendría el escorzo
    // de la perspectiva que le llegue por herencia y **seguiría escorzando durante
    // la captura**, que es cuando el presupuesto de fotogramas deja de ser una
    // metáfora: se pierde la toma.
    //
    // Y falla en silencio por partida doble: sin `escena-prof` propia puede que ni
    // se vea la profundidad, así que quien lo escriba mal no nota nada raro.
    const sueltos: string[] = []

    for (const { ruta, texto } of ARCHIVOS) {
      for (const m of texto.matchAll(/className=(?:{`|["'`])([^"'`]*)/g)) {
        const clases = m[1]
        if (/\bal-fondo\b/.test(clases) && !/\bescena-prof\b/.test(clases)) {
          sueltos.push(`${ruta}: «${clases.trim()}»`)
        }
      }
    }

    expect(sueltos).toEqual([])
  })

  it('nadie junta `tecla-3d` con una transición de Tailwind', () => {
    // LA COLISIÓN QUE NO AVISA. Tailwind inyecta sus utilidades en la línea 3 de
    // `tokens.css`, así que `.tecla-3d` —que está mucho más abajo— le gana a
    // `transition-colors` por orden, con la misma especificidad. El elemento se
    // queda sin la transición de color y el color pasa a saltar de golpe.
    //
    // No falla nada, no hay consola, no hay rojo: solo un parpadeo que nadie sabe de
    // dónde sale. Por eso `.tecla-3d` enumera hoy también los colores, y por eso el
    // marcado no debe volver a añadirle una utilidad de transición encima.
    const choques: string[] = []

    for (const { ruta, texto } of ARCHIVOS) {
      // Cada valor de `className`, entre comillas o entre backticks.
      for (const m of texto.matchAll(/className=(?:{`|["'`])([^"'`]*)/g)) {
        const clases = m[1]
        if (!/\btecla-3d\b/.test(clases)) continue
        const utilidad = /\b(transition(-\w+)?|duration-[\w[\].-]+|ease-[\w[\]().,-]+)\b/.exec(clases)
        if (utilidad) choques.push(`${ruta}: «${utilidad[0]}» junto a tecla-3d`)
      }
    }

    expect(choques).toEqual([])
  })
})
