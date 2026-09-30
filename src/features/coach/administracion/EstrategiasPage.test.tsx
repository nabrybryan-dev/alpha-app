import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ultimoCortePorSeccion, type SeccionLeida } from '../../../domain/adminTablero'

const estado = {
  lectura: { ok: true, datos: ultimoCortePorSeccion([]) } as { ok: true; datos: SeccionLeida[] } | { ok: false; error: string },
  rol: 'nutricionista',
  capacidades: new Set<string>(['responder_mercadeo', 'revisar_creadores']),
  lecturas: 0,
}
vi.mock('../../../data/consola/adminTablero', () => ({
  adminTablero: () => {
    estado.lecturas += 1
    return Promise.resolve(estado.lectura)
  },
}))
vi.mock('../consola/useCapacidades', () => ({
  useCapacidades: () => ({ cargando: false, tiene: (c: string) => estado.capacidades.has(c), usuarioId: 'u' }),
}))
vi.mock('../../../app/SessionProvider', () => ({
  useSesionOpcional: () => ({ usuario: { id: 'u', nombre: 'X', rol: estado.rol, avatarIniciales: 'X' } }),
}))
vi.mock('../creadores/BuzonMercadeo', () => ({
  BuzonMercadeo: () => <section aria-label="Buzón de mercadeo">Preguntas del agente</section>,
}))

const { default: EstrategiasPage } = await import('./EstrategiasPage')
const PENDIENTE = 'Pendiente de activar (migración 0102)'

const montar = () =>
  render(
    <MemoryRouter>
      <EstrategiasPage />
    </MemoryRouter>,
  )
const nombres = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))

beforeEach(() => {
  estado.lectura = { ok: true, datos: ultimoCortePorSeccion([]) }
  estado.rol = 'nutricionista'
  estado.capacidades = new Set(['responder_mercadeo', 'revisar_creadores'])
  estado.lecturas = 0
  window.localStorage.clear()
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never
})

describe('EstrategiasPage · orden de Bryan', () => {
  it('mercadeo, investigación, influencers y creadores evaluados, bola de nieve', async () => {
    montar()
    await screen.findByRole('region', { name: 'Mercadeo' })
    expect(nombres()).toEqual([
      'Mercadeo',
      'Investigación del agente',
      'Creadores evaluados',
      'Influencers (bola de nieve)',
      'Bola de nieve',
    ])
    expect(screen.getByText(/estrategias en uso, ganchos, loops, estructura de videos y tendencias/i)).toBeInTheDocument()
  })

  it('Investigación reutiliza el buzón de mercadeo y solo lo monta al abrir la tarjeta', async () => {
    const u = userEvent.setup()
    montar()
    const inv = await screen.findByRole('region', { name: 'Investigación del agente' })
    expect(screen.queryByText('Preguntas del agente')).toBeNull()
    await u.click(within(inv).getByRole('button', { name: /Investigación del agente/ }))
    expect(within(inv).getByText('Preguntas del agente')).toBeInTheDocument()
  })

  it('sin responder_mercadeo el buzón no se monta: dice qué permiso falta', async () => {
    const u = userEvent.setup()
    estado.capacidades = new Set(['revisar_creadores'])
    montar()
    const inv = await screen.findByRole('region', { name: 'Investigación del agente' })
    await u.click(within(inv).getByRole('button', { name: /Investigación del agente/ }))
    expect(within(inv).queryByText('Preguntas del agente')).toBeNull()
    expect(within(inv).getByText(/permiso de responder mercadeo/)).toBeInTheDocument()
  })

  it('creadores y bola de nieve enlazan al tablero solo con revisar_creadores', async () => {
    const u = userEvent.setup()
    montar()
    const c = await screen.findByRole('region', { name: 'Creadores evaluados' })
    await u.click(within(c).getByRole('button', { name: /Creadores evaluados/ }))
    expect(within(c).getByRole('link', { name: /tablero de creadores/ })).toHaveAttribute('href', '/coach/creadores')
    const b = screen.getByRole('region', { name: 'Bola de nieve' })
    await u.click(within(b).getByRole('button', { name: /Bola de nieve/ }))
    expect(within(b).getByRole('link', { name: /tablero de creadores/ })).toHaveAttribute('href', '/coach/creadores')
  })

  it('sin revisar_creadores no hay enlace a una puerta cerrada', async () => {
    const u = userEvent.setup()
    estado.capacidades = new Set(['responder_mercadeo'])
    montar()
    const b = await screen.findByRole('region', { name: 'Bola de nieve' })
    await u.click(within(b).getByRole('button', { name: /Bola de nieve/ }))
    expect(within(b).queryByRole('link')).toBeNull()
  })

  it('sin ver_administracion las secciones del tablero dicen «Pendiente de activar» y no se lee la tabla', async () => {
    montar()
    const m = await screen.findByRole('region', { name: 'Mercadeo' })
    expect(within(m).getByText(PENDIENTE)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Influencers (bola de nieve)' })).getByText(PENDIENTE)).toBeInTheDocument()
    expect(estado.lecturas).toBe(0)
  })

  it('con permiso y sin tabla también dice «Pendiente»', async () => {
    estado.capacidades.add('ver_administracion')
    estado.lectura = { ok: false, error: 'mercadeo: relation "admin_tablero" does not exist' }
    montar()
    const m = await screen.findByRole('region', { name: 'Mercadeo' })
    expect(await within(m).findByText(PENDIENTE)).toBeInTheDocument()
  })

  it('con permiso y sin corte: la tarjeta de mercadeo dice FALTA, nunca 0', async () => {
    estado.capacidades.add('ver_administracion')
    montar()
    const m = await screen.findByRole('region', { name: 'Mercadeo' })
    expect(await within(m).findByText('FALTA')).toBeInTheDocument()
    expect(within(m).queryByText('0')).toBeNull()
  })
})
