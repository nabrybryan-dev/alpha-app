import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { colocar, escribirPieza, leerPieza, type PartePieza } from './piezas3d'

/**
 * EL FORMATO `.pieza`, probado por los dos lados.
 *
 * Ida y vuelta: lo que escribe `escribirPieza` lo lee `leerPieza` byte a byte. Y la
 * pieza REAL que exportó Blender —`public/piezas/rack-sentadillas.pieza`— se lee con las
 * cuentas que se esperan de un rack: dos texturas, ocho mil y pico vértices, apoyado en
 * el suelo y de dos metros y medio. Si el exportador de Python y este lector se separan
 * en un byte, la segunda prueba lo dice.
 */

function parte(textura: string | null, triangulos: number, semilla: number): PartePieza {
  const nV = triangulos * 3
  const posicion = new Float32Array(nV * 3)
  const normal = new Float32Array(nV * 3)
  const color = new Float32Array(nV * 3)
  const uv = new Float32Array(nV * 2)
  const indice = new Uint32Array(triangulos * 3)
  for (let v = 0; v < nV; v++) {
    for (let k = 0; k < 3; k++) {
      posicion[v * 3 + k] = Math.sin(semilla + v * 0.3 + k)
      normal[v * 3 + k] = Math.cos(semilla + v * 0.7 + k)
      color[v * 3 + k] = ((semilla + v + k) % 7) / 7
    }
    uv[v * 2] = (v % 5) / 5
    uv[v * 2 + 1] = (v % 3) / 3
  }
  for (let i = 0; i < indice.length; i++) indice[i] = i
  return { textura, posicion, normal, color, uv, indice }
}

describe('el formato .pieza', () => {
  it('ida y vuelta: lo escrito se lee igual, con su textura', () => {
    const partes = [parte('rack-acero', 4, 1), parte(null, 2, 2), parte('x', 1, 3)]
    const mallas = leerPieza(escribirPieza(partes))
    expect(mallas).toHaveLength(3)
    mallas.forEach((m, i) => {
      const p = partes[i]
      expect(m.textura).toBe(p.textura)
      expect(m.vertices).toBe(p.posicion.length / 3)
      expect(Array.from(m.posicion)).toEqual(Array.from(p.posicion))
      expect(Array.from(m.normal)).toEqual(Array.from(p.normal))
      expect(Array.from(m.color)).toEqual(Array.from(p.color))
      expect(Array.from(m.uv)).toEqual(Array.from(p.uv))
      expect(Array.from(m.indice)).toEqual(Array.from(p.indice))
    })
  })

  it('los arrays quedan alineados a 4 bytes sea cual sea el largo del nombre', () => {
    // Un nombre de 1, 2, 3 y 5 letras: si el relleno estuviera mal, `Float32Array`
    // sobre un desplazamiento impar lanza, o lee basura.
    for (const nombre of ['a', 'ab', 'abc', 'abcde']) {
      const m = leerPieza(escribirPieza([parte(nombre, 2, 9), parte('otra', 1, 4)]))
      expect(m[0].textura).toBe(nombre)
      expect(m[1].textura).toBe('otra')
      expect(m[1].vertices).toBe(3)
    }
  })

  it('la bandera de luz grabada viaja en el formato, y `colocar` la conserva', () => {
    const partes = [{ ...parte('a', 1, 1), horneada: true }, parte('b', 1, 2)]
    const mallas = leerPieza(escribirPieza(partes))
    expect(mallas.map((m) => m.horneada)).toEqual([true, false])
    expect(colocar(mallas, { x: 1, z: 1, giroY: 0.3 }).map((m) => m.horneada)).toEqual([true, false])
  })

  it('sigue leyendo la versión 1, sin banderas', () => {
    // La versión 1 no lleva el u32 de banderas: se fabrica a mano a partir de una v2
    // quitándole esos cuatro bytes y bajando el número de versión.
    const v2 = new Uint8Array(escribirPieza([parte('t', 1, 4)]))
    const largo = 1
    const cabecera = 8 + 2 + largo + 1 // 'PIEZ' + versión + nPartes + u16 + 't' + relleno
    const v1 = new Uint8Array(v2.length - 4)
    v1.set(v2.subarray(0, cabecera), 0)
    v1.set(v2.subarray(cabecera + 4), cabecera)
    new DataView(v1.buffer).setUint16(4, 1, true)
    const [m] = leerPieza(v1.buffer)
    expect(m.textura).toBe('t')
    expect(m.horneada).toBe(false)
    expect(m.vertices).toBe(3)
  })

  it('rechaza lo que no es una pieza en vez de dibujarlo a medias', () => {
    const basura = new Uint8Array([80, 78, 71, 13, 0, 0, 0, 0]).buffer
    expect(() => leerPieza(basura)).toThrow(/no es una pieza/)
  })

  it('`colocar` gira y traslada las posiciones, gira las normales, y no toca el original', () => {
    const [m] = leerPieza(escribirPieza([parte('t', 1, 5)]))
    const antes = Array.from(m.posicion)
    const [c] = colocar([m], { x: 10, z: 0, giroY: Math.PI / 2 })
    // Un cuarto de vuelta lleva +Z a +X: la componente z de la posición pasa a x.
    expect(c.posicion[0]).toBeCloseTo(antes[2] + 10, 5)
    expect(c.posicion[1]).toBeCloseTo(antes[1], 5)
    expect(c.normal[0]).toBeCloseTo(m.normal[2], 5)
    expect(c.textura).toBe('t')
    expect(Array.from(m.posicion)).toEqual(antes)
  })
})

