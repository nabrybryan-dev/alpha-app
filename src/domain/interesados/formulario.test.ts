/**
 * Las garantías del formulario de interesados que no dependen de la pantalla:
 *   - solo opciones cerradas: un valor fuera de las opciones o una clave de más
 *     (comentario, «otro, ¿cuál?», una lesión) rechaza el envío entero;
 *   - las cuatro casillas se marcan «sí» o «no» y la declaración se acepta: nada viene
 *     marcado y el silencio no autoriza;
 *   - ningún dato de salud viaja en el envío, y solo se puede PEDIR después si la casilla
 *     que lo cubre está en «sí».
 */
import { describe, expect, it } from 'vitest'
import {
  CASILLAS,
  construirEnvio,
  OPCIONES_ENCAJE,
  puedePedirSalud,
  VERSION_AUTORIZACION,
  type Borrador,
  type Casillas,
} from './formulario'

const CONTEXTO = {
  envioId: '00000000-0000-4000-8000-000000000001',
  codigo: 'PRUEBAC1',
  clienteId: null,
}

function completo(
  casillas: Partial<Record<string, string>> = { A: 'no', B: 'no', C: 'no', D: 'no' },
): Borrador {
  return {
    encaje: {
      p1Dias: '3',
      p1Horarios: 'cambian',
      p2Lugar: 'casa con equipo',
      p2Modalidad: 'en línea',
      p3Expectativa: 'constancia',
    },
    casillas,
    declaracion: true,
  }
}

describe('construirEnvio: solo opciones cerradas', () => {
  it('un envío completo pasa y lleva exactamente los códigos de opción', () => {
    const r = construirEnvio(completo(), CONTEXTO)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.envio.encaje).toEqual({
      p1Dias: '3',
      p1Horarios: 'cambian',
      p2Lugar: 'casa con equipo',
      p2Modalidad: 'en línea',
      p3Expectativa: 'constancia',
    })
    expect(r.envio.codigo).toBe('PRUEBAC1')
  })

  it('un valor fuera de las opciones (texto libre) se rechaza', () => {
    const b = completo()
    const r = construirEnvio(
      { ...b, encaje: { ...b.encaje, p3Expectativa: 'bajar 10 kilos en un mes' } },
      CONTEXTO,
    )
    expect(r).toMatchObject({ ok: false, rechazadas: ['p3Expectativa'] })
  })

  it('una clave de más (comentario, «otro») rechaza el envío entero, no se recorta', () => {
    const b = completo()
    const conComentario = { ...b, encaje: { ...b.encaje, comentario: 'algo más' } }
    expect(construirEnvio(conComentario, CONTEXTO)).toMatchObject({
      ok: false,
      rechazadas: ['encaje.comentario'],
    })
    const conOtro = { ...b, otro: 'cuál' } as unknown as Borrador
    expect(construirEnvio(conOtro, CONTEXTO)).toMatchObject({ ok: false, rechazadas: ['otro'] })
  })

  it('cada opción es un código corto de la lista de PREGUNTAS-ENCAJE, no un texto', () => {
    for (const opciones of Object.values(OPCIONES_ENCAJE)) {
      for (const o of opciones) expect(o.codigo).toMatch(/^[a-z0-9_ í]{1,30}$/)
    }
  })

  it('las cinco respuestas son obligatorias', () => {
    const r = construirEnvio({ ...completo(), encaje: {} }, CONTEXTO)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.faltan).toEqual(['p1Dias', 'p1Horarios', 'p2Lugar', 'p2Modalidad', 'p3Expectativa'])
  })
})

