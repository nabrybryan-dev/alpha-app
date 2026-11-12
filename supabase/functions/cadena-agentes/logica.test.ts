import { describe, expect, it } from 'vitest'
import { ACCIONES, atender, despachar, MINUTOS_SIN_LATIDO, textoLatido, type Rpc } from './logica'

type Llamada = { nombre: string; args?: Record<string, unknown> }

describe('respuestas_preg con seudonimo', () => {
  it('entrega el codigo y conserva las demas columnas de la RPC', async () => {
    const fila = { respuesta_id: 'ficticia', cuestionario_id: 'preg-PRUEBA', codigo: 'piloto-10',
      fecha_iso: '2026-11-08T00:00:00Z', valores: { marca: 'ficticia' }, pregunta_ref: 'ref', solicitud_id: 'sol' }
    const { rpc, llamadas } = rpcFalso({ cadena_respuestas_preg: [fila] })
    const r = await despachar({ accion: 'respuestas_preg' }, rpc)
    expect(r).toEqual({ estado: 200, cuerpo: { rows: [fila] } })
    expect((r.cuerpo.rows as Record<string, unknown>[])[0]).not.toHaveProperty('usuario_id')
    expect(llamadas).toEqual([{ nombre: 'cadena_respuestas_preg', args: undefined }])
  })
})

function rpcFalso(respuestas: Record<string, unknown> = {}) {
  const llamadas: Llamada[] = []
  const rpc: Rpc = async (nombre, args) => {
    llamadas.push({ nombre, args })
    const r = respuestas[nombre]
    if (r instanceof Error) return { data: null, error: { message: r.message } }
    return { data: r ?? null, error: null }
  }
  return { rpc, llamadas }
}

describe('latido', () => {
  it('guarda el latido del origen con su detalle', async () => {
    const { rpc, llamadas } = rpcFalso({ cadena_latido: { origen: 'asus-n8n', visto_en: 'x' } })
    const r = await despachar({ accion: 'latido', origen: 'asus-n8n', detalle: { flujo: 'alpha-latido' } }, rpc)
    expect(r.estado).toBe(200)
    expect(llamadas).toEqual([{ nombre: 'cadena_latido', args: { p_origen: 'asus-n8n', p_detalle: { flujo: 'alpha-latido' } } }])
  })

  it('sin detalle manda un objeto vacío', async () => {
    const { rpc, llamadas } = rpcFalso()
    await despachar({ accion: 'latido', origen: 'asus-n8n' }, rpc)
    expect(llamadas[0].args).toEqual({ p_origen: 'asus-n8n', p_detalle: {} })
  })

  it('rechaza un origen raro o un detalle que no es objeto, sin llamar a la base', async () => {
    const { rpc, llamadas } = rpcFalso()
    expect((await despachar({ accion: 'latido', origen: 'ASUS N8N' }, rpc)).estado).toBe(400)
    expect((await despachar({ accion: 'latido', origen: 'asus-n8n', detalle: [1] }, rpc)).estado).toBe(400)
    expect((await despachar({ accion: 'latido', origen: 'asus-n8n', detalle: { x: 'a'.repeat(5000) } }, rpc)).estado).toBe(400)
    expect(llamadas).toEqual([])
  })

  it('la lista de acciones es cerrada: una nueva se añade aquí a propósito', () => {
    expect([...ACCIONES].sort()).toEqual([
      'altas_pendientes', 'canario_borrar', 'canario_estado', 'canario_proponer', 'canario_restos',
      'insertar_cuestionario', 'latido', 'respuestas_preg', 'salud', 'vigilar_latidos',
    ])
  })
})

