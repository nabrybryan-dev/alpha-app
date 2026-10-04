/**
 * Las garantías del formulario de interesados que no dependen de la pantalla:
 *   - solo opciones cerradas: un valor fuera de las opciones o una clave de más
 *     (comentario, «otro, ¿cuál?», una lesión) rechaza el envío entero;
 *   - las cinco casillas (A–E) se marcan «sí» o «no» y la declaración se acepta: nada
 *     viene marcado y el silencio no autoriza;
 *   - ningún dato de salud viaja en el envío, y solo se puede PEDIR después si la casilla
 *     que lo cubre está en «sí».
 */
import { describe, expect, it } from 'vitest'
import {
  ALCANCE_CASILLA_E,
  CASILLAS,
  construirEnvio,
  DATOS_CASILLA_E,
  OPCIONES_ENCAJE,
  puedePedirSalud,
  TEXTO_CASILLA_E,
  VERSION_AUTORIZACION,
  type Borrador,
  type Casillas,
  type DatoDeSalud,
} from './formulario'

const CONTEXTO = {
  envioId: '00000000-0000-4000-8000-000000000001',
  codigo: 'PRUEBAC1',
  clienteId: null,
}

function completo(
  casillas: Partial<Record<string, string>> = { A: 'no', B: 'no', C: 'no', D: 'no', E: 'no' },
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
  it('nada viene marcado: sin las cinco casillas no se envía', () => {
    const r = construirEnvio(completo({}), CONTEXTO)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.faltan).toEqual(['casilla A', 'casilla B', 'casilla C', 'casilla D', 'casilla E'])
  })

  it('la casilla E es obligatoria de contestar (sí o no): con las otras cuatro no basta', () => {
    const r = construirEnvio(completo({ A: 'no', B: 'no', C: 'no', D: 'no' }), CONTEXTO)
    expect(r).toMatchObject({ ok: false, faltan: ['casilla E'] })
  })

  it('una casilla solo admite «si» o «no»', () => {
    const r = construirEnvio(completo({ A: 'quizas', B: 'no', C: 'no', D: 'no', E: 'no' }), CONTEXTO)
    expect(r).toMatchObject({ ok: false, rechazadas: ['casilla A'] })
    expect(construirEnvio(completo({ A: 'no', B: 'no', C: 'no', D: 'no', E: 'true' }), CONTEXTO)).toMatchObject({
      ok: false,
      rechazadas: ['casilla E'],
    })
  })

  it('sin aceptar la declaración (mayor de 18, leyó el texto) no se envía', () => {
    const r = construirEnvio({ ...completo(), declaracion: false }, CONTEXTO)
    expect(r).toMatchObject({ ok: false, faltan: ['declaración'] })
  })

  it('la evidencia lleva la versión vigente del texto, el canal y cada casilla por separado', () => {
    const r = construirEnvio(completo({ A: 'si', B: 'no', C: 'si', D: 'no', E: 'si' }), CONTEXTO)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.envio.autorizacion).toEqual({
      version: VERSION_AUTORIZACION,
      canal: 'formulario',
      casillas: { A: 'si', B: 'no', C: 'si', D: 'no', E: 'si' },
      declaracionAceptada: true,
    })
    expect(VERSION_AUTORIZACION).toBe('0.4')
  })

  it('la casilla D lleva la redacción neutra exacta (la de la v0.3, sin cambios en la v0.4)', () => {
    const d = CASILLAS.find((c) => c.letra === 'D')
    expect(d?.texto).toBe(
      'Para preparar y hacer seguimiento a tu plan usamos proveedores tecnológicos que procesan tus datos por encargo nuestro; algunos tienen sus servidores fuera de Colombia. ¿Lo autorizas?',
    )
    expect(d?.esDeSalud).toBe(false)
  })

  it('las casillas de salud (A, B, C, E) van separadas, una por finalidad', () => {
    expect(CASILLAS.map((c) => c.letra)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(CASILLAS.filter((c) => c.esDeSalud).map((c) => c.letra)).toEqual(['A', 'B', 'C', 'E'])
  })
})

