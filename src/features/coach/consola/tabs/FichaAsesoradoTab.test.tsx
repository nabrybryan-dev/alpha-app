import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Supabase falso para `planes_estrategicos`, mismo patrón de
 * `AgentesTab.test.tsx` / `ConsultasPage.test.tsx`: se mockea en la capa más
 * baja para probar el camino real de `planVigente`.
 */
interface Resultado {
  data: unknown | null
  error: { message: string } | null
}

const nube = {
  activo: true,
  fila: null as Record<string, unknown> | null,
}

function cliente() {
  return {
    from: (tabla: string) => {
      if (tabla !== 'planes_estrategicos') throw new Error(`tabla inesperada: ${tabla}`)
      const b = {
        select: () => b,
        eq: () => b,
        maybeSingle: (): Promise<Resultado> => Promise.resolve({ data: nube.fila, error: null }),
      }
      return b
    },
  }
}

vi.mock('../../../../data/supabase', () => ({
  get modoNube() {
    return nube.activo
  },
  supabase: () => cliente(),
}))

// Import DINÁMICO y después del mock a propósito (igual que ConsultasPage.test.tsx):
// un `import` estático se iza por encima de `const nube`, y `dbInstance` lee
// `modoNube` al cargarse — con un `import` normal revienta "Cannot access 'nube'
// before initialization". El dinámico corre en el orden textual real.
const { db } = await import('../../../../data/dbInstance')
const { FichaAsesoradoTab } = await import('./FichaAsesoradoTab')

describe('FichaAsesoradoTab · Plan estratégico', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    nube.activo = true
    nube.fila = null
  })

  it('sin plan vigente, lo dice en vez de mostrar una tarjeta vacía', async () => {
    const usuarioId = db.usuarios.entrenan()[0].id
    nube.fila = null
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)
    await waitFor(() => expect(screen.getByText('Sin plan estratégico vigente todavía.')).toBeInTheDocument())
  })

  it('pinta el plan vigente: objetivo, métrica, horizonte y reglas reales de la forma de planes_estrategicos', async () => {
    const usuarioId = db.usuarios.entrenan()[0].id
    nube.fila = {
      id: 'plan-1',
      usuario_id: usuarioId,
      version: 3,
      vigente: true,
      contenido: {
        slug: 'alguien',
        objetivo_largo_plazo: 'recomposición con cintura y glúteo como métrica',
        metrica_principal: 'perímetro de glúteo y cintura',
        horizonte: '2026-08-19 → 2026-10-13 (7 microciclos de 8 días)',
        reglas: [{ numero: 2, nombre: 'Freno por readiness', texto: 'sueño <6 h → no sube volumen' }],
        reglas_derogadas: [],
        cabecera: [],
        filas: {},
      },
      hash: 'hash-v3',
      creado_en: '2026-09-20T12:00:00Z',
    }
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)
    await waitFor(() =>
      expect(screen.getByText('recomposición con cintura y glúteo como métrica')).toBeInTheDocument(),
    )
    expect(screen.getByText(/perímetro de glúteo y cintura/)).toBeInTheDocument()
    expect(screen.getByText(/2026-08-19/)).toBeInTheDocument()
    expect(screen.getByText('sueño <6 h → no sube volumen')).toBeInTheDocument()
    expect(screen.getByText('Plan estratégico · versión 3')).toBeInTheDocument()
  })

  it('con un contenido sin ninguno de los campos esperados, muestra el JSON crudo en vez de inventar campos', async () => {
    const usuarioId = db.usuarios.entrenan()[0].id
    nube.fila = {
      id: 'plan-2',
      usuario_id: usuarioId,
      version: 1,
      vigente: true,
      contenido: { forma_no_prevista: 'algo distinto' },
      hash: 'hash-v1',
      creado_en: '2026-09-20T12:00:00Z',
    }
    render(<FichaAsesoradoTab usuarioId={usuarioId} />)
    await waitFor(() => expect(screen.getByText('Plan estratégico · versión 1')).toBeInTheDocument())
    expect(screen.getByText(/forma_no_prevista/)).toBeInTheDocument()
  })
})
