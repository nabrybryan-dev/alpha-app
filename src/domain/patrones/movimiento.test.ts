import { describe, expect, it } from 'vitest'
import { PATRONES, PATRON_POR_ID } from './catalogo'
import { canalEnFase, hermiteMonotona, poseAnimada, RANGO, retardoDe } from './movimiento'
import { ALTURA_DEL_TOBILLO, puntoDeHueso, resolver, resolverConApoyo, type Lado } from './esqueleto'
import { construirMusculos, longitudesEnReposo, trazadoDeFasciculo, PORCION_POR_CLAVE } from './musculos'
import { V } from './algebra'

const reposo = longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0]))

const piesDe = (p: (typeof PATRONES)[number]): Lado[] =>
  p.pies ?? (p.apoyo === 'suelo' ? (['D', 'I'] as Lado[]) : [])

describe('el retardo distal', () => {
  it('crece según se baja por la cadena cinética', () => {
    // Es el orden que hace que un movimiento no se vea a robot: lo proximal
    // manda y lo distal obedece.
    expect(retardoDe('caderaFlex')).toBeLessThan(retardoDe('rodillaFlex'))
    expect(retardoDe('rodillaFlex')).toBeLessThan(retardoDe('tobilloPlantar'))
    expect(retardoDe('hombroFlex')).toBeLessThan(retardoDe('codoFlex'))
    expect(retardoDe('codoFlex')).toBeLessThan(retardoDe('muneca'))
  })

  it('hace que la rodilla vaya por detrás de la cadera a media repetición', () => {
    const p = PATRON_POR_ID.sentadilla
    const { pose } = poseAnimada(p, 0.5, 1, 0)
    // A mitad de bajada la rodilla todavía no ha llegado a donde le tocaría si
    // ambas articulaciones se interpolaran con la misma fase.
    const rodillaSinRetardo = canalEnFase(p, 'rodillaFlex', 0.5)
    expect(pose.rodillaFlex).toBeLessThan(rodillaSinRetardo)
  })

  it('cambia de signo al bajar, porque el retardo es en el tiempo', () => {
    const p = PATRON_POR_ID.sentadilla
    const subiendo = poseAnimada(p, 0.5, 1, 0).pose.rodillaFlex
    const bajando = poseAnimada(p, 0.5, -1, 0).pose.rodillaFlex
    expect(bajando).toBeGreaterThan(subiendo)
  })
})

describe('las capas de movimiento', () => {
  it('mantiene la cabeza mirando al frente cuando el tronco se inclina', () => {
    // La bisagra lleva el tronco casi horizontal; sin compensar, la mirada
    // acabaría clavada en el suelo.
    const { pose } = poseAnimada(PATRON_POR_ID.bisagra_cadera, 1, 1, 0)
    expect(pose.cuelloFlex).toBeLessThan(-20)
  })

  it('no toca el cuello cuando el sujeto está erguido', () => {
    const { pose } = poseAnimada(PATRON_POR_ID.flexion_codo, 0, 1, 0)
    expect(Math.abs(pose.cuelloFlex)).toBeLessThan(6)
  })

  it('mueve las extremidades que no trabajan, y no igual las dos', () => {
    // Es lo que separa un cuerpo de un maniquí con una pieza móvil: la simetría
    // perfecta se nota tanto como la rigidez.
    const { pose } = poseAnimada(PATRON_POR_ID.flexion_codo, 0.5, 1, 3.7)
    expect(pose.rodillaFlexD).toBeDefined()
    expect(pose.rodillaFlexD).not.toBe(pose.rodillaFlexI)
  })

  it('es determinista con el reloj parado', () => {
    // El encuadre y las pruebas dependen de esto: con reloj 0 no puede bailar.
    const a = poseAnimada(PATRON_POR_ID.sentadilla, 0.4, 1, 0).pose
    const b = poseAnimada(PATRON_POR_ID.sentadilla, 0.4, 1, 0).pose
    expect(a).toEqual(b)
  })

  it('adelanta los brazos cuando el patrón no los mueve por sí mismo', () => {
    // La flexión plantar deja el hombro quieto en la ficha, así que el
    // contrapeso es lo único que puede moverlo. En la sentadilla no aplica: ahí
    // los brazos ya llevan recorrido propio y no hace falta inventarles otro.
    const arriba = poseAnimada(PATRON_POR_ID.flexion_plantar, 0, 1, 0).pose
    const medio = poseAnimada(PATRON_POR_ID.flexion_plantar, 0.5, 1, 0).pose
    expect(medio.hombroFlexD).toBeGreaterThan(arriba.hombroFlexD ?? 0)
  })

  it('no le añade contrapeso al brazo que ya trabaja', () => {
    const p = PATRON_POR_ID.flexion_codo
    const { pose } = poseAnimada(p, 0.5, 1, 0)
    // Sin el contrapeso, el codo a media fase es el de la ficha con su retardo.
    expect(pose.codoFlexD).toBeUndefined()
    expect(pose.codoFlex).toBeCloseTo(canalEnFase(p, 'codoFlex', 0.5 - 0.068), 5)
  })
})

