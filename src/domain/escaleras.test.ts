import { describe, expect, it } from 'vitest'
import { aplicarEscenario, escenarioDelDia } from './bucleDelDia'
import { derivarEscaleras, POLITICA_DEL_COACH } from './escaleras'
import { coeficiente1rm } from './ondulacion'
import type { EjercicioPrescrito } from './types'

/**
 * Las escaleras salen de los números del coach, no de un porcentaje a ojo.
 *
 * Lo que se defiende aquí, en orden de importancia:
 *
 * 1. **El techo es el extremo duro del rango que él escribió.** Si dice «8-10 @
 *    RIR 2», hacer 8 al mismo RIR es más carga y sigue dentro de lo prescrito.
 *    Ese es el techo, y el bucle no lo pasa nunca.
 * 2. **Cuando no hay margen, no hay escalera** — y se dice por qué. Una diana
 *    que ya está en el extremo duro no tiene nada autorizado por encima: eso lo
 *    reescribe el coach, no se lo salta el bucle.
 * 3. **Sin suelo de RIR no hay rojo** (I-13). Aflojar sin saber hasta dónde es
 *    el cheque en blanco que el techo evita en el otro lado.
 * 4. Y el remate: con las escaleras puestas, el bucle **deja de estar bloqueado**
 *    y propone algo. Sin ellas propone nada, que es la foto de producción hoy.
 */

function ej(over: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'ej-1', categoria: 'SENTADILLA', nombre: 'Sentadilla', cues: '', prescripcion: '',
    descansoMin: 2, sets: 3, rango: '8-10', repsDiana: 10, rirObjetivo: 2, cargaKg: 100,
    series: [], ...over,
  }
}

const COACH = { deltaRir: 1, sueloRir: 3, quitarUltimaSerie: false }

describe('el techo sale del rango, no de un porcentaje', () => {
  it('el techo es la carga del extremo duro del rango, al mismo RIR', () => {
    const e = ej()
    const { escenarios } = derivarEscaleras(e, COACH)
    // 100 kg a 10 reps @ RIR 2 → la carga a 8 reps @ RIR 2, por la misma tabla
    // de coeficientes que ya escribe las prescripciones de la casa.
    const esperado = Math.round(((100 * coeficiente1rm(8, 2)) / coeficiente1rm(10, 2)) / 2.5) * 2.5
    expect(escenarios?.verde.techoCargaKg).toBe(esperado)
    expect(escenarios!.verde.techoCargaKg).toBeGreaterThan(100)
  })

  it('el escalón es UN peldaño del rango, no el salto entero al techo', () => {
    const { escenarios } = derivarEscaleras(ej(), COACH)
    expect(escenarios!.verde.deltaCargaKg).toBeLessThan(
      escenarios!.verde.techoCargaKg - 100,
    )
    expect(escenarios!.verde.deltaCargaKg).toBeGreaterThan(0)
  })

  /**
   * Yo di por hecho lo contrario y el test me corrigió: pensé que un RIR más
   * exigente daría MÁS margen. Da menos, y la tabla lo dice claro — la razón
   * entre el coeficiente de 8 reps y el de 10 baja según se acerca el fallo:
   * 1,1207 a RIR 3 · 1,1138 a RIR 2 · 1,1085 a RIR 1 · 1,1029 a RIR 0.
   *
   * O sea que **cuanto más cerca del fallo está la prescripción, menos margen
   * deja el techo**, que es la dirección correcta para una puerta de seguridad y
   * no hubo que ponerla a mano: sale de la tabla que ya escribe las cargas.
   */
  it('cuanto más cerca del fallo, MENOS margen deja el techo', () => {
    const suave = derivarEscaleras(ej({ rirObjetivo: 3 }), COACH).escenarios!.verde.techoCargaKg
    const medio = derivarEscaleras(ej({ rirObjetivo: 2 }), COACH).escenarios!.verde.techoCargaKg
    const duro = derivarEscaleras(ej({ rirObjetivo: 1 }), COACH).escenarios!.verde.techoCargaKg
    expect(suave).toBeGreaterThanOrEqual(medio)
    expect(medio).toBeGreaterThanOrEqual(duro)
    expect(duro).toBeGreaterThan(100)
  })
})

describe('cuando NO hay escalera, se dice por qué', () => {
  it('la diana ya en el extremo duro del rango: no queda margen autorizado', () => {
    const r = derivarEscaleras(ej({ repsDiana: 8 }), COACH)
    expect(r.escenarios).toBeUndefined()
    expect(r.faltan.join(' ')).toContain('extremo duro del rango')
  })

  it('al FALLO no hay techo que calcular', () => {
    const r = derivarEscaleras(ej({ rirObjetivo: 'FALLO' }), COACH)
    expect(r.faltan.join(' ')).toContain('FALLO')
  })

  it('sin carga en kg no hay escalón que subir', () => {
    const r = derivarEscaleras(ej({ cargaKg: undefined }), COACH)
    expect(r.faltan.join(' ')).toContain('carga pautada')
  })

  it('una carga pequeña donde el peldaño no llega al disco más chico', () => {
    const r = derivarEscaleras(ej({ cargaKg: 5, rango: '12-15', repsDiana: 15 }), COACH)
    expect(r.escenarios).toBeUndefined()
    expect(r.faltan.join(' ')).toContain('incremento del gimnasio')
  })

  it('SIN SUELO DE RIR no hay rojo, y por tanto no hay escaleras (I-13)', () => {
    const r = derivarEscaleras(ej(), { deltaRir: 1 })
    expect(r.escenarios).toBeUndefined()
    expect(r.faltan.join(' ')).toContain('suelo de RIR')
  })

  it('cuántos escalones suelta el rojo NO lo decide este módulo', () => {
    const r = derivarEscaleras(ej(), { sueloRir: 3 })
    expect(r.escenarios).toBeUndefined()
    expect(r.faltan.join(' ')).toContain('decisión del coach')
  })
})

