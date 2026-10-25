import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { buscarRuta, resolverAcceso } from '../../app/rutas'
import { SessionProvider } from '../../app/SessionProvider'
import { TARJETAS } from '../../domain/praxis/tarjetas'
import type { Rol } from '../../domain/types'
import { TarjetasPraxis } from './TarjetasPraxis'

/**
 * LAS TARJETAS 3D DE PRAXIS (paso 8).
 *
 * No hay ninguna al abrir. Salen cuando la conversación nombra su tema, como mucho tres,
 * y llevan a una pantalla que ya existe. Con una frase de crisis se retiran y no vuelven:
 * la Quieta manda sobre cualquier atajo.
 */
function pintar(usuario?: string) {
  if (usuario) localStorage.setItem('alpha-usuario', usuario)
  const arbol = (
    <MemoryRouter initialEntries={['/praxis']}>
      <Routes>
        <Route path="/praxis" element={<TarjetasPraxis />} />
        <Route path="/bienestar" element={<p>Pantalla Bienestar</p>} />
        <Route path="/progreso" element={<p>Pantalla Progreso</p>} />
        <Route path="/chat" element={<p>Pantalla Chat</p>} />
      </Routes>
    </MemoryRouter>
  )
  return render(usuario ? <SessionProvider>{arbol}</SessionProvider> : arbol)
}

const perfil = (rol: Rol) => ({ rol, capacidades: new Set<never>() })

function reglaCss(selector: string): string {
  const css = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8')
  const i = css.indexOf(selector)
  expect(i, selector).toBeGreaterThanOrEqual(0)
  const abre = css.indexOf('{', i)
  return css.slice(abre + 1, css.indexOf('}', abre))
}

function zIndex(selector: string): string {
  return reglaCss(selector).match(/z-index:\s*([^;]+);/)?.[1].trim() ?? ''
}

function dice(texto: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent('praxis:frasa', { detail: { texto } }))
  })
}

function crisis() {
  act(() => {
    window.dispatchEvent(new CustomEvent('praxis:quieta'))
  })
}

describe('TarjetasPraxis', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('al abrir no hay ninguna tarjeta', () => {
    pintar()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('nombrar el dolor las hace salir, y el toque abre lo suyo', async () => {
    pintar()
    dice('me duele el hombro derecho')
    const dolor = screen.getByRole('button', { name: /Me duele algo/ })
    expect(screen.getByRole('button', { name: /Escribir a mi coach/ })).toBeInTheDocument()

    await userEvent.click(dolor)

    expect(screen.getByText('Pantalla Bienestar')).toBeInTheDocument()
  })

  it('«cómo voy» lleva a Progreso', async () => {
    pintar()
    dice('¿cómo voy esta semana?')
    await userEvent.click(screen.getByRole('button', { name: /¿Cómo voy\?/ }))
    expect(screen.getByText('Pantalla Progreso')).toBeInTheDocument()
  })

  it('nunca enseña más de tres', () => {
    pintar()
    dice('me duele la rodilla, quiero ver mi progreso y hablar con mi coach')
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('con una frase de crisis se retiran todas y no vuelven', () => {
    pintar()
    dice('me duele la rodilla')
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)

    crisis()

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    dice('me duele la rodilla otra vez')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('la frase más reciente reemplaza las tarjetas de la anterior', () => {
    pintar()
    dice('me duele la rodilla')
    expect(screen.getByRole('button', { name: /Me duele algo/ })).toBeInTheDocument()

    dice('quiero hacer mi check-in de hoy')

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Mi check-in/ })).toBeInTheDocument()
  })

  it('las tarjetas van por encima de la sala: si no, no se pueden pulsar', () => {
    expect(zIndex('.praxis .px-tarjetas')).toBe('var(--z-superpuesto)')
    const css = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8')
    const valor = (token: string) => Number(css.match(new RegExp(`--${token}:\\s*(\\d+);`))?.[1])
    expect(valor('z-superpuesto')).toBeGreaterThan(valor('z-hoja'))
  })

  it('al cerrar la sala no queda ninguna flotando', () => {
    pintar()
    dice('me duele la rodilla')
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)

    act(() => {
      window.dispatchEvent(new CustomEvent('praxis:sala-cerrada'))
    })

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('cada destino existe para el asesorado según la guarda real', () => {
    for (const tarjeta of Object.values(TARJETAS)) {
      const fila = buscarRuta(tarjeta.destino)
      expect(fila, tarjeta.destino).toBeDefined()
      expect(resolverAcceso(fila!, perfil('asesorado')), tarjeta.destino).toEqual({ tipo: 'entra' })
    }
  })

  it('al coach no se le pinta ninguna: sus destinos lo devuelven a la portada', () => {
    for (const tarjeta of Object.values(TARJETAS)) {
      const fila = buscarRuta(tarjeta.destino)
      expect(resolverAcceso(fila!, perfil('coach')).tipo, tarjeta.destino).not.toBe('entra')
    }

    pintar('u-bryan')
    dice('me duele la rodilla')

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
