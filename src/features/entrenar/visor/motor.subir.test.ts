/**
 * `Motor.subir()` SUBE EXACTAMENTE LOS MISMOS BYTES QUE ANTES.
 *
 * El 2026-09-02 se reescribió `subir()` para dejar de concatenar con
 * `push(...spread)` hacia un `number[]` y pasar a reservar arrays tipados y
 * escribir con `.set()`. Medido: 7,9× más rápido, unos 4,77 ms de fotograma.
 *
 * El problema es que **ninguna prueba de este repo toca `Motor`**: en jsdom
 * `getContext('webgl')` devuelve null, así que las 3.055 pruebas seguían verdes
 * con `subir()` roto. Es exactamente el falso verde contra el que avisa
 * `CLAUDE.md`, y una optimización que se cuela por un hueco de cobertura es la
 * forma más cara de ir rápido.
 *
 * Así que aquí se finge lo justo de WebGL para capturar lo que `subir()` le pasa
 * a `bufferData`, y se compara **byte a byte** contra una reimplementación del
 * algoritmo VIEJO. Si los dos no coinciden, la optimización está mal, por muy
 * rápida que sea.
 *
 * Y la prueba se vio fallar antes de darla por buena: con la reimplementación
 * vieja sumando `+1` a un índice, el caso de las tres mallas se pone en rojo.
 */

import { describe, expect, it } from 'vitest'
import { Malla } from '../../../domain/patrones/malla'
import { Motor } from './motor'

/**
 * El resultado que daba el algoritmo viejo. La referencia.
 *
 * Concatena con un bucle y no con `push(...spread)`, y eso NO es una licencia:
 * es que el original **no llega** a los tamaños que hay que probar. Ver
 * `elSpreadRevienta` más abajo. El resultado es idéntico; lo que cambia es que
 * esta versión sobrevive para poder comparar.
 */
function comoEraAntes(mallas: Malla[]) {
  const pos: number[] = []
  const nrm: number[] = []
  const col: number[] = []
  const hueso: number[] = []
  const fibra: number[] = []
  const idx: number[] = []
  let base = 0
  const meter = (destino: number[], origen: Float32Array) => {
    for (let i = 0; i < origen.length; i++) destino.push(origen[i])
  }
  for (const m of mallas) {
    meter(pos, m.posicion)
    meter(nrm, m.normal)
    meter(col, m.color)
    meter(hueso, m.hueso)
    meter(fibra, m.fibra)
    for (const i of m.indice) idx.push(i + base)
    base += m.vertices
  }
  const grande = base > 65535
  return {
    pos: new Float32Array(pos),
    nrm: new Float32Array(nrm),
    col: new Float32Array(col),
    hueso: new Float32Array(hueso),
    fibra: new Float32Array(fibra),
    idx: grande ? new Uint32Array(idx) : new Uint16Array(idx),
  }
}

/**
 * Lo mínimo de WebGL para que `Motor` se construya y `subir()` llegue a
 * `bufferData`. No dibuja nada: solo apunta qué se le entregó a cada búfer.
 */
function glDeMentira() {
  const subidas = new Map<string, ArrayBufferView>()
  let destinoArray: string | null = null
  let destinoIndices = false
  const nombres = new Map<object, string>()

  const gl: Record<string, unknown> = {
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    DYNAMIC_DRAW: 0x88e8,
    DEPTH_TEST: 0x0b71,
    CULL_FACE: 0x0b44,
    BACK: 0x0405,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    UNSIGNED_SHORT: 0x1403,
    UNSIGNED_INT: 0x1405,

    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: () => {},
    enable: () => {},
    disable: () => {},
    cullFace: () => {},
    // La mezcla alfa y la máscara de profundidad, que el motor pide desde que dibuja el
    // fantasma en dos tandas. Aquí no hacen nada: estas pruebas miran los búferes, no
    // el dibujo, y un `gl` de mentira que no tenga el método rompe el constructor.
    blendFunc: () => {},
    depthMask: () => {},
    depthFunc: () => {},
    clearColor: () => {},
    // La extensión de índices de 32 bits se declara disponible: es lo que hace
    // que el camino de más de 65.535 vértices se pueda probar de verdad.
    getExtension: () => ({}),

    createBuffer: () => {
      const b = {}
      // Los búferes se crean en el orden de `['pos','nrm','col','hueso','fibra','idx']`,
      // que es como el constructor los pide.
      const orden = ['pos', 'nrm', 'col', 'hueso', 'fibra', 'idx']
      nombres.set(b, orden[nombres.size] ?? `extra${nombres.size}`)
      return b
    },
    bindBuffer: (destino: number, b: object) => {
      destinoIndices = destino === 0x8893
      destinoArray = nombres.get(b) ?? null
    },
    bufferData: (_destino: number, datos: ArrayBufferView) => {
      // Se copia: `subir()` entrega una VISTA de su búfer reutilizado, y ese
      // búfer se sobrescribe en la llamada siguiente. Guardar la vista sin
      // copiar haría que la primera subida cambiara sola — y la prueba pasaría
      // comparando la segunda consigo misma.
      const c = new (datos.constructor as new (n: number) => ArrayBufferView & { set(v: unknown): void })(
        (datos as unknown as { length: number }).length,
      )
      c.set(datos as unknown as ArrayLike<number>)
      subidas.set(destinoIndices ? 'idx' : (destinoArray ?? '?'), c)
    },
  }
  return { gl, subidas }
}

function motorDeMentira() {
  const { gl, subidas } = glDeMentira()
  const lienzo = { getContext: () => gl } as unknown as HTMLCanvasElement
  return { motor: new Motor(lienzo), subidas }
}

