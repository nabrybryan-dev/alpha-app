/**
 * «Mi entreno» del staff (maqueta «Espacios de Alpha», 28-sep): la semana, lo que toca hoy,
 * la entrada al salón y el progreso de fuerza, todo con los datos del seed de Valentina
 * mirados por alguien con rol `nutricionista`.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, hoyIso } from '../../../data/dbInstance'
import { aplicarSnapshot, instantaneaLocal, reiniciarDb } from '../../../data/mockDb'
import { datosRutaDe } from '../../../data/ruta/datosRuta'
import { armarSemana, sesionDestacada } from '../../../domain/rutaEntrenamiento'
import type { Rol } from '../../../domain/types'

const quien = { id: 'u-valentina', rol: 'nutricionista' as Rol }

vi.mock('../../../app/SessionProvider', () => {
  const sesion = () => ({
    usuario: { id: quien.id, nombre: 'Manuela Prueba', rol: quien.rol, avatarIniciales: 'MP' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  })
  return { useSesion: sesion, useSesionOpcional: sesion }
})

const { default: MiEntrenoPage } = await import('./MiEntrenoPage')

function pintar() {
  return render(
    <MemoryRouter initialEntries={['/mi-entreno']}>
      <Routes>
        <Route path="/mi-entreno" element={<MiEntrenoPage />} />
        <Route path="/entrenar" element={<p>El salón a pantalla completa</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const activo = () => db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')!

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
  quien.id = 'u-valentina'
  quien.rol = 'nutricionista'
})

describe('MiEntrenoPage', () => {
  it('pinta los siete días de la semana, cada día con su estado dicho en palabras', () => {
    pintar()
    const semana = screen.getByRole('region', { name: 'Estructura de la semana' })
    const dias = within(semana).getAllByRole('listitem')
    expect(dias).toHaveLength(7)
    // Las casillas con sesión son enlaces reales a esa sesión.
    const conSesion = armarSemana(activo(), hoyIso()).filter((d) => d.sesionId)
    const enlaces = within(semana).queryAllByRole('link')
    expect(enlaces).toHaveLength(conSesion.length)
    for (const d of conSesion) {
      expect(within(semana).getByRole('link', { name: new RegExp(d.titulo.replace(/[()]/g, '.')) })).toHaveAttribute(
        'href',
        `/entrenar/sesion/${d.sesionId}`,
      )
    }
  })

  it('«Hoy» lista los ejercicios con sus series y su RIR prescritos', () => {
    pintar()
    const destacada = sesionDestacada(armarSemana(activo(), hoyIso()))
    if (!destacada) {
      expect(screen.queryByRole('region', { name: 'Qué estás entrenando y cómo' })).not.toBeInTheDocument()
      return
    }
    const sesion = activo().sesiones.find((s) => s.id === destacada.sesionId)!
    const hoy = screen.getByRole('region', { name: 'Qué estás entrenando y cómo' })
    const primero = sesion.ejercicios[0]
    if (primero) {
      expect(within(hoy).getByText(primero.nombre)).toBeInTheDocument()
      expect(within(hoy).getAllByText(new RegExp(`${primero.sets} × .* · (RIR \\d|FALLO)`)).length).toBeGreaterThan(0)
    }
  })

  it('la tarjeta grande del salón lleva a /entrenar', () => {
    pintar()
    const salon = screen.getByRole('region', { name: 'El salón' })
    expect(within(salon).getByRole('link', { name: 'Entrar al salón' })).toHaveAttribute('href', '/entrenar')
  })

  it('el progreso es la comparación de fuerza que ya calcula la app, contra el microciclo anterior', () => {
    pintar()
    // El seed trae un microciclo cerrado con series: la comparación existe.
    const fuerza = datosRutaDe('u-valentina', activo()).progresoFuerza!
    expect(fuerza).toBeDefined()
    const region = screen.getByRole('region', { name: 'Tu progreso' })
    expect(within(region).getByText(`${fuerza.mejoraron} de ${fuerza.comparados} ejercicios subieron`)).toBeInTheDocument()
    expect(within(region).getByText(new RegExp(`frente a M${fuerza.microcicloPrevio}`))).toBeInTheDocument()
  })

  it('sin un microciclo anterior con que comparar, el progreso no se pinta', () => {
    const foto = instantaneaLocal()
    aplicarSnapshot({
      ...foto,
      microciclos: foto.microciclos.filter((m) => m.usuarioId !== 'u-valentina' || m.estado === 'activo'),
    })
    pintar()
    expect(datosRutaDe('u-valentina', activo()).progresoFuerza).toBeUndefined()
    expect(screen.queryByRole('region', { name: 'Tu progreso' })).not.toBeInTheDocument()
  })

  it('sin microciclo activo lo dice, y el salón sigue a mano', () => {
    quien.id = 'u-sin-microciclo'
    pintar()
    expect(screen.getByText('Sin microciclo activo', { selector: 'p.font-display' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Estructura de la semana' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Tu progreso' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar al salón' })).toBeInTheDocument()
  })

  it('un asesorado normal no entra: sigue yendo al salón como siempre', async () => {
    quien.rol = 'asesorado'
    pintar()
    // Se espera a saber si tiene el puesto de coach (cuenta personal de Bryan) antes de mandarlo al salón.
    expect(await screen.findByText('El salón a pantalla completa')).toBeInTheDocument()
    expect(screen.queryByText('Mi entrenamiento')).not.toBeInTheDocument()
  })

  // Regresión del PR #308 (vigente por FECHA, Bryan 19-sep). La invariante «un solo activo» ya se
  // rompió dos veces en producción; `byUsuario` ordena por número descendente, así que el `find`
  // de antes se quedaba con el de MAYOR número —la semana que viene— y la de hoy salía en blanco.
  // Esta pantalla nació después del arreglo y lo había heredado sin él.
  it('con dos activos (el de hoy y el de la semana que viene), pinta la semana de HOY', () => {
    // Fechas desde el lunes de HOY, no desde el seed: así la prueba no depende del reloj
    // (el seed vence un lunes, y ese lunes el «futuro» pasaría a ser el vigente).
    const hoy = new Date(`${hoyIso()}T00:00:00Z`)
    const lunes = new Date(hoy)
    lunes.setUTCDate(hoy.getUTCDate() - ((hoy.getUTCDay() + 6) % 7))
    const lunesSiguiente = new Date(lunes)
    lunesSiguiente.setUTCDate(lunes.getUTCDate() + 7)
    const iso = (d: Date) => d.toISOString().slice(0, 10)

    const foto = instantaneaLocal()
    const base = foto.microciclos.find((m) => m.usuarioId === 'u-valentina' && m.estado === 'activo')!
    const vigente = {
      ...base,
      fechaInicio: iso(lunes),
      cadenciaDias: 7,
    }
    const futuro = {
      ...base,
      id: `${base.id}-futuro`,
      numero: base.numero + 1,
      fechaInicio: iso(lunesSiguiente),
      cadenciaDias: 7,
      sesiones: base.sesiones.map((s) => ({ ...s, id: `${s.id}-futuro` })),
    }
    aplicarSnapshot({
      ...foto,
      microciclos: [...foto.microciclos.filter((m) => m.id !== base.id), vigente, futuro],
    })
    expect(db.microciclos.byUsuario('u-valentina').filter((m) => m.estado === 'activo')).toHaveLength(2)

    pintar()

    // Cada día es un enlace cuyo nombre empieza por su fecha («Lun 12: …»): la semana pintada se
    // reconoce por el número del lunes.
    const semana = screen.getByRole('region', { name: 'Estructura de la semana' })
    const nombres = within(semana)
      .queryAllByRole('link')
      .map((a) => a.getAttribute('aria-label') ?? a.textContent ?? '')
    expect(nombres.length).toBeGreaterThan(0)
    expect(nombres.some((n) => n.startsWith(`Lun ${lunes.getUTCDate()}:`))).toBe(true)
    expect(nombres.filter((n) => n.startsWith(`Lun ${lunesSiguiente.getUTCDate()}:`))).toEqual([])
  })
})

