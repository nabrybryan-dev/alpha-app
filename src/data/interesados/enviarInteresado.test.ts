/**
 * Lo que llega a la base desde el formulario de interesados (migración 0089):
 *   - la evidencia de la autorización queda guardada: versión del texto, canal, las
 *     cinco casillas (A–E) y la declaración, más la fecha, que pone el servidor;
 *   - solo columnas de opción cerrada: ni una columna de texto libre ni de salud;
 *   - un reintento tras un corte no duplica ni se queda a medias.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { construirEnvio, type EnvioInteresado } from '../../domain/interesados/formulario'
import { enviarInteresado, filasDelEnvio, guardadoEnDemo, vaciarDemo, type Insertar } from './enviarInteresado'

function envio(casillas = { A: 'si', B: 'no', C: 'no', D: 'no', E: 'no' }): EnvioInteresado {
  const r = construirEnvio(
    {
      encaje: {
        p1Dias: '4_o_mas',
        p1Horarios: 'fijos',
        p2Lugar: 'gimnasio',
        p2Modalidad: 'en línea',
        p3Expectativa: 'fuerza',
      },
      casillas,
      declaracion: true,
    },
    { envioId: crypto.randomUUID(), codigo: 'PRUEBAC1', clienteId: 'PRUEBA-001' },
  )
  if (!r.ok) throw new Error('envío de prueba inválido')
  return r.envio
}

beforeEach(() => vaciarDemo())

describe('la evidencia de la autorización queda guardada', () => {
  it('con versión, canal, casillas, declaración y fecha del servidor', async () => {
    const e = envio({ A: 'si', B: 'no', C: 'si', D: 'no', E: 'si' })
    await enviarInteresado(e)
    const { autorizaciones } = guardadoEnDemo()
    expect(autorizaciones).toHaveLength(1)
    expect(autorizaciones[0]).toMatchObject({
      envio_id: e.envioId,
      cliente_id: 'PRUEBA-001',
      version_autorizacion: '0.4',
      canal: 'formulario',
      casilla_a: 'si',
      casilla_b: 'no',
      casilla_c: 'si',
      casilla_d: 'no',
      casilla_e: 'si',
      declaracion_aceptada: true,
    })
    expect(Number.isNaN(Date.parse(autorizaciones[0].fecha_hora))).toBe(false)
  })

  it('la autorización va atada a su respuesta de encaje por el mismo envio_id', async () => {
    const e = envio()
    await enviarInteresado(e)
    const { encaje, autorizaciones } = guardadoEnDemo()
    expect(encaje[0].envio_id).toBe(e.envioId)
    expect(autorizaciones[0].envio_id).toBe(e.envioId)
  })

  it('la fecha NO la manda el navegador: la fila que sale no la lleva', () => {
    const { autorizacion } = filasDelEnvio(envio())
    expect(autorizacion).not.toHaveProperty('fecha_hora')
  })
})

describe('solo columnas cerradas, nada de salud', () => {
  it('la fila de encaje lleva exactamente estas columnas', () => {
    const { encaje } = filasDelEnvio(envio())
    expect(Object.keys(encaje).sort()).toEqual(
      ['cliente_id', 'codigo', 'envio_id', 'p1_dias', 'p1_horarios', 'p2_lugar', 'p2_modalidad', 'p3_expectativa'].sort(),
    )
  })

  it('con todas las casillas en «sí», ninguna fila lleva un dato de salud', () => {
    const filas = filasDelEnvio(envio({ A: 'si', B: 'si', C: 'si', D: 'si', E: 'si' }))
    const columnas = [...Object.keys(filas.encaje), ...Object.keys(filas.autorizacion)]
    for (const salud of [
      'lesiones', 'patologias', 'medicacion', 'alimentacion', 'medidas', 'fotos', 'peso',
      'pasos', 'sueno', 'fc_reposo', 'vfc', 'minutos_ejercicio',
    ]) {
      expect(columnas.some((c) => c.includes(salud))).toBe(false)
    }
  })
})

describe('guardado en la nube (con un insertador de prueba)', () => {
  it('inserta primero el encaje y después la autorización, sin pedir lectura', async () => {
    const insertar = vi.fn<Insertar>(async () => null)
    await enviarInteresado(envio(), insertar)
    expect(insertar.mock.calls.map(([tabla]) => tabla)).toEqual([
      'piloto_encaje_respuestas',
      'piloto_autorizaciones',
    ])
  })

  it('un reintento con el mismo envío da por bueno el encaje duplicado y guarda la autorización', async () => {
    const e = envio()
    const insertar = vi.fn<Insertar>(async (tabla) => (tabla === 'piloto_encaje_respuestas' ? '23505' : null))
    await expect(enviarInteresado(e, insertar)).resolves.toBe('guardado')
    expect(insertar).toHaveBeenCalledTimes(2)
  })

  it('un error de verdad (p. ej. RLS, 42501) no se da por guardado', async () => {
    const insertar = vi.fn<Insertar>(async () => '42501')
    await expect(enviarInteresado(envio(), insertar)).rejects.toThrow(/encaje: 42501/)
  })

  it('si falla la autorización, se avisa: no se da por autorizada', async () => {
    const insertar = vi.fn<Insertar>(async (tabla) => (tabla === 'piloto_autorizaciones' ? '23514' : null))
    await expect(enviarInteresado(envio(), insertar)).rejects.toThrow(/autorizacion: 23514/)
  })
})
