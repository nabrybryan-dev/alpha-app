import { describe, expect, it } from 'vitest'
import { fraseDeResultado, leerPropuestaDeshacer, leerResultadoDeshacer, type ResultadoDeshacer } from './pantalla'

const tarjeta = { campo: 'deshacer', registro_id: '11111111-1111-4111-8111-111111111111', tipo: 'series', descripcion: '3 series', vence_en: '2026-11-05T15:02:00.000Z', token: 'abc' }

describe('leerPropuestaDeshacer: solo pinta lo que el servidor ofreció', () => {
  it('confirmar: texto, tarjeta firmada tal cual y los dos botones del diseño', () => {
    const p = leerPropuestaDeshacer({ accion: 'confirmar_deshacer', texto: 'Voy a quitar las series. ¿Lo quito?', botones: ['x'], tarjeta })
    expect(p).toEqual({ accion: 'confirmar_deshacer', texto: 'Voy a quitar las series. ¿Lo quito?', tarjeta, botonSi: 'Sí, quitar', botonNo: 'No, dejarlo' })
  })
  it('confirmar sin tarjeta, o con la tarjeta sin firma: no se pinta (null)', () => {
    expect(leerPropuestaDeshacer({ accion: 'confirmar_deshacer', texto: 't', tarjeta: null })).toBeNull()
    expect(leerPropuestaDeshacer({ accion: 'confirmar_deshacer', texto: 't', tarjeta: { ...tarjeta, token: '' } })).toBeNull()
    expect(leerPropuestaDeshacer({ accion: 'confirmar_deshacer', texto: 't', tarjeta: { ...tarjeta, campo: 'otro' } })).toBeNull()
  })
  it('preguntar: un candidato por opción (con su hora en la etiqueta) y «Ninguno»', () => {
    const p = leerPropuestaDeshacer({ accion: 'preguntar', texto: '¿Cuál quito?', opciones: [{ registro_id: 'a', etiqueta: 'Series: 3 series, 8:15' }, { registro_id: 'b', etiqueta: 'Adherencia: marcada «sí», 12:40' }, { registro_id: '', etiqueta: 'x' }] })
    expect(p).toEqual({ accion: 'preguntar', texto: '¿Cuál quito?', opciones: [{ registroId: 'a', etiqueta: 'Series: 3 series, 8:15' }, { registroId: 'b', etiqueta: 'Adherencia: marcada «sí», 12:40' }], botonNinguno: 'Ninguno' })
  })
  it('preguntar sin opciones válidas: null', () => {
    expect(leerPropuestaDeshacer({ accion: 'preguntar', texto: 't', opciones: [] })).toBeNull()
  })
  it('nada_que_deshacer: solo el texto', () => {
    expect(leerPropuestaDeshacer({ accion: 'nada_que_deshacer', motivo: 'vacio', texto: 'No hay nada que deshacer. No toqué nada.' })).toEqual({ accion: 'nada_que_deshacer', texto: 'No hay nada que deshacer. No toqué nada.' })
  })
  it('acción desconocida, sin texto o basura: null', () => {
    expect(leerPropuestaDeshacer({ accion: 'borrar_todo', texto: 't' })).toBeNull()
    expect(leerPropuestaDeshacer({ accion: 'nada_que_deshacer' })).toBeNull()
    expect(leerPropuestaDeshacer(null)).toBeNull()
    expect(leerPropuestaDeshacer('x')).toBeNull()
  })
})

describe('leerResultadoDeshacer', () => {
  const c = (resultado: string) => ({ tipo: 'deshacer', resultado })
  it('cada resultado del servidor', () => {
    expect(leerResultadoDeshacer(200, c('deshecho'))).toBe('deshecho')
    expect(leerResultadoDeshacer(200, c('ya_deshecho'))).toBe('ya_deshecho')
    expect(leerResultadoDeshacer(200, c('cambio_despues'))).toBe('cambio_despues')
    expect(leerResultadoDeshacer(410, c('vencida'))).toBe('vencida')
    expect(leerResultadoDeshacer(409, c('otro_dia'))).toBe('otro_dia')
  })
  it('un «deshecho» que no vino con 2xx no cuenta como deshecho', () => {
    expect(leerResultadoDeshacer(502, c('deshecho'))).toBe('no_se_pudo')
    expect(leerResultadoDeshacer(500, c('ya_deshecho'))).toBe('no_se_pudo')
    expect(leerResultadoDeshacer(500, c('cambio_despues'))).toBe('no_se_pudo')
  })
  it('lo desconocido o ilegible cae en «no se pudo»', () => {
    for (const r of ['no_encontrado', 'tarjeta_invalida', 'sin_confirmar', 'error', 'raro']) expect(leerResultadoDeshacer(403, c(r))).toBe('no_se_pudo')
    expect(leerResultadoDeshacer(200, null)).toBe('no_se_pudo')
    expect(leerResultadoDeshacer(200, { resultado: 'deshecho' })).toBe('no_se_pudo')
  })
})

describe('fraseDeResultado: corta y sin tecnicismos', () => {
  const todos: ResultadoDeshacer[] = ['deshecho', 'ya_deshecho', 'cambio_despues', 'vencida', 'otro_dia', 'no_se_pudo']
  it('dice lo pactado', () => {
    expect(fraseDeResultado('deshecho', 'tu')).toBe('Listo, lo quité.')
    expect(fraseDeResultado('ya_deshecho', 'tu')).toMatch(/ya estaba quitado/)
    expect(fraseDeResultado('cambio_despues', 'tu')).toMatch(/cambió después.*no lo toqué/)
    expect(fraseDeResultado('vencida', 'tu')).toMatch(/venció.*otra vez/)
    expect(fraseDeResultado('otro_dia', 'tu')).toMatch(/otro día.*valor bueno/)
    expect(fraseDeResultado('otro_dia', 'usted')).toMatch(/Dígame/)
  })
  it('ninguna lleva tecnicismos ni números de error y todas son cortas', () => {
    for (const r of todos) for (const t of ['tu', 'usted'] as const) {
      const f = fraseDeResultado(r, t)
      expect(f.length).toBeLessThan(80)
      expect(f).not.toMatch(/token|HTTP|410|409|403|502|RPC|libro|jwt|error/i)
    }
  })
  it('las seis frases son distintas entre sí', () => {
    expect(new Set(todos.map((r) => fraseDeResultado(r, 'tu'))).size).toBe(6)
  })
})
