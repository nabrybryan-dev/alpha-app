import { describe, expect, it } from 'vitest'
import { Malla } from '../patrones/malla'
import { construirLaboratorio } from './laboratorio'
import { construirSala, SALA } from './sala'

/**
 * La sala se prueba contra las cuatro cosas que la harían inservible sin que se note
 * al mirarla de frente, más la que le da sentido: que la estación de grabación diga
 * la verdad sobre dónde se pone el móvil.
 */

function sala(series = 3, reps = 8, rir = 2): Malla {
  const m = new Malla()
  construirSala(m, { series, reps, rir })
  return m
}

const posiciones = (m: Malla): [number, number, number][] => {
  const p: [number, number, number][] = []
  for (let i = 0; i < m.posicion.length; i += 3) {
    p.push([m.posicion[i], m.posicion[i + 1], m.posicion[i + 2]])
  }
  return p
}

describe('la sala', () => {
  it('es más grande que la órbita, que es lo que impide que una pared tape al sujeto', () => {
    // LA DECISIÓN QUE SOSTIENE TODO ESTO. La cámara del visor orbita hasta 6,5 m. Con
    // la pared a 7,0 la cámara nunca sale del recinto, así que la pared que se ve es
    // siempre la del fondo y la de detrás queda a la espalda.
    //
    // Si alguien baja este radio por debajo del tope de órbita, la sala deja de ser una
    // sala y pasa a ser una caja alrededor de la cual se da vueltas — y en media vuelta
    // el muro cercano se cruza por delante del sujeto.
    const TOPE_DE_ORBITA = 6.5
    expect(SALA.radio).toBeGreaterThan(TOPE_DE_ORBITA)
  })

  it('todo va con el hueso identidad', () => {
    // Un vértice de la pared con el índice de un hueso se movería con la sentadilla.
    expect(new Set(sala().hueso)).toEqual(new Set([0]))
  })

  it('la sala y la bahía juntas caben en el búfer de 16 bits', () => {
    // El escenario comparte malla con el sujeto, y los índices son Uint16: pasado
    // 65.535 el vértice siguiente se referencia como el 0 y la geometría se pliega
    // sobre sí misma sin dar un solo error.
    const m = new Malla()
    construirLaboratorio(m)
    construirSala(m, { series: 88, reps: 88, rir: 8 }) // el caso más caro: todo ochos
    expect(m.vertices).toBeLessThan(40000)
    expect(Math.max(...m.indice)).toBeLessThan(65536)
  })

  it('los marcadores están repetidos, para que siempre haya uno al fondo', () => {
    // Con órbita libre, un marcador único queda a la espalda la mitad del tiempo.
    // Se comprueba contando cuántos ángulos distintos ocupan los paneles: si alguien
    // los reduce a uno, esto cae.
    const m = sala()
    const angulos = new Set(
      posiciones(m)
        .filter(([, y]) => y > SALA.altoPanel - 0.3 && y < SALA.altoPanel + 0.9)
        .map(([x, , z]) => Math.round((Math.atan2(z, x) * 180) / Math.PI / 30) * 30),
    )
    expect(angulos.size).toBeGreaterThanOrEqual(3)
  })

  it('las cifras cambian cuando cambia la serie', () => {
    // Los dígitos son geometría, así que un número distinto tiene que producir una
    // malla distinta. Si esto empieza a dar igual, el marcador se quedó congelado en
    // los números con los que se construyó la primera vez.
    const a = sala(3, 8, 2)
    const b = sala(3, 8, 0)
    expect(a.color).not.toEqual(b.color)
    // Y el mismo trío tiene que dar exactamente lo mismo, o el caché de arriba mentiría.
    expect(sala(3, 8, 2).color).toEqual(a.color)
  })

  it('la estación de grabación está donde una cámara puede medir de verdad', () => {
    // El sujeto mira a +Z, así que su plano sagital es X=0. Una sola cámara no da los
    // grados de libertad del plano frontal, así que la única posición desde la que se
    // puede medir velocidad de barra es PERPENDICULAR al sagital: sobre el eje X.
    //
    // 180° es exactamente eso. Si alguien mueve la estación a 90° o a 0°, la sala
    // estaría enseñando a plantar el móvil donde la medición no vale.
    expect(SALA.estacion.anguloGrados % 180).toBe(0)

    // Y la tolerancia dibujada tiene que ser la del encoder, no una inventada: con
    // disco visible admite hasta 30° de desvío, sin él solo 12.
    expect(SALA.tolerancia.conDisco).toBe(30)
    expect(SALA.tolerancia.sinDisco).toBe(12)
    expect(SALA.tolerancia.sinDisco).toBeLessThan(SALA.tolerancia.conDisco)
  })

  it('nada de la sala se mete dentro de la bahía', () => {
    // La sala envuelve; no invade. Cualquier geometría suya dentro del radio de la
    // bahía competiría con el suelo de medida y con el sujeto — salvo lo que va en el
    // suelo por definición, que es la estación y su mira.
    const m = sala()
    const invasores = posiciones(m).filter(([x, y, z]) => Math.hypot(x, z) < 1.0 && y > 0.02)
    expect(invasores).toEqual([])
  })
})
