import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La tipografía de la app tiene que ser la que dice el sistema de marca.
 *
 * EL FALLO QUE DOCUMENTA (2026-08-19). El handoff del design system fijó
 * Archivo (display, expandido al 125%), Hanken Grotesk (UI) y JetBrains Mono
 * (datos), y así están declaradas en `tokens.css`. Pero `index.html` seguía
 * pidiendo además **Inter** y **Satoshi**, de la identidad anterior, desde dos
 * hojas de estilo y un origen extra (`api.fontshare.com`).
 *
 * Las dos familias viejas solo figuraban como respaldo dentro de las pilas
 * (`'Archivo', 'Satoshi', system-ui`), así que **no se pintan nunca** en cuanto
 * la primaria carga. Medido el 2026-08-19: 141 KB de Inter (3 pesos, subconjunto
 * latino) + 47 KB de Satoshi = **188 KB en 5 archivos** que se descargan para no
 * verse, más el handshake de un dominio que no hace falta.
 *
 * Es exactamente el problema que este repo ya se comió una vez y por el que
 * existe `cargarFuentesDelGabinete`: las fuentes que no hacen falta en el primer
 * pintado no van en `index.html`.
 *
 * Y había un daño peor que los kilobytes: el manual de marca **dentro de la
 * app** enseñaba «Satoshi Bold» e «Inter Regular» como las tipografías
 * oficiales. La pantalla que existe para ser la fuente de verdad de la marca
 * decía lo contrario que los tokens.
 */

const raiz = join(__dirname, '..', '..')
const leer = (ruta: string) => readFileSync(join(raiz, ruta), 'utf8')

/**
 * Con límite de palabra a propósito: «Interfaz» e «Intervenir» contienen
 * «Inter», y una comprobación por subcadena las da por fallo. Aquí se busca la
 * familia nombrada como tal, no la letra suelta.
 */
const FAMILIAS_RETIRADAS = [/\bSatoshi\b/, /\bInter\b/]

describe('tipografía de marca', () => {
  describe('index.html solo pide las fuentes del sistema vigente', () => {
    const indice = leer('index.html')

    /**
     * Se mira lo que se PIDE, no lo que se menciona: el propio head lleva un
     * comentario que nombra las dos familias retiradas para que nadie las
     * vuelva a añadir. Un `not.toContain('Inter')` a secas lo daría por fallo.
     */
    const enlaces = indice.match(/<link[^>]*>/g) ?? []

    it('no carga ninguna familia de la identidad anterior', () => {
      for (const enlace of enlaces) {
        expect(enlace).not.toMatch(/family=Inter/)
        expect(enlace).not.toMatch(/satoshi/i)
      }
    })

    it('no abre el origen de fontshare', () => {
      for (const enlace of enlaces) {
        expect(enlace).not.toContain('fontshare.com')
      }
    })

    it('sigue pidiendo las tres del sistema', () => {
      for (const familia of ['Archivo', 'Hanken+Grotesk', 'JetBrains+Mono']) {
        expect(indice).toContain(familia)
      }
    })

    /** Una sola hoja: cada `<link rel=stylesheet>` extra bloquea el pintado. */
    it('las pide en una sola hoja de estilo', () => {
      const hojas = indice.match(/<link[^>]*rel="stylesheet"/g) ?? []
      expect(hojas).toHaveLength(1)
    })
  })

  describe('las pilas de fuentes no nombran familias que ya no se descargan', () => {
    /**
     * Dejar `'Satoshi'` en la pila sin cargarla no rompe nada —cae a
     * `system-ui`—, pero miente sobre lo que la app usa y es como vuelve a
     * colarse el `<link>` la próxima vez que alguien «arregle» el respaldo roto.
     */
    it.each(['src/styles/tokens.css', 'tailwind.config.js'])('%s', (ruta) => {
      const texto = leer(ruta)
      for (const familia of FAMILIAS_RETIRADAS) {
        expect(texto).not.toMatch(familia)
      }
    })
  })

  describe('el manual de marca dice la verdad', () => {
    const pagina = leer('src/features/marca/MarcaPage.tsx')

    it('no anuncia las tipografías de la identidad anterior', () => {
      for (const familia of FAMILIAS_RETIRADAS) {
        expect(pagina).not.toMatch(familia)
      }
    })

    it('nombra las tres del sistema vigente', () => {
      for (const familia of ['Archivo', 'Hanken Grotesk', 'JetBrains Mono']) {
        expect(pagina).toContain(familia)
      }
    })
  })
})