describe('construirEnvio: la autorización', () => {
  it('nada viene marcado: sin las cuatro casillas no se envía', () => {
    const r = construirEnvio(completo({}), CONTEXTO)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.faltan).toEqual(['casilla A', 'casilla B', 'casilla C', 'casilla D'])
  })

  it('una casilla solo admite «si» o «no»', () => {
    const r = construirEnvio(completo({ A: 'quizas', B: 'no', C: 'no', D: 'no' }), CONTEXTO)
    expect(r).toMatchObject({ ok: false, rechazadas: ['casilla A'] })
  })

  it('sin aceptar la declaración (mayor de 18, leyó el texto) no se envía', () => {
    const r = construirEnvio({ ...completo(), declaracion: false }, CONTEXTO)
    expect(r).toMatchObject({ ok: false, faltan: ['declaración'] })
  })

  it('la evidencia lleva la versión vigente del texto, el canal y cada casilla por separado', () => {
    const r = construirEnvio(completo({ A: 'si', B: 'no', C: 'si', D: 'no' }), CONTEXTO)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.envio.autorizacion).toEqual({
      version: VERSION_AUTORIZACION,
      canal: 'formulario',
      casillas: { A: 'si', B: 'no', C: 'si', D: 'no' },
      declaracionAceptada: true,
    })
    expect(VERSION_AUTORIZACION).toBe('0.3')
  })

  it('la casilla D lleva la redacción neutra exacta de la v0.3', () => {
    const d = CASILLAS.find((c) => c.letra === 'D')
    expect(d?.texto).toBe(
      'Para preparar y hacer seguimiento a tu plan usamos proveedores tecnológicos que procesan tus datos por encargo nuestro; algunos tienen sus servidores fuera de Colombia. ¿Lo autorizas?',
    )
    expect(d?.esDeSalud).toBe(false)
  })

  it('las casillas de salud (A, B, C) van separadas, una por finalidad', () => {
    expect(CASILLAS.filter((c) => c.esDeSalud).map((c) => c.letra)).toEqual(['A', 'B', 'C'])
  })
})

describe('salud: no se guarda ni se pide sin su casilla', () => {
  const CLAVES_DE_SALUD = [
    'lesiones', 'patologias', 'medicacion', 'alimentacion', 'medidas', 'fotos', 'peso',
  ]

  it('un dato de salud colado en el borrador rechaza el envío, marque lo que marque', () => {
    for (const casillas of [
      { A: 'no', B: 'no', C: 'no', D: 'no' },
      { A: 'si', B: 'si', C: 'si', D: 'si' },
    ]) {
      const b = completo(casillas)
      const conLesion = { ...b, encaje: { ...b.encaje, lesiones: 'rodilla' } }
      expect(construirEnvio(conLesion, CONTEXTO)).toMatchObject({
        ok: false,
        rechazadas: ['encaje.lesiones'],
      })
    }
  })

  it('el envío aceptado no lleva ninguna clave de salud, ni con todas las casillas en «sí»', () => {
    const r = construirEnvio(completo({ A: 'si', B: 'si', C: 'si', D: 'si' }), CONTEXTO)
    expect(r.ok).toBe(true)
    const texto = JSON.stringify(r)
    for (const clave of CLAVES_DE_SALUD) expect(texto).not.toContain(`"${clave}"`)
  })

  it('con las cuatro en «no», o sin autorización, no se puede pedir ningún dato de salud', () => {
    const todasNo: Casillas = { A: 'no', B: 'no', C: 'no', D: 'no' }
    const datos = ['lesiones', 'patologias', 'medicacion', 'alimentacion', 'medidas', 'fotos'] as const
    for (const dato of datos) {
      expect(puedePedirSalud(todasNo, dato)).toBe(false)
      expect(puedePedirSalud(undefined, dato)).toBe(false)
    }
  })

  it('cada casilla abre solo lo suyo, y la D no abre nada', () => {
    const soloA: Casillas = { A: 'si', B: 'no', C: 'no', D: 'si' }
    expect(puedePedirSalud(soloA, 'lesiones')).toBe(true)
    expect(puedePedirSalud(soloA, 'alimentacion')).toBe(false)
    expect(puedePedirSalud(soloA, 'fotos')).toBe(false)

    const soloC: Casillas = { A: 'no', B: 'no', C: 'si', D: 'no' }
    expect(puedePedirSalud(soloC, 'fotos')).toBe(true)
    expect(puedePedirSalud(soloC, 'medicacion')).toBe(false)

    const soloD: Casillas = { A: 'no', B: 'no', C: 'no', D: 'si' }
    expect(puedePedirSalud(soloD, 'lesiones')).toBe(false)
  })
})
