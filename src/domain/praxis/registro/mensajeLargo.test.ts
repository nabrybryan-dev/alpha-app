// @vitest-environment node
/**
 * Mensaje largo → áreas del check-in.
 *
 * ESCRITOS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO (regla del 5-nov-2026:
 * el texto escrito por Claude no entra al corpus de entrenamiento). Inventados, sin nombres ni
 * datos de nadie.
 */
import { describe, expect, it } from 'vitest'
import { proponerDesdeMensajeLargo, trozosDeMensaje, type ResultadoMensajeLargo } from './mensajeLargo.ts'

function propuesta(texto: string) {
  const r: ResultadoMensajeLargo = proponerDesdeMensajeLargo(texto)
  if (r.tipo !== 'propuesta') throw new Error('se esperaba propuesta, salió riesgo')
  return r
}
const valor = (texto: string, campo: string) => propuesta(texto).propuestas.find((p) => p.campo === campo)

describe('mensaje largo: casos que sí se convierten', () => {
  it('M01 sueño, estrés y comida con su cita literal', () => {
    const t = 'Dormí fatal, ando súper estresada con el trabajo, comí bien pero me dio mucha hambre en la tarde'
    const r = propuesta(t)
    expect(valor(t, 'calidadSueno')).toMatchObject({ valor: 'MALA', cita: 'Dormí fatal' })
    expect(valor(t, 'estres')).toMatchObject({ valor: 'MUCHO', cita: 'ando súper estresada con el trabajo' })
    expect(valor(t, 'alimentacion')).toMatchObject({ valor: 'BUENA', cita: 'comí bien' })
    // «mucha hambre» no es un número: no hay hambreEscala.
    expect(r.propuestas.find((p) => p.campo === 'hambreEscala')).toBeUndefined()
    expect(r.descartado.some((d) => d.area === 'hambre')).toBe(true)
    // Toda cita es literal del texto.
    for (const p of r.propuestas) expect(t).toContain(p.cita)
  })

  it('M02 horas de sueño con «y media» y hambre con número', () => {
    const t = 'Anoche dormí siete horas y media. Hoy el hambre estuvo en 8 todo el día.'
    expect(valor(t, 'horasSueno')).toMatchObject({ valor: 7.5 })
    expect(valor(t, 'hambreEscala')).toMatchObject({ valor: 8 })
  })

  it('M03 energía alta (poco cansancio) y entreno bueno', () => {
    const t = 'Amanecí con mucha energía, el entreno me fue bien y estoy tranquila con todo'
    expect(valor(t, 'cansancio')).toMatchObject({ valor: 'POCO' })
    expect(valor(t, 'rendimiento')).toMatchObject({ valor: 'BUENA' })
    expect(valor(t, 'estres')).toMatchObject({ valor: 'POCO' })
  })

  it('M04 agotada y sin ganas de entrenar: motivación POCO, no ánimo ni rendimiento', () => {
    const t = 'Estoy agotada, sin ganas de entrenar hoy'
    expect(valor(t, 'cansancio')).toMatchObject({ valor: 'MUCHO' })
    expect(valor(t, 'motivacion')).toMatchObject({ valor: 'POCO', cita: 'sin ganas de entrenar hoy' })
    expect(valor(t, 'rendimiento')).toBeUndefined()
  })

  it('M05 ánimo: el check-in no tiene ese campo, queda descartado', () => {
    const t = 'Hoy estoy contenta y dormí normal'
    const r = propuesta(t)
    expect(r.descartado.find((d) => d.area === 'ánimo')?.motivo).toMatch(/no tiene campo de ánimo/)
    expect(valor(t, 'calidadSueno')).toMatchObject({ valor: 'REGULAR' })
  })

  it('M06 no dormí mal es REGULAR, no BUENA', () => {
    expect(valor('No dormí mal, la verdad', 'calidadSueno')).toMatchObject({ valor: 'REGULAR' })
  })

  it('M07 «no me duele nada» es un cero medido de dolor', () => {
    const t = 'Hoy no me duele nada y comí mal'
    expect(valor(t, 'dolor')).toMatchObject({ valor: 0 })
    expect(valor(t, 'alimentacion')).toMatchObject({ valor: 'MALA' })
  })
})

