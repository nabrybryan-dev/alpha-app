import { describe, expect, it } from 'vitest'
import { PATRONES, PATRON_POR_ID, type Patron } from './catalogo'
import { DEMOSTRACION_POR_ID } from './demostraciones'
import {
  DURACION_CICLO,
  encuadrar,
  esqueletoEnFase,
  faseDeTiempo,
  guias,
  trazaDelPatron,
} from './escena'
import { construirHuesos } from './huesos'
import { ESQUELETO, puntoDeHueso } from './esqueleto'
import { V } from './algebra'

describe('el tempo de la repetición', () => {
  it('arranca abajo y sube en la fase concéntrica', () => {
    expect(faseDeTiempo(0)).toEqual({ fase: 0, sentido: 1 })
    const aMitadDeSubida = faseDeTiempo(0.6)
    expect(aMitadDeSubida.fase).toBeGreaterThan(0.3)
    expect(aMitadDeSubida.sentido).toBe(1)
  })

  it('baja más despacio de lo que sube', () => {
    // Es parte de lo que hay que enseñar: la fase de freno dura más. Una
    // interpolación simétrica enseñaría un tempo que nadie debería copiar.
    const enSubida = faseDeTiempo(0.6).fase
    const mismoTiempoBajando = faseDeTiempo(1.55 + 0.6).fase
    expect(mismoTiempoBajando).toBeGreaterThan(enSubida)
    expect(faseDeTiempo(2.0).sentido).toBe(-1)
  })

  it('hace pausa arriba antes de empezar a bajar', () => {
    expect(faseDeTiempo(1.3).fase).toBe(1)
    expect(faseDeTiempo(1.5).fase).toBe(1)
  })

  it('se repite sin saltos y aguanta tiempos negativos', () => {
    expect(faseDeTiempo(DURACION_CICLO).fase).toBeCloseTo(faseDeTiempo(0).fase, 6)
    expect(Number.isFinite(faseDeTiempo(-3).fase)).toBe(true)
    expect(faseDeTiempo(-3).fase).toBeGreaterThanOrEqual(0)
  })
})

describe('el encuadre automático', () => {
  it('deja al sujeto dentro del cono de visión en toda la repetición', () => {
    for (const p of PATRONES) {
      const { centro, distancia } = encuadrar(p)
      expect(Number.isFinite(distancia), p.id).toBe(true)
      expect(distancia, p.id).toBeGreaterThan(0.5)
      expect(distancia, p.id).toBeLessThan(8)
      expect(centro.every(Number.isFinite), p.id).toBe(true)
    }
  })

  it('se acerca más en un patrón local que en uno de cuerpo entero', () => {
    // La flexión plantar mueve una articulación; encuadrar el cuerpo entero
    // dejaba la pantorrilla del tamaño de una uña.
    expect(encuadrar(PATRON_POR_ID.flexion_plantar).distancia).toBeLessThan(
      encuadrar(PATRON_POR_ID.sentadilla).distancia,
    )
  })

  it('sigue al sujeto cuando el patrón lo tumba', () => {
    // El press de banca ocurre a media altura, no de pie.
    const { centro } = encuadrar(PATRON_POR_ID.empuje_horizontal)
    expect(centro[1]).toBeLessThan(1)
  })
})

describe('la traza del movimiento', () => {
  it('sale de donde empieza el gesto y llega a donde termina', () => {
    const p = PATRON_POR_ID.sentadilla
    const traza = trazaDelPatron(p)
    expect(traza).not.toBeNull()
    expect(traza).toHaveLength(26)
    const inicio = puntoDeHueso(esqueletoEnFase(p, 0), 'pelvis', 0, [0, 0, 0.1])
    const fin = puntoDeHueso(esqueletoEnFase(p, 1), 'pelvis', 0, [0, 0, 0.1])
    expect(V.largo(V.restar(traza![0], inicio))).toBeLessThan(0.01)
    expect(V.largo(V.restar(traza![25], fin))).toBeLessThan(0.01)
  })

  it('recorre una distancia apreciable en todos los patrones que la tienen', () => {
    for (const p of PATRONES) {
      const traza = trazaDelPatron(p)
      if (!traza) continue
      let recorrido = 0
      for (let i = 1; i < traza.length; i++) {
        recorrido += V.largo(V.restar(traza[i], traza[i - 1]))
      }
      // Un arco de menos de diez centímetros no se lee sobre la figura. Los
      // patrones invertidos son la excepción legítima: no trazan un recorrido
      // sino la distancia entre un fallo y su corrección, y esa es corta a
      // propósito —en una plancha la pelvis se mete unos centímetros y ya.
      const minimo = p.invertido ? 0.02 : 0.1
      expect(recorrido, `${p.id} traza ${recorrido.toFixed(3)} m`).toBeGreaterThan(minimo)
    }
  })

  it('devuelve null cuando el patrón no define seguimiento', () => {
    expect(trazaDelPatron({ ...PATRON_POR_ID.sentadilla, seguimiento: undefined })).toBeNull()
  })
})

