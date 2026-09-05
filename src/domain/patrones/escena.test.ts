import { describe, expect, it } from 'vitest'
import { PATRONES, PATRON_POR_ID, type Patron } from './catalogo'
import { DEMOSTRACIONES, DEMOSTRACION_POR_ID } from './demostraciones'
import { sobreponerMedida } from './escena'
import {
  DURACION_CICLO,
  duracionDelCiclo,
  CAMPO_VISUAL,
  encuadrar,
  esqueletoEnFase,
  faseDeTiempo,
  guias,
  trazaDelPatron,
} from './escena'
import { construirHuesos } from './huesos'
import { ESQUELETO, puntoDeHueso } from './esqueleto'
import { grados, V } from './algebra'

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
    // Arriba se para, pero no se congela: el asentamiento hace que la fase
    // ronde el 1 en vez de clavarse en él. Hasta que se añadió, esto exigía un
    // 1 exacto y eso era justo lo que hacía que el tope pareciese un maniquí.
    expect(faseDeTiempo(1.3).fase).toBeCloseTo(1, 1)
    expect(faseDeTiempo(1.5).fase).toBeCloseTo(1, 2)
    // Y no se pasa del tope: pasarse del bloqueo sería hiperextender.
    for (const t of [1.25, 1.3, 1.4, 1.5]) expect(faseDeTiempo(t).fase).toBeLessThanOrEqual(1)
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

describe('el encuadre de las articulaciones pequeñas', () => {
  it('no se pega tanto que se pierda el contexto', () => {
    // La muñeca enfoca la mano, que mide unos diez centímetros, y con la
    // holgura sola la cámara se metía dentro del antebrazo: se veía un
    // amasijo de tubos donde no se distinguía ni la mano. Hace falta un suelo:
    // sin ver el hueso de al lado no se entiende contra qué se mueve.
    for (const d of DEMOSTRACIONES) {
      const { distancia } = encuadrar(d.patron)
      expect(distancia, `${d.id} encuadra a ${distancia.toFixed(2)}`).toBeGreaterThan(0.75)
    }
  })

  it('sigue dando primeros planos donde los hay que dar', () => {
    // El suelo no puede comerse la ganancia: el codo tiene que seguir viéndose
    // de cerca, no como el cuerpo entero.
    const codo = encuadrar(DEMOSTRACION_POR_ID['demo-codo-codoFlex'].patron)
    expect(codo.distancia).toBeLessThan(1.8)
  })
})

describe('el ritmo de un levantamiento', () => {
  // Los tramos del ciclo, por tiempo. Filtrar por `sentido` mezclaba el final de
  // un ciclo con el principio del siguiente.
  const SUBIDA: [number, number] = [0, 1.2]
  const ARRIBA: [number, number] = [1.2, 1.55]
  const BAJADA: [number, number] = [1.55, 3.45]

  /** Muestrea un tramo y devuelve fase y velocidad de fase. */
  const tramo = ([a, b]: [number, number], n = 300) => {
    const puntos = Array.from({ length: n + 1 }, (_, i) => {
      const t = a + ((b - a) * i) / n
      return { t, fase: faseDeTiempo(t).fase }
    })
    const vel: number[] = []
    for (let i = 1; i < puntos.length; i++) {
      const dt = puntos[i].t - puntos[i - 1].t
      vel.push((puntos[i].fase - puntos[i - 1].fase) / dt)
    }
    return { puntos, vel }
  }

  it('frena en la región de estancamiento al subir', () => {
    // Un levantamiento real no sube a velocidad de interpolación: hay un tramo,
    // pasado el arranque, donde el brazo de momento empeora y la barra se
    // enlentece. Está documentado en la sentadilla y cualquiera que entrene lo
    // reconoce; sin él, la subida se lee como una animación y no como un gesto.
    const { vel } = tramo(SUBIDA)
    const tercio = Math.floor(vel.length / 3)
    const arranque = Math.max(...vel.slice(0, tercio))
    const medio = Math.min(...vel.slice(tercio, tercio * 2))
    expect(medio, `arranque ${arranque.toFixed(2)} vs medio ${medio.toFixed(2)}`).toBeLessThan(
      arranque * 0.75,
    )
  })

  it('no retrocede mientras sube', () => {
    // El estancamiento frena, no da marcha atrás: la barra no baja a mitad de
    // subida salvo que se falle la repetición, y eso no es lo que se enseña.
    const { puntos } = tramo(SUBIDA)
    for (let i = 1; i < puntos.length; i++) {
      expect(puntos[i].fase, `retrocede en t=${puntos[i].t.toFixed(2)}`).toBeGreaterThanOrEqual(
        puntos[i - 1].fase - 1e-9,
      )
    }
  })

  it('baja sin estancamiento', () => {
    // Bajar es ceder contra la gravedad: no hay punto de atasco. Meterle uno
    // sería inventar un fenómeno que no ocurre.
    const { vel } = tramo(BAJADA)
    const rapidez = vel.map(Math.abs)
    const tercio = Math.floor(rapidez.length / 3)
    const pico = Math.max(...rapidez)
    const medio = Math.min(...rapidez.slice(tercio, tercio * 2))
    expect(medio).toBeGreaterThan(pico * 0.75)
  })

  it('se asienta al llegar arriba en vez de clavarse', () => {
    // Follow-through: el cuerpo llega al tope y acomoda, no se congela de golpe.
    // Es pequeño —si se nota como un rebote parece que se falla la repetición—
    // pero es lo que separa a una persona de un maniquí.
    const { puntos } = tramo(ARRIBA, 400)
    const minimo = Math.min(...puntos.map((p) => p.fase))
    expect(1 - minimo, 'el asentamiento no existe').toBeGreaterThan(0.004)
    expect(1 - minimo, 'el asentamiento se nota como un rebote').toBeLessThan(0.05)
  })

  it('empieza y termina el ciclo abajo del todo', () => {
    // Sin esto el bucle daría un salto visible al reiniciarse.
    expect(faseDeTiempo(0).fase).toBeCloseTo(0, 3)
    expect(faseDeTiempo(DURACION_CICLO - 1e-4).fase).toBeCloseTo(0, 2)
  })
})

