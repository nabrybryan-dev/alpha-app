import { describe, expect, it } from 'vitest'
import { ALERTA_SIN_MOTIVO, franjaEnClaro, guionTieneContenido, leerGuion } from './guionDeVenta'

// Guion inventado: ninguna persona real. Misma forma que manda la landing.
const COMPLETO = {
  version: 2,
  persona: { nombre: 'Persona de prueba', edad_tramo: '30-39', objetivo: 'Bajar grasa', ciudad: 'campo que la app no conoce' },
  alerta_salud: 'Hipertensión en tratamiento',
  apertura: '  Abre con lo que contó de su rutina.  ',
  dolores: ['Poco tiempo', '', 'Se cansa en la tarde'],
  que_mostrar: ['Cómo se registra una serie'],
  objeciones_probables: [{ objecion: 'Es caro', respuesta: 'Compáralo con lo que ya gasta.' }],
  cierre: 'Propón empezar el lunes.',
  avisos: ['No prometas resultados en semanas'],
  preferencia: { fecha: '2026-11-05', franja: 'tarde', hora: '15:00', en_claro: 'el jueves 5 de noviembre en la tarde' },
  campo_del_futuro: { lo: 'que sea' },
}

describe('leerGuion · tolerante', () => {
  it('lee el guion completo, recorta textos y quita los vacíos', () => {
    const g = leerGuion(COMPLETO)
    expect(g).not.toBeNull()
    expect(g).toMatchObject({
      version: 2,
      persona: { nombre: 'Persona de prueba', edadTramo: '30-39', objetivo: 'Bajar grasa' },
      alertaSalud: 'Hipertensión en tratamiento',
      apertura: 'Abre con lo que contó de su rutina.',
      dolores: ['Poco tiempo', 'Se cansa en la tarde'],
      queMostrar: ['Cómo se registra una serie'],
      objeciones: [{ objecion: 'Es caro', respuesta: 'Compáralo con lo que ya gasta.' }],
      cierre: 'Propón empezar el lunes.',
      avisos: ['No prometas resultados en semanas'],
      preferencia: { dia: '2026-11-05', franja: 'tarde', hora: '15:00', enClaro: 'el jueves 5 de noviembre en la tarde' },
    })
  })

  it('ignora los campos desconocidos (no aparecen en el resultado)', () => {
    const g = leerGuion(COMPLETO)!
    expect(Object.keys(g)).not.toContain('campo_del_futuro')
    expect(Object.keys(g.persona)).not.toContain('ciudad')
  })

  it('un objeto vacío no rompe: todo ausente', () => {
    const g = leerGuion({})!
    expect(g.version).toBeNull()
    expect(g.persona).toEqual({ nombre: null, edadTramo: null, objetivo: null })
    expect(g.dolores).toEqual([])
    expect(g.objeciones).toEqual([])
    expect(g.alertaSalud).toBeNull()
    expect(guionTieneContenido(g)).toBe(false)
  })

  it('lo que no es un objeto devuelve null', () => {
    expect(leerGuion(null)).toBeNull()
    expect(leerGuion('guion')).toBeNull()
    expect(leerGuion([COMPLETO])).toBeNull()
  })

  it('un campo con forma equivocada cuenta como ausente sin tumbar al resto', () => {
    const g = leerGuion({
      version: '3',
      persona: 'texto',
      apertura: 42,
      dolores: 'no es lista',
      que_mostrar: [1, 'Su semana', null],
      objeciones_probables: [{ objecion: 'Sin respuesta' }, { respuesta: 'Sin objeción' }, 'suelta'],
      cierre: 'Cierre válido',
    })!
    expect(g.version).toBeNull()
    expect(g.persona.nombre).toBeNull()
    expect(g.apertura).toBeNull()
    expect(g.dolores).toEqual([])
    expect(g.queMostrar).toEqual(['Su semana'])
    expect(g.objeciones).toEqual([{ objecion: 'Sin respuesta', respuesta: '' }])
    expect(g.cierre).toBe('Cierre válido')
    expect(guionTieneContenido(g)).toBe(true)
  })

  it('entiende la alerta de salud como texto, como «sí» o como objeto', () => {
    expect(leerGuion({ alerta_salud: true })!.alertaSalud).toBe(ALERTA_SIN_MOTIVO)
    expect(leerGuion({ alerta_salud: false })!.alertaSalud).toBeNull()
    expect(leerGuion({ alerta_salud: '   ' })!.alertaSalud).toBeNull()
    expect(leerGuion({ alerta_salud: { motivo: 'Embarazo' } })!.alertaSalud).toBe('Embarazo')
    expect(leerGuion({ alerta_salud: { activa: false, motivo: 'x' } })!.alertaSalud).toBeNull()
    expect(leerGuion({ alerta_salud: {} })!.alertaSalud).toBe(ALERTA_SIN_MOTIVO)
  })

  it('una alerta sola ya es contenido que enseñar', () => {
    expect(guionTieneContenido(leerGuion({ alerta_salud: true })!)).toBe(true)
  })

  it('acepta la preferencia también bajo `reserva` y con `dia`', () => {
    const g = leerGuion({ reserva: { dia: '2026-11-06', franja: 'tarde' } })!
    expect(g.preferencia).toEqual({ dia: '2026-11-06', franja: 'tarde', hora: null, enClaro: null })
  })
})

describe('franjaEnClaro', () => {
  it('traduce las tres franjas y deja tal cual lo que no reconoce', () => {
    expect(franjaEnClaro('tarde')).toBe('en la tarde')
    expect(franjaEnClaro('manana')).toBe('en la mañana')
    expect(franjaEnClaro('NOCHE')).toBe('en la noche')
    expect(franjaEnClaro('al mediodía')).toBe('al mediodía')
    expect(franjaEnClaro(null)).toBeNull()
  })
})
