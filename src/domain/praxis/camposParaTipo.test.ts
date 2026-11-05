import { describe, expect, it } from 'vitest'
import { camposParaTipo, nombresDeCamposParaMeta, type PiezaParaCampos } from './camposParaTipo'
import type { TipoPregunta } from './enrutarPraxis'

// Pieza FICTICIA: cada campo lleva una marca distinta para ver cuál sale.
const pieza: PiezaParaCampos = {
  estado: 'aprobada',
  respuesta: 'RESP-X',
  estudios: 'EST-X',
  criterio_de_practica: 'PRAC-X',
  de_que_depende: ['DEP-1', 'DEP-2'],
}
const marcas = ['RESP-X', 'EST-X', 'PRAC-X', 'DEP-1']
const salen = (t: TipoPregunta) => {
  const r = camposParaTipo(pieza, t)
  return r.hay ? marcas.filter((m) => r.texto.includes(m)) : []
}

describe('camposParaTipo: qué campo para qué pregunta (criterio de Bryan, 3-nov)', () => {
  it('cantidad, momento y definición muestran solo la respuesta', () => {
    for (const t of ['cantidad', 'momento', 'definicion'] as const) expect(salen(t)).toEqual(['RESP-X'])
  })
  it('razón muestra estudios, práctica y de qué depende, sin la respuesta', () => {
    expect(salen('razon')).toEqual(['EST-X', 'PRAC-X', 'DEP-1'])
    const r = camposParaTipo(pieza, 'razon')
    expect(r.hay && r.secciones.map((s) => s.titulo)).toEqual(['Estudios', 'En la práctica', 'De qué depende'])
  })
  it('permiso, comparación y mi_caso muestran respuesta y de qué depende', () => {
    for (const t of ['permiso', 'comparacion', 'mi_caso'] as const) expect(salen(t)).toEqual(['RESP-X', 'DEP-1'])
  })
  it('método no tiene campo: no inventa nada', () => {
    expect(camposParaTipo(pieza, 'metodo')).toEqual({ hay: false, motivo: 'sin_campo' })
  })
  it('sin tipo no muestra nada', () => {
    expect(camposParaTipo(pieza, undefined)).toEqual({ hay: false, motivo: 'sin_tipo' })
  })
  it('el texto es el de la pieza, sin cambiarlo', () => {
    const r = camposParaTipo(pieza, 'permiso')
    expect(r.hay && r.texto).toBe('Respuesta\nRESP-X\n\nDe qué depende\n- DEP-1\n- DEP-2')
  })
  it('salta el campo vacío o nulo sin dejar su título', () => {
    const r = camposParaTipo({ ...pieza, criterio_de_practica: null, estudios: '  ' }, 'razon')
    expect(r.hay && r.secciones.map((s) => s.campo)).toEqual(['de_que_depende'])
    expect(camposParaTipo({ ...pieza, estudios: '', criterio_de_practica: null, de_que_depende: [] }, 'razon')).toEqual({ hay: false, motivo: 'vacia' })
  })
})

describe('camposParaTipo: exclusiones', () => {
  it('no muestra una pieza en borrador ni sin estado', () => {
    expect(camposParaTipo({ ...pieza, estado: 'borrador' }, 'cantidad')).toEqual({ hay: false, motivo: 'no_aprobada' })
    expect(camposParaTipo({ ...pieza, estado: undefined }, 'cantidad')).toEqual({ hay: false, motivo: 'no_aprobada' })
  })
  it('no muestra una pieza en reserva hasta el encoder, aunque esté aprobada', () => {
    expect(camposParaTipo({ ...pieza, estado_uso: 'reserva_hasta_encoder' }, 'cantidad')).toEqual({ hay: false, motivo: 'no_aprobada' })
  })
  it('estado_uso «revisar» no excluye: lo llevan piezas aprobadas en el archivo local', () => {
    expect(camposParaTipo({ ...pieza, estado_uso: 'revisar' }, 'cantidad').hay).toBe(true)
  })
  it('no muestra nada con bandera de salud, ni siquiera en método', () => {
    expect(camposParaTipo({ ...pieza, bandera_salud: true }, 'cantidad')).toEqual({ hay: false, motivo: 'salud' })
    expect(camposParaTipo({ ...pieza, bandera_salud: true }, 'metodo')).toEqual({ hay: false, motivo: 'salud' })
  })
})

describe('nombresDeCamposParaMeta', () => {
  it('lleva solo nombres de campo y marca el hueco de método', () => {
    expect(nombresDeCamposParaMeta('razon')).toEqual({ tipo: 'razon', campos: ['estudios', 'criterio_de_practica', 'de_que_depende'] })
    expect(nombresDeCamposParaMeta('metodo')).toEqual({ tipo: 'metodo', campos: [], hueco: 'metodo' })
    expect(nombresDeCamposParaMeta(undefined)).toBeUndefined()
  })
})
