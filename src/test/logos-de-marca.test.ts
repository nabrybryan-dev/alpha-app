import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Los logos son trazo monocromo, y eso decide tanto el formato como el encuadre.
 *
 * EL FALLO QUE DOCUMENTA (2026-08-19), en dos partes.
 *
 * EL FORMATO. Los cuatro logos eran JPEG. Para trazo blanco sobre negro es el
 * codec equivocado dos veces: inventa ondas alrededor de cada borde duro —donde
 * mas se nota es el wordmark— y, sobre todo, **no tiene canal alfa**, asi que el
 * negro queda incrustado en los pixeles. Un logo con el fondo cocido dentro solo
 * se puede poner sobre ese fondo exacto.
 *
 * EL ENCUADRE. `monograma-a` y `wordmark` median 1536x1024 y la ficha los
 * pintaba en una caja cuadrada con `object-cover`, que recorta al lado corto:
 * **se perdia el 33% del ancho, 256 px por lado**. El manual de marca —la
 * pantalla que existe para enseñar como es la marca— enseñaba el wordmark
 * cortado por los dos extremos.
 *
 * LO QUE SE HIZO. Los cuatro pasan a PNG en escala de grises con alfa (modo LA):
 * la forma va en el alfa, el color lo pone el CSS y el negro pasa a ser un
 * escenario declarado —`bg-ink-900`, que no cambia con el tema— en vez de
 * pixeles. De paso pesan 99 kB en total en vez de 142.
 */

const raiz = join(__dirname, '..', '..')
const carpeta = join(raiz, 'src', 'assets', 'brand')

/** Tipo de color del PNG: byte 25 de la cabecera IHDR. 4 = gris+alfa, 6 = RGBA. */
const CON_ALFA = [4, 6]

const archivos = readdirSync(carpeta)

describe('logos de marca', () => {
  it('no queda ningún JPEG: es el codec equivocado para trazo monocromo', () => {
    expect(archivos.filter((f) => /\.jpe?g$/i.test(f))).toEqual([])
  })

  it('están los cuatro', () => {
    for (const logo of ['logo-aguila', 'monograma-a', 'wordmark', 'marca-halcon']) {
      expect(archivos).toContain(`${logo}.png`)
    }
  })

  describe.each(archivos.filter((f) => f.endsWith('.png')))('%s', (nombre) => {
    const bytes = readFileSync(join(carpeta, nombre))

    it('es un PNG de verdad', () => {
      expect([...bytes.subarray(1, 4)].map((b) => String.fromCharCode(b)).join('')).toBe('PNG')
    })

    /**
     * Sin alfa el fondo va cocido en los píxeles y el logo deja de poder
     * ponerse sobre otra superficie. Es lo que pasaba con los JPEG.
     */
    it('lleva canal alfa', () => {
      expect(CON_ALFA).toContain(bytes[25])
    })
  })

  describe('el manual no recorta lo que enseña', () => {
    const pagina = readFileSync(join(raiz, 'src/features/marca/MarcaPage.tsx'), 'utf8')

    it('no usa object-cover en la rejilla de logos', () => {
      expect(pagina).not.toContain('object-cover')
    })

    it('los encaja enteros sobre un escenario negro declarado', () => {
      expect(pagina).toContain('object-contain')
      expect(pagina).toContain('bg-ink-900')
    })

    it('ya no importa ningún JPEG', () => {
      expect(pagina).not.toMatch(/\.jpe?g'/)
    })
  })
})