describe('la pieza real de la sala del gimnasio', () => {
  const bytes = readFileSync('public/piezas/sala-gimnasio.pieza')
  const mallas = leerPieza(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))

  it('trae una parte por imagen más las de color plano, todas con la luz grabada', () => {
    const texturas = new Set(mallas.map((m) => m.textura))
    for (const t of ['suelo-goma', 'hormigon', 'gym-atlas', 'rack-acero', 'rack-barra', null]) {
      expect(texturas.has(t), `falta la parte «${t}»`).toBe(true)
    }
    expect(mallas.every((m) => m.horneada)).toBe(true)
  })

  it('es una sala de 16 × 11 × 3,8 con el suelo en cero, y cabe en un teléfono', () => {
    const total = mallas.reduce((n, m) => n + m.vertices, 0)
    expect(total).toBeGreaterThan(30000)
    expect(total).toBeLessThan(120000)
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (const m of mallas) {
      expect(m.posicion.every(Number.isFinite)).toBe(true)
      expect(m.normal.every(Number.isFinite)).toBe(true)
      expect(m.color.every(Number.isFinite)).toBe(true)
      for (let i = 0; i < m.posicion.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], m.posicion[i + k])
          max[k] = Math.max(max[k], m.posicion[i + k])
        }
      }
    }
    expect(max[0] - min[0]).toBeCloseTo(16.2, 0)
    expect(max[2] - min[2]).toBeCloseTo(11.2, 0)
    expect(min[1]).toBeGreaterThan(-0.15)
    expect(max[1]).toBeCloseTo(3.9, 0)
  })

  it('nada vive dentro de la órbita de la cámara salvo el suelo, el techo y lo del centro', () => {
    // La cámara orbita a 4,6 m del sujeto y como mucho a 2 m de alto. Lo que esté de pie
    // a menos de 4,4 m de la vertical del origen se le cruza por delante. Se toleran el
    // suelo y las marcas planas del centro —plataforma, LED del suelo: nada que levante
    // más de 12 cm— y lo que cuelga del techo por encima de 3,1 m: conductos con sus
    // abrazaderas, tiras y sus cables, que la cámara no alcanza.
    let intrusos = 0
    for (const m of mallas) {
      for (let i = 0; i < m.posicion.length; i += 3) {
        const [x, y, z] = [m.posicion[i], m.posicion[i + 1], m.posicion[i + 2]]
        if (y > 0.12 && y < 3.1 && Math.hypot(x, z) < 4.4) intrusos++
      }
    }
    expect(intrusos).toBe(0)
  })
})
