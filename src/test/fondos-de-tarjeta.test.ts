import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FONDO_SESION_FUERZA,
  FONDO_SESION_METABOLICA,
} from '../features/entrenar/fondoSesion'
import { medidasJpeg } from './medidasJpeg'

/**
 * Las fotos de `.tarjeta-foto` no pueden estirarse.
 *
 * Este test existe por un fallo que se repitió dos veces y que **no se ve
 * desarrollando**, porque en un monitor la imagen se pinta a 1x y parece
 * correcta: el fondo del login era de 341x512 y se escalaba cuatro veces en un
 * móvil, y el de la sesión era de 590x1280 y se escalaba 1,82. Ningún test lo
 * notaba, y a simple vista en el navegador tampoco.
 *
 * La tarjeta monta la foto con `background-size: cover`, así que la escala la
 * manda la dimensión que peor va. Se compara contra el tamaño real en píxeles
 * de un móvil de referencia.
 */

const raiz = join(__dirname, '..', '..')

/** Móvil de referencia: 390 pt de ancho y densidad 3, que es lo más común hoy. */
const DPR = 3

/**
 * Geometría leída del DOM de la app en modo demo con un viewport de 390x844,
 * no estimada. Si cambia la maquetación de estas pantallas hay que volver a
 * medirla: un número inventado aquí haría pasar el test sin querer.
 */
const TARJETAS: {
  pantalla: string
  anchoPt: number
  altoPt: number
  /**
   * Fondos declarados fuera de la pantalla, cuando la ruta no es un literal.
   * Sin esto, `fondoDeclarado` leería el texto de la expresión que elige entre
   * dos y daría un archivo que no existe.
   */
  fondos?: string[]
}[] = [
  {
    pantalla: 'src/features/entrenar/SesionPage.tsx',
    anchoPt: 358,
    altoPt: 334,
    // La sesión pinta un fondo u otro según su tipo, y los dos caen en la misma
    // tarjeta: los dos tienen que aguantar la misma geometría.
    fondos: [FONDO_SESION_FUERZA, FONDO_SESION_METABOLICA],
  },
  {
    pantalla: 'src/features/logros/LogrosPage.tsx',
    anchoPt: 358,
    altoPt: 315,
  },
]

/**
 * Cuánto hay que ampliar la imagen para llenar la tarjeta con `cover`.
 * Por encima de 1 se está inventando detalle que no existe.
 */
function escalaCover(
  imagen: { ancho: number; alto: number },
  tarjeta: { anchoPx: number; altoPx: number },
): number {
  return Math.max(tarjeta.anchoPx / imagen.ancho, tarjeta.altoPx / imagen.alto)
}

/** La ruta que la pantalla mete en la variable CSS `--foto`. */
function fondoDeclarado(rutaPantalla: string): string {
  const fuente = readFileSync(join(raiz, rutaPantalla), 'utf8')
  const encontrado = fuente.match(/'--foto':\s*"?'?url\(([^)]+)\)/)
  if (!encontrado) throw new Error(`No encuentro la variable --foto en ${rutaPantalla}`)
  return encontrado[1].replace(/['"]/g, '')
}

describe('fondos de las tarjetas con foto', () => {
  for (const tarjeta of TARJETAS) {
    const partes = tarjeta.pantalla.split('/')
    const nombre = partes[partes.length - 1] ?? tarjeta.pantalla

    describe(nombre, () => {
      const fondos = tarjeta.fondos ?? [fondoDeclarado(tarjeta.pantalla)]

      for (const fondo of fondos) {
        const archivo = join(raiz, 'public', fondo.replace(/^\//, ''))

        it(`${fondo} apunta a un archivo que existe`, () => {
          // Una ruta rota no da error en desarrollo: la tarjeta se queda negra y
          // el texto se sigue leyendo, así que pasa desapercibida.
          expect(existsSync(archivo), `${fondo} no existe en public/`).toBe(true)
        })

        it(`${fondo} tiene resolución para el móvil, sin estirarse`, () => {
          const imagen = medidasJpeg(archivo)
          const escala = escalaCover(imagen, {
            anchoPx: tarjeta.anchoPt * DPR,
            altoPx: tarjeta.altoPt * DPR,
          })

          expect(
            escala,
            `${fondo} mide ${imagen.ancho}x${imagen.alto} y se ampliaría ${escala.toFixed(2)}x ` +
              `para llenar ${tarjeta.anchoPt * DPR}x${tarjeta.altoPt * DPR}`,
          ).toBeLessThanOrEqual(1.05)
        })

        it(`${fondo} no pesa más de 200 KB`, () => {
          // Son fondos decorativos por encima del pliegue: si engordan, retrasan
          // el primer pintado de una pantalla que se abre a diario.
          const kb = readFileSync(archivo).length / 1024
          expect(kb, `${fondo} pesa ${kb.toFixed(0)} KB`).toBeLessThanOrEqual(200)
        })
      }
    })
  }
})
