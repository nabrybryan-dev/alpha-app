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
  it('ida y vuelta: lo escrito se lee dentro de la precisión de cada campo', () => {
    // La versión 3 guarda cada número en el tamaño que necesita, así que la vuelta ya no
    // es byte a byte: es dentro de una tolerancia que se declara AQUÍ y que es lo que hace
    // honesto el ahorro. Si alguien recorta más de la cuenta, esto se pone rojo.
    const partes = [parte('rack-acero', 4, 1), parte(null, 2, 2), parte('x', 1, 3)]
    const mallas = leerPieza(escribirPieza(partes))
    expect(mallas).toHaveLength(3)
    mallas.forEach((m, i) => {
      const p = partes[i]
      expect(m.textura).toBe(p.textura)
      expect(m.vertices).toBe(p.posicion.length / 3)
      // Posición: u16 sobre el rango de la parte. Con estas mallas de ±1 el paso es
      // microscópico; en la sala de 16 m son 0,25 mm.
      const rango = Math.max(...p.posicion) - Math.min(...p.posicion)
      const paso = rango / 65535
      for (let k = 0; k < p.posicion.length; k++) {
        expect(Math.abs(m.posicion[k] - p.posicion[k]), `posición ${k}`).toBeLessThanOrEqual(paso)
      }
      // Normal: i8, menos de medio grado.
      for (let k = 0; k < p.normal.length; k++) expect(Math.abs(m.normal[k] - p.normal[k])).toBeLessThan(1 / 127)
      // Color: u8, que es toda la precisión que tiene un color de pantalla.
      for (let k = 0; k < p.color.length; k++) expect(Math.abs(m.color[k] - p.color[k])).toBeLessThan(1 / 255)
      // Los índices son exactos: redondearlos sería cambiar la malla.
      expect(Array.from(m.indice)).toEqual(Array.from(p.indice))
    })
  })

  it('una parte sin textura no guarda coordenadas: eran ceros', () => {
    const conUv = escribirPieza([parte('t', 40, 1)]).byteLength
    const sinTextura = { ...parte(null, 40, 1), uv: new Float32Array(240) }
    const sinUv = escribirPieza([sinTextura]).byteLength
    expect(sinUv).toBeLessThan(conUv)
    // Y al leerla, las coordenadas vuelven a cero sin que nadie las haya guardado.
    const [m] = leerPieza(escribirPieza([sinTextura]))
    expect(Array.from(m.uv).every((v) => v === 0)).toBe(true)
  })

  it('pesa menos de la mitad que la versión de floats', () => {
    // 44 bytes por vértice (tres arrays de 12 y uno de 8) más 4 por índice, contra 16 y 2.
    const p = parte('t', 500, 7)
    const comoAntes = (p.posicion.length + p.normal.length + p.color.length + p.uv.length) * 4 + p.indice.length * 4
    expect(escribirPieza([p]).byteLength).toBeLessThan(comoAntes / 2)
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

  it('sigue leyendo la versión 1, sin banderas y con todo en floats', () => {
    // Se fabrica a mano, byte a byte, en vez de derivarla de la que se escribe hoy: una
    // pieza v1 vieja tiene que seguir abriéndose, y si el lector se rompe para ella esto
    // lo dice. Cabecera + una parte de un triángulo con textura «t».
    const p = parte('t', 1, 4)
    const cabecera = 8 + 4 // 'PIEZ' + u16 versión + u16 partes + (u16 largo + 't' + relleno)
    const datos = (3 * 3 * 3 + 3 * 2 + 3) * 4 // pos+nrm+col (9 cada uno) + uv (6) + idx (3)
    const bytes = new ArrayBuffer(cabecera + 8 + datos)
    const v = new DataView(bytes)
    for (let i = 0; i < 4; i++) v.setUint8(i, 'PIEZ'.charCodeAt(i))
    v.setUint16(4, 1, true)
    v.setUint16(6, 1, true)
    v.setUint16(8, 1, true)
    v.setUint8(10, 't'.charCodeAt(0))
    v.setUint32(12, 3, true)
    v.setUint32(16, 3, true)
    let pos = 20
    for (const a of [p.posicion, p.normal, p.color, p.uv]) {
      new Float32Array(bytes, pos, a.length).set(a)
      pos += a.byteLength
    }
    new Uint32Array(bytes, pos, 3).set(p.indice)

    const [m] = leerPieza(bytes)
    expect(m.textura).toBe('t')
    expect(m.horneada).toBe(false)
    expect(m.vertices).toBe(3)
    // Y en la v1 no hay cuantización: los floats vuelven exactos.
    expect(Array.from(m.posicion)).toEqual(Array.from(p.posicion))
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
