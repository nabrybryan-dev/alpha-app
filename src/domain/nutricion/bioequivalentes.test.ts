import { describe, expect, it } from 'vitest'

import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import type { AlimentoIndice } from './busqueda'
import {
  anclaDe,
  cambiosPara,
  porQueNoHayCambios,
  porcionDeReferencia,
} from './bioequivalentes'

const porId = (id: string) => catalogoRepo.porId(id)
const buscar = (id: string) => {
  const alimento = porId(id)
  if (!alimento) throw new Error(`el índice no trae ${id}`)
  return alimento
}

const ARROZ = 'arroz-blanco-cocido'

describe('las anclas que decidió Manuela', () => {
  it('los lácteos se cambian por proteína y las verduras por fibra', () => {
    // 2026-08-09. Hasta ese día los dos grupos salían vacíos a propósito.
    expect(anclaDe({ grupo: 'lacteos' })).toBe('proteina_g')
    expect(anclaDe({ grupo: 'vegetales' })).toBe('fibra_g')
  })

  it('el grupo «otro» sigue sin ancla, y eso se puede explicar', () => {
    expect(anclaDe({ grupo: 'otro' })).toBeNull()
  })
})

describe('los cambios de un alimento', () => {
  it('propone cantidades, no solo nombres', () => {
    const cambios = cambiosPara(buscar(ARROZ), porId)
    expect(cambios.length).toBeGreaterThan(0)
    for (const cambio of cambios) {
      expect(cambio.gramos).toBeGreaterThan(0)
      expect(cambio.alimento.nombre).toBeTruthy()
    }
  })

  it('nunca más de cinco, que es lo que cabe leer', () => {
    expect(cambiosPara(buscar(ARROZ), porId).length).toBeLessThanOrEqual(5)
  })

  it('LA DERIVA SE DICE: cada propuesta trae lo que mueve', () => {
    // Igualar el ancla no iguala el plato. Si esto se vacía, la pantalla
    // estaría prometiendo un cambio gratis que no lo es.
    const [primero] = cambiosPara(buscar(ARROZ), porId)
    expect(Object.keys(primero.deriva).length).toBeGreaterThan(0)
    expect(primero.deriva).toHaveProperty('kcal')
  })

  it('el ancla queda igualada: el carbohidrato del arroz casi no se mueve', () => {
    // Es la prueba de que los gramos salen de igualar el ancla y no de otra
    // cosa. «Casi» por el redondeo de los gramos a entero.
    for (const cambio of cambiosPara(buscar(ARROZ), porId)) {
      expect(Math.abs(cambio.deriva.carbos_g ?? 0)).toBeLessThan(1)
    }
  })

  it('la porción de referencia es la curada, no una inventada', () => {
    expect(porcionDeReferencia(ARROZ)).toBeGreaterThan(0)
    expect(porcionDeReferencia('no-existe')).toBeNull()
  })
})

describe('la tabla no sabe de quién es, y por eso se filtra al leerla', () => {
  it('lo que ella no puede comer NO se le propone', () => {
    // El peor fallo posible de esta pantalla: proponerle leche a una alérgica
    // porque el archivo venía así.
    const todos = cambiosPara(buscar(ARROZ), porId)
    const vetado = todos[0].alimento.id
    const filtrados = cambiosPara(buscar(ARROZ), porId, new Set([vetado]))
    expect(filtrados.map((c) => c.alimento.id)).not.toContain(vetado)
  })

  it('y al filtrar sigue habiendo cinco, porque se exportan diez', () => {
    // El margen no es de adorno: sin él, quien tiene una alergia vería menos
    // propuestas que las demás justo por tenerla.
    const todos = cambiosPara(buscar(ARROZ), porId)
    if (todos.length < 5) return
    const dosFuera = new Set(todos.slice(0, 2).map((c) => c.alimento.id))
    expect(cambiosPara(buscar(ARROZ), porId, dosFuera)).toHaveLength(5)
  })
})

