import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importacionesDe } from '../../scripts/codigo-huerfano.mjs'

/**
 * EL BUCLE DEL DÍA CALCULA, NO MUESTRA. Este test es esa frase, ejecutable.
 *
 * ## Por qué existe, y por qué existe DESDE HOY
 *
 * El acuerdo con el coach (supuesto del 2026-08-25, §7.1) es que la ondulación
 * flexible intra-semana corra **en sombra** hasta que un número la avale: la app
 * calcula el escenario que habría pisado cada día y **no se lo enseña a nadie**.
 *
 * Hasta el 2026-09-04 eso lo garantizaba de rebote el detector de código huérfano:
 * `bucleDelDia` no lo importaba nadie, así que era imposible que llegara a una
 * pantalla. Ese día se escribió `corridaEnSombra.ts` para reproducir el bucle
 * sobre la historia, y con ese primer consumidor **la garantía se cayó sola**: el
 * detector solo mira si hay consumidor, no cuál.
 *
 * Es el patrón de esta casa —el check que sobrevive al campo que lo volvía
 * falso—, con la variante de que aquí lo que se cae no es el check sino lo que
 * protegía sin querer. Así que la condición se escribe a mano y se mide:
 *
 *   **ni `src/features/` ni `src/data/` pueden importar el bucle.**
 *
 * `src/domain/` sí puede: ahí no hay React ni I/O, y de ahí no sale nada a una
 * pantalla por sí solo. Los scripts también: se corren a mano contra un export.
 *
 * Cuando el coach dé el visto bueno para enchufarlo, este test se borra **en el
 * mismo commit** que lo enchufa, y con el número de la corrida en la mano.
 */

const RAIZ = resolve(__dirname, '..')
const EN_SOMBRA = ['bucleDelDia', 'corridaEnSombra', 'balanceDeLaSombra']
/** Las dos capas por las que algo llega a los ojos de una persona. */
const CAPAS_DE_PANTALLA = ['features', 'data']

function archivosDe(dir: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta))
    else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) salida.push(ruta)
  }
  return salida
}

describe('el bucle del día calcula, no muestra', () => {
  it('ninguna pantalla importa el bucle ni su corrida en sombra', () => {
    const culpables: string[] = []

    for (const capa of CAPAS_DE_PANTALLA) {
      for (const ruta of archivosDe(join(RAIZ, capa))) {
        const importa = importacionesDe(readFileSync(ruta, 'utf8'), ruta)
        for (const { especificador } of importa) {
          const modulo = especificador.split('/').pop() ?? ''
          if (EN_SOMBRA.includes(modulo)) {
            culpables.push(`${ruta.slice(RAIZ.length + 1)} → ${especificador}`)
          }
        }
      }
    }

    expect(
      culpables,
      'El bucle del día está EN SOMBRA por acuerdo con el coach (supuesto del\n' +
        '2026-08-25 §7.1): calcula y no se lo enseña a nadie hasta que la corrida\n' +
        'sobre un microciclo avale que reduce la discrepancia.\n\n' +
        'Estos archivos de pantalla lo importan:\n' +
        culpables.map((c) => `  · ${c}`).join('\n') +
        '\n\nSi el coach ya lo aprobó, borra este test EN EL MISMO COMMIT que lo enchufa,\n' +
        'con el número de la corrida en la mano. No lo dejes pasando a medias.',
    ).toEqual([])
  })

  it('el detector mira de verdad las dos capas', () => {
    // Sin esto, un fallo al resolver rutas dejaría la lista vacía y el test de
    // arriba pasaría sin comprobar nada — el falso verde de siempre.
    for (const capa of CAPAS_DE_PANTALLA) {
      expect(archivosDe(join(RAIZ, capa)).length).toBeGreaterThan(10)
    }
  })

  it('y el dominio SÍ puede importarlo: la corrida en sombra lo hace', () => {
    const codigo = readFileSync(join(RAIZ, 'domain', 'corridaEnSombra.ts'), 'utf8')
    const especificadores = importacionesDe(codigo, 'corridaEnSombra.ts').map(
      (i: { especificador: string }) => i.especificador,
    )
    expect(especificadores).toContain('./bucleDelDia')
  })
})
