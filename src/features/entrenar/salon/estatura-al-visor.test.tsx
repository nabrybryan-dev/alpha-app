import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, hoyIso } from '../../../data/dbInstance'
import { cargaPorGrupo } from '../../../domain/fatiga'
import { notasDelMicrociclo } from '../../../domain/notasDeLaSemana'
import { requisitosParaPeldano } from '../../../domain/nivelesAlfa'
import { indiceRecuperacion } from '../../../domain/readiness'
import { esqueletoConJuego, JUEGOS } from '../../../domain/patrones/juegoDeHuesos'
import { juegoParaEstatura } from '../../../domain/patrones/estatura'
import { puntoDeHueso, resolver } from '../../../domain/patrones/esqueleto'
import {
  armarSemana,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  type DatosRuta,
} from '../../../domain/rutaEntrenamiento'
import { SalonEntrenar } from './SalonEntrenar'

/**
 * LA ESTATURA DE LA FICHA LLEGA AL VISOR — y con ella el sujeto cambia de talla.
 *
 * Hasta el 2026-09-06 el muñeco del salón medía lo mismo para todo el mundo: el varón del
 * atlas, 1,714 m. Una persona de 1,60 y otra de 1,90 veían **el mismo cuerpo** haciendo su
 * sentadilla, y la geometría de un ejercicio depende de cuánto mides.
 *
 * Esto prueba las dos mitades de la costura, y la segunda es la que suele faltar:
 *
 *  1. Que el salón le pasa al visor la estatura de la ficha, y que **sin medida no le pasa
 *     nada** —para que el defecto lo decida el visor y no esta pantalla—.
 *  2. Que esa estatura de verdad CAMBIA EL CUERPO. Pasar un número que nadie usa es el
 *     fallo que no da rojo: la prop viaja, nadie la mira, y la foto sale igual.
 *
 * El visor se sustituye por un espía porque jsdom no tiene WebGL; lo que dibuja cada juego
 * lo vigila `juegoDeHuesos.test.ts` y lo que hace el escalado, `estatura.test.ts`.
 */

const espia = vi.hoisted(() => ({ recibidas: [] as Record<string, unknown>[] }))

vi.mock('../visor/VisorPatron', () => ({
  VisorPatron: (props: Record<string, unknown>) => {
    espia.recibidas.push(props)
    return null
  },
}))

function montarSalon(estaturaCm: number | undefined) {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const sesion = microciclo.sesiones.find((s) => s.ejercicios.length > 0)
  const hoy = hoyIso()
  const datos: DatosRuta = {
    microcicloNumero: microciclo.numero,
    sesionesRegistradas: 0,
    sesionesTotales: microciclo.sesiones.length,
    seriesPorGrupo: cargaPorGrupo(microciclo).map((g) => g.seriesPautadas),
  }
  const requisitos = requisitosParaPeldano(2, datos)
  render(
    <MemoryRouter>
      <SalonEntrenar
        microciclo={microciclo}
        ruta={db.ruta.byUsuario(usuario.id)}
        recuperacion={indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)}
        progresoPct={progresoAlSiguiente(requisitos)}
        estadisticas={estadisticasCalculadas(datos)}
        competencias={competenciasCalculadas(datos)}
        requisitos={requisitos}
        semana={armarSemana(microciclo, hoy)}
        notas={notasDelMicrociclo(microciclo)}
        sesion={sesion}
        estaturaCm={estaturaCm}
      />
    </MemoryRouter>,
  )
}

const ultimaEstatura = (): unknown =>
  espia.recibidas.length ? espia.recibidas[espia.recibidas.length - 1].estaturaCm : undefined

describe('la estatura de la ficha llega al visor', () => {
  beforeEach(() => {
    espia.recibidas = []
  })

  it('la pasa tal cual', () => {
    montarSalon(163)
    expect(espia.recibidas.length).toBeGreaterThan(0)
    expect(ultimaEstatura()).toBe(163)
  })

  it('sin medida NO pasa nada, para que el defecto lo decida el visor', () => {
    // No medido no es cero ni «lo que suele medir la gente». Si el salón mandara un número
    // inventado, el visor no tendría forma de saber que no lo es.
    montarSalon(undefined)
    expect(espia.recibidas.length).toBeGreaterThan(0)
    expect(ultimaEstatura()).toBeUndefined()
  })
})

describe('y esa estatura cambia el cuerpo de verdad', () => {
  /** Del punto más bajo al más alto del esqueleto, más la planta: la talla del muñeco. */
  function tallaDelSujeto(estaturaCm: number | undefined): number {
    const juego = estaturaCm === undefined ? JUEGOS.hombre : juegoParaEstatura(JUEGOS.hombre, estaturaCm)
    const esq = resolver({}, [0, 0, 0], [0, 0, 0], esqueletoConJuego(juego))
    let alto = -Infinity
    let bajo = Infinity
    for (const hueso of Object.keys(esq.mundo)) {
      for (const t of [0, 1]) {
        const y = puntoDeHueso(esq, hueso, t)[1]
        alto = Math.max(alto, y)
        bajo = Math.min(bajo, y)
      }
    }
    return alto - bajo + juego.planta
  }

  it('el de 1,60 y el de 1,90 dejan de ser el mismo muñeco', () => {
    // El fallo que no da rojo sería que la prop viajara y nadie la mirara. Esto lo caza:
    // se compara el cuerpo que sale, no el número que entra.
    expect(tallaDelSujeto(160)).toBeCloseTo(1.6, 2)
    expect(tallaDelSujeto(190)).toBeCloseTo(1.9, 2)
    expect(tallaDelSujeto(190) - tallaDelSujeto(160)).toBeGreaterThan(0.28)
  })

  it('sin estatura, el muñeco es el del atlas y no ha cambiado nada', () => {
    expect(tallaDelSujeto(undefined)).toBeCloseTo(JUEGOS.hombre.coronilla, 2)
  })
})
