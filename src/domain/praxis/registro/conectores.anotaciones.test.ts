// @vitest-environment node
/**
 * Anotaciones del cuaderno (Bryan, 8-nov-2026): «molida de las piernas» y «pesada después del almuerzo» no llenan el
 * check-in, pero quedan propuestas como anotación. ESCRITAS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO.
 */
import { describe, expect, it } from 'vitest'
import { conectarMensaje } from './conectores.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

function resultado(frase: string, p?: CampoCheckin) {
  const r = conectarMensaje(frase, { preguntaAnterior: p })
  if (r.tipo === 'riesgo') throw new Error('salio como riesgo')
  return r
}

describe('recuperación de una zona', () => {
  it('«molida de las piernas»: anotación con la zona y NO llena el cansancio', () => {
    const r = resultado('estoy molida de las piernas', 'cansancio')
    expect(r.anotaciones).toEqual([{ tipo: 'recuperacion_zona', zona: 'piernas', cita: 'estoy molida de las piernas' }])
    expect(r.propuestas).toEqual([])
    expect(r.dudosas).toEqual([])
  })
  it('otras zonas, en singular y plural', () => {
    expect(resultado('quedé molido del cuello').anotaciones[0]).toMatchObject({ zona: 'cuello' })
    expect(resultado('amanecí molida de la espalda').anotaciones[0]).toMatchObject({ zona: 'espalda' })
    expect(resultado('molida de los glúteos').anotaciones[0]).toMatchObject({ zona: 'gluteos' })
  })
  it('negativas: «molida» sola es cansancio y no anota; una articulación no se anota', () => {
    const sola = resultado('estoy molida', 'cansancio')
    expect(sola.anotaciones).toEqual([])
    expect(sola.propuestas).toMatchObject([{ campo: 'cansancio', valor: 'MUCHO' }])
    expect(resultado('molida de la rodilla').anotaciones).toEqual([])
  })
})

describe('reacción a una comida', () => {
  it.each([
    ['me sentí pesada después del almuerzo', 'almuerzo'],
    ['me cayó pesada la cena', 'cena'],
    ['el desayuno me cayó pesado', 'desayuno'],
    ['me sentí pesado después de comer', 'otro'],
  ] as const)('«%s» -> %s, sin llenar el rendimiento', (frase, momento) => {
    const r = resultado(frase, 'rendimiento')
    expect(r.anotaciones).toEqual([{ tipo: 'reaccion_comida', momento, cita: frase }])
    expect(r.propuestas).toEqual([])
  })
  it('negativas: lo habitual y el entreno pesado no se anotan', () => {
    expect(resultado('siempre me cae pesado el almuerzo').anotaciones).toEqual([])
    expect(resultado('el entreno lo sentí pesado').anotaciones).toEqual([])
    expect(resultado('el almuerzo estuvo bien').anotaciones).toEqual([])
  })
})

describe('riesgo primero', () => {
  it('un mensaje con dolor sale como riesgo y no anota nada', () => {
    const r = conectarMensaje('me duele la pierna y estoy molida de las piernas')
    expect(r.tipo).toBe('riesgo')
  })
})
