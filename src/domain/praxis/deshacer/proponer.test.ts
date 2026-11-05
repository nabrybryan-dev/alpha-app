import { describe, expect, it } from 'vitest'
import { crearLibroSimulado } from './libroSimulado'
import { interpretarPedidoDeshacer } from './pedido'
import { BOTON_NO, BOTON_SI, TEXTO_FUERA_DE_VENTANA, TEXTO_NADA, proponerDeshacer } from './proponer'
import { ZONA_BOGOTA, type RegistroLibro } from './tipos'

const U = 'u1'
// 14:00 en Bogotá. Todo con fechas fijas: la CI corre en UTC.
const AHORA = new Date('2026-11-04T19:00:00Z')

const reg = (id: string, creadoEn: string, extra: Partial<RegistroLibro> = {}): RegistroLibro => ({
  id,
  usuarioId: U,
  tipo: 'hidratacion',
  descripcion: '+250 ml',
  creadoEn,
  deshechoEn: null,
  ...extra,
})

const pedir = (frase: string) => {
  const p = interpretarPedidoDeshacer(frase)
  if (!p) throw new Error(`la frase no se entendió: ${frase}`)
  return p
}
const proponer = (libro: readonly RegistroLibro[], frase: string, ahora = AHORA) =>
  proponerDeshacer(libro, pedir(frase), ahora, ZONA_BOGOTA, U)

describe('caso 1: «quita lo último que anoté» con un registro', () => {
  it('propone confirmar exactamente ese y no escribe', () => {
    const libro = crearLibroSimulado([reg('a1', '2026-11-04T13:15:00Z')])
    const r = proponer(libro.registros(), 'quita lo último que anoté')
    expect(r.accion).toBe('confirmar_deshacer')
    if (r.accion !== 'confirmar_deshacer') return
    expect(r.tarjeta.registroId).toBe('a1')
    expect(r.texto).toBe('Voy a quitar el agua que anotaste a las 8:15: +250 ml. ¿Lo quito?')
    expect(r.botones).toEqual([BOTON_SI, BOTON_NO])
    expect(libro.escrituras()).toBe(0)
  })
})

describe('caso 2: se pulsa «Sí, quitar»', () => {
  it('marca solo ese registro; los demás quedan idénticos', () => {
    const libro = crearLibroSimulado([
      reg('viejo', '2026-11-04T13:15:00Z'),
      reg('nuevo', '2026-11-04T17:00:00Z'),
      reg('comida', '2026-11-04T16:00:00Z', { tipo: 'comida', descripcion: 'almuerzo, 3 alimentos' }),
    ])
    const antes = libro.registros()
    const r = proponer(antes, 'quita lo último que anoté')
    if (r.accion !== 'confirmar_deshacer') throw new Error('debía confirmar')
    expect(r.tarjeta.registroId).toBe('nuevo')
    const ok = libro.confirmar(r.tarjeta, U, AHORA)
    expect(ok.ok).toBe(true)
    const despues = libro.registros()
    expect(despues.filter((x) => x.deshechoEn !== null).map((x) => x.id)).toEqual(['nuevo'])
    for (const id of ['viejo', 'comida']) {
      expect(despues.find((x) => x.id === id)).toEqual(antes.find((x) => x.id === id))
    }
    expect(libro.escrituras()).toBe(1)
  })
})

describe('caso 3: «deshaz lo del agua» con agua y comida en el mismo minuto', () => {
  it('elige el agua, no la comida, aunque la comida se anotó después', () => {
    const libro = [
      reg('agua', '2026-11-04T16:00:00Z'),
      reg('comida', '2026-11-04T16:00:30Z', { tipo: 'comida', descripcion: 'almuerzo, 3 alimentos' }),
    ]
    const r = proponer(libro, 'deshaz lo del agua')
    expect(r.accion === 'confirmar_deshacer' && r.tarjeta.registroId).toBe('agua')
  })
})

