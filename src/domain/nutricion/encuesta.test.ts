import { describe, expect, it } from 'vitest'
import {
  CAMPOS,
  camposAPreguntar,
  encuestaPendiente,
  generoDe,
  revisarRespuestas,
  tieneValor,
  type Respuestas,
} from './encuesta'

/** Lo que trae alguien que ya respondió la encuesta de captación. */
const CON_JSON: Respuestas = {
  genero: 'M',
  fechaNacimiento: '2004-05-06',
  pesoKg: 56,
  alturaCm: 170,
  cuelloCm: 32,
  cinturaCm: 68,
  caderaCm: 99,
  diasEntreno: 5,
  alergias: ['ninguna'],
  condicionesMedicas: ['ninguna'],
  excluye: ['nada'],
  comeVisceras: 'no',
  lugarCompra: 'supermercado',
  frecuenciaCocina: 'casi_siempre',
  tieneBascula: 'si',
  cicloMenstrual: 'irregular',
  noLeGustan: '-',
  sinAcceso: '-',
}

const claves = (respuestas: Respuestas) => camposAPreguntar(respuestas).map((c) => c.clave)

describe('camposAPreguntar', () => {
  it('a quien no sabemos nada, se le pregunta todo lo que aplica', () => {
    const pendientes = claves({ genero: 'H' })
    expect(pendientes).not.toContain('genero')
    expect(pendientes.length).toBeGreaterThan(10)
  })

  it('a quien llega con la encuesta de captación solo le falta lo que esa no trae', () => {
    // Es el objetivo de todo esto: no volver a preguntar lo que ya contestó.
    //
    // Eran los pasos y solo los pasos hasta el 2026-08-09, cuando se añadió la
    // del embarazo: la encuesta de captación tampoco la trae, así que hay dos.
    // Si esta lista crece sin motivo, es que alguien metió una pregunta que ya
    // estaba contestada en otro sitio.
    expect(claves(CON_JSON)).toEqual(['pasosDiarios', 'embarazo'])
  })

  it('los pasos son justo lo que la encuesta de captación no trae', () => {
    expect(CAMPOS.find((c) => c.clave === 'pasosDiarios')?.obligatorio).toBe(true)
  })

  describe('lo que solo aplica a algunas personas', () => {
    it('a un hombre no se le pide la cadera: su fórmula no la usa', () => {
      expect(claves({ genero: 'H' })).not.toContain('caderaCm')
    })

    it('a una mujer sí', () => {
      expect(claves({ genero: 'M' })).toContain('caderaCm')
    })

    it('el ciclo menstrual solo se pregunta a mujeres', () => {
      expect(claves({ genero: 'H' })).not.toContain('cicloMenstrual')
      expect(claves({ genero: 'M' })).toContain('cicloMenstrual')
    })

    it('el embarazo solo se pregunta a mujeres', () => {
      expect(claves({ genero: 'H' })).not.toContain('embarazo')
      expect(claves({ genero: 'M' })).toContain('embarazo')
    })

    it('la fecha de parto NO se pregunta hasta que diga que está embarazada', () => {
      // Pedirle a todo el mundo una fecha probable de parto es la clase de
      // pregunta que hace abandonar una encuesta.
      expect(claves({ genero: 'M' })).not.toContain('fechaProbableParto')
      expect(claves({ genero: 'M', embarazo: 'no' })).not.toContain('fechaProbableParto')
      expect(claves({ genero: 'M', embarazo: 'lactancia' })).not.toContain('fechaProbableParto')
    })

    it('y sí en cuanto lo diga', () => {
      expect(claves({ genero: 'M', embarazo: 'si' })).toContain('fechaProbableParto')
    })

    it('la fecha de parto no es obligatoria', () => {
      // Quien no la sepa o no la quiera dar tiene que poder seguir. Sin fecha
      // la marca vale igual, solo que no caduca sola —ver `embarazo.ts`—.
      expect(CAMPOS.find((c) => c.clave === 'fechaProbableParto')?.obligatorio).toBeFalsy()
    })

    it('sin saber el género todavía, no se pregunta lo que depende de él', () => {
      // Aparecerán en cuanto conteste la primera pregunta.
      const pendientes = claves({})
      expect(pendientes).toContain('genero')
      expect(pendientes).not.toContain('caderaCm')
    })

    it('lo contestado en la sesión ya cuenta para decidir qué falta', () => {
      // Marca "Mujer" y la cadera aparece sin recargar nada.
      const conGenero = camposAPreguntar({}, { genero: 'M' }).map((c) => c.clave)
      expect(conGenero).toContain('caderaCm')
    })
  })

  it('un dato vacío NO cuenta como sabido', () => {
    expect(claves({ ...CON_JSON, pesoKg: undefined })).toContain('pesoKg')
  })

  it('una lista vacía tampoco', () => {
    expect(claves({ ...CON_JSON, alergias: [] })).toContain('alergias')
  })
})