describe('el remate: con escaleras el bucle deja de estar bloqueado', () => {
  const conRegistroAlto = ej({ series: [{ orden: 1, cargaKg: 130, reps: 8, rir: 2 }] })
  const senalesBuenas = {
    checkin: { horasSueno: 8, calidadSueno: 'BUENA', estres: 'POCO', cansancio: 'POCO' },
  }

  it('sin escaleras, el cruce dice verde y el ajuste no propone nada', () => {
    const decision = escenarioDelDia(conRegistroAlto, senalesBuenas)
    const ajuste = aplicarEscenario(conRegistroAlto, decision)
    expect(decision.escenario).toBe('verde')
    expect(ajuste.cargaKg).toBeUndefined()
    expect(ajuste.motivo).toContain('sin camino autorizado')
  })

  it('con las escaleras derivadas, el mismo caso SÍ propone carga', () => {
    const { escenarios } = derivarEscaleras(conRegistroAlto, COACH)
    const conEscaleras = { ...conRegistroAlto, escenarios }
    const decision = escenarioDelDia(conEscaleras, senalesBuenas)
    const ajuste = aplicarEscenario(conEscaleras, decision)
    expect(ajuste.cargaKg).toBe(100 + escenarios!.verde.deltaCargaKg!)
  })

  it('y nunca pasa del techo, por buenos que sean los días', () => {
    const { escenarios } = derivarEscaleras(ej(), COACH)
    const techo = escenarios!.verde.techoCargaKg
    // Un ejercicio que ya está EN el techo: el verde no propone nada más.
    const enElTecho = ej({ cargaKg: techo, escenarios, series: [{ orden: 1, cargaKg: techo * 1.5, reps: 8, rir: 2 }] })
    const ajuste = aplicarEscenario(enElTecho, escenarioDelDia(enElTecho, senalesBuenas))
    expect(ajuste.cargaKg).toBeUndefined()
    expect(ajuste.motivo).toContain('techo')
  })
})

/**
 * La decisión de Bryan del 2026-09-04, escrita como prueba.
 *
 * No es ceremonia: `POLITICA_DEL_COACH` es lo único de este archivo que NO sale
 * de la aritmética, así que es lo único que puede cambiar sin que nada más se
 * queje. Si alguien la toca, que sea a sabiendas.
 */
describe('la política que eligió el coach', () => {
  it('un escalón de RIR, no dos', () => {
    expect(POLITICA_DEL_COACH.deltaRir).toBe(1)
  })

  it('el día malo SÍ recorta la última serie', () => {
    expect(POLITICA_DEL_COACH.quitarUltimaSerie).toBe(true)
  })

  it('con ella, un ejercicio con suelo en la ficha saca sus dos escaleras', () => {
    const r = derivarEscaleras(ej(), { ...POLITICA_DEL_COACH, sueloRir: 3 })
    expect(r.escenarios?.rojo).toEqual({ deltaRir: 1, sueloRir: 3, quitarUltimaSerie: true })
    expect(r.faltan).toEqual([])
  })

  it('y sigue sin elegir por él: la política se pasa, no se asume', () => {
    // Sin pasarla, no hay rojo. El módulo no se la aplica solo.
    expect(derivarEscaleras(ej(), { sueloRir: 3 }).escenarios).toBeUndefined()
  })
})

describe('un dato roto no da un techo', () => {
  /**
   * Se vio en el ensayo en seco contra la cartera real, antes de escribir nada:
   * 10 ejercicios (2,1 %) tienen la diana FUERA de su propio rango. Uno de ellos
   * —«rango 8-10, diana 12»— salía con un techo del +25 %, calculado sobre un
   * hueco de cuatro repeticiones que nadie escribió. El margen no era prudente:
   * era inventado con cara de calculado.
   */
  it('la diana por encima del máximo del rango no genera escalera', () => {
    const r = derivarEscaleras(ej({ rango: '8-10', repsDiana: 12 }), { ...POLITICA_DEL_COACH, sueloRir: 3 })
    expect(r.escenarios).toBeUndefined()
    expect(r.faltan.join(' ')).toContain('FUERA de su rango')
  })

  it('y la diana en el máximo exacto SÍ la genera: ahí el rango es real', () => {
    const r = derivarEscaleras(ej({ rango: '8-10', repsDiana: 10 }), { ...POLITICA_DEL_COACH, sueloRir: 3 })
    expect(r.escenarios?.verde.techoCargaKg).toBeGreaterThan(100)
  })
})
