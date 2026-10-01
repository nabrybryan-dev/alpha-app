import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HallazgoMercadeo } from '../../../domain/hallazgosMercadeo'

const est = {
  lectura: { ok: true, datos: [] } as { ok: true; datos: HallazgoMercadeo[] } | { ok: false; error: string },
  lecturas: 0,
}
type Resultado = { ok: true; id: string } | { ok: false; error: string }
const comentar = vi.fn<(id: string, texto: string) => Promise<Resultado>>(async () => ({ ok: true, id: 'c' }))

vi.mock('../../../data/consola/mercadeoHallazgos', () => ({
  hallazgosDeMercadeo: () => {
    est.lecturas += 1
    return Promise.resolve(est.lectura)
  },
  comentarHallazgo: (id: string, texto: string) => comentar(id, texto),
  TEXTO_PENDIENTE_0103: 'Pendiente de activar (migración 0103)',
  esTablaAusente0103: (e: string) => /does not exist/.test(e),
}))

const { InvestigacionInteractiva } = await import('./InvestigacionInteractiva')

const h = (o: Partial<HallazgoMercadeo> = {}): HallazgoMercadeo => ({
  id: 'h1', codigo: 'H-01', tipo: 'hook', titulo: 'Pregunta directa al inicio', resumen: 'Resumen de prueba del hallazgo',
  fuenteNombre: 'Cuenta pública de ejemplo', fuenteUrl: 'https://ejemplo.test/reel/1', fuenteFecha: '2026-09-29', estado: 'nuevo',
  comentarios: [], ...o,
})

beforeEach(() => {
  est.lectura = { ok: true, datos: [h()] }
  est.lecturas = 0
  comentar.mockClear()
})

