import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * LAS 80 PRUEBAS DEL NÚCLEO, CORRIENDO CONTRA EL NÚCLEO QUE USA LA APP.
 *
 * ## Por qué existe este archivo
 *
 * Estas dos baterías vivían SOLO en `cerebro-alpha/herramientas/encoder-camara`, y
 * `nucleo/ORIGEN.md` decía que el núcleo de aquí era una copia verbatim de allí, de solo
 * lectura. Dejó de serlo hace tiempo y nadie lo vio: el 2026-09-11 se midió que el
 * original tiene **928 líneas** y esta copia **1.435**. Quinientas líneas de trabajo real
 * que **ninguna de estas pruebas había visto nunca**, en el código que mide los vídeos de
 * gente que entrena.
 *
 * Decisión de Bryan (2026-09-11): **manda la copia de la app, y las pruebas se mudan con
 * ella.** Esto es esa mudanza. No es un test nuevo: es la red de seguridad que ya existía,
 * puesta por fin debajo del código que de verdad corre.
 *
 * ## Los dos rojos son REALES y están aquí a propósito
 *
 * Al correrlas por primera vez contra el núcleo de producción, 19 de 21 del disco pasan y
 * **dos no**. No se tocan ni se silencian: se cuentan, porque un número es lo único que
 * detecta un tercero. Los dos, medidos:
 *
 *   1. `25% tapado` — el original daba la lectura por **fiable** (centro err 0,45 px,
 *      cobertura 97 %); este núcleo la declara **no fiable** (1,13 px, 84 %). Es más
 *      conservador, y eso **puede ser una mejora deliberada**: rechazar antes una lectura
 *      dudosa. Pero nadie lo decidió por escrito.
 *   2. `brazo de cadera con los dos discos` — el original da **177 mm** y este núcleo
 *      **169 mm**. Ocho milímetros, un 4,5 %. Es un número que Bryan USA, y el candidato
 *      más probable es el cambio de medir el disco como circunferencia a medirlo como la
 *      elipse que es. También puede ser correcto. Tampoco lo decidió nadie.
 *
 *      Y un dato medido que ayuda a decidirlo, salido de mutar el núcleo a propósito:
 *      **multiplicar el brazo por 1,05 pone ese caso en verde**. O sea que los 8 mm no
 *      son ruido ni un caso raro: son un factor de escala sistemático de ~5 %. Quien
 *      revise esto busca una escala, no un borde.
 *
 * **Lo que este test afirma NO es que el núcleo esté bien.** Afirma que se comporta
 * EXACTAMENTE como se comportaba el día que se midió. Si alguien lo mejora y baja a 1
 * rojo, este test cae y hay que venir aquí a bajar el número a mano, leyendo por qué. Si
 * alguien lo rompe y sube a 3, cae igual. Las dos caídas son la gracia.
 *
 * **Visto morder, no supuesto.** Con el brazo multiplicado por 1,05 en `disco.js`, los
 * rojos bajan de 2 a 1 y este test cae con «expected 1 to be 2». Antes probé mutando un
 * umbral de fiabilidad y NO cayó — y no era el test el que fallaba, era mi mutación, que
 * tocaba una rama que estas pruebas no ejercitan. Mutar algo que el banco no mide no
 * demuestra nada sobre el banco.
 *
 * La batería de velocidad va en **0 rojos y ahí se queda**: sus 59 pasan en el original y
 * en esta copia, así que la divergencia de las 500 líneas no tocó la velocidad.
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
    verdes: lineas.filter((l) => l.startsWith('VERDE')).length,
    rojos: lineas.filter((l) => l.startsWith('ROJO')).length,
    salida,
  }
}

describe('el núcleo del encoder, contra las pruebas que lo validaron', () => {
  it('la batería del disco: 21 casos, y exactamente los 2 rojos conocidos', () => {
    const { verdes, rojos, salida } = correr('pruebas-disco.mjs')

    // El total importa tanto como los rojos: una batería que deja de correr casos
    // también «baja» los rojos, y sin esta línea eso pasaría por una mejora.
    expect(verdes + rojos).toBe(21)
    expect(rojos).toBe(2)

    // Y CUÁLES son. Dos rojos distintos de estos dos son otra historia, no la misma.
    expect(salida).toMatch(/ROJO\s+· 25% tapado/)
    expect(salida).toMatch(/ROJO\s+· brazo de cadera con los dos discos/)
  })

  it('la batería de velocidad: 59 casos y ni un rojo', () => {
    const { verdes, rojos } = correr('pruebas-velocidad.mjs')
    // 59, no 60: la batería imprime además una línea de resumen «TODO EN VERDE» que
    // NO es un caso. Contarla infla el total, y así lo conté yo la primera vez —lo
    // cazó este mismo test al ponerlo en 60—. Por eso aquí se cuentan solo las
    // líneas que EMPIEZAN por VERDE, y el número está medido, no recordado.
    expect(verdes).toBe(59)
    expect(rojos).toBe(0)
  })
})
