import { describe, expect, it } from 'vitest'
import type { Arquitectura } from './anatomia'
import { PORCION_POR_CLAVE, PORCIONES, radioDePorcion } from './musculos'

describe('el grosor a lo largo del músculo', () => {
  const RADIO = 0.02

  it('es fino en los extremos y grueso en el vientre', () => {
    // Un músculo no es un tubo: son dos tendones y un vientre.
    const centro = radioDePorcion(0.5, RADIO, 1, 1)
    for (const t of [0, 1]) {
      expect(centro, `t=${t}`).toBeGreaterThan(radioDePorcion(t, RADIO, 1, 1) * 3)
    }
  })

  it('engorda el vientre al acortarse', () => {
    // Volumen constante: lo que pierde de largo lo gana de ancho, que es lo que
    // hay que ver de un patrón.
    const reposo = radioDePorcion(0.5, RADIO, 1, 1)
    const contraido = radioDePorcion(0.5, RADIO, 1.4, 1)
    expect(contraido).toBeGreaterThan(reposo * 1.3)
  })

  it('deja el tendón igual por mucho que se contraiga', () => {
    // Un tendón es colágeno: transmite fuerza y no cambia de grosor. Antes el
    // ensanche se aplicaba al tubo entero y el músculo se movía como una goma.
    for (const t of [0, 0.01, 0.99, 1]) {
      const reposo = radioDePorcion(t, RADIO, 1, 1)
      const contraido = radioDePorcion(t, RADIO, 1.55, 1)
      expect(contraido / reposo, `en t=${t} el tendón engorda`).toBeLessThan(1.06)
    }
  })

  it('reparte el engorde según lo carnoso que sea cada punto', () => {
    // No es un interruptor: entre el tendón y el vientre hay transición, o se
    // vería un escalón donde el músculo cambia de grosor de golpe.
    const razon = (t: number) => radioDePorcion(t, RADIO, 1.5, 1) / radioDePorcion(t, RADIO, 1, 1)
    expect(razon(0.5)).toBeGreaterThan(razon(0.25))
    expect(razon(0.25)).toBeGreaterThan(razon(0.05))
  })
})

describe('la arquitectura de las fibras', () => {
  const porcion = (clave: string) => PORCION_POR_CLAVE[clave].porcion

  it('declara penación solo donde las fibras van oblicuas', () => {
    // Un fusiforme tiene las fibras a lo largo del eje: darle un ángulo sería
    // decir que es penado.
    for (const { porcion: p, clave } of PORCIONES) {
      const arq = p.arquitectura ?? 'fusiforme'
      const oblicua = arq === 'unipenado' || arq === 'bipenado' || arq === 'multipenado'
      if (oblicua) {
        expect(p.penacion, `${clave} es ${arq} y no dice su ángulo`).toBeGreaterThan(0)
      } else {
        expect(p.penacion ?? 0, `${clave} es ${arq} y declara penación`).toBe(0)
      }
    }
  })

  it('mantiene los ángulos dentro de lo que existe en un cuerpo', () => {
    // Los penados humanos van de unos 10° a 30°. Fuera de ahí no es un músculo,
    // es un error de tecleo.
    for (const { porcion: p, clave } of PORCIONES) {
      if (!p.penacion) continue
      expect(p.penacion, clave).toBeGreaterThanOrEqual(8)
      expect(p.penacion, clave).toBeLessThanOrEqual(32)
    }
  })

  it('da a los de manual la arquitectura de manual', () => {
    // Los casos que cualquier libro usa como ejemplo. Si alguno cambia, es que
    // se ha tocado la tabla sin querer.
    expect(porcion('biceps.larga').arquitectura ?? 'fusiforme').toBe('fusiforme')
    expect(porcion('cuadriceps.recto').arquitectura).toBe('bipenado')
    expect(porcion('triceps_sural.gastro_medial').arquitectura).toBe('bipenado')
    expect(porcion('deltoides.medio').arquitectura).toBe('multipenado')
    expect(porcion('cuadriceps.vasto_lateral').arquitectura).toBe('unipenado')
    expect(porcion('pectoral_mayor.esternocostal').arquitectura).toBe('convergente')
  })

  it('el sóleo es el más penado de todos', () => {
    // Es lo que le permite meter tanta fuerza en tan poco recorrido, y es la
    // razón de que aguante el peso del cuerpo todo el día.
    const suyo = porcion('triceps_sural.soleo').penacion ?? 0
    for (const { porcion: p, clave } of PORCIONES) {
      if (clave === 'triceps_sural.soleo') continue
      expect(p.penacion ?? 0, clave).toBeLessThanOrEqual(suyo)
    }
  })
})