describe('vigilar_latidos', () => {
  const caido = { origen: 'asus-n8n', cambio: 'caido', visto_en: '2026-11-07T10:00:00Z', minutos: 41 }

  it('pregunta con el umbral de 30 min, avisa y marca solo si el aviso salió', async () => {
    const { rpc, llamadas } = rpcFalso({ cadena_latidos_por_avisar: [caido] })
    const textos: string[] = []
    const r = await despachar({ accion: 'vigilar_latidos' }, rpc, async (t) => {
      textos.push(t)
      return true
    })
    expect(MINUTOS_SIN_LATIDO).toBe(30)
    expect(llamadas).toEqual([
      { nombre: 'cadena_latidos_por_avisar', args: { p_minutos: 30 } },
      { nombre: 'cadena_latido_avisado', args: { p_origen: 'asus-n8n', p_estado: 'caido' } },
    ])
    expect(textos).toEqual([textoLatido(caido as never)])
    expect(r.cuerpo).toEqual({ rows: [{ origen: 'asus-n8n', cambio: 'caido', avisado: true }] })
  })

  it('si Telegram falla o lanza, no marca: se reintenta en la próxima vuelta', async () => {
    for (const avisar of [async () => false, async () => { throw new Error('timeout') }]) {
      const { rpc, llamadas } = rpcFalso({ cadena_latidos_por_avisar: [caido] })
      const r = await despachar({ accion: 'vigilar_latidos' }, rpc, avisar)
      expect(llamadas.map((l) => l.nombre)).toEqual(['cadena_latidos_por_avisar'])
      expect(r.cuerpo).toEqual({ rows: [{ origen: 'asus-n8n', cambio: 'caido', avisado: false }] })
    }
  })

  it('al volver marca vivo', async () => {
    const { rpc, llamadas } = rpcFalso({ cadena_latidos_por_avisar: [{ ...caido, cambio: 'volvio', minutos: 2 }] })
    await despachar({ accion: 'vigilar_latidos' }, rpc, async () => true)
    expect(llamadas[1]).toEqual({ nombre: 'cadena_latido_avisado', args: { p_origen: 'asus-n8n', p_estado: 'vivo' } })
  })

  it('sin nada pendiente no avisa', async () => {
    const { rpc } = rpcFalso({ cadena_latidos_por_avisar: [] })
    let avisos = 0
    const r = await despachar({ accion: 'vigilar_latidos' }, rpc, async () => (avisos++, true))
    expect(avisos).toBe(0)
    expect(r.cuerpo).toEqual({ rows: [] })
  })

  it('el texto no lleva más que el origen y los minutos', () => {
    expect(textoLatido(caido as never)).toMatch(/«asus-n8n» no da señales desde hace 41 min/)
    expect(textoLatido({ ...caido, cambio: 'volvio' } as never)).toMatch(/«asus-n8n» volvió a dar señales/)
  })
})

describe('atender', () => {
  it('sin la clave no llega a la base', async () => {
    const { rpc, llamadas } = rpcFalso()
    const r = await atender('POST', 'mala', 'buena', async () => ({ accion: 'latido', origen: 'asus-n8n' }), rpc)
    expect(r.estado).toBe(401)
    expect(llamadas).toEqual([])
  })

  it('pasa el avisador a vigilar_latidos', async () => {
    const { rpc } = rpcFalso({ cadena_latidos_por_avisar: [{ origen: 'asus-n8n', cambio: 'caido', visto_en: 'x', minutos: 31 }] })
    let avisado = false
    const r = await atender('POST', 'k', 'k', async () => ({ accion: 'vigilar_latidos' }), rpc, () => {}, async () => (avisado = true))
    expect(avisado).toBe(true)
    expect(r.estado).toBe(200)
  })

  it('un error de la base es 500 sin el detalle', async () => {
    const { rpc } = rpcFalso({ cadena_latido: new Error('cadena_latido: algo interno') })
    const r = await atender('POST', 'k', 'k', async () => ({ accion: 'latido', origen: 'asus-n8n' }), rpc)
    expect(r).toEqual({ estado: 500, cuerpo: { error: 'fallo en la base' } })
  })
})