describe('caso 4: «lo de la comida de las 10» con dos comidas', () => {
  it('elige la de 10:05 y no la de 12:40', () => {
    const libro = [
      reg('c1', '2026-11-04T15:05:00Z', { tipo: 'comida', descripcion: 'desayuno, 3 alimentos' }),
      reg('c2', '2026-11-04T17:40:00Z', { tipo: 'comida', descripcion: 'almuerzo, 4 alimentos' }),
    ]
    const r = proponer(libro, 'deshaz lo de la comida de las 10')
    expect(r.accion === 'confirmar_deshacer' && r.tarjeta.registroId).toBe('c1')
    if (r.accion === 'confirmar_deshacer') expect(r.texto).toContain('10:05')
  })
})

describe('caso 5: «deshaz eso» con dos aguas', () => {
  it('pregunta cuál (dos opciones con su hora) y no elige solo', () => {
    const libro = [reg('a1', '2026-11-04T13:15:00Z'), reg('a2', '2026-11-04T17:40:00Z')]
    const r = proponer(libro, 'deshaz eso')
    expect(r.accion).toBe('preguntar')
    if (r.accion !== 'preguntar') return
    expect(r.opciones.map((o) => o.registroId)).toEqual(['a2', 'a1'])
    expect(r.opciones.map((o) => o.etiqueta)).toEqual(['Agua: +250 ml, 12:40', 'Agua: +250 ml, 8:15'])
  })

  it('con 5 candidatos muestra solo los 3 más recientes y «Ninguno»', () => {
    const libro = [0, 1, 2, 3, 4].map((i) => reg(`a${i}`, `2026-11-04T1${i}:00:00Z`))
    const r = proponer(libro, 'deshaz eso')
    if (r.accion !== 'preguntar') throw new Error('debía preguntar')
    expect(r.opciones.map((o) => o.registroId)).toEqual(['a4', 'a3', 'a2'])
    expect(r.botones).toHaveLength(4)
    expect(r.botones[3]).toBe('Ninguno')
  })
})

describe('caso 6: «deshaz eso» sin nada anotado', () => {
  it('no hay nada que deshacer', () => {
    const r = proponer([], 'deshaz eso')
    expect(r).toEqual({ accion: 'nada_que_deshacer', motivo: 'vacio', texto: TEXTO_NADA })
  })

  it('lo que es de otra persona no cuenta', () => {
    const r = proponer([reg('x', '2026-11-04T16:00:00Z', { usuarioId: 'otra' })], 'deshaz eso')
    expect(r.accion).toBe('nada_que_deshacer')
  })
})

describe('caso 7: la orden sin pulsar nada', () => {
  it('0 escrituras y la tarjeta caduca a los 2 minutos', () => {
    const libro = crearLibroSimulado([reg('a1', '2026-11-04T13:15:00Z')])
    const r = proponer(libro.registros(), 'quita lo último que anoté')
    if (r.accion !== 'confirmar_deshacer') throw new Error('debía confirmar')
    expect(libro.escrituras()).toBe(0)
    expect(r.tarjeta.venceEn).toBe('2026-11-04T19:02:00.000Z')
    const tarde = libro.confirmar(r.tarjeta, U, new Date('2026-11-04T19:02:01Z'))
    expect(tarde).toEqual({ ok: false, motivo: 'vencida' })
    expect(libro.escrituras()).toBe(0)
  })
})

describe('caso 8: token vencido o reusado', () => {
  it('reusado: el segundo uso se rechaza con 0 escrituras nuevas', () => {
    const libro = crearLibroSimulado([reg('a1', '2026-11-04T13:15:00Z')])
    const r = proponer(libro.registros(), 'quita lo último que anoté')
    if (r.accion !== 'confirmar_deshacer') throw new Error('debía confirmar')
    expect(libro.confirmar(r.tarjeta, U, AHORA).ok).toBe(true)
    expect(libro.confirmar(r.tarjeta, U, AHORA)).toEqual({ ok: false, motivo: 'ya_usada' })
    expect(libro.escrituras()).toBe(1)
  })
})

