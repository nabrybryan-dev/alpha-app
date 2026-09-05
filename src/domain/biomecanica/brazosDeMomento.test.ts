import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from '../patrones/catalogo'
import { esqueletoEnFase } from '../patrones/escena'
import { brazosDeMomento, puntoDeCarga } from './brazosDeMomento'
import { planDeMedida, type PlanDeMedida } from './palancas'

/**
 * EL BRAZO DE MOMENTO, MEDIDO SOBRE EL SUJETO DE VERDAD.
 *
 * No se prueba contra números inventados: se resuelve la sentadilla goblet del catálogo
 * arriba y en el fondo, y se comprueba lo que la biomecánica dice que tiene que pasar —el
 * brazo de la cadera crece al bajar—, más la geometría que hace dibujable el segmento: el
 * pie está a la altura del eje y sobre la vertical de la carga.
 */

const plan = planDeMedida('SENTADILLA', 'Sentadilla goblet')!
const sentadilla = PATRON_POR_ID.sentadilla

describe('brazosDeMomento', () => {
  it('la sentadilla trae cadera y rodilla, y ningún estabilizador', () => {
    const b = brazosDeMomento(esqueletoEnFase(sentadilla, 1), plan)
    const nombres = b.map((x) => x.articulacion)
    expect(nombres).toContain('cadera')
    expect(nombres).toContain('rodilla')
    expect(b.every((x) => x.protagonismo !== 'estabilizador')).toBe(true)
  })

  it('en la bisagra de cadera, los brazos lumbar y de cadera crecen al bajar', () => {
    // La sentadilla del catálogo lleva los brazos colgando, y con las manos bajando por
    // delante el brazo de cadera NO crece al bajar (medido: 17 cm de pie, 12 en el fondo).
    // Donde la biomecánica exige que crezca sin discusión es en la bisagra: la carga se
    // queda sobre el pie y la cadera se va atrás.
    const bisagra = PATRON_POR_ID.bisagra_cadera
    const planBisagra = planDeMedida(bisagra.categoria, 'Peso muerto rumano')!
    const de = (fase: number, art: string) =>
      brazosDeMomento(esqueletoEnFase(bisagra, fase), planBisagra).find((x) => x.articulacion === art)!.metros
    expect(de(1, 'lumbar')).toBeGreaterThan(de(0, 'lumbar') + 0.03)
    expect(de(1, 'cadera')).toBeGreaterThan(de(0, 'cadera'))
  })

  it('el pie está a la altura del eje y sobre la vertical de la carga', () => {
    const esq = esqueletoEnFase(sentadilla, 0.6)
    const carga = puntoDeCarga(esq)!
    for (const b of brazosDeMomento(esq, plan)) {
      expect(b.pie[1]).toBe(b.eje[1])
      expect(b.pie[0]).toBe(carga[0])
      expect(b.pie[2]).toBe(carga[2])
      expect(b.metros).toBeCloseTo(Math.hypot(b.pie[0] - b.eje[0], b.pie[2] - b.eje[2]), 9)
    }
  })

  it('con cable no hay vertical de gravedad: no se dibuja nada', () => {
    const conCable: PlanDeMedida = { ...plan, linea: { ...plan.linea, origen: 'cable' } }
    expect(brazosDeMomento(esqueletoEnFase(sentadilla, 1), conCable)).toEqual([])
  })

  it('una articulación que el rig no tiene como hueso se salta sin reventar', () => {
    const raro = {
      ...plan,
      ejes: [{ articulacion: 'escapula', protagonismo: 'principal', accion: 'retraccion', motores: [], vista: 'lateral' }],
    } as unknown as PlanDeMedida
    expect(brazosDeMomento(esqueletoEnFase(sentadilla, 1), raro)).toEqual([])
  })
})
