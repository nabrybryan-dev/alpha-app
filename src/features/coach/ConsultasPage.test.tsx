import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Supabase falso: solo lo que usa la página (select encadenado y update).
 *
 * `nube` es mutable para que cada test decida qué devuelve la base sin volver
 * a montar el mock del módulo.
 */
interface Resultado {
  data: unknown[] | null
  error: { message: string } | null
}

const nube = {
  activo: true,
  lectura: { data: [] as unknown[], error: null } as Resultado,
  escritura: { data: [] as unknown[], error: null } as Resultado,
  /** Campos con los que se llamó al último update. */
  ultimoUpdate: undefined as Record<string, unknown> | undefined,
}

function cliente() {
  return {
    from(tabla: string) {
      let esUpdate = false
      const resolver = async (): Promise<Resultado> => {
        if (esUpdate) return nube.escritura
        if (tabla === 'consultas_chat') return nube.lectura
        if (tabla === 'usuarios_app') return { data: [{ id: 'u1', nombre: 'Daniela Rivera' }], error: null }
        return { data: [{ id: 'f-agujetas', titulo: 'Agujetas' }], error: null }
      }
      const b = {
        select: () => b,
        order: () => b,
        limit: () => b,
        eq: () => b,
        update: (campos: Record<string, unknown>) => {
          esUpdate = true
          nube.ultimoUpdate = campos
          return b
        },
        then: (ok: (r: Resultado) => unknown, mal?: (e: unknown) => unknown) =>
          resolver().then(ok, mal),
      }
      return b
    },
  }
}

vi.mock('../../data/supabase', () => ({
  get modoNube() {
    return nube.activo
  },
  supabase: () => cliente(),
}))

// El import va después del mock a propósito: `vi.mock` se iza, pero leerlo en
// este orden deja claro que la página siempre ve el Supabase falso.
const { default: ConsultasPage } = await import('./ConsultasPage')

function fila(p: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    usuario_id: 'u1',
    mensaje: 'Me duele la rodilla al bajar en sentadilla',
    ficha_id: 'f-agujetas',
    similitud: 0.62,
    via: 'ficha',
    bandera_roja: true,
    revisado: false,
    corregido: false,
    creado_en: '2026-07-26T10:00:00Z',
    ...p,
  }
}

describe('ConsultasPage', () => {
  beforeEach(() => {
    nube.activo = true
    nube.lectura = { data: [fila()], error: null }
    nube.escritura = { data: [fila({ revisado: true, corregido: true })], error: null }
    nube.ultimoUpdate = undefined
  })

  it('en modo demo avisa, no deja la pantalla en blanco', async () => {
    nube.activo = false
    render(<ConsultasPage />)
    expect(await screen.findByText('No se pudieron cargar las consultas')).toBeInTheDocument()
    expect(screen.getByText(/modo demo/)).toBeInTheDocument()
  })

  it('si Supabase falla al cargar, lo dice y ofrece reintentar', async () => {
    nube.lectura = { data: null, error: { message: 'conexión perdida' } }
    render(<ConsultasPage />)
    expect(await screen.findByText('No se pudieron cargar las consultas')).toBeInTheDocument()
    expect(screen.getByText(/conexión perdida/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('muestra el mensaje del asesorado y el boton de correccion sin desplegar nada', async () => {
    render(<ConsultasPage />)
    expect(await screen.findByText('Me duele la rodilla al bajar en sentadilla')).toBeInTheDocument()
    expect(screen.getByText('Daniela Rivera')).toBeInTheDocument()
    expect(screen.getByText('Agujetas')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Esto no es lo que yo habría dicho' }),
    ).toBeInTheDocument()
  })

  it('los grupos que no necesitan criterio arrancan colapsados', async () => {
    render(<ConsultasPage />)
    expect(await screen.findByRole('button', { name: /Requiere tu criterio/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('button', { name: /Con dudas/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /Resuelto/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('marcar la correccion guarda revisado y corregido', async () => {
    render(<ConsultasPage />)
    const boton = await screen.findByRole('button', { name: 'Esto no es lo que yo habría dicho' })
    await userEvent.click(boton)

    expect(nube.ultimoUpdate).toEqual({ revisado: true, corregido: true })
    // La tarjeta sale de la cola abierta: sin aviso, el coach vería
    // desaparecer lo que acaba de pulsar y no sabria si se guardo.
    expect(await screen.findByRole('status')).toHaveTextContent(/^Corregida «Me duele la rodilla/)
    expect(screen.getByRole('status')).toHaveTextContent(/pasa a Resuelto/)
  })

  it('marcar solo revisado no marca corregido', async () => {
    nube.escritura = { data: [fila({ revisado: true })], error: null }
    render(<ConsultasPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Revisado' }))

    expect(nube.ultimoUpdate).toEqual({ revisado: true })
    expect(await screen.findByRole('status')).toHaveTextContent(/^Revisada/)
  })

  it('si Supabase no confirma el cambio, NO se pinta como guardado', async () => {
    // Un UPDATE que RLS descarta no devuelve error: devuelve cero filas.
    nube.escritura = { data: [], error: null }
    render(<ConsultasPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Esto no es lo que yo habría dicho' }))

    expect(await screen.findByText(/No se guardó/)).toBeInTheDocument()
    expect(screen.queryByText('Corregida')).not.toBeInTheDocument()
    // El boton sigue ahi para volver a intentarlo.
    expect(screen.getByRole('button', { name: 'Esto no es lo que yo habría dicho' })).toBeInTheDocument()
  })

  it('si el update devuelve error, tampoco se pinta como revisado', async () => {
    nube.escritura = { data: null, error: { message: 'permiso denegado' } }
    render(<ConsultasPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Revisado' }))

    expect(await screen.findByText(/permiso denegado/)).toBeInTheDocument()
    expect(screen.queryByText('Revisada')).not.toBeInTheDocument()
  })
})
