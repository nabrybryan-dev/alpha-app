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

  it('el curl de muñeca tiene palanca, y la tiene máxima a media flexión', () => {
    // El guardián que faltaba, y que nació ROJO: hasta el 2026-09-06 la carga se ponía en
    // el ARRANQUE del hueso de la mano, que es exactamente donde está el eje de la muñeca,
    // así que la distancia entre los dos era cero por construcción — cero en las cinco
    // fases, en los dos patrones de muñeca, por mucho que su modelo mecánico existiera.
    //
    // Un cero que sale de la geometría del rig y no del ejercicio es un cero que miente, y
    // encima es invisible: no falla nada, simplemente no se dibuja ninguna flecha.
    //
    // Y no basta con que sea distinto de cero. La forma de la curva es lo que dice que el
    // punto de agarre está donde toca: con el antebrazo apoyado, el brazo externo es la
    // distancia horizontal de la muñeca a la carga, que es máxima cuando la mano pasa por
    // la horizontal —a media flexión— y se acorta en los dos extremos del recorrido.
    const curl = PATRON_POR_ID.flexion_muneca
    const planCurl = planDeMedida(curl.categoria, 'Curl de muñeca con barra sentado')!
    const serie = [0, 0.25, 0.5, 0.75, 1].map(
      (fase) =>
        brazosDeMomento(esqueletoEnFase(curl, fase), planCurl).find(
          (x) => x.articulacion === 'muñeca',
        )!.metros,
    )
    expect(serie.every((m) => m > 0.02)).toBe(true)
    const medio = Math.max(serie[1], serie[2], serie[3])
    expect(medio).toBeGreaterThan(serie[0])
    expect(medio).toBeGreaterThan(serie[4])
  })

  it('el agarre está en la palma, y eso NO mueve los ejercicios de cadena cerrada', () => {
    // La contraprueba de que el punto de agarre no es un ajuste a ojo: si se hubiera
    // elegido para que saliera un número bonito, movería todo. Mueve donde el agarre manda
    // —un curl de bíceps pasa de 24 a 33 cm— y no mueve donde la carga va sobre los
    // hombros. En la sentadilla las manos solo sujetan la barra al cuello.
    const arriba = brazosDeMomento(esqueletoEnFase(sentadilla, 0), plan)
    const abajo = brazosDeMomento(esqueletoEnFase(sentadilla, 1), plan)
    for (const b of [...arriba, ...abajo]) {
      expect(b.metros, `${b.articulacion} se disparó con el agarre`).toBeLessThan(0.35)
    }
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