describe('tieneValor', () => {
  it('un cero SÍ es una respuesta', () => {
    // "Entreno 0 días" es un dato, no un hueco. Tratarlo como vacío obligaría a
    // mentir a quien no entrena esta semana.
    expect(tieneValor(0)).toBe(true)
  })

  it('el texto en blanco no', () => {
    expect(tieneValor('   ')).toBe(false)
  })

  it('un número que no es número, tampoco', () => {
    expect(tieneValor(Number.NaN)).toBe(false)
  })
})

describe('revisarRespuestas', () => {
  const campos = camposAPreguntar({ genero: 'H' })

  it('sin responder lo obligatorio, no deja seguir', () => {
    const errores = revisarRespuestas(campos, {})
    expect(errores.length).toBeGreaterThan(0)
    expect(errores.every((e) => e.mensaje === 'Falta responder')).toBe(true)
  })

  it('lo opcional en blanco no estorba', () => {
    const soloTexto = CAMPOS.filter((c) => c.clave === 'noLeGustan')
    expect(revisarRespuestas(soloTexto, {})).toEqual([])
  })

  describe('los rangos', () => {
    const peso = CAMPOS.filter((c) => c.clave === 'pesoKg')

    it('rechazan el error de dedo', () => {
      // Un 6 donde iban 56: de ahí sale un porcentaje de grasa que después
      // alguien lee como si lo hubieran medido.
      expect(revisarRespuestas(peso, { pesoKg: 6 })).toHaveLength(1)
    })

    it('pero NO rechazan personas', () => {
      expect(revisarRespuestas(peso, { pesoKg: 45 })).toEqual([])
      expect(revisarRespuestas(peso, { pesoKg: 180 })).toEqual([])
    })

    it('dicen cuál es el límite, no solo que está mal', () => {
      expect(revisarRespuestas(peso, { pesoKg: 500 })[0].mensaje).toMatch(/300/)
    })
  })

  it('una opción inventada no pasa', () => {
    const bascula = CAMPOS.filter((c) => c.clave === 'tieneBascula')
    expect(revisarRespuestas(bascula, { tieneBascula: 'quiza' })).toHaveLength(1)
  })

  it('con todo respondido no hay nada que corregir', () => {
    expect(revisarRespuestas(camposAPreguntar(CON_JSON), { pasosDiarios: 9000 })).toEqual([])
  })
})

describe('generoDe', () => {
  it('devuelve el que las fórmulas esperan', () => {
    expect(generoDe({ genero: 'M' })).toBe('M')
  })

  it('cualquier otra cosa es null, no un casteo optimista', () => {
    // Un género mal escrito aplicaría la fórmula equivocada y daría un
    // porcentaje creíble pero falso, que es peor que no dar ninguno.
    expect(generoDe({ genero: 'Femenino' })).toBeNull()
    expect(generoDe({})).toBeNull()
  })
})

describe('encuestaPendiente', () => {
  it('está pendiente mientras no se haya marcado como terminada', () => {
    expect(encuestaPendiente(undefined)).toBe(true)
    expect(encuestaPendiente({ respuestas: {}, completadaEn: undefined })).toBe(true)
  })

  it('sigue pendiente si se marcó terminada pero falta algo obligatorio', () => {
    expect(encuestaPendiente({ respuestas: {}, completadaEn: '2026-08-02' })).toBe(true)
  })

  it('deja de estar pendiente cuando está terminada y completa', () => {
    const completas = Object.fromEntries(
      CAMPOS.filter((c) => c.obligatorio).map((c) => [
        c.clave,
        c.tipo === 'numero' ? 10 : c.tipo === 'multiple' ? ['x'] : 'x',
      ]),
    )
    expect(encuestaPendiente({ respuestas: completas, completadaEn: '2026-08-02' })).toBe(false)
  })
})
