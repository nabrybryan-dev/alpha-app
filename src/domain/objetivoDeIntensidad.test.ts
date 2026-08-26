import { describe, expect, it } from 'vitest'
import {
  AL_FALLO,
  aflojar,
  esAlFallo,
  leerObjetivoDeIntensidad,
  rirDeTabla,
  textoDeObjetivo,
} from './objetivoDeIntensidad'
import { componerPrescripcion, parsearPrescripcion } from './prescripcion'
import { revisarAlineacion } from './alineacion'
import type { EjercicioPrescrito } from './types'

describe('el FALLO no es RIR 0', () => {
  it('son valores distintos y `esAlFallo` los separa', () => {
    expect(esAlFallo(AL_FALLO)).toBe(true)
    expect(esAlFallo(0)).toBe(false)
  })

  /**
   * La carga que va en la barra es la MISMA, y eso no es una concesión.
   *
   * La columna 0 de la tabla de coeficientes es «no queda otra repetición
   * completa», que es exactamente donde acaba la parte contada de una serie al
   * fallo. Lo que distingue al fallo pasa después, y son parciales: no se
   * cuentan como repeticiones, así que no mueven el peso.
   */
  it('para la tabla de %1RM el fallo entra por la columna 0', () => {
    expect(rirDeTabla(AL_FALLO)).toBe(0)
    expect(rirDeTabla(0)).toBe(0)
    expect(rirDeTabla(3)).toBe(3)
  })
})

describe('aflojar — la escalera tiene el fallo por encima de RIR 0', () => {
  it('un escalón desde el fallo deja RIR 0, no RIR 1', () => {
    expect(aflojar(AL_FALLO, 1)).toBe(0)
    expect(aflojar(AL_FALLO, 2)).toBe(1)
  })

  it('sin escalones que aflojar, el objetivo no se toca', () => {
    expect(aflojar(AL_FALLO, 0)).toBe(AL_FALLO)
    expect(aflojar(2, 0)).toBe(2)
  })

  it('desde un RIR numérico es la suma de siempre', () => {
    expect(aflojar(2, 1)).toBe(3)
    expect(aflojar(0, 2)).toBe(2)
  })

  /**
   * Este es el fallo que `aflojar` existe para impedir, y era silencioso.
   *
   * Antes la ondulación hacía `rirObjetivo + 1`. Sobre un ejercicio al fallo eso
   * era una suma sobre una palabra: en JavaScript `'FALLO' + 1` da la cadena
   * `'FALLO1'`, que ni es un RIR ni revienta — se cuela hasta la tabla, se acota
   * a la columna 0 y la carga sale como si nada hubiera pasado. El asesorado con
   * la readiness en rojo habría seguido pautado al fallo.
   */
  it('nunca devuelve algo que no sea un objetivo legible', () => {
    for (const escalones of [0, 1, 2, 3]) {
      const r = aflojar(AL_FALLO, escalones)
      expect(esAlFallo(r) || (typeof r === 'number' && Number.isInteger(r) && r >= 0)).toBe(true)
    }
  })
})

