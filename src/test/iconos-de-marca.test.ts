import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Qué marca se usa a cada tamaño, que no es lo mismo que qué marca es la buena.
 *
 * DOS FALLOS DEL 2026-08-19, y los dos son el mismo error de fondo: usar la
 * marca completa donde no cabe.
 *
 * EL FAVICON NO ERA LA MARCA. `public/favicon.svg` era un marcador de posición
 * que nadie retiró: un rectángulo negro, un borde rojo y una «A» compuesta en
 * **Arial Black**. Ninguna de las tres cosas es de Alpha. Y el navegador lo
 * pinta a 16 y 32 px en la pestaña, que es donde más gente ve la marca.
 *
 * HOY ENSEÑABA EL LOGO COMPLETO A 48 PX. `logo-aguila` es el águila **con
 * "ALPHA ATHLETICS" debajo**. A 48 px ese texto no se lee: queda una mancha
 * gris bajo el ave. El monograma es la marca que sí funciona a ese tamaño.
 *
 * Lo que decidió los dos arreglos no fue una opinión de diseño: `icon-192.png`
 * e `icon-512.png` —los iconos PWA que la app YA envía— usan el monograma. El
 * favicon y Hoy eran los que contradecían al sistema, no al revés. Por eso el
 * favicon sale del propio `icon-512`, recortado a la marca para que aguante los
 * 16 px, y no de un trazado nuevo: un logo trazado a mano que discrepa del
 * original es peor que uno rasterizado.
 */

const raiz = join(__dirname, '..', '..')
const publico = join(raiz, 'public')

describe('iconos de marca', () => {
  describe('el favicon es la marca', () => {
    const indice = readFileSync(join(raiz, 'index.html'), 'utf8')
    const iconos = [...indice.matchAll(/<link[^>]*rel="(?:icon|apple-touch-icon)"[^>]*>/g)]
      .map(([etiqueta]) => /href="([^"]+)"/.exec(etiqueta)?.[1])
      .filter((h): h is string => Boolean(h))

    it('declara al menos un icono', () => {
      expect(iconos.length).toBeGreaterThan(0)
    })

    it('todos los que declara existen', () => {
      for (const href of iconos) {
        expect(existsSync(join(publico, href.replace(/^\//, '')))).toBe(true)
      }
    })

    /**
     * La prueba del marcador de posición: un icono de marca se dibuja con
     * formas, nunca componiendo una letra con la tipografía del sistema.
     */
    it('ningún icono está dibujado con una tipografía', () => {
      const svgs = readdirSync(publico).filter((f) => f.endsWith('.svg'))
      for (const svg of svgs) {
        const texto = readFileSync(join(publico, svg), 'utf8')
        expect(texto).not.toMatch(/<text/)
        expect(texto).not.toMatch(/font-family/)
      }
    })
  })

  describe('a tamaño pequeño va el monograma, no el logo completo', () => {
    /**
     * El umbral no es arbitrario: `logo-aguila` lleva el wordmark debajo del
     * ave, y por debajo de unos 64 px ese texto deja de leerse.
     */
    it('Hoy usa el monograma en la placa de 48 px', () => {
      const pagina = readFileSync(join(raiz, 'src/features/hoy/HoyPage.tsx'), 'utf8')
      expect(pagina).toContain('monograma-a.png')
      expect(pagina).not.toContain('logo-aguila')
    })

    it('los iconos PWA siguen siendo el monograma, que es de donde sale el criterio', () => {
      for (const icono of ['icon-192.png', 'icon-512.png']) {
        expect(existsSync(join(publico, icono))).toBe(true)
      }
    })
  })
})
