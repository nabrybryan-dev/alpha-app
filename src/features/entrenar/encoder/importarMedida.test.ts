import { describe, expect, it } from 'vitest'
import { importarMedida, origenDe } from './importarMedida'

/* Los datos son inventados y tienen que serlo: una medida real es el brazo de
 * momento de la cadera de una persona concreta, fotograma a fotograma, y en este
 * repo los datos de asesorados no van en tests ni en fixtures. Las cifras imitan
 * la forma de la salida de `exportar-medida.mjs`, no su contenido. */

function medidaCruda(p: Record<string, unknown> = {}) {
  return JSON.stringify({
    ok: true,
    negativas: ['El plano frontal no se mide con una sola cámara.'],
    escala: { mmPorPx: 1.89, dispersion: 0.11, fiable: true },
    sigmaArticulacionPx: 6.2,
    sigmaBrazoMm: 16.7,
    ejeObjetivo: 'cadera',
    grupoObjetivo: 'Isquios',
    grupoObjetivoTexto: 'los isquios',
    porFotograma: [
      { t: 0, ok: true, brazos: { cadera: { mm: 218, unLado: false, derivado: false, sigmaExtraMm: 0 } } },
      { t: 0.5, ok: true, brazos: { cadera: { mm: 190, unLado: false, derivado: false, sigmaExtraMm: 0 } } },
    ],
    medidos: 668,
    total: 721,
    descartadosPorSalto: 9,
    causas: { sin_persona: 45, sin_carga: 8, sin_consenso: 0, sin_eje: 0, salto: 4 },
    maximoEje: { mm: 218, t: 0, fraccion: 0.02 },
    ...p,
  })
}

describe('lo que se rechaza, y con qué frase', () => {
  it('un archivo que no es JSON', () => {
    const r = importarMedida('esto no es json {')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.problema).toMatch(/no es un archivo JSON/)
  })

  it('un JSON que no es una medida', () => {
    const r = importarMedida('[1,2,3]')
    expect(r.ok).toBe(false)
  })

  it('sin eje protagónico, porque sin él no se sabe de qué habla', () => {
    const r = importarMedida(medidaCruda({ ejeObjetivo: undefined }))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.problema).toMatch(/eje protagónico/)
  })

  it('sin saber si la escala es fiable', () => {
    // De eso depende que el número se pueda sostener o solo exista.
    const r = importarMedida(medidaCruda({ escala: { mmPorPx: 1.9 } }))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.problema).toMatch(/escala/)
  })

  it('sin barra de error, que es la mentira que esta pantalla evita', () => {
    const r = importarMedida(medidaCruda({ sigmaBrazoMm: 0 }))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.problema).toMatch(/barra de error/)
  })

  it('y una medida que se dice buena sin traer un solo fotograma', () => {
    const r = importarMedida(medidaCruda({ porFotograma: [] }))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.problema).toMatch(/no trae fotogramas/)
  })
})

describe('las causas no se aceptan a medias', () => {
  it('un reparto incompleto se descarta entero', () => {
    // `causaDominante` decide QUÉ FRASE se dice: con el grueso en sin_consenso
    // se dice que repetir no lo arregla, y con sin_persona lo contrario. Medio
    // reparto mandaría a alguien a no repetir una toma que sí iba a salir.
    const r = importarMedida(medidaCruda({ causas: { sin_persona: 45, salto: 4 } }))
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.medida.causas).toBeUndefined()
  })

  it('un reparto completo entra tal cual', () => {
    const r = importarMedida(medidaCruda())
    expect(r.ok === true && r.medida.causas?.sin_persona).toBe(45)
    expect(r.ok === true && r.medida.causas?.sin_consenso).toBe(0)
  })
})

describe('lo que sí entra', () => {
  it('una medida completa conserva lo que la pantalla necesita', () => {
    const r = importarMedida(medidaCruda())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.medida.ejeObjetivo).toBe('cadera')
    expect(r.medida.grupoObjetivoTexto).toBe('los isquios')
    expect(r.medida.medidos).toBe(668)
    expect(r.medida.total).toBe(721)
    expect(r.medida.escala.fiable).toBe(true)
    expect(r.medida.maximoEje?.fraccion).toBe(0.02)
  })

  it('una escala dudosa entra como dudosa, no se corrige por el camino', () => {
    // Filtrar lo incómodo en la costura es como se cuela un número que nadie
    // puede rastrear. La pantalla ya sabe qué hacer con una escala mala.
    const r = importarMedida(medidaCruda({ escala: { mmPorPx: 1.89, dispersion: 0.55, fiable: false } }))
    expect(r.ok === true && r.medida.escala.fiable).toBe(false)
    expect(r.ok === true && r.medida.escala.dispersion).toBe(0.55)
  })

  it('un `no aplica` entra aunque no traiga fotogramas', () => {
    // No es un fallo de la toma: es un límite del método, y la pantalla tiene un
    // estado propio para eso.
    const r = importarMedida(
      medidaCruda({ ok: false, motivo: 'ejercicio_no_aplica', porFotograma: [] }),
    )
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.medida.motivo).toBe('ejercicio_no_aplica')
  })

  it('los fotogramas rotos se caen sin tumbar la medida', () => {
    const r = importarMedida(
      medidaCruda({ porFotograma: [{ t: 0, ok: true }, { roto: true }, { t: 'x', ok: true }] }),
    )
    expect(r.ok === true && r.medida.porFotograma).toHaveLength(1)
  })
})

describe('el origen', () => {
  it('se lee cuando el exportador lo anotó', () => {
    const r = origenDe(medidaCruda({ origen: { video: '001', ejercicio: 'peso muerto con barra' } }))
    expect(r?.ejercicio).toBe('peso muerto con barra')
  })

  it('y no estorba cuando no está', () => {
    expect(origenDe(medidaCruda())).toBeUndefined()
    expect(origenDe('no json')).toBeUndefined()
  })
})
