import { describe, expect, it } from 'vitest'
import { Malla } from '../patrones/malla'
import { construirLaboratorio } from './laboratorio'
import { construirSala, SALA, vistaDeGrabacion } from './sala'

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

describe('la vista desde el trípode', () => {
  it('pone el ojo exactamente donde va el móvil', () => {
    // El contrato: los tres parámetros que devuelve, metidos en la fórmula de la
    // órbita, tienen que reproducir la posición de la estación. Si esto se desvía, la
    // app estaría enseñando un encuadre que no es el que va a tener el teléfono — que
    // es peor que no enseñar ninguno.
    const centro: [number, number, number] = [0, 0.9, 0]
    const v = vistaDeGrabacion(centro)
    const r = (g: number) => (g * Math.PI) / 180
    const ojo = [
      centro[0] + Math.sin(r(v.azimut)) * Math.cos(r(v.elevacion)) * v.distancia,
      centro[1] + Math.sin(r(v.elevacion)) * v.distancia,
      centro[2] + Math.cos(r(v.azimut)) * Math.cos(r(v.elevacion)) * v.distancia,
    ]
    const a = r(SALA.estacion.anguloGrados)
    expect(ojo[0]).toBeCloseTo(Math.cos(a) * SALA.estacion.distancia, 6)
    expect(ojo[1]).toBeCloseTo(SALA.estacion.altura, 6)
    expect(ojo[2]).toBeCloseTo(Math.sin(a) * SALA.estacion.distancia, 6)
  })

  it('mira al sujeto de perfil, que es lo único que sabe medir una cámara sola', () => {
    // El sujeto mira a +Z. Un azimut de ±90° coloca el ojo sobre el eje X, o sea
    // perpendicular al plano sagital. Cualquier otro valor y la velocidad de barra
    // saldría proyectada sobre un plano que una sola cámara no puede resolver.
    const v = vistaDeGrabacion([0, 0.9, 0])
    expect(Math.abs(Math.abs(v.azimut) - 90)).toBeLessThan(0.001)
  })

  it('el trípode está casi a la altura de la escena, no en picado', () => {
    // Un metro de trípode contra un centro de escena a 0,9: la cámara mira casi
    // horizontal. Si esta elevación se dispara, alguien movió la altura del trípode a
    // algo que no se sostiene con un móvil.
    const v = vistaDeGrabacion([0, 0.9, 0])
    expect(Math.abs(v.elevacion)).toBeLessThan(8)
  })
})

describe('el marcador y el fallo', () => {
  it('el FALLO se dice con su letra, no con un cero', () => {
    // REGLA DEL MÉTODO, y por eso está en un test y no en un comentario: el fallo NO es
    // RIR 0. RIR 0 es la última repetición completa con la parcial en reserva; el fallo
    // es meterse en esa parcial. Un cero en la pared donde la prescripción dice FALLO
    // estaría diciendo otra cosa, y encima la que el asesorado va a ejecutar.
    const conFallo = new Malla()
    construirSala(conFallo, { series: 3, reps: 8, rir: 'FALLO' })
    const conCero = new Malla()
    construirSala(conCero, { series: 3, reps: 8, rir: 0 })
    expect(conFallo.color).not.toEqual(conCero.color)
  })

  it('un RIR fuera de rango se acota en vez de romper el display', () => {
    // Un dígito solo tiene diez signos. Si llegara un 12, `SEGMENTOS` no lo encontraría
    // y el hueco saldría con todos los segmentos apagados: un panel en blanco que
    // parece una avería del display en vez de un dato raro.
    const m = new Malla()
    construirSala(m, { series: 99, reps: 99, rir: 12 })
    expect(m.vertices).toBeGreaterThan(0)
    const apagado = new Malla()
    construirSala(apagado, { series: 99, reps: 99, rir: 9 })
    expect(m.color).toEqual(apagado.color)
  })
})