describe('leer la palabra: solo dentro del paréntesis de la cabecera', () => {
  it('reconoce los dos objetivos y solo esos dos', () => {
    expect(leerObjetivoDeIntensidad('RIR 2')).toBe(2)
    expect(leerObjetivoDeIntensidad('FALLO')).toBe(AL_FALLO)
    expect(leerObjetivoDeIntensidad('al fallo')).toBe(AL_FALLO)
  })

  it('lo que no es un objetivo se queda fuera, no se adivina', () => {
    expect(leerObjetivoDeIntensidad('RIR 2-3')).toBeUndefined()
    expect(leerObjetivoDeIntensidad('ISOMETRÍA')).toBeUndefined()
    expect(leerObjetivoDeIntensidad('CONTROL')).toBeUndefined()
    expect(leerObjetivoDeIntensidad('')).toBeUndefined()
  })

  /**
   * **El test que justifica que esto sea un campo y no una búsqueda de texto.**
   *
   * El 2026-08-25 se barrieron las 2.702 prescripciones de producción: la palabra
   * «fallo» salía en 81, y al mirarlas una a una la mayoría querían decir lo
   * contrario de una orden de llegar al fallo. Tres familias, por frecuencia:
   *
   *   1. **la negación** — «sin fallo», «lejos del fallo», «no se busca el fallo»;
   *   2. **el recuerdo** — «en M14 llegaste al fallo con este peso»;
   *   3. **la disculpa** — «es un fallo mío, no tuyo», que ni siquiera va de entrenar.
   *
   * Un detector por expresión regular sobre la frase habría leído «sin llegar al
   * fallo» como una orden de llegar al fallo, y en el corpus real esa frase estaba
   * en isométricas terapéuticas. Eso es rango 1 de la jerarquía: seguridad.
   *
   * Las frases de abajo son inventadas, con la forma de las reales: las de verdad
   * llevan dentro el rendimiento de personas concretas y no se copian aquí.
   */
  it('la nota del coach no declara nada, diga la palabra que diga', () => {
    const notas = [
      '3 SERIES DE 12 (RIR 3). LEJOS DEL FALLO SIEMPRE: ES MEDICINA, NO MÚSCULO.',
      '2 SERIES DE 20 SEGUNDOS. SIN LLEGAR AL FALLO: SI LA CADERA CAE, SE ACABÓ.',
      'AXIAL: TÉCNICA INTACHABLE, SIN FALLO.',
      'EL CLUSTER ES PARA CALIDAD, NO PARA FALLO.',
      'EL TEXTO TE PEDÍA UN PESO. ES UN FALLO MÍO, NO TUYO.',
    ]
    for (const nota of notas) {
      const leido = parsearPrescripcion(`40KG A 10 REPS; 3 SERIES (RIR 2). ${nota}`)
      expect(leido.rirObjetivo).toBe(2)
      expect(leido.notaCoach).toBe(nota)
    }
  })
})

const base: EjercicioPrescrito = {
  id: 'e1',
  categoria: 'EMPUJE HORIZONTAL',
  nombre: 'PRESS BANCA',
  cues: '',
  prescripcion: '',
  cargaKg: 40,
  descansoMin: 2,
  sets: 3,
  rango: '8-10',
  repsDiana: 10,
  rirObjetivo: 2,
  series: [],
}

describe('la frase se escribe desde el campo', () => {
  it('un objetivo al fallo se compone como (FALLO), no como (RIR 0)', () => {
    const frase = componerPrescripcion({ ...base, rirObjetivo: AL_FALLO })
    expect(frase).toBe('40KG A 10 REPS; 3 SERIES (FALLO).')
    expect(frase).not.toContain('RIR')
  })

  it('y se vuelve a leer como el mismo objetivo (ida y vuelta)', () => {
    const ejercicio: EjercicioPrescrito = { ...base, rirObjetivo: AL_FALLO }
    const leido = parsearPrescripcion(componerPrescripcion(ejercicio))
    expect(leido.rirObjetivo).toBe(AL_FALLO)
  })

  it('textoDeObjetivo dice cada cosa por su nombre', () => {
    expect(textoDeObjetivo(AL_FALLO)).toBe('FALLO')
    expect(textoDeObjetivo(0)).toBe('RIR 0')
  })
})

describe('la alineación denuncia el cruce entre los dos objetivos', () => {
  it('el campo dice FALLO y la frase anuncia un RIR: eso es un desajuste', () => {
    const desajustes = revisarAlineacion({
      ...base,
      rirObjetivo: AL_FALLO,
      prescripcion: '40KG A 10 REPS; 3 SERIES (RIR 0).',
    })
    expect(desajustes).toEqual([{ campo: 'rirObjetivo', enLaFrase: 0, enElCampo: AL_FALLO }])
  })

  it('el campo dice RIR 0 y la frase declara el FALLO: también', () => {
    const desajustes = revisarAlineacion({
      ...base,
      rirObjetivo: 0,
      prescripcion: '40KG A 10 REPS; 3 SERIES (FALLO).',
    })
    expect(desajustes).toEqual([{ campo: 'rirObjetivo', enLaFrase: AL_FALLO, enElCampo: 0 }])
  })

  it('cuando coinciden, no dice nada', () => {
    expect(
      revisarAlineacion({
        ...base,
        rirObjetivo: AL_FALLO,
        prescripcion: '40KG A 10 REPS; 3 SERIES (FALLO).',
      }),
    ).toEqual([])
  })
})