describe('cada patrón, en toda la repetición', () => {
  const fases = [0, 0.25, 0.5, 0.75, 1]

  it.each(PATRONES.map((p) => [p.id, p] as const))(
    '%s se resuelve sin salirse de rango ni del suelo',
    (_id, p) => {
      for (const fase of fases) {
        for (const sentido of [1, -1]) {
          const { pose, desplazamiento, giroRaiz } = poseAnimada(p, fase, sentido, 2.3)

          for (const [canal, valor] of Object.entries(pose)) {
            const rango = RANGO[canal.replace(/[DI]$/, '')]
            expect(rango, `canal desconocido "${canal}"`).toBeDefined()
            expect(Number.isFinite(valor), canal).toBe(true)
            expect(valor, `${canal}=${valor}`).toBeGreaterThanOrEqual(rango[0] - 0.01)
            expect(valor, `${canal}=${valor}`).toBeLessThanOrEqual(rango[1] + 0.01)
          }

          const pies = piesDe(p)
          const esq = resolverConApoyo(pose, desplazamiento, giroRaiz, p.apoyo, p.alturaApoyo, pies)

          if (p.apoyo === 'suelo' && pies.length) {
            for (const lado of pies) {
              for (const t of [0, 0.5, 1]) {
                // La PLANTA, no el hueso: la sonda va hacia +Z local, a la altura del tobillo.
                const y = puntoDeHueso(esq, 'pie' + lado, t, [0, 0, ALTURA_DEL_TOBILLO])[1]
                expect(y, `pie${lado} bajo el suelo en la fase ${fase}`).toBeGreaterThan(-0.02)
              }
            }
          }
        }
      }
    },
  )

  it.each(PATRONES.map((p) => [p.id, p] as const))(
    '%s genera una malla muscular finita',
    (_id, p) => {
      const { pose, desplazamiento, giroRaiz } = poseAnimada(p, 0.5, 1, 0)
      const esq = resolverConApoyo(pose, desplazamiento, giroRaiz, p.apoyo, p.alturaApoyo, piesDe(p))
      const malla = construirMusculos(esq, p.activacion, reposo)
      expect(malla.vertices).toBeGreaterThan(1000)
      expect(malla.posicion.every(Number.isFinite)).toBe(true)
      expect(malla.normal.every(Number.isFinite)).toBe(true)
    },
  )
})

describe('el acortamiento muscular', () => {
  it('acorta el agonista al ejecutar el movimiento', () => {
    // Es lo único que el visor tiene que enseñar de verdad: qué se acorta.
    const p = PATRON_POR_ID.flexion_codo
    const largoEn = (fase: number): number => {
      const { pose, desplazamiento, giroRaiz } = poseAnimada(p, fase, 1, 0)
      const esq = resolverConApoyo(pose, desplazamiento, giroRaiz, p.apoyo, p.alturaApoyo, piesDe(p))
      const trazado = trazadoDeFasciculo(esq, PORCION_POR_CLAVE['biceps.larga'].porcion, 'D', 0)
      let l = 0
      for (let i = 1; i < trazado.length; i++) l += V.largo(V.restar(trazado[i], trazado[i - 1]))
      return l
    }
    expect(largoEn(1)).toBeLessThan(largoEn(0))
  })

  it('estira el antagonista en el mismo gesto', () => {
    const p = PATRON_POR_ID.flexion_codo
    const largoEn = (fase: number): number => {
      const { pose, desplazamiento, giroRaiz } = poseAnimada(p, fase, 1, 0)
      const esq = resolverConApoyo(pose, desplazamiento, giroRaiz, p.apoyo, p.alturaApoyo, piesDe(p))
      const trazado = trazadoDeFasciculo(esq, PORCION_POR_CLAVE['triceps.larga'].porcion, 'D', 0)
      let l = 0
      for (let i = 1; i < trazado.length; i++) l += V.largo(V.restar(trazado[i], trazado[i - 1]))
      return l
    }
    expect(largoEn(1)).toBeGreaterThan(largoEn(0))
  })
})

