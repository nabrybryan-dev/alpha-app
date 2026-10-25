import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, hoyIso } from '../../../data/dbInstance'
import { cargaPorGrupo } from '../../../domain/fatiga'
import { notasDelMicrociclo } from '../../../domain/notasDeLaSemana'
import { requisitosParaPeldano } from '../../../domain/nivelesAlfa'
import { indiceRecuperacion } from '../../../domain/readiness'
import {
  armarSemana,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  type DatosRuta,
} from '../../../domain/rutaEntrenamiento'
import type { EjercicioPrescrito, Sesion } from '../../../domain/types'
import { SalonEntrenar } from './SalonEntrenar'

/**
 * EL SALON ABRE EN EL CUERPO (sujeto de Blender) Y EL MOVIMIENTO SIGUE ENTERO.
 *
 * El visor se sustituye por uno de mentira que apunta las propiedades que recibe: lo que se
 * comprueba aqui es QUE LE LLEGA al visor desde el salon. Que el cuerpo se vea es cosa del
 * ojo (jsdom no tiene WebGL).
 */
const recibidas: Record<string, unknown>[] = []
vi.mock('../visor/VisorPatron', () => ({
  VisorPatron: (props: Record<string, unknown>) => {
    recibidas.push(props)
    return <canvas data-testid="visor-falso" />
  },
}))

type Tinte = Record<string, { k: number; dolor: boolean }>
type PropsDelVisor = Record<string, unknown> & { cuerpo?: { capa: string; tinte: Tinte } }
const ultimas = () => recibidas[recibidas.length - 1] as PropsDelVisor

function montar(opciones: { dolor?: { dolor: number; dolorDonde: string }; seriesHechas?: number } = {}) {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const base = microciclo.sesiones.find((s) => s.ejercicios.length > 0)!
  const hechas = opciones.seriesHechas ?? 0
  // Una sesion de fuerza con un remo con `hechas` series anotadas: lo unico que tine el cuerpo.
  const ejercicio = {
    ...base.ejercicios[0],
    categoria: 'TRACCIÓN HORIZONTAL',
    nombre: 'Remo con barra',
    series: Array.from({ length: hechas }, (_, i) => ({ orden: i + 1, cargaKg: 40 })),
  } as unknown as EjercicioPrescrito
  const sesion: Sesion = { ...base, ejercicios: [ejercicio] }
  const ruta = db.ruta.byUsuario(usuario.id)
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
        microciclo={{ ...microciclo, sesiones: [sesion] }}
        ruta={ruta}
        recuperacion={indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)}
        progresoPct={progresoAlSiguiente(requisitos)}
        estadisticas={estadisticasCalculadas(datos)}
        competencias={competenciasCalculadas(datos)}
        requisitos={requisitos}
        semana={armarSemana(microciclo, hoy)}
        notas={notasDelMicrociclo(microciclo)}
        sesion={sesion}
        dolorDeHoy={opciones.dolor}
      />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  recibidas.length = 0
  localStorage.clear()
})

describe('la vista de cuerpo es la portada', () => {
  it('abre en el cuerpo, en la capa Musculo, y el visor recibe el tinte', () => {
    montar({ seriesHechas: 3 })
    const cuerpo = ultimas().cuerpo!
    expect(cuerpo, 'el visor no recibio la vista de cuerpo').toBeDefined()
    expect(cuerpo.capa).toBe('musculo')
    expect(cuerpo.tinte.dors).toEqual({ k: 1, dolor: false })
    expect(cuerpo.tinte.bic.k).toBeCloseTo(0.3 + 0.7 * (1.5 / 3)) // secundaria: la mitad
    expect(cuerpo.tinte.pecho).toEqual({ k: 0, dolor: false })
    expect(screen.getByText('Dorsal 3 · Deltoides 1,5 · Bíceps 1,5')).toBeInTheDocument()
  })

  it('las capas Piel y Hueso llegan al visor', () => {
    montar({ seriesHechas: 1 })
    fireEvent.click(screen.getByRole('radio', { name: 'Hueso' }))
    expect(ultimas().cuerpo!.capa).toBe('hueso')
    fireEvent.click(screen.getByRole('radio', { name: 'Piel' }))
    expect(ultimas().cuerpo!.capa).toBe('piel')
  })

  it('el dolor del check-in llega al visor en rojo y se lee en su linea', () => {
    montar({ seriesHechas: 1, dolor: { dolor: 7, dolorDonde: 'el hombro' } })
    expect(ultimas().cuerpo!.tinte.delt.dolor).toBe(true)
    expect(screen.getByText(/Te duele: Deltoides/)).toBeInTheDocument()
  })

  it('un dolor bajo (menos de 4) no pinta nada', () => {
    montar({ seriesHechas: 1, dolor: { dolor: 3, dolorDonde: 'el hombro' } })
    expect(ultimas().cuerpo!.tinte.delt.dolor).toBe(false)
    expect(screen.queryByText(/Te duele/)).toBeNull()
  })

  it('sin series anotadas no se inventa tinte', () => {
    montar({ seriesHechas: 0 })
    expect(Object.values(ultimas().cuerpo!.tinte).every((t) => t.k === 0)).toBe(true)
    expect(screen.getByText('Aún no hay series anotadas')).toBeInTheDocument()
  })
})