describe('InvestigacionInteractiva', () => {
  it('agrupa de lo macro a lo micro y dice FALTA en un tipo sin hallazgos', async () => {
    render(<InvestigacionInteractiva puede />)
    await screen.findByRole('region', { name: 'Hooks (ganchos de texto)' })
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Tendencias',
      'Estructura de videos',
      'Loops',
      'Hooks (ganchos de texto)',
      'Ganchos visuales',
    ])
    expect(within(screen.getByRole('region', { name: 'Loops' })).getByText(/^FALTA: sin hallazgos/)).toBeInTheDocument()
  })

  it('sin el permiso no se hace ni una consulta y dice qué permiso falta', () => {
    render(<InvestigacionInteractiva puede={false} />)
    expect(screen.getByText(/permiso de responder mercadeo/)).toBeInTheDocument()
  })

  it('un hallazgo muestra fuente y estado; Manuela comenta y la lista se vuelve a leer', async () => {
    const u = userEvent.setup()
    render(<InvestigacionInteractiva puede />)
    const tipo = await screen.findByRole('region', { name: 'Hooks (ganchos de texto)' })
    await u.click(within(tipo).getByRole('button', { name: /Hooks/ }))
    await u.click(within(tipo).getByRole('button', { name: /Pregunta directa al inicio/ }))
    expect(within(tipo).getByText(/Cuenta pública de ejemplo/)).toBeInTheDocument()
    expect(within(tipo).getByRole('link', { name: 'Ver el original' })).toHaveAttribute('href', 'https://ejemplo.test/reel/1')
    expect(within(tipo).getByText(/Todavía nadie lo comentó/)).toBeInTheDocument()
    await u.type(within(tipo).getByLabelText(/Tu comentario para el agente/), 'Pruébalo con una cifra')
    await u.click(within(tipo).getByRole('button', { name: 'Comentar' }))
    expect(comentar).toHaveBeenCalledWith('h1', 'Pruébalo con una cifra')
    await waitFor(() => expect(est.lecturas).toBe(2))
    // La fila sigue abierta después de releer.
    expect(within(tipo).getByLabelText(/Tu comentario para el agente/)).toBeInTheDocument()
  })

  it('un comentario con un contacto no se envía y dice por qué', async () => {
    const u = userEvent.setup()
    render(<InvestigacionInteractiva puede />)
    const tipo = await screen.findByRole('region', { name: 'Hooks (ganchos de texto)' })
    await u.click(within(tipo).getByRole('button', { name: /Hooks/ }))
    await u.click(within(tipo).getByRole('button', { name: /Pregunta directa al inicio/ }))
    await u.type(within(tipo).getByLabelText(/Tu comentario para el agente/), 'escríbele a alguien@ejemplo.test')
    await u.click(within(tipo).getByRole('button', { name: 'Comentar' }))
    expect(comentar).not.toHaveBeenCalled()
    expect(within(tipo).getByRole('alert')).toHaveTextContent(/@/)
  })

  it('si la base rechaza, se dice y lo escrito se conserva', async () => {
    const u = userEvent.setup()
    comentar.mockResolvedValueOnce({ ok: false, error: 'no puedes comentar' })
    render(<InvestigacionInteractiva puede />)
    const tipo = await screen.findByRole('region', { name: 'Hooks (ganchos de texto)' })
    await u.click(within(tipo).getByRole('button', { name: /Hooks/ }))
    await u.click(within(tipo).getByRole('button', { name: /Pregunta directa al inicio/ }))
    const campo = within(tipo).getByLabelText(/Tu comentario para el agente/)
    await u.type(campo, 'Mi idea')
    await u.click(within(tipo).getByRole('button', { name: 'Comentar' }))
    expect(await within(tipo).findByRole('alert')).toHaveTextContent('no puedes comentar')
    expect(campo).toHaveValue('Mi idea')
  })

  it('muestra el hilo con la respuesta del agente y cuenta lo que el agente no contestó', async () => {
    const u = userEvent.setup()
    est.lectura = {
      ok: true,
      datos: [
        h({
          estado: 'en_discusion',
          comentarios: [
            { id: 'a', hallazgoId: 'h1', autor: 'manuela', texto: 'Primera idea', enRespuestaA: null, creadoEn: '2026-09-30T10:00:00Z' },
            { id: 'b', hallazgoId: 'h1', autor: 'agente', texto: 'Lo probé y sube', enRespuestaA: 'a', creadoEn: '2026-09-30T11:00:00Z' },
            { id: 'c', hallazgoId: 'h1', autor: 'bryan', texto: 'Otra idea', enRespuestaA: null, creadoEn: '2026-09-30T12:00:00Z' },
          ],
        }),
      ],
    }
    render(<InvestigacionInteractiva puede />)
    const tipo = await screen.findByRole('region', { name: 'Hooks (ganchos de texto)' })
    await u.click(within(tipo).getByRole('button', { name: /Hooks/ }))
    expect(within(tipo).getByText(/1 sin respuesta/)).toBeInTheDocument()
    await u.click(within(tipo).getByRole('button', { name: /Pregunta directa al inicio/ }))
    expect(within(tipo).getByText('Lo probé y sube')).toBeInTheDocument()
    expect(within(tipo).getByText(/Agente de mercadeo/)).toBeInTheDocument()
    expect(within(tipo).getByText(/todavía no contestó un comentario/)).toBeInTheDocument()
  })

  it('un hallazgo descartado no ofrece comentar', async () => {
    const u = userEvent.setup()
    est.lectura = { ok: true, datos: [h({ estado: 'descartado' })] }
    render(<InvestigacionInteractiva puede />)
    const tipo = await screen.findByRole('region', { name: 'Hooks (ganchos de texto)' })
    await u.click(within(tipo).getByRole('button', { name: /Hooks/ }))
    await u.click(within(tipo).getByRole('button', { name: /Pregunta directa al inicio/ }))
    expect(within(tipo).queryByRole('button', { name: 'Comentar' })).toBeNull()
    expect(within(tipo).getByText(/ya no admite comentarios/)).toBeInTheDocument()
  })

  it('sin hallazgos: vacío confirmado con FALTA y quién los trae', async () => {
    est.lectura = { ok: true, datos: [] }
    render(<InvestigacionInteractiva puede />)
    expect(await screen.findByText(/FALTA: todavía el agente de mercadeo no ha cargado hallazgos/)).toBeInTheDocument()
  })

  it('sin la tabla dice «Pendiente de activar»; un fallo se ve como fallo con Reintentar', async () => {
    est.lectura = { ok: false, error: 'relation "mercadeo_hallazgos" does not exist' }
    const a = render(<InvestigacionInteractiva puede />)
    expect(await screen.findByText('Pendiente de activar (migración 0103)')).toBeInTheDocument()
    a.unmount()
    est.lectura = { ok: false, error: 'red caída' }
    render(<InvestigacionInteractiva puede />)
    expect(await screen.findByText(/red caída/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument()
  })
})