describe('EN EMBARAZO NO SE PROPONE HÍGADO', () => {
  /**
   * El fallo que estos tests documentan, y que casi se despliega.
   *
   * 52 de las 1.958 propuestas de la tabla son hígado o menudencias: al lomo de
   * cerdo se le proponen 161 g de menudencias de pollo, y al tocino 25 g de
   * hígado de res. Son sustituciones correctas por proteína, y son exactamente
   * lo que en embarazo no se puede proponer.
   *
   * La primera versión de esta pantalla filtraba las alergias y NO la
   * contraindicación. `seContraindica` llevaba desde el 2026-08-09 sin un solo
   * consumidor —la app registraba y no proponía— y esta es la primera pantalla
   * que propone algo.
   */
  const EMBARAZO = new Set(['embarazo'])
  const sinCondicion = new Set<string>()

  /**
   * Un alimento del catálogo al que la tabla le propone hígado o menudencias.
   *
   * El jamón de cerdo es el caso que mejor lo enseña: **tres de sus cinco
   * propuestas son hígado**. No es una víscera rara pedida a propósito, es lo
   * que hay en el desayuno de mucha gente.
   */
  const conHigadoEntreSusCambios = () => {
    for (const id of ['jamon-de-cerdo-crudo', 'res-corazon-crudo']) {
      const alimento = porId(id)
      if (!alimento) continue
      const tieneHigado = cambiosPara(alimento, porId, new Set(), sinCondicion).some((c) =>
        /h[ií]gado|menudencias/i.test(c.alimento.nombre),
      )
      if (tieneHigado) return alimento
    }
    return null
  }

  it('el caso existe de verdad en la tabla, no es hipotético', () => {
    // Si esto deja de encontrarse, los dos tests de abajo pasarían sin probar
    // nada. Entonces hay que buscar otro alimento, no borrar el test.
    expect(conHigadoEntreSusCambios()).not.toBeNull()
  })

  it('sin declarar embarazo, el hígado sigue siendo una sustitución válida', () => {
    const alimento = conHigadoEntreSusCambios()!
    const nombres = cambiosPara(alimento, porId, new Set(), sinCondicion).map(
      (c) => c.alimento.nombre,
    )
    expect(nombres.some((n) => /h[ií]gado|menudencias/i.test(n))).toBe(true)
  })

  it('declarado el embarazo, desaparece', () => {
    const alimento = conHigadoEntreSusCambios()!
    const nombres = cambiosPara(alimento, porId, new Set(), EMBARAZO).map(
      (c) => c.alimento.nombre,
    )
    expect(nombres.some((n) => /h[ií]gado|menudencias/i.test(n))).toBe(false)
  })

  it('y no la deja sin propuestas: se rellena con las siguientes', () => {
    // Por esto se exportan diez y se enseñan cinco. Si el filtro la dejara con
    // dos opciones, la pantalla castigaría justo a quien más la necesita.
    const alimento = conHigadoEntreSusCambios()!
    const conFiltro = cambiosPara(alimento, porId, new Set(), EMBARAZO)
    const sinFiltro = cambiosPara(alimento, porId, new Set(), sinCondicion)
    expect(conFiltro.length).toBe(sinFiltro.length)
  })

  it('en lactancia NO se filtra: nadie le prohíbe el hígado a quien amamanta', () => {
    const alimento = conHigadoEntreSusCambios()!
    const nombres = cambiosPara(alimento, porId, new Set(), new Set(['lactancia'])).map(
      (c) => c.alimento.nombre,
    )
    expect(nombres.some((n) => /h[ií]gado|menudencias/i.test(n))).toBe(true)
  })
})

describe('vacío no es «no hay nada parecido»', () => {
  it('el grupo sin ancla lo dice, no se queda callado', () => {
    const sinAncla = { id: 'x', grupo: 'otro' } as AlimentoIndice
    expect(cambiosPara(sinAncla, porId)).toEqual([])
    expect(porQueNoHayCambios(sinAncla).motivo).toBe('sin_ancla')
  })

  it('un alimento con ancla y sin porción curada es un hueco que se llena', () => {
    const conAncla = { id: 'no-esta-en-la-tabla', grupo: 'frutas' } as AlimentoIndice
    expect(porQueNoHayCambios(conAncla).motivo).toBe('sin_porcion')
  })
})

