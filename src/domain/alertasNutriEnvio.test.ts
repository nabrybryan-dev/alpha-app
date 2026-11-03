import { describe, expect, it } from 'vitest'
import { correrAlertasNutri, type Rest } from '../../supabase/functions/avisos-plan/alertasNutriEnvio.ts'

const HOY = '2026-10-28'
const MANUELA = 'manuela-id'

interface Llamada {
  ruta: string
  metodo: string
  cuerpo?: string
}

/** Un servidor falso: responde por prefijo de ruta y apunta cada llamada. */
function servidor(tablas: Record<string, unknown[]>, opciones: { postDevuelve?: unknown[] } = {}) {
  const llamadas: Llamada[] = []
  const rest: Rest = async (ruta, init = {}) => {
    const metodo = init.method ?? 'GET'
    llamadas.push({ ruta, metodo, cuerpo: init.body as string | undefined })
    const tabla = ruta.split('?')[0]
    if (metodo === 'GET') return new Response(JSON.stringify(tablas[tabla] ?? []), { status: 200 })
    if (metodo === 'POST') return new Response(JSON.stringify(opciones.postDevuelve ?? []), { status: 201 })
    return new Response('[]', { status: 200 })
  }
  return { rest, llamadas }
}

const hambreAlta = (dias: number) =>
  Array.from({ length: dias }, (_, i) => {
    const d = new Date(`${HOY}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i)
    return { usuario_id: 'u1', fecha: d.toISOString().slice(0, 10), hambre_escala: '10' }
  })

const suscripcion = [{ endpoint: 'https://push.ejemplo/x', p256dh: 'k', auth: 'a' }]

describe('alertas nutricionales: la parte con red', () => {
  it('apagadas (por defecto): una sola lectura, ningún dato de salud leído, ningún envío', async () => {
    const { rest, llamadas } = servidor({
      alertas_nutricion_ajustes: [
        { clave: 'hambre_sostenida', encendida: false },
        { clave: 'objetivo_insuficiente', encendida: false },
      ],
    })
    let enviados = 0
    const r = await correrAlertasNutri({ rest, hoy: HOY, manuelaId: MANUELA, enviar: async () => void enviados++ })
    expect(r.alertasNutri).toBe('apagadas')
    expect(enviados).toBe(0)
    const tablasLeidas = llamadas.map((l) => l.ruta.split('?')[0])
    expect(tablasLeidas).not.toContain('checkins')
    expect(tablasLeidas).not.toContain('planes_nutricionales')
    expect(llamadas.every((l) => l.metodo === 'GET')).toBe(true)
  })

  it('encendida y con hambre sostenida: crea la alerta y manda UN push neutro solo a Manuela', async () => {
    const { rest, llamadas } = servidor(
      {
        alertas_nutricion_ajustes: [{ clave: 'hambre_sostenida', encendida: true }],
        checkins: hambreAlta(3),
        permisos_de_aviso: suscripcion,
      },
      { postDevuelve: [{ id: 'nueva-1' }] },
    )
    const cargas: string[] = []
    const r = await correrAlertasNutri({ rest, hoy: HOY, manuelaId: MANUELA, enviar: async (_s, c) => void cargas.push(c) })
    expect(r).toMatchObject({ creadas: 1, push: 1 })
    expect(cargas).toHaveLength(1)
    expect(cargas[0]).toContain('Tienes una alerta nueva de un asesorado')
    expect(cargas[0].toLowerCase()).not.toContain('hambre')
    const consultaSub = llamadas.find((l) => l.ruta.startsWith('permisos_de_aviso'))!
    expect(consultaSub.ruta).toContain(`usuario_id=eq.${MANUELA}`)
    const marca = llamadas.find((l) => l.metodo === 'PATCH' && l.cuerpo?.includes('avisada_en'))
    expect(marca?.ruta).toContain('nueva-1')
  })

  it('si el teléfono falla, la alerta queda sin avisar para reintentar y no lanza', async () => {
    const { rest, llamadas } = servidor(
      {
        alertas_nutricion_ajustes: [{ clave: 'hambre_sostenida', encendida: true }],
        checkins: hambreAlta(3),
        permisos_de_aviso: suscripcion,
      },
      { postDevuelve: [{ id: 'nueva-1' }] },
    )
    const r = await correrAlertasNutri({
      rest,
      hoy: HOY,
      manuelaId: MANUELA,
      enviar: async () => {
        throw Object.assign(new Error('red'), { statusCode: 500 })
      },
    })
    expect(r.push).toBe(0)
    expect(llamadas.some((l) => l.metodo === 'PATCH' && l.cuerpo?.includes('avisada_en'))).toBe(false)
  })

  it('sin suscripción de Manuela no envía, pero la alerta queda registrada', async () => {
    const { rest } = servidor(
      { alertas_nutricion_ajustes: [{ clave: 'hambre_sostenida', encendida: true }], checkins: hambreAlta(3) },
      { postDevuelve: [{ id: 'nueva-1' }] },
    )
    let enviados = 0
    const r = await correrAlertasNutri({ rest, hoy: HOY, manuelaId: MANUELA, enviar: async () => void enviados++ })
    expect(r).toMatchObject({ creadas: 1, push: 0 })
    expect(enviados).toBe(0)
  })

  it('al apagar una alerta con filas abiertas, las retira', async () => {
    const { rest, llamadas } = servidor({
      alertas_nutricion_ajustes: [{ clave: 'hambre_sostenida', encendida: false }],
      alertas_nutricion: [{ id: 'vieja-1', asesorado_id: 'u1', clave: 'hambre_sostenida', avisada_en: null }],
    })
    const r = await correrAlertasNutri({ rest, hoy: HOY, manuelaId: MANUELA, enviar: async () => {} })
    expect(r.retiradas).toBe(1)
    expect(llamadas.some((l) => l.metodo === 'PATCH' && l.ruta.includes('vieja-1') && l.cuerpo?.includes('resuelta_en'))).toBe(true)
  })

  it('si el POST de las alertas nuevas falla, el resumen reporta el error y no dice ok', async () => {
    const base = servidor({
      alertas_nutricion_ajustes: [{ clave: 'hambre_sostenida', encendida: true }],
      checkins: hambreAlta(3),
      permisos_de_aviso: suscripcion,
    })
    const rest: Rest = async (ruta, init = {}) =>
      init.method === 'POST' ? new Response('boom', { status: 500 }) : base.rest(ruta, init)
    let enviados = 0
    const r = await correrAlertasNutri({ rest, hoy: HOY, manuelaId: MANUELA, enviar: async () => void enviados++ })
    expect(r.alertasNutri).toBe('error')
    expect(enviados).toBe(0)
  })

  it('si el PATCH que retira alertas falla, el resumen reporta el error y no dice ok', async () => {
    const base = servidor({
      alertas_nutricion_ajustes: [{ clave: 'hambre_sostenida', encendida: false }],
      alertas_nutricion: [{ id: 'vieja-1', asesorado_id: 'u1', clave: 'hambre_sostenida', avisada_en: null }],
    })
    const rest: Rest = async (ruta, init = {}) =>
      init.method === 'PATCH' ? new Response('boom', { status: 500 }) : base.rest(ruta, init)
    const r = await correrAlertasNutri({ rest, hoy: HOY, manuelaId: MANUELA, enviar: async () => {} })
    expect(r.alertasNutri).toBe('error')
  })

  it('un fallo de lectura no lanza: devuelve error', async () => {
    const rest: Rest = async () => new Response('x', { status: 500 })
    const r = await correrAlertasNutri({ rest, hoy: HOY, manuelaId: MANUELA, enviar: async () => {} })
    expect(r.alertasNutri).toBe('error')
  })
})
