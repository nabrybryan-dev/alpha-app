import { describe, expect, it } from 'vitest'
import { cuerpoDelAsesorado, proporcionesDeSusSeries } from './cuerpoDelAsesorado'
import { huellaDePista } from './patrones/huellaArticular'
import { LARGO, pistaSintetica } from './patrones/pistaSintetica'
import type { Microciclo, Perfil } from './types'

/**
 * CÓMO ES EL CUERPO DE ESTA PERSONA: el eslabón que junta los dos lados.
 *
 * La talla sale de la ficha y la forma de sus vídeos, y el sitio donde la forma queda
 * guardada no es obvio: la pista de pose NO se persiste —se importa, se lee y se tira—, así
 * que lo único que queda de ella es la huella, dentro de la medición de una serie. Buscarla
 * ahí es lo que hace este módulo, y es justo el paso donde un dato se pierde sin que nada
 * falle: el muñeco saldría con la forma del atlas y nadie sabría por qué.
 */

const huellaCon = (femur: number) =>
  huellaDePista(pistaSintetica({ repeticiones: 2, largo: { ...LARGO, femur } }))!

/** Un microciclo de mentira con una serie por huella, en el orden en que se pasen. */
function microciclo(numero: number, huellas: (ReturnType<typeof huellaCon> | undefined)[]): Microciclo {
  return {
    numero,
    sesiones: [
      {
        id: `s-${numero}`,
        nombre: 'SESIÓN',
        orden: 1,
        ejercicios: [
          {
            id: `e-${numero}`,
            categoria: 'SENTADILLA',
            nombre: 'Sentadilla con barra',
            cues: '',
            prescripcion: '',
            descansoMin: 2,
            sets: huellas.length,
            rango: '(8-12)',
            repsDiana: 10,
            rirObjetivo: 2,
            series: huellas.map((huella, i) => ({
              orden: i + 1,
              cargaKg: 60,
              velocidad: huella ? { huella } : undefined,
            })),
          },
        ],
      },
    ],
  } as unknown as Microciclo
}

describe('las proporciones que alguien ha dejado en sus series', () => {
  it('se encuentran donde de verdad están: dentro de la medición de una serie', () => {
    const p = proporcionesDeSusSeries([microciclo(1, [huellaCon(400)])])
    expect(p).toBeDefined()
    expect(p!.femur).toBeGreaterThan(0.1)
  })

  it('gana la ÚLTIMA, no la primera: lo que hay que dibujar es lo último que se sabe', () => {
    // Una persona cambia de cuerpo poco, pero una toma mala se corrige con otra mejor. Y el
    // recorrido va por número de microciclo, no por el orden en que lleguen del almacén.
    const vieja = huellaCon(360)
    const nueva = huellaCon(520)
    const p = proporcionesDeSusSeries([microciclo(7, [nueva]), microciclo(2, [vieja])])
    expect(p!.femur).toBeCloseTo(nueva.proporciones!.femur, 6)
  })

  it('se salta las series sin medir, que hoy son casi todas', () => {
    // Casi nadie graba: lo normal es que un microciclo entero no traiga ni una pista.
    const p = proporcionesDeSusSeries([microciclo(1, [undefined, undefined, huellaCon(480)])])
    expect(p!.femur).toBeCloseTo(huellaCon(480).proporciones!.femur, 6)
  })

  it('sin ninguna serie medida no hay forma, y eso NO es «proporciones normales»', () => {
    expect(proporcionesDeSusSeries([microciclo(1, [undefined])])).toBeUndefined()
    expect(proporcionesDeSusSeries([])).toBeUndefined()
    expect(proporcionesDeSusSeries(undefined)).toBeUndefined()
  })
})

describe('el cuerpo entero: talla de la ficha, forma de sus vídeos', () => {
  const perfil = (alturaCm?: number) =>
    ({ medidas: alturaCm === undefined ? [] : [{ fecha: '2026-09-01', alturaCm, perimetros: {} }] }) as unknown as Perfil

  it('junta las dos mitades cuando existen', () => {
    const c = cuerpoDelAsesorado(perfil(168), [microciclo(1, [huellaCon(500)])])
    expect(c.estaturaCm).toBe(168)
    expect(c.proporciones).toBeDefined()
  })

  it('las dos mitades son independientes: puede haber una y no la otra', () => {
    // Con talla y sin forma, el muñeco mide lo suyo con la forma del atlas. Con forma y sin
    // talla, la forma no llega a usarse por sí sola pero tampoco se inventa una altura.
    const soloTalla = cuerpoDelAsesorado(perfil(168), [microciclo(1, [undefined])])
    expect(soloTalla.estaturaCm).toBe(168)
    expect(soloTalla.proporciones).toBeUndefined()

    const soloForma = cuerpoDelAsesorado(perfil(undefined), [microciclo(1, [huellaCon(500)])])
    expect(soloForma.estaturaCm).toBeUndefined()
    expect(soloForma.proporciones).toBeDefined()
  })

  it('sin ficha y sin series, el sujeto es el de siempre', () => {
    const c = cuerpoDelAsesorado(undefined, undefined)
    expect(c.estaturaCm).toBeUndefined()
    expect(c.proporciones).toBeUndefined()
  })
})
