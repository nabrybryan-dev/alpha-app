import { describe, expect, it } from 'vitest'
import { RECETAS, TODAS_LAS_RECETAS as TODAS, sinFirmar } from './recetas'
import { catalogoRepo } from './catalogo/catalogoRepo'
import { motivoParaNoRegistrar, recetaAlRegistro } from '../domain/nutricion/recetaAlRegistro'

/**
 * Las seis recetas reales, sacadas de Instagram el 2026-08-16.
 *
 * Lo que se protege aquí no es que existan: es que no pueda salir a producción
 * una receta a medio hacer. Son datos de nutrición para 21 personas, y un
 * ingrediente mal mapeado o unas kcal escritas a mano no dan error en pantalla
 * — solo dan un número equivocado que nadie va a cuestionar.
 */

describe('las recetas reales', () => {
  it('hay seis', () => {
    expect(TODAS).toHaveLength(6)
  })

  /**
   * La compuerta. Sin notas del coach, la receta tiene porción y macros pero le
   * falta lo único que la hace de Alfa. Es un filtro sobre el propio dato, no
   * una lista que alguien tenga que acordarse de actualizar.
   */
  describe('la compuerta de las notas', () => {
    /**
     * En la suite `MODE` vale 'test', y en el build 'production': las dos caen
     * del mismo lado. Ni los tests ni los 21 asesorados ven una receta sin
     * firmar; en desarrollo sí, para que el coach pueda revisarlas antes de
     * escribir las notas.
     */
    it('fuera de desarrollo solo sale lo firmado, y hoy no hay nada firmado', () => {
      expect(RECETAS).toHaveLength(0)
    })

    it('las seis siguen ahí, esperando su firma', () => {
      expect(TODAS).toHaveLength(6)
      expect(TODAS.every(sinFirmar)).toBe(true)
    })

    it('`sinFirmar` distingue la que tiene notas de la que no', () => {
      const [una] = TODAS
      expect(sinFirmar(una)).toBe(true)
      const firmada = {
        ...una,
        ajuste: { ...una.ajuste, notas: [{ tipo: 'encaja' as const, label: 'x', texto: 'y' }] },
      }
      expect(sinFirmar(firmada)).toBe(false)
    })

    it('lo que se sirve SIEMPRE tiene notas', () => {
      for (const r of RECETAS) expect(r.ajuste.notas.length).toBeGreaterThan(0)
    })

    it('y sale sola en cuanto se le escriban', () => {
      const conNotas = TODAS.map((r) => ({
        ...r,
        ajuste: { ...r.ajuste, notas: [{ tipo: 'encaja' as const, label: 'x', texto: 'y' }] },
      }))
      expect(conNotas.filter((r) => r.ajuste.notas.length > 0)).toHaveLength(6)
    })
  })

  describe('el crédito al creador', () => {
    it('todas llevan handle y enlace al post original', () => {
      for (const r of TODAS) {
        expect(r.handle, r.nombre).toMatch(/^@/)
        expect(r.media.instagramPermalink, r.nombre).toMatch(/^https:\/\/www\.instagram\.com\//)
      }
    })

    /** Si el reel se viera sin salir de Alfa, el creador perdería la visita. */
    it('ninguna aloja el vídeo', () => {
      for (const r of TODAS) expect(r.media.videoUrl, r.nombre).toBeUndefined()
    })

    /** Las URLs de imagen de Instagram van firmadas y caducan en horas. */
    it('la miniatura se dibuja, no se trae de Instagram', () => {
      for (const r of TODAS) {
        expect(r.media.thumbnail, r.nombre).toMatch(/^data:image\/svg\+xml/)
      }
    })
  })

  describe('todas se pueden registrar', () => {
    it.each(TODAS.map((r) => [r.nombre, r] as const))('%s', (_n, r) => {
      expect(motivoParaNoRegistrar(r)).toBeNull()
    })

    it('ningún ingrediente se cae del catálogo', () => {
      for (const r of TODAS) {
        for (const i of r.ingredientes ?? []) {
          expect(catalogoRepo.porId(i.alimentoId as string), `${r.nombre} · ${i.nombre}`).toBeDefined()
        }
      }
    })
  })

  /**
   * La ficha y el registro tienen que dar lo MISMO. Si la ficha dijera 445 y al
   * registrar sumara 380, el asesorado vería un número al abrir y otro al
   * agregar sin saber cuál vale.
   */
  it('las kcal de la ficha son las que luego suma el día', () => {
    for (const r of TODAS) {
      const plan = recetaAlRegistro(r, '2026-08-16T12:00:00')
      if (!plan.puede) throw new Error(`${r.nombre}: ${plan.motivo}`)
      const sumadas = plan.items.reduce((t, item) => {
        const a = catalogoRepo.porId(item.alimentoId)
        return t + ((a?.por100g.kcal ?? 0) * item.gramos) / 100
      }, 0)
      expect(Math.round(sumadas), r.nombre).toBe(r.ajuste.kcal)
    }
  })

  it('ninguna sale con cifras absurdas', () => {
    for (const r of TODAS) {
      expect(r.ajuste.kcal, r.nombre).toBeGreaterThan(50)
      expect(r.ajuste.kcal, r.nombre).toBeLessThan(900)
      expect(r.ajuste.prot, r.nombre).toBeGreaterThanOrEqual(0)
    }
  })

  /**
   * El asterisco existe para que no se confunda lo que dijo el creador con lo
   * que puso el coach. Si nada estuviera marcado, la marca no serviría de nada.
   */
  it('lo estimado está marcado, y lo que dio el creador no', () => {
    const todos = TODAS.flatMap((r) => r.ingredientes ?? [])
    expect(todos.some((i) => i.estimado)).toBe(true)
    expect(todos.some((i) => !i.estimado)).toBe(true)
  })

  it('el yogur griego entró al catálogo, que era lo que faltaba', () => {
    const griego = catalogoRepo.porId('yogur-griego-entero')
    expect(griego).toBeDefined()
    // El natural tiene 3,8 g: sustituir uno por otro subestimaba la proteína.
    expect(griego?.por100g.proteina_g ?? 0).toBeGreaterThan(7)
  })
})
