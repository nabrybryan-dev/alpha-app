import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cuantasPiezas, DIRECCIONES } from '../lib/direccionesVisuales'
import { medidasJpeg } from './medidasJpeg'

/**
 * El catálogo de direcciones visuales no puede mentir.
 *
 * Este test existe por un modo de fallo concreto y silencioso: el póster de una
 * pieza es su PRIMER FOTOGRAMA. Si alguien lo cambia por una foto parecida —o
 * por el póster vertical del splash, que fue justo el error al escribir este
 * módulo— no revienta nada: simplemente, cuando el vídeo releva a la imagen, la
 * escena salta a la vista. Un salto no lanza excepciones.
 *
 * Se comprueba lo que se puede comprobar sin decodificar AV1: que los dos
 * archivos existen, que el póster tiene la forma del vídeo, y los techos de peso.
 */
const raiz = join(__dirname, '..', '..')
const publico = join(raiz, 'public')

/** El loop se produjo a esta medida. Un póster con otra forma no es su fotograma. */
const ANCHO = 1280
const ALTO = 720

describe('direcciones visuales', () => {
  for (const d of DIRECCIONES) {
    describe(`${d.id} · ${d.nombre}`, () => {
      const rutaVideo = join(publico, d.video.replace(/^\//, ''))
      const rutaPoster = join(publico, d.poster.replace(/^\//, ''))

      it('tiene el vídeo y el póster en public/', () => {
        expect(existsSync(rutaVideo), `${d.video} no existe`).toBe(true)
        expect(existsSync(rutaPoster), `${d.poster} no existe`).toBe(true)
      })

      it('el póster tiene la forma del vídeo, no la de otra pieza', () => {
        const { ancho, alto } = medidasJpeg(rutaPoster)
        expect({ ancho, alto }).toEqual({ ancho: ANCHO, alto: ALTO })
      })

      it('el vídeo no pasa de 900 KB', () => {
        // Techo heredado del dossier: por encima, el loop tarda más que la
        // portada entera y la banda se queda en el póster fijo demasiado rato.
        const kb = readFileSync(rutaVideo).length / 1024
        expect(kb, `${d.video} pesa ${kb.toFixed(0)} KB`).toBeLessThanOrEqual(900)
      })

      it('el póster no pasa de 200 KB', () => {
        const kb = readFileSync(rutaPoster).length / 1024
        expect(kb, `${d.poster} pesa ${kb.toFixed(0)} KB`).toBeLessThanOrEqual(200)
      })
    })
  }

  it('no hay dos direcciones apuntando al mismo archivo', () => {
    // Copiar una entrada para crear la siguiente y olvidar cambiar la ruta deja
    // dos pantallas distintas enseñando el mismo plano.
    const videos = DIRECCIONES.map((d) => d.video)
    const posters = DIRECCIONES.map((d) => d.poster)
    expect(new Set(videos).size).toBe(videos.length)
    expect(new Set(posters).size).toBe(posters.length)
  })

  it('el número que se enseña en el manual es el que hay', () => {
    // El manual decía «Las cinco piezas» con seis debajo. No era un despiste
    // suelto: `fondoHero.ts` contaba «las otras cuatro» omitiendo también a F.
    // La pieza que nunca se colocó tampoco se contaba.
    const palabras = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho']
    expect(cuantasPiezas()).toBe(palabras[DIRECCIONES.length])
  })
})