describe('la trayectoria por las tres poses', () => {
  // Un canal con pose intermedia de verdad: la rodilla de la sentadilla adelanta pronto.
  const sentadilla = PATRONES.find((p) => p.id === 'sentadilla')!
  const conMedio = PATRONES.filter((p) => p.medio)

  it('pasa EXACTAMENTE por las tres poses del catálogo', () => {
    for (const p of conMedio) {
      for (const canal of Object.keys(p.medio!)) {
        expect(canalEnFase(p, canal, 0), `${p.id}.${canal} al inicio`).toBeCloseTo(p.inicio[canal] ?? 0, 9)
        expect(canalEnFase(p, canal, 0.5), `${p.id}.${canal} en medio`).toBeCloseTo(p.medio![canal], 9)
        expect(canalEnFase(p, canal, 1), `${p.id}.${canal} al final`).toBeCloseTo(p.fin[canal] ?? 0, 9)
      }
    }
  })

  it('la velocidad articular NO salta en la pose de en medio', () => {
    // Era dos rectas con un codo: la pendiente cambiaba de golpe a mitad de recorrido en
    // cada repetición. Se mide la derivada numérica por los dos lados de 0,5 y se exige
    // que sean la misma, con una tolerancia relativa al tamaño del movimiento.
    const h = 1e-4
    for (const p of conMedio) {
      for (const canal of Object.keys(p.medio!)) {
        const izquierda = (canalEnFase(p, canal, 0.5) - canalEnFase(p, canal, 0.5 - h)) / h
        const derecha = (canalEnFase(p, canal, 0.5 + h) - canalEnFase(p, canal, 0.5)) / h
        const recorrido = Math.abs((p.fin[canal] ?? 0) - (p.inicio[canal] ?? 0)) + 1
        expect(Math.abs(derecha - izquierda) / recorrido, `${p.id}.${canal} tiene codo`).toBeLessThan(0.02)
      }
    }
  })

  it('no rebasa ninguna pose por el camino: la rodilla no se hiperextiende', () => {
    for (const p of conMedio) {
      for (const canal of Object.keys(p.medio!)) {
        const a = p.inicio[canal] ?? 0
        const m = p.medio![canal]
        const b = p.fin[canal] ?? 0
        for (let f = 0; f <= 1; f += 0.01) {
          const v = canalEnFase(p, canal, f)
          const lo = f <= 0.5 ? Math.min(a, m) : Math.min(m, b)
          const hi = f <= 0.5 ? Math.max(a, m) : Math.max(m, b)
          expect(v, `${p.id}.${canal} rebasa en f=${f.toFixed(2)}`).toBeGreaterThanOrEqual(lo - 1e-9)
          expect(v, `${p.id}.${canal} rebasa en f=${f.toFixed(2)}`).toBeLessThanOrEqual(hi + 1e-9)
        }
      }
    }
  })

  it('cuando la pose de en medio es la media, la curva ES la recta', () => {
    // Los patrones sin curvatura real no cambian ni una décima.
    for (let f = 0; f <= 1; f += 0.05) {
      expect(hermiteMonotona(10, 55, 100, f)).toBeCloseTo(10 + 90 * f, 9)
    }
  })

  it('la rodilla de la sentadilla sigue adelantando pronto', () => {
    // La razón de la pose intermedia: a mitad de recorrido la rodilla ya lleva más de la
    // mitad de su flexión. La curva nueva tiene que conservar eso, no solo suavizarlo.
    const a = sentadilla.inicio.rodillaFlex ?? 0
    const b = sentadilla.fin.rodillaFlex ?? 0
    expect(canalEnFase(sentadilla, 'rodillaFlex', 0.5)).toBeGreaterThan((a + b) / 2)
  })
})
