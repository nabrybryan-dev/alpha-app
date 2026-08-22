import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { medidasJpeg } from './medidasJpeg'

/**
 * La tarjeta que sale al compartir el enlace de la app.
 *
 * EL HUECO QUE CIERRA (2026-08-19). El `index.html` no tenía ninguna etiqueta
 * social ni `description`: quien pegaba el enlace en WhatsApp veía un rectángulo
 * gris con la URL cruda. Para una marca cuya dirección visual es «cinemático,
 * oscuro, alto contraste», la primera impresión al compartir era ninguna.
 *
 * POR QUÉ ESTE TEST Y NO OTRO. El fallo típico de una tarjeta social no es que
 * falte la etiqueta: es que **apunte a un archivo que no existe**, o que declare
 * unas medidas que no son las del archivo. Nada de eso se ve al desarrollar,
 * porque el navegador nunca pide la imagen — solo la piden los rastreadores, y
 * su caché convierte cada corrección en una espera de horas. Así que se
 * comprueba aquí: que la ruta resuelva a un archivo real de `public/` y que las
 * medidas declaradas sean las verdaderas.
 *
 * El `og:image` va en ruta relativa a propósito (el repo no conoce su dominio;
 * lo resuelve Vercel). Si algún día se fija dominio propio y se pasa a absoluta,
 * este test hay que adaptarlo.
 */

const raiz = join(__dirname, '..', '..')
const html = readFileSync(join(raiz, 'index.html'), 'utf8')

/** Saca el `content` de una etiqueta meta por su `property` o su `name`. */
function contenidoDe(clave: string): string | null {
  const patron = new RegExp(
    `<meta[^>]*(?:property|name)="${clave}"[^>]*content="([^"]*)"|` +
      `<meta[^>]*content="([^"]*)"[^>]*(?:property|name)="${clave}"`,
    's',
  )
  const encontrado = html.match(patron)
  if (!encontrado) return null
  return encontrado[1] ?? encontrado[2] ?? null
}

describe('metadatos sociales', () => {
  it('declara descripción, título y tipo', () => {
    expect(contenidoDe('description')).toBeTruthy()
    expect(contenidoDe('og:title')).toBe('Alpha Athletics')
    expect(contenidoDe('og:type')).toBe('website')
  })

  it('pide tarjeta grande en Twitter, no la miniatura cuadrada', () => {
    expect(contenidoDe('twitter:card')).toBe('summary_large_image')
  })

  it('la imagen de la tarjeta existe de verdad en public/', () => {
    const ruta = contenidoDe('og:image')
    expect(ruta).toBeTruthy()

    const archivo = join(raiz, 'public', ruta!.replace(/^\//, ''))
    expect(existsSync(archivo), `og:image apunta a ${ruta} y ahí no hay archivo`).toBe(true)
  })

  it('las medidas declaradas son las del archivo', () => {
    const ruta = contenidoDe('og:image')!
    const archivo = join(raiz, 'public', ruta.replace(/^\//, ''))
    const { ancho, alto } = medidasJpeg(archivo)

    expect(String(ancho)).toBe(contenidoDe('og:image:width'))
    expect(String(alto)).toBe(contenidoDe('og:image:height'))
  })

  it('la imagen pesa lo que un rastreador acepta sin rechistar', () => {
    const ruta = contenidoDe('og:image')!
    const archivo = join(raiz, 'public', ruta.replace(/^\//, ''))
    const kb = statSync(archivo).size / 1024

    // WhatsApp descarta por encima de ~600 KB y ni siquiera lo avisa.
    expect(kb).toBeLessThan(600)
  })

  it('la imagen lleva texto alternativo, que se leerá en voz alta al compartirla', () => {
    expect(contenidoDe('og:image:alt')).toBeTruthy()
  })
})