describe('la tabla y el índice hablan del mismo catálogo', () => {
  it('toda propuesta existe en el índice de la app', () => {
    // Si alguien exporta la tabla y no regenera el índice, esto lo caza. La
    // app se lo saltaría en silencio, que es lo correcto en pantalla y lo que
    // no se quiere descubrir en producción.
    // `buscar` revienta si el id no está, a propósito: un test que se salta lo
    // que no encuentra pasa siempre y no protege nada.
    for (const id of [ARROZ, 'yogur-natural-entero', 'brocoli-crudo']) {
      for (const cambio of cambiosPara(buscar(id), porId)) {
        expect(porId(cambio.alimento.id)).toBeTruthy()
      }
    }
  })

  it('los dos grupos que desbloqueó Manuela ya proponen algo', () => {
    expect(cambiosPara(buscar('yogur-natural-entero'), porId).length).toBeGreaterThan(0)
    expect(cambiosPara(buscar('brocoli-crudo'), porId).length).toBeGreaterThan(0)
  })
})

/**
 * Lo que la persona tiene en casa (migraciones 0024 y 0042).
 *
 * El sentido de esto es que la pantalla pueda decir «cámbialo por las lentejas
 * que ya tienes» en vez de «cámbialo por lentejas»: lo primero se puede hacer
 * esta noche sin ir al mercado, que es para lo que existe la hoja de cambios.
 */
describe('lo que hay en casa sube en la lista', () => {
  it('con la despensa vacía NO cambia nada', () => {
    // Es la propiedad que más importa: hoy la despensa está vacía para todo el
    // mundo, así que este camino es el de siempre y no puede alterarse.
    const sinDespensa = cambiosPara(buscar(ARROZ), porId)
    const conVacia = cambiosPara(buscar(ARROZ), porId, new Set(), new Set(), new Set())

    expect(conVacia.map((c) => c.alimento.id)).toEqual(sinDespensa.map((c) => c.alimento.id))
    expect(conVacia.every((c) => !c.enCasa)).toBe(true)
  })

  it('lo que hay en casa se marca', () => {
    const todos = cambiosPara(buscar(ARROZ), porId)
    const alguno = todos[todos.length - 1].alimento.id

    const cambios = cambiosPara(buscar(ARROZ), porId, new Set(), new Set(), new Set([alguno]))

    expect(cambios.find((c) => c.alimento.id === alguno)?.enCasa).toBe(true)
  })

  it('y sube al primer puesto, que es el que se ve', () => {
    // El tope de pantalla corta la lista: sin esto, lo que la persona tiene en
    // casa se quedaría fuera por estar más abajo en la tabla curada.
    const todos = cambiosPara(buscar(ARROZ), porId)
    const ultimo = todos[todos.length - 1].alimento.id

    const cambios = cambiosPara(buscar(ARROZ), porId, new Set(), new Set(), new Set([ultimo]))

    expect(cambios[0].alimento.id).toBe(ultimo)
  })

  it('NO filtra: lo que no está en casa sigue saliendo', () => {
    // Ocultar lo que no hay dejaría sin ninguna propuesta a quien tenga la
    // despensa vacía o con cosas que no son equivalentes. Sería peor que no
    // mirarla.
    const todos = cambiosPara(buscar(ARROZ), porId)
    const uno = todos[0].alimento.id

    const cambios = cambiosPara(buscar(ARROZ), porId, new Set(), new Set(), new Set([uno]))

    expect(cambios.length).toBe(todos.length)
    expect(cambios.some((c) => !c.enCasa)).toBe(true)
  })

  it('el orden de la tabla se conserva dentro de cada grupo', () => {
    // La tabla no está ordenada al azar ni alfabéticamente: la curó alguien. Un
    // sort inestable la barajaría y nadie lo notaría en pantalla.
    const todos = cambiosPara(buscar(ARROZ), porId).map((c) => c.alimento.id)
    const enCasa = new Set([todos[todos.length - 1]])

    const cambios = cambiosPara(buscar(ARROZ), porId, new Set(), new Set(), enCasa)
    const resto = cambios.filter((c) => !c.enCasa).map((c) => c.alimento.id)

    expect(resto).toEqual(todos.filter((id) => !enCasa.has(id)))
  })
})