describe('la casilla E (v0.4): los seis datos del teléfono', () => {
  const E = CASILLAS.find((c) => c.letra === 'E')

  it('es una sola casilla, de salud, con su texto y su alcance a la vista', () => {
    expect(E).toBeDefined()
    expect(E?.esDeSalud).toBe(true)
    expect(E?.texto).toBe(TEXTO_CASILLA_E)
    expect(E?.alcance).toBe(ALCANCE_CASILLA_E)
  })

  it('nombra los seis datos, uno por uno, y ninguno más', () => {
    expect(DATOS_CASILLA_E).toEqual([
      'pasos',
      'sueño',
      'frecuencia cardiaca en reposo',
      'variabilidad de la frecuencia cardiaca',
      'minutos de ejercicio',
      'peso',
    ])
    for (const dato of DATOS_CASILLA_E) expect(TEXTO_CASILLA_E).toContain(dato)
  })

  it('está escrita en español, dice para qué se usa y no promete lo que no hace', () => {
    expect(TEXTO_CASILLA_E).toMatch(/^Leer desde mi teléfono/)
    expect(TEXTO_CASILLA_E).toMatch(/para que Alpha y mi coach ajusten/)
    // El alcance dice lo esencial de la Ley 1581: minimización, quién ve, voluntario y revocable.
    expect(ALCANCE_CASILLA_E).toMatch(/resumen por día/)
    expect(ALCANCE_CASILLA_E).toMatch(/nunca tu ubicación/)
    expect(ALCANCE_CASILLA_E).toMatch(/voluntario/)
    expect(ALCANCE_CASILLA_E).toMatch(/revocarla cuando quieras/)
    expect(ALCANCE_CASILLA_E).toMatch(/borramos lo que ya enviaste/)
    expect(ALCANCE_CASILLA_E).toMatch(/la D/)
  })
})

describe('salud: no se guarda ni se pide sin su casilla', () => {
  const CLAVES_DE_SALUD = [
    'lesiones', 'patologias', 'medicacion', 'alimentacion', 'medidas', 'fotos', 'peso',
    'pasos', 'sueno', 'fc_reposo', 'vfc', 'minutos_ejercicio',
  ]

  it('un dato de salud colado en el borrador rechaza el envío, marque lo que marque', () => {
    for (const casillas of [
      { A: 'no', B: 'no', C: 'no', D: 'no', E: 'no' },
      { A: 'si', B: 'si', C: 'si', D: 'si', E: 'si' },
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
    const r = construirEnvio(completo({ A: 'si', B: 'si', C: 'si', D: 'si', E: 'si' }), CONTEXTO)
    expect(r.ok).toBe(true)
    const texto = JSON.stringify(r)
    for (const clave of CLAVES_DE_SALUD) expect(texto).not.toContain(`"${clave}"`)
  })

  it('con las cinco en «no», o sin autorización, no se puede pedir ningún dato de salud', () => {
    const todasNo: Casillas = { A: 'no', B: 'no', C: 'no', D: 'no', E: 'no' }
    const datos = [
      'lesiones', 'patologias', 'medicacion', 'alimentacion', 'medidas', 'fotos',
      'pasos', 'sueno', 'fc_reposo', 'vfc', 'minutos_ejercicio', 'peso',
    ] as const
    for (const dato of datos) {
      expect(puedePedirSalud(todasNo, dato)).toBe(false)
      expect(puedePedirSalud(undefined, dato)).toBe(false)
    }
  })

  it('cada casilla abre solo lo suyo, y la D no abre nada', () => {
    const soloA: Casillas = { A: 'si', B: 'no', C: 'no', D: 'si', E: 'no' }
    expect(puedePedirSalud(soloA, 'lesiones')).toBe(true)
    expect(puedePedirSalud(soloA, 'alimentacion')).toBe(false)
    expect(puedePedirSalud(soloA, 'fotos')).toBe(false)

    const soloC: Casillas = { A: 'no', B: 'no', C: 'si', D: 'no', E: 'no' }
    expect(puedePedirSalud(soloC, 'fotos')).toBe(true)
    expect(puedePedirSalud(soloC, 'medicacion')).toBe(false)

    const soloD: Casillas = { A: 'no', B: 'no', C: 'no', D: 'si', E: 'no' }
    expect(puedePedirSalud(soloD, 'lesiones')).toBe(false)
    expect(puedePedirSalud(soloD, 'pasos')).toBe(false)
  })

  it('la E abre los seis datos del teléfono y NADA más; ninguna otra los abre', () => {
    const seis: DatoDeSalud[] = ['pasos', 'sueno', 'fc_reposo', 'vfc', 'minutos_ejercicio', 'peso']
    const otros: DatoDeSalud[] = ['lesiones', 'patologias', 'medicacion', 'alimentacion', 'medidas', 'fotos']
    const soloE: Casillas = { A: 'no', B: 'no', C: 'no', D: 'no', E: 'si' }
    for (const dato of seis) expect(puedePedirSalud(soloE, dato), dato).toBe(true)
    for (const dato of otros) expect(puedePedirSalud(soloE, dato), dato).toBe(false)

    // A, B, C y D en «sí» con la E en «no»: los seis datos del teléfono siguen cerrados.
    const todasMenosE: Casillas = { A: 'si', B: 'si', C: 'si', D: 'si', E: 'no' }
    for (const dato of seis) expect(puedePedirSalud(todasMenosE, dato), dato).toBe(false)
  })
})