describe('las guías', () => {
  it('dibuja el arco con geometría, no con líneas', () => {
    // `gl.lineWidth` se ignora en casi todos los navegadores: si esto fueran
    // líneas, el arco se vería como un hilo de un píxel en el móvil.
    const traza = trazaDelPatron(PATRON_POR_ID.sentadilla)
    const malla = guias(traza, 0.5, [0, 0.9, 0], false)
    expect(malla.vertices).toBeGreaterThan(100)
    expect(malla.indice.length).toBeGreaterThan(100)
  })

  it('añade la esfera de orbitar solo cuando se pide', () => {
    const traza = trazaDelPatron(PATRON_POR_ID.sentadilla)
    const sin = guias(traza, 0.5, [0, 0.9, 0], false).vertices
    const con = guias(traza, 0.5, [0, 0.9, 0], true).vertices
    expect(con).toBeGreaterThan(sin)
  })

  it('no falla sin traza', () => {
    expect(guias(null, 0.5, [0, 0.9, 0], false).vertices).toBe(0)
  })
})

describe('la geometría ósea', () => {
  const malla = construirHuesos()

  it('sale finita y con volumen', () => {
    expect(malla.vertices).toBeGreaterThan(5000)
    expect(malla.posicion.every(Number.isFinite)).toBe(true)
    expect(malla.normal.every(Number.isFinite)).toBe(true)
    expect(malla.indice.length % 3).toBe(0)
  })

  it('reparte la geometría entre todos los huesos del esqueleto', () => {
    // Si un hueso se queda sin geometría, ese segmento se ve como un hueco al
    // orbitar y no hay test de píxeles que lo cace.
    const usados = new Set(malla.hueso)
    for (const h of ESQUELETO) {
      expect(usados.has(0), 'el slot 0 es la identidad, no un hueso').toBe(false)
      expect(usados.size, `falta geometría en algún hueso (${h.nombre})`).toBe(ESQUELETO.length)
    }
  })

  it('no apunta a ningún índice de hueso fuera del array', () => {
    // El shader guarda 24 matrices: un índice mayor dibujaría con basura.
    expect(Math.max(...malla.hueso)).toBeLessThanOrEqual(ESQUELETO.length)
    expect(Math.min(...malla.hueso)).toBeGreaterThan(0)
  })

  it('cabe en índices de 16 bits', () => {
    // Por encima de 65 535 vértices haría falta una extensión que no todos los
    // móviles traen. Es el margen que hay que vigilar si la malla crece.
    expect(malla.vertices).toBeLessThan(65535)
  })

  it('entrega los arrays tipados que espera la tarjeta gráfica', () => {
    const a = malla.arrays()
    expect(a.posicion).toBeInstanceOf(Float32Array)
    expect(a.posicion.length).toBe(malla.vertices * 3)
    expect(a.hueso.length).toBe(malla.vertices)
    expect(a.indice.length).toBe(malla.indice.length)
  })
})

describe('el encuadre con foco en una articulación', () => {
  const conFoco = (patron: Patron, foco: string): Patron => ({ ...patron, foco })
  const demoCodo = DEMOSTRACION_POR_ID['demo-codo-codoFlex'].patron

  it('se acerca mucho más que el encuadre por musculatura', () => {
    // La musculatura que cruza el codo nace en la escápula y llega a la mano,
    // así que encuadrarla deja el codo del tamaño de una uña. Estudiar una
    // articulación pide un primer plano de ESA articulación.
    const ancho = encuadrar({ ...demoCodo, foco: undefined })
    const cerca = encuadrar(demoCodo)
    expect(cerca.distancia).toBeLessThan(ancho.distancia * 0.75)
  })

  it('centra en la articulación, no en la línea media del cuerpo', () => {
    const { centro } = encuadrar(demoCodo)
    // El codo derecho está claramente fuera del eje del cuerpo. Un centro
    // pegado a x≈0 significaría que se está mirando el tronco.
    expect(Math.abs(centro[0])).toBeGreaterThan(0.12)
  })

  it('mantiene el segmento móvil dentro del cuadro durante toda la repetición', () => {
    // Un encuadre apretado en la pose inicial deja el antebrazo fuera cuando
    // el codo llega a los 152°: hay que medir el recorrido entero.
    const { centro, distancia } = encuadrar(demoCodo)
    for (const fase of [0, 0.25, 0.5, 0.75, 1]) {
      const esq = esqueletoEnFase(demoCodo, fase)
      for (const t of [0, 0.5, 1]) {
        const p = puntoDeHueso(esq, 'antebrazoD', t)
        const d = Math.hypot(p[0] - centro[0], p[1] - centro[1], p[2] - centro[2])
        expect(d, `antebrazo fuera del cuadro en fase ${fase}`).toBeLessThan(distancia)
      }
    }
  })

  it('deja el encuadre por musculatura intacto en los ejercicios', () => {
    // Los diecinueve patrones no llevan foco: su encuadre es el de siempre.
    for (const p of PATRONES) expect(p.foco, p.id).toBeUndefined()
  })

  it('ignora un foco que no corresponde a ningún hueso', () => {
    // Viene de datos; que un nombre mal escrito deje la cámara en el infinito
    // sería peor que encuadrar de más.
    const raro = encuadrar(conFoco(demoCodo, 'peroneD'))
    expect(Number.isFinite(raro.distancia)).toBe(true)
    expect(raro.distancia).toBeGreaterThan(0)
  })
})