describe('mensaje largo: trampas', () => {
  it('T01 riesgo dentro: no se extrae nada', () => {
    const r = proponerDesdeMensajeLargo('Dormí fatal, estoy estresada y la verdad no quiero vivir, comí bien')
    expect(r.tipo).toBe('riesgo')
    expect(r).not.toHaveProperty('propuestas')
  })

  it('T02 dolor con síntoma: nada se extrae por esta vía y el dolor nunca se escribe', () => {
    const t = 'Dormí mal y me duele mucho la rodilla desde el entreno'
    const r = proponerDesdeMensajeLargo(t)
    if (r.tipo === 'propuesta') {
      expect(r.propuestas.find((p) => p.campo === 'dolor')).toBeUndefined()
      expect(r.descartado.some((d) => d.area === 'dolor')).toBe(true)
    } else expect(r.tipo).toBe('riesgo') // el filtro clínico lo tomó primero
  })

  it('T03 contradicción: estrés dicho dos veces con valores distintos queda dudoso', () => {
    const t = 'Estoy súper estresada con el trabajo, aunque la verdad estoy tranquila'
    const r = propuesta(t)
    expect(r.propuestas.find((p) => p.campo === 'estres')).toBeUndefined()
    expect(r.dudosas[0]).toMatchObject({ campo: 'estres' })
    expect(r.dudosas[0].candidatos.map((c) => c.valor).sort()).toEqual(['MUCHO', 'POCO'])
  })

  it('T04 negación fuera de tabla no se invierte', () => {
    const t = 'No estoy estresada, no comí bien'
    const r = propuesta(t)
    expect(r.propuestas).toEqual([])
    expect(r.descartado.length).toBe(2)
  })

  it('T05 palabra fuera de tabla: «súper pesado» no se vuelve BUENA por el «súper»', () => {
    const t = 'El entreno lo sentí súper pesado'
    const r = propuesta(t)
    expect(r.propuestas.find((p) => p.campo === 'rendimiento')).toBeUndefined()
    expect(r.descartado[0].motivo).toMatch(/pesado/)
  })

  it('T06 hambre sin número: no hay valor y se deja el motivo', () => {
    const r = propuesta('Tuve bastante hambre toda la tarde')
    expect(r.propuestas).toEqual([])
    expect(r.descartado[0].motivo).toMatch(/no es un número/)
  })

  it('T07 lo no dicho queda ausente: sin el 7 por defecto', () => {
    const r = propuesta('Hoy fue un día normal, nada especial')
    expect(r.propuestas).toEqual([])
  })

  it('T08 muerta de hambre no es cansancio', () => {
    const r = propuesta('Estoy muerta de hambre en 9')
    expect(r.propuestas.find((p) => p.campo === 'cansancio')).toBeUndefined()
    expect(valor('Estoy muerta de hambre en 9', 'hambreEscala')).toMatchObject({ valor: 9 })
  })

  it('T09 el mensaje largo completo, todas las áreas', () => {
    const t = 'Dormí 6 horas, dormí regular. Ando estresada, estoy rendida. Comí mal, me pasé con los dulces. En el gym me fue bien, con ganas de entrenar mañana.'
    const r = propuesta(t)
    expect(valor(t, 'horasSueno')).toMatchObject({ valor: 6 })
    expect(valor(t, 'estres')).toMatchObject({ valor: 'MUCHO' })
    expect(valor(t, 'cansancio')).toMatchObject({ valor: 'MUCHO' })
    expect(valor(t, 'alimentacion')).toMatchObject({ valor: 'MALA' })
    expect(valor(t, 'rendimiento')).toMatchObject({ valor: 'BUENA' })
    for (const p of r.propuestas) expect(t).toContain(p.cita)
  })

  it('T10 molestia leve: si pasa el filtro, el dolor no se escribe y queda el motivo', () => {
    const r = proponerDesdeMensajeLargo('Dormí normal y me molesta un poco el hombro')
    if (r.tipo === 'propuesta') {
      expect(r.propuestas.find((p) => p.campo === 'dolor')).toBeUndefined()
      expect(r.descartado.some((d) => d.area === 'dolor')).toBe(true)
    } else expect(r.tipo).toBe('riesgo')
  })

  it('T11 tres áreas con "cuenta de uno": horas con número y cita literal', () => {
    const t = 'Dormí 5 horas, estoy rendida y sin estrés'
    expect(valor(t, 'horasSueno')).toMatchObject({ valor: 5, cita: 'Dormí 5 horas' })
    expect(valor(t, 'cansancio')).toMatchObject({ valor: 'MUCHO' })
    expect(valor(t, 'estres')).toMatchObject({ valor: 'POCO' })
  })

  it('trozosDeMensaje no parte «siete horas y media»', () => {
    expect(trozosDeMensaje('dormí siete horas y media, bien')).toEqual(['dormí siete horas y media', 'bien'])
  })
})
