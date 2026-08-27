import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Un color al que se le pone opacidad tiene que admitirla.
 *
 * Tailwind solo aplica un modificador —`bg-ink-900/70`— si el color está declarado
 * con el marcador `<alpha-value>`, o sea en la forma `rgb(<canales> / <alpha-value>)`.
 * Si está declarado como un `var()` a secas, **descarta la clase entera y no genera
 * ninguna regla**. Y lo hace en silencio: no falla el build, no falla el typecheck,
 * no falla ningún test de componente. El elemento simplemente se queda sin fondo.
 *
 * Pasó de verdad, y en seis sitios a la vez: `bg-ink-700/95` en la lámina de cristal
 * del descanso —cuyo único fondo real acabó siendo el `backdrop-filter`—, y cinco
 * más en nutrición. Se descubrió abriendo la app en el navegador y leyendo el estilo
 * calculado, que es la única forma de ver un color que no se pinta.
 *
 * Este guardián lo cierra para siempre, y también para las escalas que todavía no
 * han caído: si mañana alguien escribe `bg-silver-300/40` sin darle `<alpha-value>`
 * a esa escala, esto se pone rojo antes de que llegue a producción.
 */

// Vitest corre desde la raíz del proyecto. Se usa `cwd` y no `import.meta.url`
// porque en Windows ese devuelve una ruta con prefijo `/@fs/` que `node:fs` no abre.
const RAIZ = process.cwd()

/** Las utilidades de Tailwind que aceptan modificador de opacidad. */
const PREFIJOS = ['bg', 'text', 'border', 'ring', 'fill', 'stroke', 'from', 'via', 'to', 'divide', 'outline', 'shadow', 'accent', 'caret', 'decoration', 'placeholder']

function archivosFuente(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === 'dist' || entrada.startsWith('.')) continue
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) archivosFuente(ruta, acc)
    else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) acc.push(ruta)
  }
  return acc
}

/** Los colores del `theme.extend.colors` y cómo están declarados. */
function coloresDeTailwind(): Map<string, string> {
  const cfg = readFileSync(join(RAIZ, 'tailwind.config.js'), 'utf8')
  const bloque = cfg.slice(cfg.indexOf('colors: {'))
  const mapa = new Map<string, string>()
  for (const m of bloque.matchAll(/^\s*'?([a-zA-Z][\w-]*)'?:\s*'([^']+)'/gm)) {
    mapa.set(m[1], m[2])
  }
  return mapa
}

/**
 * Los colores que HOY se usan con opacidad sin admitirla.
 *
 * Son 222 clases repartidas en estos doce, y ninguna pinta. No se arreglan aquí
 * porque no es un cambio pequeño: siete de ellos se redefinen por tema —hay que dar
 * canales en `:root` y otra vez en `[data-theme="light"]`— y `hairline` ya es un
 * `rgba()` con su propia alfa, así que ni siquiera encaja en la forma de canales.
 * Eso es una tanda propia, con su revisión.
 *
 * Esta lista es un **delta, no un presupuesto**, igual que los avisos del linter: no
 * se trata de tenerla a cero hoy, se trata de que no crezca. Si alguien añade un
 * color nuevo a `extend` y lo usa con `/NN` sin `<alpha-value>`, este test se pone
 * rojo. Y si alguien arregla uno de estos doce, hay que quitarlo de aquí — el test
 * también avisa de eso, para que la lista no se quede mintiendo.
 */
const SIN_ALFA_CONOCIDOS = [
  'ambar',
  'azul',
  'bg',
  'hairline',
  'linea',
  'oro',
  'rojo',
  'surface-2',
  'surface-3',
  'tenue',
  'texto',
  'verde',
] as const

describe('los colores del sistema admiten la opacidad que se les pide', () => {
  it('ningún color NUEVO se usa con opacidad sin admitirla', () => {
    const colores = coloresDeTailwind()
    expect(colores.size).toBeGreaterThan(10)

    const patron = new RegExp(`\\b(?:${PREFIJOS.join('|')})-([a-zA-Z][\\w-]*?)/(\\d{1,3})\\b`, 'g')
    const rotos = new Map<string, string>()

    for (const archivo of archivosFuente(join(RAIZ, 'src'))) {
      const fuente = readFileSync(archivo, 'utf8')
      for (const m of fuente.matchAll(patron)) {
        const [clase, nombre] = [m[0], m[1]]
        const declaracion = colores.get(nombre)
        // Un color que no está en `extend` es de la paleta de Tailwind (black,
        // white, transparent…), y esos ya admiten opacidad de fábrica.
        if (declaracion === undefined) continue
        if (!declaracion.includes('<alpha-value>') && !rotos.has(nombre)) {
          const rel = archivo.slice(RAIZ.length).replace(/\\/g, '/')
          rotos.set(nombre, `${rel}: "${clase}"`)
        }
      }
    }

    const nuevos = [...rotos.keys()].filter((c) => !SIN_ALFA_CONOCIDOS.includes(c as never))
    expect(
      nuevos,
      'Estas clases NO generan ninguna regla CSS y dejan el elemento sin color.\n' +
        'Arreglo: declarar ese color en tailwind.config.js como\n' +
        "  'nombre': 'rgb(var(--nombre-rgb) / <alpha-value>)'\n" +
        'y añadir sus canales a tokens.css, como ya hacen `ink-*` y `accion`.\n\n' +
        nuevos.map((c) => `${c} -> ${rotos.get(c)}`).join('\n'),
    ).toEqual([])

    // Y al revés: si uno de los conocidos ya se arregló, que salga de la lista.
    const yaArreglados = SIN_ALFA_CONOCIDOS.filter((c) => !rotos.has(c))
    expect(
      yaArreglados,
      `Estos colores ya admiten opacidad (o dejaron de usarse con ella): ${yaArreglados.join(', ')}.\n` +
        'Quítalos de SIN_ALFA_CONOCIDOS para que la lista no mienta.',
    ).toEqual([])
  })

  it('la escala ink acepta opacidad y su color sigue saliendo de los canales', () => {
    const colores = coloresDeTailwind()
    for (const tono of ['1000', '900', '800', '700', '600', '500', '400']) {
      expect(colores.get(`ink-${tono}`)).toBe(`rgb(var(--ink-${tono}-rgb) / <alpha-value>)`)
    }
    // Y una sola fuente por color: el hex se deriva de los canales, no se repite.
    const css = readFileSync(join(RAIZ, 'src/styles/tokens.css'), 'utf8')
    for (const tono of ['900', '700']) {
      expect(css).toContain(`--ink-${tono}: rgb(var(--ink-${tono}-rgb));`)
    }
  })
})