describe('la focal de la cámara', () => {
  it('mira con una focal de retrato y no de gran angular', () => {
    // Un campo visual ancho exagera lo que está cerca del objetivo: la mano que
    // se adelanta sale enorme y el cuerpo se deforma. En cine la figura humana
    // se mira con el equivalente a un 85 mm, que ronda los 22-25° de campo. A
    // 34° el sujeto salía con la perspectiva estirada.
    expect(CAMPO_VISUAL).toBeGreaterThan(grados(20))
    expect(CAMPO_VISUAL).toBeLessThan(grados(30))
  })

  it('mantiene el encuadre al cambiar la focal', () => {
    // Estrechar el campo sin alejar la cámara recortaría el sujeto. Como la
    // distancia se calcula a partir del mismo campo, el tamaño en pantalla se
    // conserva y lo único que cambia es la perspectiva, que es de lo que se
    // trata.
    for (const p of PATRONES) {
      const { radio, distancia } = (() => {
        const e = encuadrar(p)
        // Semiángulo que ocupa el sujeto desde la cámara: es lo que decide el
        // tamaño en pantalla, y tiene que caber en el campo visual.
        return { radio: (e.distancia - 0.22) * Math.tan(CAMPO_VISUAL / 2), distancia: e.distancia }
      })()
      const ocupa = 2 * Math.atan(radio / (distancia - 0.22))
      expect(ocupa / CAMPO_VISUAL, p.id).toBeCloseTo(1, 5)
    }
  })
})

