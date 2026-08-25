import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import huellas from './nucleo/huellas.json'

/* El núcleo de `nucleo/` entra verbatim desde el repo de las herramientas, donde
 * lo validan 56 casos de prueba que aquí no existen. Un parche hecho en esta
 * copia no lo ve ninguna de esas pruebas: compilaría, pasaría el linter y
 * mediría mal.
 *
 * Aquí hay DOS guardianes, y hacen falta los dos:
 *
 * 1. Las huellas, que detectan que alguien tocó la copia de AQUÍ.
 * 2. La comparación contra el original, que detecta que cambió el de ALLÍ — que
 *    es el caso normal, porque los arreglos se hacen allí.
 *
 * El segundo faltaba, y costó caro: el 23 de agosto de 2026 se descubrió que la
 * app llevaba semanas midiendo con un núcleo viejo al que le faltaban el ajuste
 * de elipse del disco (6-9 % de escala sistemático, y nada detectado por encima
 * de 25° de cámara) y el umbral de giro (una tanda entera de diez tomas
 * grabadas con el indicador en verde y descartadas después). Las huellas
 * estaban en verde todo ese tiempo, porque nadie había tocado la copia: la
 * copia estaba intacta y obsoleta, que es peor. Ver `nucleo/ORIGEN.md`. */

const aqui = dirname(fileURLToPath(import.meta.url))

describe('el nucleo vendorizado', () => {
  it.each(Object.keys(huellas))('%s sigue siendo el original', (archivo) => {
    // Los saltos de línea se normalizan ANTES de la huella. Esta máquina tiene
    // `core.autocrlf=true`, así que el mismo archivo sale con CRLF en Windows y
    // con LF en el CI de Linux: sin normalizar, el guardián se pondría rojo en
    // CI aunque nadie hubiera tocado nada, que es la peor clase de guardián.
    const texto = readFileSync(join(aqui, 'nucleo', archivo), 'utf8').replace(/\r\n/g, '\n')
    const huella = createHash('sha256').update(texto).digest('hex')
    expect(
      huella,
      `${archivo} cambio en la app. Los arreglos van en herramientas/encoder-camara, ` +
        'se corren alli pruebas-velocidad.mjs y pruebas-disco.mjs, y luego se vuelve a ' +
        'copiar. Si la copia es correcta, actualiza nucleo/huellas.json.',
    ).toBe(huellas[archivo as keyof typeof huellas])
  })
})

/**
 * Dónde está el repo de las herramientas, si es que está.
 *
 * No hay una ruta fija: la app y las herramientas son dos repos y cada máquina
 * los pone donde quiere. Se prueban las colocaciones conocidas y se admite una
 * variable de entorno para el resto, incluido el CI el día que quiera montarlo.
 */
function buscarHerramientas(): string | null {
  // Si alguien pone la variable, MANDA: es el único candidato. Buscar por detrás
  // «por si acaso» haría que apuntar a un sitio equivocado se resolviera solo y
  // en silencio, y entonces no habría forma de comprobar que el salto funciona.
  const declarado = process.env.ENCODER_HERRAMIENTAS
  if (declarado) return existsSync(join(declarado, 'analisis.js')) ? declarado : null

  const raiz = join(aqui, '..', '..', '..', '..')
  const candidatos = [
    // `dev/alpha-app` junto a `dev/cerebro-alpha`, que es como está hoy.
    join(raiz, '..', 'cerebro-alpha', 'herramientas', 'encoder-camara'),
    // La colocación que asume el script de allí: la app DENTRO de cerebro-alpha.
    join(raiz, '..', 'herramientas', 'encoder-camara'),
  ]
  for (const c of candidatos) {
    if (existsSync(join(c, 'analisis.js'))) return c
  }
  return null
}

const herramientas = buscarHerramientas()

/* Un `skip` no se ve. Vitest lo pinta en gris junto a los cientos de tests que
 * pasan, y quien mira la salida entiende «todo bien» — que es justo lo contrario
 * de lo que significa: significa «no he podido comprobar lo que más ha fallado».
 *
 * La deriva se descubrió el 23 de agosto de 2026 y VOLVIÓ a ocurrir el 25, con
 * 188 líneas de diferencia en `analisis.js`. El guardián existía y estaba bien
 * escrito las dos veces. Lo que no existía era un aviso de que no estaba mirando. */
if (!herramientas) {
  console.warn(
    `
  ⚠ EL GUARDIAN DEL NUCLEO NO SE HA EJECUTADO.
    No encuentro el repo de las herramientas, asi que NO se ha comprobado que esta
    copia siga al dia. Ha derivado en silencio dos veces: el 23 de agosto de 2026 y
    otra vez el 25, esa con 188 lineas de diferencia y la app midiendo sin velocidad
    media propulsiva.
    En el CI es normal y no pasa nada. En tu maquina, no: clona cerebro-alpha al lado,
    o pon ENCODER_HERRAMIENTAS=<ruta a herramientas/encoder-camara>.

    Para sincronizar:  node herramientas/encoder-camara/sincronizar-nucleo.mjs --aplicar
`,
  )
}

/* Este bloque se SALTA cuando el otro repo no está, y eso es deliberado: es otro
 * repo y puede no estar clonado —en el CI no lo está—. Un guardián que se pone
 * rojo por algo que no depende de quien lo lee enseña a ignorar los rojos, y
 * entonces deja de guardar nada. Cuando está, manda. */
describe.skipIf(!herramientas)('la copia contra el original de las herramientas', () => {
  it.each(Object.keys(huellas))('%s no se ha separado del original', (archivo) => {
    const leer = (ruta: string) => readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n')
    const copia = leer(join(aqui, 'nucleo', archivo))
    const original = leer(join(herramientas!, archivo))
    expect(
      copia === original,
      `${archivo} se ha separado del original de herramientas/encoder-camara.\n` +
        'Los dos ficheros tienen que ir a la par y, si se separan, NO dan error: dan\n' +
        'numeros creibles y equivocados. Pasos: correr alli pruebas-velocidad.mjs y\n' +
        'pruebas-disco.mjs, copiar los tres .js a nucleo/, y actualizar huellas.json.\n' +
        `Original en: ${herramientas}`,
    ).toBe(true)
  })
})
