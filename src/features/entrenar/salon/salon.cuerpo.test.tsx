import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
import { LOGRO_MS } from './registro/despuesDeGuardar'
import { avanceDeTransicion, TRANSICION_MS } from '../sujeto/pintura'
import type { TinteDeRegion } from '../sujeto/tinte'

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

type Tinte = Record<string, { k: number; dolor: boolean; pendiente?: boolean; trabajadaEn?: number }>
type PropsDelVisor = Record<string, unknown> & { cuerpo?: { capa: string; tinte: Tinte; ahora?: number } }
const ultimas = () => recibidas[recibidas.length - 1] as PropsDelVisor

function montar(opciones: { dolor?: { dolor: number; dolorDonde: string }; seriesHechas?: number } = {}) {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const base = microciclo.sesiones.find((s) => s.ejercicios.length > 0)!
  // Una sesion de fuerza con un remo con `hechas` series anotadas: lo unico que tine el cuerpo.
  const conHechas = (hechas: number): Sesion => {
    const ejercicio = {
      ...base.ejercicios[0],
      categoria: 'TRACCIÓN HORIZONTAL',
      nombre: 'Remo con barra',
      series: Array.from({ length: hechas }, (_, i) => ({ orden: i + 1, cargaKg: 40 })),
    } as unknown as EjercicioPrescrito
    return { ...base, ejercicios: [ejercicio] }
  }
  const sets = base.ejercicios[0].sets
  const ruta = db.ruta.byUsuario(usuario.id)
  const hoy = hoyIso()
  const datos: DatosRuta = {
    microcicloNumero: microciclo.numero,
    sesionesRegistradas: 0,
    sesionesTotales: microciclo.sesiones.length,
    seriesPorGrupo: cargaPorGrupo(microciclo).map((g) => g.seriesPautadas),
  }
  const requisitos = requisitosParaPeldano(2, datos)
  const elemento = (sesion: Sesion) => (
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
    </MemoryRouter>
  )
  const { rerender } = render(elemento(conHechas(opciones.seriesHechas ?? 0)))
  // Lo que hace la app cuando la base cambia: volver a pintar el salón con la sesión nueva.
  return { sets, conHechas: (n: number) => rerender(elemento(conHechas(n))) }
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

  it('lo que la sesión deja por trabajar llega al visor en rojo y se dice debajo', () => {
    montar({ seriesHechas: 0 })
    expect(ultimas().cuerpo!.tinte.dors.pendiente).toBe(true)
    const linea = document.querySelector('[data-testigo="por-trabajar"]')!
    expect(linea).toHaveTextContent(/falta por trabajar/)
    expect(linea.getAttribute('aria-label')).toMatch(/por trabajar: Dorsal/)
    // Y abre la hoja de regiones, donde cada pendiente lo dice.
    fireEvent.click(linea)
    const hoja = screen.getByRole('dialog', { name: 'Series por región' })
    expect(within(hoja).getByText('Dorsal').closest('li')).toHaveTextContent('Por trabajar')
  })

  it('con el ejercicio terminado no queda nada en rojo ni se dice', () => {
    montar({ seriesHechas: 8 })
    expect(ultimas().cuerpo!.tinte.dors.pendiente).toBeUndefined()
    expect(document.querySelector('[data-testigo="por-trabajar"]')).toBeNull()
  })

  it('con «Semana» no se pinta lo pendiente: la semana cuenta lo hecho', () => {
    montar({ seriesHechas: 0 })
    fireEvent.click(screen.getByRole('radio', { name: 'Semana' }))
    expect(ultimas().cuerpo!.tinte.dors.pendiente).toBeUndefined()
  })

  /**
   * LA TRANSICIÓN DEL ROJO A «TRABAJADO», DE PUNTA A PUNTA (revisión ciega del 26-oct: N1, N3).
   * Guardar la última serie del remo: el dorsal sigue rojo mientras se ve el logro, a mitad
   * de la transición va a medias y al final queda en su color. Y nada de esto avanza si el
   * salón no le pasa al visor una hora nueva en cada paso.
   */
  it('al cerrar el ejercicio, rojo durante el logro, a medias después y en su color al final', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const T0 = new Date('2026-10-26T10:00:00Z').getTime()
    vi.setSystemTime(T0)
    try {
      const { sets, conHechas } = montar({ seriesHechas: 2 })
      expect(sets, 'el seed cambió: la prueba necesita un ejercicio de 3 series').toBe(3)
      const cajon = document.querySelector('[data-cajon="serie"]') as HTMLElement
      fireEvent.keyDown(document.querySelector('[data-asidero="ficha"]') as HTMLElement, { key: 'Enter' })
      act(() => vi.advanceTimersByTime(50))
      fireEvent.click(within(cajon).getByRole('button', { name: 'RIR 2' }))
      const guardado = Date.now()
      fireEvent.click(within(cajon).getByRole('button', { name: /^Hecho tal cual/ }))
      // La base ya tiene la serie: la app vuelve a pintar el salón con el remo terminado.
      conHechas(3)

      const avance = () => {
        const c = ultimas().cuerpo!
        return avanceDeTransicion(c.tinte.dors as TinteDeRegion, c.ahora ?? Date.now())
      }
      expect(ultimas().cuerpo!.tinte.dors.pendiente).toBeUndefined()
      expect(ultimas().cuerpo!.tinte.dors.trabajadaEn).toBe(guardado + LOGRO_MS)
      expect(avance(), 'durante el logro tiene que seguir roja').toBe(0)

      act(() => vi.advanceTimersByTime(LOGRO_MS + TRANSICION_MS / 2))
      expect(avance()).toBeGreaterThan(0.3)
      expect(avance()).toBeLessThan(0.7)

      act(() => vi.advanceTimersByTime(TRANSICION_MS))
      expect(avance()).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * CON MOVIMIENTO REDUCIDO (revisión ciega, ronda 3: R1). Fue el caso que destapó N1: la
   * región se quedaba en rojo. Sin pasos: roja mientras se ve el logro y, al irse, de una vez
   * en su color.
   */
  it('con movimiento reducido: roja durante el logro y en su color de una vez al irse', () => {
    const medios = vi.spyOn(window, 'matchMedia').mockImplementation(
      (consulta: string) =>
        ({
          matches: consulta.includes('reduce'),
          media: consulta,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    )
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date('2026-10-26T10:00:00Z').getTime())
    try {
      const { conHechas } = montar({ seriesHechas: 2 })
      const cajon = document.querySelector('[data-cajon="serie"]') as HTMLElement
      fireEvent.keyDown(document.querySelector('[data-asidero="ficha"]') as HTMLElement, { key: 'Enter' })
      act(() => vi.advanceTimersByTime(50))
      fireEvent.click(within(cajon).getByRole('button', { name: 'RIR 2' }))
      fireEvent.click(within(cajon).getByRole('button', { name: /^Hecho tal cual/ }))
      conHechas(3)
      const avance = () => {
        const c = ultimas().cuerpo!
        return avanceDeTransicion(c.tinte.dors as TinteDeRegion, c.ahora ?? Date.now())
      }

      expect(avance(), 'durante el logro tiene que seguir roja').toBe(0)
      act(() => vi.advanceTimersByTime(LOGRO_MS - 100))
      expect(avance(), 'aún no se fue el logro').toBe(0)
      act(() => vi.advanceTimersByTime(200))
      expect(avance(), 'al irse el logro cambia de una vez, sin pasos').toBe(1)
    } finally {
      vi.useRealTimers()
      medios.mockRestore()
    }
  })

  it('en Piel no se dice lo que falta por trabajar, porque no se pinta', () => {
    montar({ seriesHechas: 0 })
    fireEvent.click(screen.getByRole('radio', { name: 'Piel' }))
    expect(document.querySelector('[data-testigo="por-trabajar"]')).toBeNull()
  })

  it('la región que duele no se nombra «en rojo, por trabajar»: va a rayas', () => {
    montar({ seriesHechas: 0, dolor: { dolor: 7, dolorDonde: 'la espalda alta' } })
    const linea = document.querySelector('[data-testigo="por-trabajar"]')
    expect(linea?.getAttribute('aria-label') ?? '').not.toMatch(/Dorsal/)
  })

  it('el dolor del check-in llega al visor en rojo y se lee en su linea', () => {
    montar({ seriesHechas: 1, dolor: { dolor: 7, dolorDonde: 'el hombro' } })
    expect(ultimas().cuerpo!.tinte.delt.dolor).toBe(true)
    expect(screen.getByText(/Te duele \(a rayas\): Deltoides/)).toBeInTheDocument()
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

  it('el salon sigue el tema de la persona: no fuerza data-theme (zona 8, decision de Bryan 28-oct)', () => {
    montar({ seriesHechas: 1 })
    expect(document.querySelector('[data-salon="entrenar"]')?.hasAttribute('data-theme')).toBe(false)
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

  it('el gesto W (atravesar con el dedo) no hace nada en el cuerpo: oscurecia la sala sin cambiar el cuerpo', () => {
    montar({ seriesHechas: 1 })
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    const centro = salon.querySelector('[data-hueco="centro"]') as HTMLElement
    const dedo = (tipo: string, y: number) =>
      fireEvent(centro, new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: 200, clientY: y }))
    dedo('pointerdown', 400)
    dedo('pointermove', 200)
    dedo('pointerup', 200)
    expect(salon.getAttribute('data-w')).toBe('0')
    // Y en la vista de movimiento el mismo gesto SI atraviesa (la escalera W sigue entera).
    fireEvent.click(screen.getByRole('button', { name: 'Ver el movimiento' }))
    dedo('pointerdown', 400)
    dedo('pointermove', 200)
    dedo('pointerup', 200)
    expect(salon.getAttribute('data-w')).toBe('1')
  })

  it('la franja de la lectura no recibe toques fuera de su boton: no tapa el joystick ni la camara', () => {
    montar({ seriesHechas: 1 })
    const boton = screen.getByRole('button', { name: 'Ver series por región' })
    expect(boton.className).toContain('pointer-events-auto')
    const franja = boton.parentElement as HTMLElement
    expect(franja.className).toContain('pointer-events-none')
    expect(franja.className).not.toContain('pointer-events-auto')
  })
  it('«Dar la vuelta» le pide al visor la espalda y, con otro toque, el frente', () => {
    montar({ seriesHechas: 1 })
    expect(ultimas().vuelta).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: /Dar la vuelta: ahora se ve el frente/ }))
    expect(ultimas().vuelta).toMatchObject({ azimut: 180 })
    const primera = ultimas().vuelta as { orden: number }
    // El visor reporta su cámara con alMirar; aquí se simula que llegó a la espalda.
    act(() => (ultimas().alMirar as (c: object) => void)({ azimut: 180, elevacion: 2, distancia: 5.1 }))
    fireEvent.click(screen.getByRole('button', { name: /Dar la vuelta: ahora se ve la espalda/ }))
    expect(ultimas().vuelta).toMatchObject({ azimut: 0 })
    expect((ultimas().vuelta as { orden: number }).orden).toBeGreaterThan(primera.orden)
  })
})