describe('el movimiento sigue entero detras de «Ver el movimiento» (relevo sin perdidas)', () => {
  it('sin vista de cuerpo, el visor recibe lo mismo que recibia antes: sala, tempo, cifras, fantasma, orbita con un dedo', () => {
    montar({ seriesHechas: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Ver el movimiento' }))
    const p = ultimas()
    expect(p.cuerpo).toBeUndefined()
    expect(p.conSala).toBe(true)
    expect(p.tempo).toEqual({ excentricaSeg: expect.any(Number) })
    expect(p.cifras).toBeDefined()
    expect('fantasma' in p).toBe(true)
    expect(p.patron).toBeDefined()
    expect(p.nombreEjercicio).toBe('Remo con barra')
    expect(p.w).toBe(0)
    expect(typeof p.alMirar).toBe('function')
    expect(screen.queryByRole('radiogroup', { name: 'Capas del cuerpo' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver el cuerpo' }))
    expect(ultimas().cuerpo).toBeDefined()
  })

  it('el panel de abajo (la hoja con lo largo) y la tira de ejercicios siguen en las dos vistas', () => {
    montar({ seriesHechas: 1 })
    expect(document.querySelector('[data-hueco="panelInferior"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver el movimiento' }))
    expect(document.querySelector('[data-hueco="panelInferior"]')).not.toBeNull()
  })

  it('en el cuerpo no se pintan los cuadros de la pared (caerian detras de la cabeza), pero en el movimiento vuelven', () => {
    montar({ seriesHechas: 1 })
    expect(document.querySelector('[data-hueco="paredes"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver el movimiento' }))
    expect(document.querySelector('[data-hueco="paredes"]')).not.toBeNull()
  })

  it('el salon es una sala oscura en los dos temas: lo que se lee encima usa los tokens oscuros', () => {
    montar({ seriesHechas: 1 })
    expect(document.querySelector('[data-salon="entrenar"]')?.getAttribute('data-theme')).toBe('dark')
  })

  it('arriba, en pequeno, el nombre del ejercicio y sus cifras (series · reps · descanso · RIR), tambien en el cuerpo', () => {
    montar({ seriesHechas: 1 })
    const linea = document.querySelector('[data-testigo="resumen-del-ejercicio"]') as HTMLElement
    expect(linea, 'la portada no dice que ejercicio toca').not.toBeNull()
    expect(linea.textContent).toContain('Remo con barra')
    expect(linea.textContent).toMatch(/\d+ series · \d+ reps · .+ · RIR (\d+|fallo)/i)
    // Esta dentro del hueco del cuerpo (contrato del salon: no hay texto suelto fuera de huecos).
    expect(linea.closest('[data-hueco="cuerpo"]')).not.toBeNull()
  })

  it('en la vista de movimiento no se repite: ahi lo dicen los cuadros de la pared', () => {
    montar({ seriesHechas: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Ver el movimiento' }))
    expect(document.querySelector('[data-testigo="resumen-del-ejercicio"]')).toBeNull()
  })
})
