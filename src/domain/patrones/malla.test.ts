import { describe, expect, it } from 'vitest'
import { entre, grados, limitar, M4, suavizar, V, type Vec3 } from './algebra'
import { curva, elipsoide, flecha, hornear, huesoLargo, Malla, tubo, tuboDiscontinuo } from './malla'

describe('el álgebra', () => {
  it('opera sobre vectores', () => {
    expect(V.sumar([1, 2, 3], [1, 1, 1])).toEqual([2, 3, 4])
    expect(V.restar([1, 2, 3], [1, 1, 1])).toEqual([0, 1, 2])
    expect(V.escalar([1, 2, 3], 2)).toEqual([2, 4, 6])
    expect(V.punto([1, 0, 0], [1, 0, 0])).toBe(1)
    expect(V.cruz([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1])
    expect(V.largo([3, 4, 0])).toBe(5)
    expect(V.entre([0, 0, 0], [2, 2, 2], 0.5)).toEqual([1, 1, 1])
  })

  it('normaliza sin dividir por cero', () => {
    expect(V.normalizar([0, 5, 0])).toEqual([0, 1, 0])
    // Un vector nulo aparece cuando dos puntos de control coinciden; devolverlo
    // tal cual es preferible a propagar NaN por toda la malla.
    expect(V.normalizar([0, 0, 0]).every(Number.isFinite)).toBe(true)
  })

  it('multiplica matrices dejando la identidad como elemento neutro', () => {
    const m = M4.euler(0.3, -0.2, 0.1)
    expect(M4.multiplicar(m, M4.identidad())).toEqual(m)
    expect(M4.multiplicar(M4.identidad(), m)).toEqual(m)
  })

  it('traslada y gira puntos', () => {
    expect(M4.transformarPunto(M4.trasladar(1, 2, 3), [0, 0, 0])).toEqual([1, 2, 3])
    const girado = M4.transformarPunto(M4.girarY(Math.PI / 2), [1, 0, 0])
    expect(girado[0]).toBeCloseTo(0, 6)
    expect(girado[2]).toBeCloseTo(-1, 6)
  })

  it('distingue transformar un punto de transformar una dirección', () => {
    // La dirección ignora la traslación: es lo que hace que una normal siga
    // apuntando bien cuando el hueso se mueve.
    const m = M4.trasladar(5, 5, 5)
    expect(M4.transformarDireccion(m, [1, 0, 0])).toEqual([1, 0, 0])
    expect(M4.transformarPunto(m, [1, 0, 0])).toEqual([6, 5, 5])
  })

  it('gira sobre los tres ejes en el sentido esperado', () => {
    const enX = M4.transformarDireccion(M4.girarX(Math.PI / 2), [0, 1, 0])
    expect(enX[2]).toBeCloseTo(1, 6)
    const enZ = M4.transformarDireccion(M4.girarZ(Math.PI / 2), [1, 0, 0])
    expect(enZ[1]).toBeCloseTo(1, 6)
  })

  it('construye una proyección en perspectiva utilizable', () => {
    const p = M4.perspectiva(grados(34), 1.5, 0.05, 40)
    expect(p).toHaveLength(16)
    expect(p.every(Number.isFinite)).toBe(true)
    // La cuarta columna proyecta la profundidad: sin ese −1 no hay perspectiva.
    expect(p[11]).toBe(-1)
  })

  it('mira desde un ojo hacia un centro', () => {
    const v = M4.mirarDesde([0, 0, 5], [0, 0, 0], [0, 1, 0])
    // El centro cae delante de la cámara, o sea en Z negativa.
    expect(M4.transformarPunto(v, [0, 0, 0])[2]).toBeCloseTo(-5, 6)
  })

  it('convierte grados, acota y suaviza', () => {
    expect(grados(180)).toBeCloseTo(Math.PI, 10)
    expect(limitar(5, 0, 1)).toBe(1)
    expect(limitar(-5, 0, 1)).toBe(0)
    expect(limitar(0.5, 0, 1)).toBe(0.5)
    expect(entre(0, 10, 0.25)).toBe(2.5)
    // Arranca y termina despacio: es el perfil de una repetición controlada.
    expect(suavizar(0)).toBe(0)
    expect(suavizar(1)).toBe(1)
    expect(suavizar(0.5)).toBe(0.5)
    expect(suavizar(0.1)).toBeLessThan(0.1)
  })
})

describe('la curva de control', () => {
  it('interpola en línea recta con dos puntos', () => {
    const c = curva([[0, 0, 0], [0, 10, 0]], 11)
    expect(c).toHaveLength(11)
    expect(c[5][1]).toBeCloseTo(5, 6)
  })

  it('pasa por los extremos con más puntos', () => {
    const c = curva([[0, 0, 0], [1, 2, 0], [2, 0, 0]], 15)
    expect(c[0]).toEqual([0, 0, 0])
    expect(c[14][0]).toBeCloseTo(2, 6)
    expect(c.every((p) => p.every(Number.isFinite))).toBe(true)
  })
})

describe('la construcción de malla', () => {
  it('genera un tubo cerrado por los extremos', () => {
    const m = new Malla()
    tubo(m, curva([[0, 0, 0], [0, 1, 0]], 6), () => 0.1, { radial: 8 })
    expect(m.vertices).toBe(6 * 8 + 2) // los dos vértices de las tapas
    expect(m.indice.length % 3).toBe(0)
  })

  it('deja el tubo abierto si se le dice', () => {
    const m = new Malla()
    tubo(m, curva([[0, 0, 0], [0, 1, 0]], 6), () => 0.1, { radial: 8, tapar: false })
    expect(m.vertices).toBe(6 * 8)
  })

  it('no se retuerce en una curva cerrada', () => {
    // Es el fallo clásico de orientar cada sección con un «arriba» fijo: en una
    // curva que dobla, el tubo se estrangula sobre sí mismo.
    const m = new Malla()
    const anillo: Vec3[] = []
    for (let i = 0; i < 24; i++) {
      const a = (i / 23) * Math.PI * 1.8
      anillo.push([Math.cos(a), Math.sin(a), 0])
    }
    tubo(m, anillo, () => 0.05, { radial: 8 })
    expect(m.posicion.every(Number.isFinite)).toBe(true)
    expect(m.normal.every(Number.isFinite)).toBe(true)
  })

  it('achata la sección cuando se le pide', () => {
    const redondo = new Malla()
    tubo(redondo, curva([[0, 0, 0], [0, 1, 0]], 4), () => 0.2, { radial: 12 })
    const plano = new Malla()
    tubo(plano, curva([[0, 0, 0], [0, 1, 0]], 4), () => 0.2, { radial: 12, aplanar: 0.3 })
    // El achatamiento va sobre el binormal del tubo, y para un tubo vertical
    // ese eje puede caer en X o en Z: se compara el más estrecho de los dos.
    const ancho = (m: Malla, eje: number) => {
      const v: number[] = []
      for (let i = eje; i < m.posicion.length; i += 3) v.push(m.posicion[i])
      return Math.max(...v) - Math.min(...v)
    }
    const estrecho = (m: Malla) => Math.min(ancho(m, 0), ancho(m, 2))
    expect(estrecho(plano)).toBeLessThan(estrecho(redondo))
  })

  it('genera un elipsoide con los radios pedidos', () => {
    const m = new Malla()
    elipsoide(m, [0, 0, 0], [1, 2, 3], { su: 12, sv: 8 })
    const eje = (i: number) => {
      const v: number[] = []
      for (let k = i; k < m.posicion.length; k += 3) v.push(m.posicion[k])
      return Math.max(...v)
    }
    expect(eje(0)).toBeCloseTo(1, 5)
    expect(eje(1)).toBeCloseTo(2, 5)
    expect(eje(2)).toBeCloseTo(3, 5)
  })

  it('gira el elipsoide si se le pasa una rotación', () => {
    const m = new Malla()
    elipsoide(m, [0, 0, 0], [1, 0.1, 0.1], { su: 10, sv: 6, giro: M4.girarZ(Math.PI / 2) })
    const alturas: number[] = []
    for (let i = 1; i < m.posicion.length; i += 3) alturas.push(m.posicion[i])
    // El eje largo pasa de X a Y.
    expect(Math.max(...alturas)).toBeCloseTo(1, 5)
  })

  it('ensancha las epífisis del hueso largo', () => {
    const m = new Malla()
    huesoLargo(m, [0, 0, 0], [0, 1, 0], 0.02, { epifisisA: 3, epifisisB: 3 })
    const radioEn = (yObjetivo: number) => {
      let max = 0
      for (let i = 0; i < m.posicion.length; i += 3) {
        if (Math.abs(m.posicion[i + 1] - yObjetivo) > 0.06) continue
        max = Math.max(max, Math.hypot(m.posicion[i], m.posicion[i + 2]))
      }
      return max
    }
    // El perfil, y no el grosor, es lo que hace que se lea como hueso.
    expect(radioEn(0)).toBeGreaterThan(radioEn(0.5))
    expect(radioEn(1)).toBeGreaterThan(radioEn(0.5))
  })

  it('arquea el hueso largo sin romper la malla', () => {
    const m = new Malla()
    huesoLargo(m, [0, 0, 0], [0, 1, 0], 0.02, { arqueo: 0.05 })
    expect(m.posicion.every(Number.isFinite)).toBe(true)
    expect(m.vertices).toBeGreaterThan(0)
  })

  it('parte el trazo discontinuo en varios tramos', () => {
    const m = new Malla()
    const recta = curva([[0, 0, 0], [0, 1, 0]], 20)
    tuboDiscontinuo(m, recta, 0.01, [1, 1, 0], [0.3, 0.3, 0], 0.5, 0.05, 0.05)
    expect(m.vertices).toBeGreaterThan(50)
    // La mitad recorrida va encendida y la otra apagada: dos colores distintos.
    const rojos = new Set<number>()
    for (let i = 0; i < m.color.length; i += 3) rojos.add(m.color[i])
    expect(rojos.size).toBe(2)
  })

  it('ignora un trazo sin longitud en vez de dividir por cero', () => {
    const m = new Malla()
    tuboDiscontinuo(m, [[0, 0, 0], [0, 0, 0]], 0.01, [1, 1, 0], [0, 0, 0], 1, 0.05, 0.05)
    expect(m.vertices).toBe(0)
    const n = new Malla()
    tuboDiscontinuo(n, [[0, 0, 0]], 0.01, [1, 1, 0], [0, 0, 0], 1, 0.05, 0.05)
    expect(n.vertices).toBe(0)
  })

  it('pone la punta de flecha en el extremo y no en cualquier sitio', () => {
    const m = new Malla()
    flecha(m, [0, 0, 0], [0, 1, 0], 0.02, [1, 1, 0])
    let masAlto = -Infinity
    for (let i = 1; i < m.posicion.length; i += 3) masAlto = Math.max(masAlto, m.posicion[i])
    expect(masAlto).toBeCloseTo(1, 3)
  })

  it('no dibuja flecha si no hay dirección', () => {
    const m = new Malla()
    flecha(m, [1, 1, 1], [1, 1, 1], 0.02, [1, 1, 0])
    expect(m.vertices).toBe(0)
  })
})

describe('hornear', () => {
  it('lleva cada vértice a su hueso y lo deja sin hueso, conservando color, fibra e índices', () => {
    const origen = new Malla(16)
    // Un triángulo colgado del hueso 1, con fibra y color propios.
    origen.verticeSuelto(0, 0, 0, 0, 1, 0, [0.2, 0.4, 0.6], 1, 0.11)
    origen.verticeSuelto(1, 0, 0, 0, 1, 0, [0.2, 0.4, 0.6], 1, 0.22)
    origen.verticeSuelto(0, 0, 1, 0, 1, 0, [0.2, 0.4, 0.6], 1, 0.33)
    origen.triangulo(0, 1, 2)
    origen.alfa = 0.5
    // La paleta: la identidad en 0 y una traslación de dos metros en Y en 1.
    const matrices = [M4.identidad(), M4.trasladar(0, 2, 0)]

    const h = hornear(origen, matrices)
    expect(h.vertices).toBe(3)
    expect(Array.from(h.hueso)).toEqual([0, 0, 0])
    expect(h.posicion[1]).toBeCloseTo(2, 9)
    expect(h.posicion[4]).toBeCloseTo(2, 9)
    // La normal es una DIRECCIÓN: la traslación no la mueve.
    expect(Array.from(h.normal.subarray(0, 3))).toEqual([0, 1, 0])
    expect(Array.from(h.color.subarray(0, 3)).map((v) => Math.round(v * 10) / 10)).toEqual([0.2, 0.4, 0.6])
    expect(Array.from(h.fibra).map((v) => Math.round(v * 100) / 100)).toEqual([0.11, 0.22, 0.33])
    expect(Array.from(h.indice)).toEqual([0, 1, 2])
    expect(h.alfa).toBe(0.5)
  })

  it('reutiliza el destino sin dejar restos del fotograma anterior', () => {
    const a = new Malla(8)
    a.verticeSuelto(0, 0, 0, 0, 1, 0, [1, 1, 1], 0)
    a.verticeSuelto(1, 0, 0, 0, 1, 0, [1, 1, 1], 0)
    a.verticeSuelto(0, 0, 1, 0, 1, 0, [1, 1, 1], 0)
    a.triangulo(0, 1, 2)
    const destino = new Malla(8)
    hornear(a, [M4.identidad()], destino)
    const b = new Malla(8)
    b.verticeSuelto(5, 5, 5, 0, 1, 0, [1, 1, 1], 0)
    b.verticeSuelto(6, 5, 5, 0, 1, 0, [1, 1, 1], 0)
    b.verticeSuelto(5, 5, 6, 0, 1, 0, [1, 1, 1], 0)
    b.triangulo(0, 1, 2)
    const h = hornear(b, [M4.identidad()], destino)
    expect(h).toBe(destino)
    expect(h.vertices).toBe(3)
    expect(h.posicion[0]).toBe(5)
  })
})
