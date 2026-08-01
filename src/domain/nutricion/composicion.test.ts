import { describe, expect, it } from 'vitest'
import {
  disponibilidadEnergetica,
  evaluarDisponibilidad,
  faltantes,
  grasaPct,
  imc,
  masaMagraKg,
  type Medidas,
} from './composicion'

/**
 * Las cifras esperadas salen de correr `herramientas/composicion/composicion.py`
 * sobre los mismos datos. Si el puerto se desvía, aquí se ve.
 *
 * Los perfiles son inventados: mismas formas que un caso real, ningún dato de
 * ninguna persona.
 */

const MUJER_TIPO: Medidas = {
  pesoKg: 56,
  alturaCm: 170,
  cuelloCm: 32,
  cinturaCm: 68,
  caderaCm: 99,
  genero: 'M',
}

const HOMBRE_TIPO: Medidas = {
  pesoKg: 80,
  alturaCm: 178,
  cuelloCm: 38,
  cinturaCm: 85,
  genero: 'H',
}

describe('faltantes', () => {
  it('no falta nada cuando están todas', () => {
    expect(faltantes(MUJER_TIPO)).toEqual([])
  })

  it('a un hombre NO le falta la cadera: su fórmula no la usa', () => {
    expect(faltantes(HOMBRE_TIPO)).toEqual([])
  })

  it('a una mujer sí', () => {
    expect(faltantes({ ...MUJER_TIPO, caderaCm: undefined })).toEqual(['caderaCm'])
  })

  it('sin género no hay fórmula que aplicar', () => {
    expect(faltantes({ ...MUJER_TIPO, genero: undefined })).toContain('genero')
  })

  it('lista todo lo que falte, no solo lo primero', () => {
    expect(faltantes({ genero: 'M' })).toEqual([
      'pesoKg',
      'alturaCm',
      'cuelloCm',
      'cinturaCm',
      'caderaCm',
    ])
  })
})

describe('grasaPct', () => {
  it('coincide con el Python en el caso femenino', () => {
    expect(grasaPct(MUJER_TIPO)).toBe(24.6)
  })

  it('coincide en el caso masculino', () => {
    expect(grasaPct(HOMBRE_TIPO)).toBe(16.4)
  })

  it('sin una medida devuelve null, no un número inventado', () => {
    expect(grasaPct({ ...MUJER_TIPO, cuelloCm: 0 })).toBeNull()
  })

  it('cintura menor que el cuello: error de medida, no un negativo', () => {
    expect(grasaPct({ ...HOMBRE_TIPO, cinturaCm: 30, cuelloCm: 38 })).toBeNull()
  })

  it('un resultado fuera de rango humano se descarta', () => {
    // Es el fallo que tenía la plantilla vieja: una asesorada con -15,2 %.
    expect(grasaPct({ ...HOMBRE_TIPO, cinturaCm: 38.5, cuelloCm: 38 })).toBeNull()
  })
})

describe('masaMagraKg', () => {
  it('se calcula del PESO, no de un perímetro', () => {
    expect(masaMagraKg(MUJER_TIPO)).toBe(42.22)
  })

  it('sin porcentaje no hay masa magra', () => {
    expect(masaMagraKg({ ...MUJER_TIPO, caderaCm: undefined })).toBeNull()
  })
})

describe('imc', () => {
  it('calcula bien', () => {
    expect(imc(56, 170)).toBe(19.4)
  })

  it('sin datos no inventa', () => {
    expect(imc(0, 170)).toBeNull()
  })
})

describe('disponibilidadEnergetica', () => {
  it('descuenta el gasto de entrenar y divide por la masa magra', () => {
    expect(disponibilidadEnergetica(1800, 400, 42.22)).toBe(33.2)
  })

  it('sin masa magra no se puede calcular', () => {
    expect(disponibilidadEnergetica(1800, 400, null)).toBeNull()
  })
})

describe('evaluarDisponibilidad', () => {
  it('en mujeres el corte está en 30', () => {
    expect(evaluarDisponibilidad(29.9, 'M')?.estado).toBe('problema')
    expect(evaluarDisponibilidad(30, 'M')?.estado).toBe('bien')
  })

  it('en mujeres NO hay zona de vigilancia: el corte no la deja', () => {
    for (const valor of [10, 25, 29.9, 30, 45]) {
      expect(evaluarDisponibilidad(valor, 'M')?.estado).not.toBe('vigilancia')
    }
  })

  it('en hombres es una banda, no un corte', () => {
    expect(evaluarDisponibilidad(19.9, 'H')?.estado).toBe('problema')
    expect(evaluarDisponibilidad(22, 'H')?.estado).toBe('vigilancia')
    expect(evaluarDisponibilidad(25.1, 'H')?.estado).toBe('bien')
  })

  it('el criterio viaja con el veredicto', () => {
    expect(evaluarDisponibilidad(28, 'M')?.criterio).toMatch(/ACSM/)
    expect(evaluarDisponibilidad(28, 'H')?.criterio).toMatch(/banda/)
  })

  it('un valor negativo SÍ se juzga: es el caso más grave', () => {
    // Gastar más de lo que se come es real, no un error de captura.
    expect(evaluarDisponibilidad(-5, 'M')?.estado).toBe('problema')
  })

  it('null entra, null sale', () => {
    expect(evaluarDisponibilidad(null, 'M')).toBeNull()
  })

  it('un número que no es número revienta', () => {
    expect(() => evaluarDisponibilidad(Number.NaN, 'M')).toThrow()
  })
})