describe('caso 14: frases que no son una orden', () => {
  it('«mi hermano borró todo» y «toca borrar fotos» no proponen nada', () => {
    expect(interpretarPedidoDeshacer('mi hermano borró todo')).toBeNull()
    expect(interpretarPedidoDeshacer('toca borrar fotos')).toBeNull()
  })
})

describe('caso 15: «borra los tres últimos»', () => {
  it('propone UNO solo y lo dice', () => {
    const libro = [reg('a1', '2026-11-04T13:00:00Z'), reg('a2', '2026-11-04T14:00:00Z'), reg('a3', '2026-11-04T15:00:00Z')]
    const r = proponer(libro, 'borra los tres últimos')
    expect(r.accion).toBe('confirmar_deshacer')
    if (r.accion !== 'confirmar_deshacer') return
    expect(r.tarjeta.registroId).toBe('a3')
    expect(r.texto.startsWith('Te los quito de a uno. ')).toBe(true)
  })
})

describe('caso 16: registro más viejo que la ventana', () => {
  it('de ayer: remite a la corrección y no ofrece quitarlo', () => {
    const ayer = [reg('v', '2026-11-04T04:00:00Z')] // 23:00 del 3 en Bogotá
    const r = proponer(ayer, 'quita lo último que anoté')
    expect(r).toEqual({ accion: 'nada_que_deshacer', motivo: 'fuera_de_ventana', texto: TEXTO_FUERA_DE_VENTANA })
  })

  it('borde 23:30 de Bogotá: a las 23:50 se ofrece; a las 00:10 ya no', () => {
    const libro = [reg('n', '2026-11-05T04:30:00Z')] // 23:30 Bogotá del 4
    expect(proponer(libro, 'quita lo último que anoté', new Date('2026-11-05T04:50:00Z')).accion).toBe('confirmar_deshacer')
    expect(proponer(libro, 'quita lo último que anoté', new Date('2026-11-05T05:10:00Z')).accion).toBe('nada_que_deshacer')
  })
})

describe('caso 17: doble toque en «Sí»', () => {
  it('una sola reversión', () => {
    const libro = crearLibroSimulado([reg('a1', '2026-11-04T13:15:00Z')])
    const r = proponer(libro.registros(), 'deshaz lo del agua')
    if (r.accion !== 'confirmar_deshacer') throw new Error('debía confirmar')
    const a = libro.confirmar(r.tarjeta, U, AHORA)
    const b = libro.confirmar(r.tarjeta, U, new Date(AHORA.getTime() + 300))
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(false)
    expect(libro.escrituras()).toBe(1)
    expect(libro.registros()[0].deshechoEn).toBe(AHORA.toISOString())
  })

  it('una tarjeta nueva sobre el mismo registro ya deshecho también se rechaza', () => {
    const libro = crearLibroSimulado([reg('a1', '2026-11-04T13:15:00Z')])
    const r = proponer(libro.registros(), 'deshaz lo del agua')
    if (r.accion !== 'confirmar_deshacer') throw new Error('debía confirmar')
    libro.confirmar(r.tarjeta, U, AHORA)
    const otra = { ...r.tarjeta, venceEn: '2026-11-04T19:05:00.000Z' }
    expect(libro.confirmar(otra, U, AHORA)).toEqual({ ok: false, motivo: 'ya_deshecho' })
  })
})

describe('el dueño manda (apoyo al caso 9 del diseño)', () => {
  it('una tarjeta con el usuario cambiado se rechaza y no escribe', () => {
    const libro = crearLibroSimulado([reg('a1', '2026-11-04T13:15:00Z')])
    const r = proponer(libro.registros(), 'deshaz lo del agua')
    if (r.accion !== 'confirmar_deshacer') throw new Error('debía confirmar')
    expect(libro.confirmar(r.tarjeta, 'intruso', AHORA)).toEqual({ ok: false, motivo: 'otro_usuario' })
    expect(libro.escrituras()).toBe(0)
  })
})
