import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * LAS 89 PRUEBAS DEL NÚCLEO, CORRIENDO CONTRA EL NÚCLEO QUE USA LA APP.
 *
 * ## Qué hace, y por qué aquí
 *
 * El núcleo del encoder (`nucleo/*.js`) entra verbatim desde
 * `cerebro-alpha/herramientas/encoder-camara`, y **allí** tiene sus dos baterías. Aquí no
 * las había. `verify` sí comprueba que la copia no se haya separado del original, pero
 * eso solo corre **si tienes clonado el repo de herramientas**, y en el CI no está: en
 * CI, hoy, al núcleo no lo comprueba nada.
 *
 * Esto lo cierra: las dos baterías corren contra el núcleo de esta copia en cada
 * `npm run verify`, con repo de herramientas o sin él.
 *
 * **Las baterías siguen siendo de allí y no se editan aquí**, igual que el núcleo: si el
 * núcleo cambia, se copian las dos cosas juntas. Ese es el punto delicado de este archivo,
 * y por eso se cuentan los CASOS y no solo los rojos.
 *
 * ## El error que costó esta tarde, escrito para que no se repita
 *
 * La primera versión de este archivo portó las baterías **de agosto** y las corrió contra
 * el núcleo **de septiembre**. Dieron dos rojos, y los leí como que la app medía distinto
 * del original: escribí que el brazo de cadera daba 169 mm donde el original daba 177, y
 * que había 500 líneas en la app que ninguna prueba había visto nunca.
 *
 * **Era falso, y el fallo estuvo en de dónde leí.** Con veinte worktrees del cerebro en el
 * disco, leer «el original» de una carpeta te da la rama que esa carpeta tenga sacada, y
 * leí de dos que llevaban parados en agosto. El núcleo de verdad —el que la app copió—
 * vive en `origin/encoder/la-semilla-sin-auditar`, tiene las mismas 1.435 líneas, y **su
 * batería trae 302 líneas, no 162**. Corrida ESA contra este núcleo: **30 verdes, 0
 * rojos**, y el caso del brazo de cadera espera 169 y sale verde. El cambio de 177 a 169
 * fue deliberado y vino con su prueba actualizada el 5-sep.
 *
 * La regla, que está en `CLAUDE.md` y me la salté: **un fichero se lee de una rama
 * (`git show <rama>:<ruta>`), no de un directorio.** Un directorio es una opinión con
 * fecha.
 *
 * ## Por qué se cuentan los casos
 *
 * Porque aquel fallo habría pasado desapercibido con un `expect(rojos).toBe(0)` a secas:
 * una batería vieja también da cero rojos el día que alguien ajuste un esperado. Si el
 * total baja de 30, es que se está corriendo otra batería —probablemente una traída de un
 * worktree congelado— y eso es justo lo que hay que cazar.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))

/** Corre una batería y devuelve cuántas líneas VERDE y cuántas ROJO imprimió. */
function correr(bateria: string): { verdes: number; rojos: number; salida: string } {
  // `execFileSync` y no `exec`: sin shell de por medio no hay comillas que escapar ni
  // rutas con espacios que partan el comando (esta máquina tiene «C:\Users\ASUS»).
  const salida = execFileSync(process.execPath, [join(AQUI, bateria)], {
    encoding: 'utf8',
    timeout: 120_000,
  })
  const lineas = salida.split('\n')
  return {
    // Solo las que EMPIEZAN por la palabra: la batería de velocidad imprime además un
    // resumen «TODO EN VERDE» que no es un caso, y contarlo infla el total.
    verdes: lineas.filter((l) => l.startsWith('VERDE')).length,
    rojos: lineas.filter((l) => l.startsWith('ROJO')).length,
    salida,
  }
}

describe('el núcleo del encoder, contra las pruebas que lo validaron', () => {
  it('la batería del disco: los 30 casos en verde', () => {
    const { verdes, rojos } = correr('pruebas-disco.mjs')
    expect(rojos).toBe(0)
    expect(verdes).toBe(30)
  })

  it('la batería de velocidad: los 59 casos en verde', () => {
    const { verdes, rojos } = correr('pruebas-velocidad.mjs')
    expect(rojos).toBe(0)
    expect(verdes).toBe(59)
  })

  it('y el brazo de momento sale con la escala de septiembre, no con la de agosto', () => {
    // El caso exacto donde se vio el error. Se afirma el NÚMERO y no solo el verde: un
    // cambio de escala del 5 % en el brazo de momento es un dato que se usa con gente
    // real, y no puede volver a pasar por «mejora» ni por «regresión» sin que se lea.
    const { salida } = correr('pruebas-disco.mjs')
    expect(salida).toMatch(/VERDE\s+· brazo de cadera con los dos discos\s+169 mm/)
  })
})
