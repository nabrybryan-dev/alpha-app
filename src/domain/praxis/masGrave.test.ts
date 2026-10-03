import { describe, expect, it } from 'vitest'
import { LECTURA_DEL_MODELO_SOBRE_MARCADAS, gravedad, hayQueConsultarAlModelo, leerMarcaDelServidor, masGrave } from './masGrave'
import { marcaDesdeModelo, NIVELES_MODELO } from './riesgoModelo'
import type { MarcaDeRiesgo } from './riesgo'

/** «Gana la lectura más grave»: la regla pura, sin red, sin pantalla y sin relojes. */
const quieta = (linea: 'vida' | 'pareja' | 'nino'): MarcaDeRiesgo => ({ tipo: 'quieta', linea })
const cuidado: MarcaDeRiesgo = { tipo: 'cuidado' }
const salud: MarcaDeRiesgo = { tipo: 'salud', filtro: 'dolor' }

describe('masGrave: de menos a más grave, salud < cuidado < Quieta', () => {
  it('el orden de gravedad', () => {
    expect(gravedad(null)).toBe(0)
    expect(gravedad(salud)).toBeLessThan(gravedad(cuidado))
    expect(gravedad(cuidado)).toBeLessThan(gravedad(quieta('vida')))
  })

  it('el filtro marca salud: el modelo en Quieta gana y trae SU línea (no la del filtro)', () => {
    expect(masGrave(salud, quieta('vida'))).toEqual(quieta('vida'))
    expect(masGrave(salud, quieta('nino'))).toEqual(quieta('nino'))
    expect(masGrave(cuidado, quieta('pareja'))).toEqual(quieta('pareja'))
  })

  it('el filtro marca salud y el modelo cuidado: sale cuidado', () => {
    expect(masGrave(salud, cuidado)).toEqual(cuidado)
  })

  it('el modelo NUNCA baja ni quita una marca', () => {
    expect(masGrave(cuidado, salud)).toEqual(cuidado)
    expect(masGrave(cuidado, null)).toEqual(cuidado)
    expect(masGrave(salud, null)).toEqual(salud)
    expect(masGrave(quieta('vida'), salud)).toEqual(quieta('vida'))
    expect(masGrave(quieta('pareja'), null)).toEqual(quieta('pareja'))
  })

  it('en un empate se conserva la del filtro, con su detalle propio', () => {
    const delFiltro: MarcaDeRiesgo = { tipo: 'salud', filtro: 'medicamento' }
    expect(masGrave(delFiltro, marcaDesdeModelo('DERIVAR'))).toBe(delFiltro)
    expect(masGrave(quieta('pareja'), quieta('vida'))).toEqual(quieta('pareja'))
  })

  it('para cada nivel del modelo y cada marca del filtro, el resultado nunca es menos grave que el filtro', () => {
    for (const f of [salud, cuidado, quieta('vida')]) {
      for (const nivel of NIVELES_MODELO) {
        expect(gravedad(masGrave(f, marcaDesdeModelo(nivel)))).toBeGreaterThanOrEqual(gravedad(f))
      }
    }
  })
})

describe('hayQueConsultarAlModelo', () => {
  it('con el filtro en Quieta NO se consulta (ya es el máximo y la emergencia no espera)', () => {
    expect(hayQueConsultarAlModelo(quieta('vida'), true)).toBe(false)
  })
  it('cuidado y salud se consultan solo con el interruptor encendido', () => {
    expect(hayQueConsultarAlModelo(salud, true)).toBe(true)
    expect(hayQueConsultarAlModelo(cuidado, true)).toBe(true)
    expect(hayQueConsultarAlModelo(salud, false)).toBe(false)
    expect(hayQueConsultarAlModelo(cuidado, false)).toBe(false)
  })
  it('sin marca del filtro no hay nada que consultar por esta vía', () => {
    expect(hayQueConsultarAlModelo(null, true)).toBe(false)
  })
})

describe('el interruptor de consentimiento', () => {
  it('sale APAGADO: lo que dice la pantalla de privacidad hoy es que lo marcado no sale del teléfono', () => {
    expect(LECTURA_DEL_MODELO_SOBRE_MARCADAS).toBe(false)
  })
})

describe('leerMarcaDelServidor', () => {
  it('lee las tres marcas y rechaza todo lo demás', () => {
    expect(leerMarcaDelServidor({ marca: { tipo: 'quieta', linea: 'nino' } })).toEqual(quieta('nino'))
    expect(leerMarcaDelServidor({ marca: { tipo: 'cuidado' } })).toEqual(cuidado)
    expect(leerMarcaDelServidor({ marca: { tipo: 'salud' } })?.tipo).toBe('salud')
    expect(leerMarcaDelServidor({ marca: { tipo: 'quieta', linea: '999' } })).toBeNull()
    expect(leerMarcaDelServidor({ marca: { tipo: 'quieta' } })).toBeNull()
    expect(leerMarcaDelServidor({ marca: null })).toBeNull()
    expect(leerMarcaDelServidor({ marca: { tipo: 'nada' } })).toBeNull()
    expect(leerMarcaDelServidor(null)).toBeNull()
    expect(leerMarcaDelServidor('x')).toBeNull()
  })
})
