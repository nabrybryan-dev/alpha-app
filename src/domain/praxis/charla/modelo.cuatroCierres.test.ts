import { describe, expect, it } from 'vitest'
import { leerRespuestaCharla } from './modelo'

const charla = { apertura: null, nombre: null }

describe('privacidad de la respuesta del modelo', () => {
  it.each(['Tranquilo, aquí no queda nada guardado.', 'Puedes ensayar: esto no guarda nada.', 'Nunca almacenamos ningún dato.'])('sustituye la promesa absoluta «%s»', (texto) => {
    const r = leerRespuestaCharla({ respuesta_charla: texto }, charla)
    expect(r).not.toBeNull()
    expect(r).not.toBe(texto)
    expect(r).toMatch(/tarjeta|confirma|Guardar/)
    expect(r).not.toMatch(/no (?:queda|guarda) nada/)
  })
  it('una promesa falsa no permite saltarse el bloqueo de dosis', () => {
    expect(leerRespuestaCharla({ respuesta_charla: 'Toma 20 mg, esto no guarda nada.' }, charla)).toBeNull()
  })
})
