import { describe, expect, it } from 'vitest'
import {
  CLAVES_DE_MEDIDA,
  esClaveDeMedida,
  MEDIDA_POR_CLAVE,
  revisarMedidas,
  type MedidasDelCuerpo,
} from '../src/domain/medidas'

/**
 * VERIFICACIÓN INDEPENDIENTE de `src/domain/medidas.ts` (rama `capa/datos`, ya fusionada
 * aquí): las ocho medidas de la encuesta de bienestar, su catálogo cerrado de claves y su
 * validador `revisarMedidas`.
 *
 * Los rangos no se copian a mano: se leen de `MEDIDA_POR_CLAVE` en cada prueba de borde,
 * así que si `capa/datos` ajusta un rango mañana esta prueba se mueve con él y sigue
 * probando el límite de verdad, no un número fijado el día que se escribió.
 *
 * Contra `origin/capa/datos`:
 *   npx vitest run pruebas/definicion-corporal.test.ts pruebas/encuesta-de-medidas.test.ts
 */

/** Un juego de las ocho, todas en el punto medio de su rango — el caso feliz. */
function medidasEnElMedio(): MedidasDelCuerpo {
  const salida: MedidasDelCuerpo = {}
  for (const clave of CLAVES_DE_MEDIDA) {
    const { minimo, maximo } = MEDIDA_POR_CLAVE[clave]
    salida[clave] = Math.round(((minimo + maximo) / 2) * 10) / 10
  }
  return salida
}

describe('caso feliz', () => {
  it('las ocho medidas en el punto medio de su rango no dan ningún reparo', () => {
    expect(revisarMedidas(medidasEnElMedio())).toEqual([])
  })

  it('un objeto vacío tampoco da reparos: todo es opcional', () => {
    expect(revisarMedidas({})).toEqual([])
  })

  it('las ocho claves están, en el orden del contrato', () => {
    expect(CLAVES_DE_MEDIDA).toEqual([
      'tibiaCm',
      'femurCm',
      'torsoCm',
      'antebrazoCm',
      'brazoCm',
      'anchoClavicularCm',
      'cinturaCm',
      'caderasCm',
    ])
  })
})

describe('bordes: el fémur en el límite de su holgura del ±15 %', () => {
  const { minimo, maximo } = MEDIDA_POR_CLAVE.femurCm

  it(`${minimo} cm (el mínimo) se acepta`, () => {
    expect(revisarMedidas({ femurCm: minimo })).toEqual([])
  })

  it(`${maximo} cm (el máximo) se acepta`, () => {
    expect(revisarMedidas({ femurCm: maximo })).toEqual([])
  })

  it(`un centímetro por debajo del mínimo (${minimo - 1}) se rechaza`, () => {
    const reparos = revisarMedidas({ femurCm: minimo - 1 })
    expect(reparos).toHaveLength(1)
    expect(reparos[0].campo).toBe('femurCm')
    expect(reparos[0].motivo).toContain(`${minimo}`)
    expect(reparos[0].motivo).toContain(`${maximo}`)
  })

  it(`un centímetro por encima del máximo (${maximo + 1}) se rechaza`, () => {
    const reparos = revisarMedidas({ femurCm: maximo + 1 })
    expect(reparos).toHaveLength(1)
    expect(reparos[0].campo).toBe('femurCm')
  })
})

describe('borde: otra medida en el límite exacto del rango (cintura)', () => {
  const { minimo, maximo } = MEDIDA_POR_CLAVE.cinturaCm

  it('el mínimo exacto se acepta', () => {
    expect(revisarMedidas({ cinturaCm: minimo })).toEqual([])
  })

  it('el máximo exacto se acepta', () => {
    expect(revisarMedidas({ cinturaCm: maximo })).toEqual([])
  })

  it('justo por debajo del mínimo se rechaza', () => {
    expect(revisarMedidas({ cinturaCm: minimo - 0.1 })).toHaveLength(1)
  })
})

describe('clave extra: el catálogo está cerrado', () => {
  it('una clave que no es una de las ocho se rechaza, aunque el número sea razonable', () => {
    const reparos = revisarMedidas({ gluteosCm: 95 })
    expect(reparos).toHaveLength(1)
    expect(reparos[0].campo).toBe('gluteosCm')
    expect(reparos[0].motivo).toContain('gluteosCm')
    expect(reparos[0].motivo).toContain('no es una de las ocho')
  })

  it('esClaveDeMedida dice que no para una clave ajena, y que sí para las ocho', () => {
    expect(esClaveDeMedida('gluteosCm')).toBe(false)
    expect(esClaveDeMedida('Cadera')).toBe(false)
    for (const clave of CLAVES_DE_MEDIDA) expect(esClaveDeMedida(clave)).toBe(true)
  })

  it('una clave ajena junto a medidas válidas no contamina las demás: cada campo se reporta aparte', () => {
    const reparos = revisarMedidas({ femurCm: 45, gluteosCm: 95, tibiaCm: 38 })
    expect(reparos).toHaveLength(1)
    expect(reparos[0].campo).toBe('gluteosCm')
  })
})

describe('lo que no es un número', () => {
  it('un texto se rechaza con el mensaje de la etiqueta, no de la clave', () => {
    const reparos = revisarMedidas({ femurCm: '45' as unknown as number })
    expect(reparos).toHaveLength(1)
    expect(reparos[0].campo).toBe('femurCm')
    expect(reparos[0].motivo).toContain('Fémur')
  })

  it('NaN e Infinity también se rechazan', () => {
    expect(revisarMedidas({ femurCm: Number.NaN })).toHaveLength(1)
    expect(revisarMedidas({ femurCm: Number.POSITIVE_INFINITY })).toHaveLength(1)
  })

  it('un valor undefined en una clave presente NO es un reparo: es un campo en blanco', () => {
    expect(revisarMedidas({ femurCm: undefined })).toEqual([])
  })
})

describe('el fallo a media operación: varios reparos a la vez, todos reportados', () => {
  it('quien rellena ocho campos ve los que están mal de una vez, no uno a uno', () => {
    const reparos = revisarMedidas({
      femurCm: 999, // fuera de rango
      tibiaCm: 38, // válido
      gluteosCm: 95, // clave ajena
      torsoCm: 'no-numero' as unknown as number, // no es número
    })
    const campos = reparos.map((r) => r.campo).sort()
    expect(campos).toEqual(['femurCm', 'gluteosCm', 'torsoCm'])
  })
})

describe('la entrada entera está mal formada', () => {
  it('null, un array o un texto dan un único reparo sin campo', () => {
    for (const entrada of [null, [1, 2, 3], 'no-es-un-objeto']) {
      const reparos = revisarMedidas(entrada)
      expect(reparos).toHaveLength(1)
      expect(reparos[0].campo).toBe('')
    }
  })
})
