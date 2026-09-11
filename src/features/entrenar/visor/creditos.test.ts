import { describe, expect, it } from 'vitest'
import { CREDITOS_DEL_GIMNASIO, obligaACitar } from './creditos'

/**
 * EL CRÉDITO ES UNA OBLIGACIÓN, NO UN ADORNO.
 *
 * Todo el equipamiento del salón es CC Attribution: la licencia permite usarlo en una app
 * comercial **a cambio** de nombrar al autor. Un crédito incompleto —sin autor, con el
 * enlace roto, o con una obra que desaparece de la lista sin desaparecer de la escena— no
 * es un fallo cosmético: deja el gimnasio fuera de licencia.
 *
 * Estas comprobaciones son de las pocas del repo que protegen algo legal y no algo que se
 * vea. Por eso vigilan tres cosas distintas: que estén las obras que están en la escena,
 * que cada una tenga con qué cumplir, y que nadie pueda rebajar una licencia escribiendo.
 */

describe('los créditos del gimnasio', () => {
  it('nombra las tres obras que están dentro de la pieza', () => {
    // Las tres que exportó Blender a `sala-gimnasio.pieza`. Si mañana entra una máquina
    // nueva y nadie la añade aquí, esta lista sigue siendo la misma y esto no lo caza:
    // lo que sí caza es que alguien BORRE una de las que ya están.
    expect(CREDITOS_DEL_GIMNASIO.map((f) => f.autor)).toEqual(
      expect.arrayContaining(['Oxygen3D', 'Sousinho', 'Douglas.Alves1']),
    )
  })

  it('cada obra que obliga a citar trae con qué cumplir', () => {
    for (const f of CREDITOS_DEL_GIMNASIO.filter(obligaACitar)) {
      expect(f.autor.trim(), `«${f.obra}» sin autor`).not.toBe('')
      expect(f.obra.trim()).not.toBe('')
      // Un enlace es parte del crédito: sin él no se puede llegar a la ficha ni comprobar
      // la licencia. Y tiene que ser https, o el navegador lo bloquea desde la app.
      expect(f.enlace, `«${f.obra}» sin ficha`).toMatch(/^https:\/\/\S+\.\S+/)
      expect(f.queEs.trim(), `«${f.obra}» sin decir qué es`).not.toBe('')
    }
  })

  it('quien decide si hay que citar es la licencia, no la lista', () => {
    // Escrito como función a propósito. Con un campo `obliga` a mano, marcar `false` un
    // CC-BY para ahorrarse la línea sería un cambio de una palabra que nadie revisaría.
    expect(obligaACitar({ ...CREDITOS_DEL_GIMNASIO[0], licencia: 'CC Attribution' })).toBe(true)
    expect(obligaACitar({ ...CREDITOS_DEL_GIMNASIO[0], licencia: 'CC0' })).toBe(false)
  })

  it('no repite una ficha, que es lo que se usa como clave al pintarlas', () => {
    const enlaces = CREDITOS_DEL_GIMNASIO.map((f) => f.enlace)
    expect(new Set(enlaces).size).toBe(enlaces.length)
  })
})
