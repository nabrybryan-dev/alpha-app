import { afterEach, describe, expect, it } from 'vitest'
import { cargarFuentesDelGabinete } from './fuentesDelGabinete'

/**
 * Estas fuentes son 314 KB. Lo que se protege aquí no es que se carguen, sino
 * que se carguen UNA vez y solo en la pantalla que las usa.
 */
describe('fuentesDelGabinete', () => {
  afterEach(() => {
    document.getElementById('fuentes-del-gabinete')?.remove()
  })

  it('inyecta la hoja de fuentes', () => {
    cargarFuentesDelGabinete()
    const link = document.getElementById('fuentes-del-gabinete') as HTMLLinkElement | null
    expect(link).not.toBeNull()
    expect(link?.rel).toBe('stylesheet')
    expect(link?.href).toContain('fonts.googleapis.com')
  })

  /** Cinco ejercicios en una sesión son cinco montajes: una sola petición. */
  it('llamarla cinco veces deja un solo enlace', () => {
    for (let i = 0; i < 5; i++) cargarFuentesDelGabinete()
    expect(document.querySelectorAll('#fuentes-del-gabinete')).toHaveLength(1)
  })

  it('pide las cinco familias del gabinete', () => {
    cargarFuentesDelGabinete()
    const href = (document.getElementById('fuentes-del-gabinete') as HTMLLinkElement).href
    for (const familia of ['Playfair+Display', 'Alfa+Slab+One', 'Anton', 'Cinzel', 'Bungee']) {
      expect(href, `falta ${familia}`).toContain(familia)
    }
  })

  /**
   * `display=swap` es lo que hace que el texto se vea desde el primer
   * fotograma. Sin él la máquina arranca con los datos invisibles hasta que
   * llega la fuente, que es justo lo que no se quiere en mitad de una serie.
   */
  it('pide swap, para que el dato nunca quede invisible', () => {
    cargarFuentesDelGabinete()
    expect((document.getElementById('fuentes-del-gabinete') as HTMLLinkElement).href).toContain('display=swap')
  })

  /** Solo los pesos que se usan: cada variante de más son decenas de KB. */
  it('no pide pesos que nadie usa', () => {
    cargarFuentesDelGabinete()
    const href = decodeURIComponent((document.getElementById('fuentes-del-gabinete') as HTMLLinkElement).href)
    expect(href).toContain('Playfair+Display:ital,wght@0,900;1,700')
    expect(href).not.toContain('0,700;0,900')
  })
})
