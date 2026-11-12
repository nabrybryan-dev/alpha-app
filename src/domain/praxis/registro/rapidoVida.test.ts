// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { armarContexto } from './contexto.ts'
import { caminoRapidoVida, extraerRapidoVida, proponerVidaLocal, VIDA_LOCAL_ENCENDIDA } from './rapidoVida.ts'

const ctx = armarContexto({ ahora: '2026-11-11T10:00:00-05:00', activo: null, hidratacionHoyMl: 0 })
const registro = (frase: string) => caminoRapidoVida(frase, ctx)?.propuesta.registros[0]

describe('camino rápido de vida · lo que SÍ toma', () => {
  it.each([
    ['tomé dos litros de agua', 2000], ['me tomé tres vasos de agua', 600], ['tomé un vaso de agua', 200],
    ['tomé medio litro de agua', 500], ['tomé litro y medio de agua', 1500], ['tomé 1,5 litros de agua', 1500],
    ['acabo de tomarme un vaso de agua', 200], ['hoy tomé dos litros de agua', 2000],
  ])('agua «%s» = %i mL', (frase, ml) => {
    expect(registro(frase)).toMatchObject({ campo: 'hidratacion', delta_ml: ml })
  })

  it.each([
    ['dormí seis horas y media', 6.5], ['dormí 7 horas', 7], ['anoche dormí ocho horas', 8], ['dormí siete horas y 30 minutos', 7.5],
  ])('sueño «%s» = %s h', (frase, h) => {
    expect(registro(frase)).toMatchObject({ campo: 'checkin', parche: { horasSueno: h } })
  })

  it.each([
    ['hoy caminé 8.500 pasos', 8500], ['hice 9500 pasos', 9500], ['llevo 8 mil pasos', 8000], ['caminé ocho mil quinientos pasos', 8500],
    ['el reloj me marca 12.350 pasos', 12350],
  ])('pasos «%s» = %i', (frase, n) => {
    expect(registro(frase)).toMatchObject({ campo: 'checkin', parche: { pasos: n } })
  })

  it('la cita es literal de la frase (misma forma que la del modelo)', () => {
    expect(extraerRapidoVida('dormí seis horas y media')).toEqual({ intencion: ['vida'], vida: { sueno_horas: 'seis horas y media' } })
  })
})

describe('camino rápido de vida · lo que NO toma (null, sigue al servidor)', () => {
  it.each([
    ['negación', 'no tomé agua'], ['negación de sueño', 'no dormí nada'], ['negación de pasos', 'hoy no caminé ni mil pasos'],
    ['hipotético', 'si tomara dos litros de agua'], ['plan', 'mañana quiero caminar 10 mil pasos'], ['plan de sueño', 'voy a dormir 8 horas'],
    ['rango', 'dormí entre 6 y 7 horas'], ['rango con o', 'tomé 2 o 3 vasos de agua'], ['rango sin conector', 'dormí cinco seis horas'],
    ['pregunta', '¿tomé dos litros de agua?'], ['pregunta sin signo', 'cuántos pasos caminé'], ['aproximado', 'dormí como 5 horas'], ['aproximado 2', 'tomé unos dos litros de agua'],
    ['y pico', 'dormí seis horas y pico'], ['cota', 'caminé más de 8 mil pasos'], ['cifra ambigua', 'dormí 6 7 horas'], ['coma de miles', 'caminé 10,000 pasos'], ['decimal de pasos', 'caminé 8,5 mil pasos'], ['pasos con decimal', 'caminé 8.5 pasos'], ['sueño redondeado', 'dormí 7,25 horas'],
    ['dos anotaciones', 'tomé dos litros de agua y dormí seis horas'], ['dos anotaciones 2', 'dormí seis horas y caminé 8 mil pasos'],
    ['otro día', 'ayer dormí nueve horas'], ['sin cifra', 'dormí muchas horas'], ['unidad ajena', 'caminé 5 km'], ['no es agua', 'tomé dos litros de jugo'],
    ['salud: dolor', 'me duele la rodilla y dormí seis horas'], ['salud: síntoma', 'tomé dos litros de agua porque me mareé'], ['salud: dolor suelto', 'dormí seis horas con dolor'],
    ['riesgo', 'no quiero vivir, dormí seis horas'], ['botella sin tamaño', 'tomé una botella de agua'], ['imposible', 'dormí 20 horas'], ['imposible agua', 'tomé 30 litros de agua'],
    ['entreno', 'sentadilla 60 por 10'], ['vacía', ''],
  ])('%s: «%s»', (_motivo, frase) => {
    expect(caminoRapidoVida(frase, ctx)).toBeNull()
  })
})

describe('camino rápido de vida · bandera', () => {
  it('apagada por defecto', () => {
    expect(VIDA_LOCAL_ENCENDIDA).toBe(false)
    expect(proponerVidaLocal('tomé dos litros de agua', { ahora: '2026-11-11T10:00:00-05:00' }, 'm1')).toBeNull()
  })
  it('encendida devuelve propuesta y tarjeta; lo que no acepta, null', () => {
    const e = { ahora: '2026-11-11T10:00:00-05:00', hidratacionHoyMl: 0 }
    const r = proponerVidaLocal('tomé dos litros de agua', e, 'm1', true)
    expect(r?.propuesta.accion).toBe('tarjeta')
    expect(r?.tarjeta).toBeTruthy()
    expect(proponerVidaLocal('me duele la espalda', e, 'm2', true)).toBeNull()
  })
})