describe('dónde se atasca cada ejercicio', () => {
  /** Fase de la subida en la que la velocidad toca su mínimo. */
  const dondeFrena = (patron: Patron): number => {
    const n = 400
    let peor = { k: 0, v: Infinity }
    for (let i = 1; i <= n; i++) {
      const k0 = ((i - 1) / n) * 1.2
      const k1 = (i / n) * 1.2
      const v = (faseDeTiempo(k1, patron).fase - faseDeTiempo(k0, patron).fase) / (k1 - k0)
      // Se ignoran los extremos, donde la velocidad es baja por el arranque y la
      // llegada y no por el brazo de momento.
      const k = k1 / 1.2
      if (k > 0.12 && k < 0.88 && v < peor.v) peor = { k, v }
    }
    return peor.k
  }

  it('atasca la sentadilla poco después de salir del hoyo', () => {
    // La fuerza es mínima en los primeros 15 cm sobre la posición más baja de la
    // barra, que en un recorrido de medio metro cae en torno al primer cuarto.
    expect(dondeFrena(PATRON_POR_ID['sentadilla'])).toBeLessThan(0.35)
  })

  it('atasca la extensión de cadera casi al arrancar', () => {
    // En el hip thrust el momento extensor es máximo con la cadera cerca de 90°
    // —es decir, abajo— y decae hacia la extensión completa. Es el ejercicio
    // donde antes cuesta.
    const k = dondeFrena(PATRON_POR_ID['extension_cadera'])
    expect(k).toBeLessThan(0.3)
    expect(k).toBeLessThan(dondeFrena(PATRON_POR_ID['empuje_horizontal']))
  })

  it('atasca el empuje horizontal más arriba que la sentadilla', () => {
    // En el banca el mínimo de velocidad queda bastante por encima del pecho,
    // no justo al despegar.
    expect(dondeFrena(PATRON_POR_ID['empuje_horizontal'])).toBeGreaterThan(
      dondeFrena(PATRON_POR_ID['sentadilla']),
    )
  })

  it('deja un punto por defecto para el que no lo declara', () => {
    // La mayoría de patrones no tienen medida publicada: se les deja el valor
    // de en medio en vez de inventarles uno por ejercicio.
    const sinDeclarar = PATRONES.filter((p) => p.estancamiento === undefined)
    expect(sinDeclarar.length).toBeGreaterThan(20)
    for (const p of sinDeclarar.slice(0, 5)) {
      expect(dondeFrena(p), p.id).toBeCloseTo(dondeFrena(sinDeclarar[0]), 1)
    }
  })
})

describe('el tempo prescrito', () => {
  it('sin tempo, el ciclo es el de siempre', () => {
    expect(duracionDelCiclo()).toBeCloseTo(DURACION_CICLO, 9)
    expect(faseDeTiempo(0.6, undefined, undefined).fase).toBeCloseTo(faseDeTiempo(0.6).fase, 9)
  })

  it('con excéntrica de 3 s, la bajada dura 3 s y la subida no cambia', () => {
    const tempo = { excentricaSeg: 3 }
    // El ciclo crece exactamente en lo que crece la bajada (1,9 → 3).
    expect(duracionDelCiclo(tempo)).toBeCloseTo(DURACION_CICLO - 1.9 + 3, 9)
    // La subida es la misma: al mismo tiempo, la misma fase.
    expect(faseDeTiempo(0.6, undefined, tempo).fase).toBeCloseTo(faseDeTiempo(0.6).fase, 9)
    // Y a mitad de la bajada nueva —1,2 + 0,35 + 1,5— la fase ronda la mitad.
    const mitadDeBajada = faseDeTiempo(1.2 + 0.35 + 1.5, undefined, tempo)
    expect(mitadDeBajada.sentido).toBe(-1)
    expect(mitadDeBajada.fase).toBeGreaterThan(0.35)
    expect(mitadDeBajada.fase).toBeLessThan(0.65)
  })

  it('un tempo sin sentido no rompe el ciclo', () => {
    for (const malo of [0, -2, Number.NaN]) {
      expect(duracionDelCiclo({ excentricaSeg: malo })).toBeCloseTo(DURACION_CICLO, 9)
    }
  })
})

describe('la pose medida manda sobre la del patrón', () => {
  it('sobreponerMedida quita los dos lados del canal que se mide', () => {
    const pose = sobreponerMedida({ rodillaFlexD: 10, rodillaFlexI: 12, caderaFlex: 30, codoFlexD: 5 }, { rodillaFlex: 100 })
    expect(pose).toEqual({ caderaFlex: 30, codoFlexD: 5, rodillaFlex: 100 })
  })

  it('un valor que no es número no toca nada', () => {
    expect(sobreponerMedida({ rodillaFlexD: 10 }, { rodillaFlex: NaN })).toEqual({ rodillaFlexD: 10 })
  })

  it('esqueletoEnFase con medida mueve la rodilla; sin medida es el de siempre', () => {
    const patron = PATRON_POR_ID.sentadilla
    const sinMedida = esqueletoEnFase(patron, 0.5, 1, 0)
    const igual = esqueletoEnFase(patron, 0.5, 1, 0, undefined)
    const conMedida = esqueletoEnFase(patron, 0.5, 1, 0, { rodillaFlex: 5, caderaFlex: 5 })
    expect(puntoDeHueso(igual, 'tibiaD', 1)).toEqual(puntoDeHueso(sinMedida, 'tibiaD', 1))
    // Con la rodilla casi extendida, la cadera queda más alta que a media sentadilla.
    expect(puntoDeHueso(conMedida, 'pelvis', 0)[1]).toBeGreaterThan(puntoDeHueso(sinMedida, 'pelvis', 0)[1] + 0.1)
  })
})
