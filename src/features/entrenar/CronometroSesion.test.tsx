/**
 * Tests del cronómetro de sesión, escritos ANTES de cambiarlo.
 *
 * No tenía ninguno, y su valor no es solo decorativo: `TestPostSesion` lo lee para
 * la `duracionMin` que sube al servidor, y el coach programa el microciclo siguiente
 * mirando esas duraciones.
 *
 * Los cuatro primeros documentan el comportamiento ACTUAL y tienen que pasar igual
 * antes y después. Los dos últimos describen el fallo que se va a corregir y nacen
 * ROJOS a propósito: un cronómetro abierto hace días seguía contando y llegó a
 * mostrar `156:20:13` en pantalla.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CronometroSesion, leerTiempoCrono, limpiarCronometro } from './CronometroSesion'

const SESION = 's-prueba'
const CLAVE = `alpha-crono-${SESION}`
const BASE = new Date('2026-07-30T10:00:00Z').getTime()

let ahora = BASE

/** Deja guardado un cronómetro que arrancó hace `segundos` y sigue corriendo. */
function guardarCorriendo(segundos: number) {
  localStorage.setItem(
    CLAVE,
    JSON.stringify({ acumuladoSeg: 0, desdeEpoch: ahora - segundos * 1000 }),
  )
}

describe('cronómetro de sesión', () => {
  beforeEach(() => {
    localStorage.clear()
    ahora = BASE
    vi.spyOn(Date, 'now').mockImplementation(() => ahora)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('sin nada guardado arranca en cero', () => {
    render(<CronometroSesion sesionId={SESION} />)
    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })

  it('continúa desde donde iba si la sesión se retomó hace un rato', () => {
    guardarCorriendo(20 * 60) // 20 minutos
    render(<CronometroSesion sesionId={SESION} />)
    expect(screen.getByText('00:20:00')).toBeInTheDocument()
  })

  it('leerTiempoCrono devuelve los segundos del cronómetro guardado', () => {
    guardarCorriendo(90)
    expect(leerTiempoCrono(SESION)).toBe(90)
  })

  it('limpiarCronometro lo borra', () => {
    guardarCorriendo(90)
    limpiarCronometro(SESION)
    expect(localStorage.getItem(CLAVE)).toBeNull()
    expect(leerTiempoCrono(SESION)).toBe(0)
  })

  // ── El fallo que se corrige ────────────────────────────────────────────────
  // Alguien abre una sesión por error un lunes y no la cierra. El jueves entra a
  // entrenar de verdad: el cronómetro lleva contando 3 días.

  it('un cronómetro abierto hace días arranca de nuevo, no muestra el tiempo acumulado', () => {
    guardarCorriendo(3 * 24 * 3600) // 3 días
    render(<CronometroSesion sesionId={SESION} />)
    expect(screen.getByText('00:00:00')).toBeInTheDocument()
  })

  it('y la duración que sube al servidor tampoco arrastra esos días', () => {
    guardarCorriendo(3 * 24 * 3600)
    // Lo que se lee es el tiempo de AHORA, no el de la sesión abandonada.
    expect(leerTiempoCrono(SESION)).toBeLessThan(60)
  })

  it('una sesión larga pero plausible SÍ se conserva', () => {
    guardarCorriendo(2 * 3600) // 2 horas: duro, pero es un entreno real
    render(<CronometroSesion sesionId={SESION} />)
    expect(screen.getByText('02:00:00')).toBeInTheDocument()
  })
})
