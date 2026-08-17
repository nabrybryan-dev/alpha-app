import { describe, expect, it } from 'vitest'
import type { AlimentoIndice } from './busqueda'
import { nutrientesEnDuda, sinDatosEnDuda } from './datosSospechosos'

const pinaIndia: AlimentoIndice = {
  id: 'pina-india-cruda',
  nombre: 'Piña india, cruda',
  grupo: 'frutas',
  estado: 'crudo',
  confianza: 'oficial',
  fuente: 'tcac',
  por100g: {
    kcal: 54,
    proteina_g: 0.5,
    carbos_g: 10.7,
    grasa_g: 0.2,
    hierro_mg: 6,
    vitamina_c_mg: 14,
    potasio_mg: 2445,
  },
}

const arroz: AlimentoIndice = {
  id: 'arroz-blanco-pulido-cocido-sin-sal',
  nombre: 'Arroz blanco, pulido, cocido sin sal',
  grupo: 'cereales',
  estado: 'cocido',
  confianza: 'oficial',
  fuente: 'tcac',
  por100g: {
    kcal: 130,
    proteina_g: 2.7,
    carbos_g: 28,
    grasa_g: 0.3,
    hierro_mg: 0.2,
    vitamina_c_mg: null,
    potasio_mg: 35,
  },
}

describe('nutrientesEnDuda', () => {
  it('la piña india tiene el potasio en duda', () => {
    expect(nutrientesEnDuda('pina-india-cruda').has('potasio_mg')).toBe(true)
  })

  it('pero no su vitamina C: la señal es sobre minerales', () => {
    // Las cenizas dicen que la familia de los minerales de esa fila no cuadra,
    // no que el alimento entero esté mal. La vitamina C no entra en las cenizas.
    expect(nutrientesEnDuda('pina-india-cruda').has('vitamina_c_mg')).toBe(false)
  })

  it('la oca tiene en duda justo lo contrario: la vitamina C', () => {
    // 382 mg sin cáscara contra 31 con cáscara. Pelar no multiplica por doce.
    expect(nutrientesEnDuda('oca-o-ibia-sin-cascara-cruda').has('vitamina_c_mg')).toBe(true)
    expect(nutrientesEnDuda('oca-o-ibia-sin-cascara-cruda').has('hierro_mg')).toBe(false)
  })

  it('un alimento sano no tiene nada en duda', () => {
    expect(nutrientesEnDuda('arroz-blanco-pulido-cocido-sin-sal').size).toBe(0)
  })
})

describe('sinDatosEnDuda', () => {
  it('el potasio de la piña india sale como null, no como cero', () => {
    // null = "no se midió", 0 = "se midió y no contiene". Un cero afirmaría que
    // la piña india no tiene potasio, tan falso como los 2.445 mg.
    expect(sinDatosEnDuda(pinaIndia).por100g.potasio_mg).toBeNull()
  })

  it('lo que no está cuestionado del mismo alimento se conserva', () => {
    const limpio = sinDatosEnDuda(pinaIndia)
    expect(limpio.por100g.kcal).toBe(54)
    expect(limpio.por100g.vitamina_c_mg).toBe(14)
    expect(limpio.nombre).toBe('Piña india, cruda')
  })

  it('un alimento sin sospecha pasa idéntico', () => {
    expect(sinDatosEnDuda(arroz).por100g).toEqual(arroz.por100g)
  })

  it('NO MUTA EL ALIMENTO QUE RECIBE', () => {
    // El catálogo es el mismo objeto para toda la app: vaciarlo dentro lo
    // vaciaría también para la búsqueda y para el siguiente asesorado. Los
    // fallos de pérdida de datos de este repo vinieron de mutar compartido.
    sinDatosEnDuda(pinaIndia)
    expect(pinaIndia.por100g.potasio_mg).toBe(2445)
  })

  it('un alimento cuyo nutriente en duda ni siquiera viaja en el índice no revienta', () => {
    // Del catálogo del Cerebro solo llegan siete nutrientes; el calcio, el zinc
    // y el magnesio de esas mismas filas se quedan fuera del índice.
    const sinMicros: AlimentoIndice = {
      ...pinaIndia,
      por100g: { kcal: 54, proteina_g: 0.5, carbos_g: 10.7, grasa_g: 0.2 },
    }
    expect(() => sinDatosEnDuda(sinMicros)).not.toThrow()
    expect(sinDatosEnDuda(sinMicros).por100g.kcal).toBe(54)
  })
})
