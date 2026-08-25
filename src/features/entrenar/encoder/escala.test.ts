import { describe, expect, it } from 'vitest'
import type { ResultadoSerie } from './nucleo/analisis'
import { avisoDeEscala, revisarEscala } from './escala'

/* El error de escala es el único que no deja rastro: elegir el disco que no es
 * desvía TODAS las velocidades por el mismo factor, la serie sale limpia y la
 * calidad sale buena. El %PV tampoco se entera, porque es un cociente entre dos
 * velocidades medidas con la misma regla equivocada.
 *
 * Lo único que chirría es el recorrido. `romPlausible` lleva la tabla desde el
 * principio en `nucleo/disco.js` y no la llamaba nadie. */

function serie(roms: number[], hayEscala = true): ResultadoSerie {
  return {
    ok: true,
    unidad: hayEscala ? 'm/s' : 'px/s',
    hayEscala,
    fpsReal: 60,
    deteccion: 1,
    sepPxMediana: 110,
    escalaPxM: 244,
    conDiana: false,
    inclinacionGrados: NaN,
    inclinacionMax: NaN,
    anguloMediana: 2,
    // El fixture completo de Repeticion: `revisarEscala` solo mira `rom`, pero el
    // tipo es el que devuelve el nucleo y rellenarlo entero evita que un campo
    // nuevo del nucleo pase inadvertido aqui.
    reps: roms.map((rom, i) => ({
      n: i + 1,
      iInicio: i * 10,
      iFin: i * 10 + 9,
      rom,
      concSeg: 0.8,
      vMedia: 0.6,
      vMediaCompleta: 0.55,
      vPico: 0.9,
      vPicoCrudo: 0.88,
      picoRecuperado: 0.02,
    })),
    vPrimera: 0.6,
    vUltima: 0.5,
    pvPct: 16,
    concSegMedia: 0.8,
    romRelativo: 1,
    compensacion: NaN,
    ie: 9.6,
    coberturaDisco: NaN,
    calidad: { nivel: 'buena', motivos: [] },
    serie: { t: [], s: [], v: [] },
  }
}

describe('revisarEscala', () => {
  it('sin escala dice «no lo se», que no es lo mismo que decir que esta bien', () => {
    // En pixeles el recorrido no son metros, y compararlo con la tabla seria
    // inventarse un veredicto. `null` y no `{ ok: true }`: la diferencia importa.
    expect(revisarEscala(serie([0.55], false), 'sentadilla')).toBeNull()
  })

  it('un recorrido normal de sentadilla pasa', () => {
    const r = revisarEscala(serie([0.52, 0.55, 0.54]), 'sentadilla')!
    expect(r.ok).toBe(true)
    expect(r.romM).toBeCloseTo(0.54, 2)
    expect(r.clave).toBe('sentadilla')
  })

  it('una sentadilla de metro y medio delata el disco mal elegido', () => {
    const r = revisarEscala(serie([1.45, 1.5, 1.48]), 'sentadilla')!
    expect(r.ok).toBe(false)
    expect(r.clave).toBe('sentadilla')
  })

  it('el press banca tiene su propio rango, y 55 cm ahi ya no cuela', () => {
    // 0,60 m es normal en sentadilla y no existe en press banca. Si la tabla se
    // aplicara plana, este caso pasaria — y es el que mas se va a dar, porque el
    // press se mide con el mismo disco que la sentadilla.
    expect(revisarEscala(serie([0.6]), 'sentadilla')!.ok).toBe(true)
    expect(revisarEscala(serie([0.6]), 'press banca')!.ok).toBe(false)
  })

  it('un ejercicio que no esta en la tabla cae en generico, no se salta la reja', () => {
    const r = revisarEscala(serie([2.4]), 'zancada bulgara con mancuernas')!
    expect(r.clave).toBe('generico')
    expect(r.ok).toBe(false)
  })

  it('manda la MEDIANA: una primera repeticion corta no condena la toma', () => {
    // La primera suele ser corta —se coloca, tantea— y la ultima bajo fatiga
    // tambien. Ninguna de las dos puntas puede decidir que el disco esta mal.
    const r = revisarEscala(serie([0.08, 0.55, 0.56, 0.54, 0.05]), 'sentadilla')!
    expect(r.ok).toBe(true)
    expect(r.romM).toBeCloseTo(0.54, 2)
  })

  it('una serie sin repeticiones no se juzga', () => {
    expect(revisarEscala(serie([]), 'sentadilla')).toBeNull()
  })
})

describe('avisoDeEscala', () => {
  it('cuando cuadra no dice nada', () => {
    expect(avisoDeEscala(revisarEscala(serie([0.55]), 'sentadilla'))).toBeNull()
    expect(avisoDeEscala(null)).toBeNull()
  })

  it('lleva el numero medido y el ejercicio, que es lo unico accionable', () => {
    // Es la leccion del #88: «no cuadra» no distingue entre el disco mal
    // elegido y el ejercicio mal escrito, y son dos arreglos distintos.
    const aviso = avisoDeEscala(revisarEscala(serie([1.45]), 'sentadilla'))!
    expect(aviso).toContain('145 cm')
    expect(aviso).toContain('sentadilla')
    expect(aviso).toMatch(/disco/i)
  })
})