/**
 * Una malla con geometría reconocible, distinta para cada semilla.
 *
 * OJO con la API, que ya se equivocó una vez al escribir esta prueba:
 * `vertice()` añade un vértice y `triangulo()` toma **tres índices**, no tres
 * posiciones. Llamar a `triangulo()` con posiciones compila —son números— y
 * deja la malla con cero vértices, así que la prueba pasaba comparando dos
 * búferes vacíos. Cuatro verdes que no valían nada.
 *
 * Por eso este ayudante comprueba al final que produjo lo que dijo.
 */
function mallaDePrueba(semilla: number, triangulos: number): Malla {
  const m = new Malla(8)
  for (let t = 0; t < triangulos; t++) {
    const base = t * 3
    for (let k = 0; k < 3; k++) {
      const f = semilla * 31 + t * 7 + k
      m.verticeSuelto(
        Math.sin(f * 0.31), Math.cos(f * 0.17), Math.sin(f * 0.53),
        Math.sin(f * 0.11), Math.cos(f * 0.29), Math.sin(f * 0.43),
        [0.2 + (semilla % 4) * 0.1, 0.5, 0.9],
        semilla % 5,
        f * 0.013,
      )
    }
    m.triangulo(base, base + 1, base + 2)
  }
  if (m.vertices !== triangulos * 3) throw new Error('la malla de prueba no se construyó')
  return m
}

function comparar(subidas: Map<string, ArrayBufferView>, esperado: ReturnType<typeof comoEraAntes>) {
  for (const clave of ['pos', 'nrm', 'col', 'hueso', 'fibra', 'idx'] as const) {
    const dio = subidas.get(clave)
    expect(dio, `no se subió el búfer «${clave}»`).toBeDefined()
    expect(Array.from(dio as unknown as ArrayLike<number>), `el búfer «${clave}» no coincide`).toEqual(
      Array.from(esperado[clave]),
    )
  }
}

describe('Motor.subir()', () => {
  it('con una sola malla sube lo mismo que el algoritmo viejo', () => {
    const { motor, subidas } = motorDeMentira()
    const mallas = [mallaDePrueba(1, 6)]
    motor.subir(mallas)
    comparar(subidas, comoEraAntes(mallas))
  })

  it('con varias mallas desplaza los índices igual que el algoritmo viejo', () => {
    const { motor, subidas } = motorDeMentira()
    // Tres mallas de distinto tamaño: si la base de los índices se calculara
    // mal, aquí es donde se ve. Con una sola malla la base es siempre 0 y el
    // error no se manifiesta.
    const mallas = [mallaDePrueba(1, 4), mallaDePrueba(2, 9), mallaDePrueba(3, 2)]
    motor.subir(mallas)
    comparar(subidas, comoEraAntes(mallas))
  })

  it('no arrastra restos de la escena anterior al reutilizar los búferes', () => {
    // Es el riesgo propio de guardar la memoria entre fotogramas: una escena
    // grande deja el búfer lleno, y si la siguiente es pequeña y se sube el
    // búfer entero, la tarjeta dibuja la escena vieja detrás de la nueva.
    const { motor, subidas } = motorDeMentira()
    motor.subir([mallaDePrueba(1, 40)])
    const pequena = [mallaDePrueba(9, 3)]
    motor.subir(pequena)
    comparar(subidas, comoEraAntes(pequena))
  })

  it('aguanta una malla que hacía reventar la pila al algoritmo viejo', () => {
    // ESTE ERA UN FALLO REAL, no una mejora de velocidad.
    //
    // `push(...m.posicion)` construye una lista de ARGUMENTOS con un elemento
    // por número. Con una malla de 22.000 triángulos son 198.000 argumentos en
    // una sola llamada, y el motor de JavaScript se queda sin pila:
    // `RangeError: Maximum call stack size exceeded`. No se degrada: lanza, y
    // el salón se queda en negro.
    //
    // No era teórico. El trabajo de amueblar la sala del 2026-09-02 metió 3.979
    // vértices de mobiliario, y la cuenta iba subiendo. Escribiendo con `.set()`
    // no hay lista de argumentos que construir y el límite desaparece.
    const gorda = mallaDePrueba(1, 22000)
    expect(() => {
      const v: number[] = []
      v.push(...gorda.posicion)
    }).toThrow(RangeError)

    const { motor, subidas } = motorDeMentira()
    expect(() => motor.subir([gorda])).not.toThrow()
    comparar(subidas, comoEraAntes([gorda]))
  })

  it('cambia a índices de 32 bits al pasar de 65.535 vértices', () => {
    const { motor, subidas } = motorDeMentira()
    // 22.000 triángulos son 66.000 vértices: justo por encima del límite de los
    // índices de 16 bits.
    const mallas = [mallaDePrueba(1, 22000)]
    motor.subir(mallas)
    expect(subidas.get('idx')).toBeInstanceOf(Uint32Array)
    comparar(subidas, comoEraAntes(mallas))
  })

  it('vuelve a 16 bits si la escena siguiente es pequeña', () => {
    // El búfer guardado es de 32 bits y CABE de sobra, así que una reserva que
    // solo mirase el tamaño lo reutilizaría y subiría índices del tipo
    // equivocado. La tarjeta los leería de dos en dos bytes: basura.
    const { motor, subidas } = motorDeMentira()
    motor.subir([mallaDePrueba(1, 22000)])
    const pequena = [mallaDePrueba(4, 5)]
    motor.subir(pequena)
    expect(subidas.get('idx')).toBeInstanceOf(Uint16Array)
    comparar(subidas, comoEraAntes(pequena))
  })
})