describe('la silueta según la arquitectura', () => {
  /** Perfil de grosor a lo largo de la porción, de origen a inserción. */
  const perfil = (arq: Arquitectura, n = 40) =>
    Array.from({ length: n + 1 }, (_, i) => radioDePorcion(i / n, 0.02, 1, 1, arq))

  it('hace el convergente ancho en el origen y fino en la inserción', () => {
    // Un pectoral o un dorsal nacen en una superficie grande y acaban en un
    // tendón: es la forma la que cuenta que muchas fibras tiran de un solo sitio.
    const p = perfil('convergente')
    expect(p[2]).toBeGreaterThan(p[p.length - 3] * 2)
  })

  it('mantiene el paralelo casi igual de grueso todo el recorrido', () => {
    // Un recto abdominal o un sartorio no tienen vientre: son una banda. Con el
    // perfil fusiforme parecían un huso, que es otro músculo.
    const p = perfil('plano').slice(4, -4)
    expect(Math.max(...p) / Math.min(...p)).toBeLessThan(1.5)
  })

  it('le da al fusiforme su vientre en medio', () => {
    const p = perfil('fusiforme')
    const medio = p[Math.floor(p.length / 2)]
    // El perfil tiene un suelo para que ningún extremo quede con radio cero, así
    // que el salto no puede ser mayor de lo que ese suelo permite.
    expect(medio).toBeGreaterThan(p[3] * 1.6)
    expect(medio).toBeGreaterThan(p[p.length - 4] * 1.6)
  })

  it('le da al penado un vientre más corto y tendones más largos', () => {
    // Es la diferencia de forma entre un bíceps y un gemelo: el penado mete el
    // músculo en menos recorrido y deja más tendón a cada lado.
    const fus = perfil('fusiforme')
    const bip = perfil('bipenado')
    const anchoDeVientre = (p: number[]) => {
      const tope = Math.max(...p)
      return p.filter((v) => v > tope * 0.8).length
    }
    expect(anchoDeVientre(bip)).toBeLessThan(anchoDeVientre(fus))
  })

  it('nunca deja una porción sin grosor', () => {
    // Un radio cero parte el tubo en dos y deja un agujero.
    for (const arq of ['fusiforme', 'unipenado', 'bipenado', 'multipenado', 'convergente', 'plano'] as Arquitectura[]) {
      for (const v of perfil(arq)) {
        expect(v, arq).toBeGreaterThan(0)
        expect(Number.isFinite(v), arq).toBe(true)
      }
    }
  })
})

describe('los grupos musculares, uno por uno', () => {
  it('declara la arquitectura de todas las porciones', () => {
    // El campo es obligatorio en el tipo, así que esto no puede fallar por
    // olvido. Se comprueba igual porque una porción nueva podría entrar con un
    // valor puesto para salir del paso.
    for (const { porcion, clave } of PORCIONES) {
      expect(porcion.arquitectura, `${clave} sin arquitectura`).toBeTruthy()
    }
  })

  it('da abanico a todos los convergentes', () => {
    // Un convergente sin fascículos repartidos es un tubo triangular: lo que lo
    // define es que nace en una superficie ancha y todo acaba en el mismo sitio.
    // Sin el abanico, esa idea no se ve.
    for (const { porcion, clave } of PORCIONES) {
      if (porcion.arquitectura !== 'convergente') continue
      expect(porcion.fasciculos ?? 1, `${clave} converge sin abanico`).toBeGreaterThan(1)
      expect(porcion.abanicoDesde, `${clave} no dice por dónde se reparte`).toBeDefined()
    }
  })

  it('no reparte el abanico más allá de lo que mide el hueso', () => {
    // El vector va en metros: un cero de más manda los fascículos a medio metro
    // del origen y el músculo sale disparado.
    for (const { porcion, clave } of PORCIONES) {
      const a = porcion.abanicoDesde ?? porcion.abanicoHasta
      if (!a) continue
      const largo = Math.hypot(a[0], a[1], a[2])
      expect(largo, `${clave} reparte ${(largo * 100).toFixed(0)} cm`).toBeLessThan(0.2)
    }
  })

  it('reparte cada familia sin dejar ninguna vacía', () => {
    // Si una arquitectura se queda sin porciones es que se declaró un tipo que
    // nadie usa, y entonces sobra del modelo.
    const familias = new Set(PORCIONES.map((p) => p.porcion.arquitectura))
    for (const f of ['fusiforme', 'unipenado', 'bipenado', 'multipenado', 'convergente', 'plano']) {
      expect(familias.has(f as never), `nadie es ${f}`).toBe(true)
    }
  })
})
