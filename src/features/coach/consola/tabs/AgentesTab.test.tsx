import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Supabase falso, mismo patrón que `ConsultasPage.test.tsx`: se mockea el
 * cliente en la capa más baja (`data/supabase`), no el repo de lectura, para
 * probar el camino real que usa `corridasDeTodaLaCartera`.
 */
interface Resultado {
  data: unknown[] | null
  error: { message: string } | null
}

const nube = {
  activo: true,
  filas: [] as unknown[],
}

function cliente() {
  return {
    from: (tabla: string) => {
      if (tabla !== 'cadena_corridas') throw new Error(`tabla inesperada: ${tabla}`)
      const b = {
        select: () => b,
        order: (): Promise<Resultado> => Promise.resolve({ data: nube.filas, error: null }),
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

import type { Usuario } from '../../../../domain/types'

// Import DINÁMICO y después del mock a propósito (igual que ConsultasPage.test.tsx):
// un `import` estático se iza por encima de `const nube`, y `dbInstance` lee
// `modoNube` al cargarse — con un `import` normal revienta "Cannot access 'nube'
// before initialization". El dinámico corre en el orden textual real.
const { db } = await import('../../../../data/dbInstance')
const { AgentesTab } = await import('./AgentesTab')

function usuario(id: string, nombre: string): Usuario {
  return { id, nombre, rol: 'asesorado', avatarIniciales: nombre.slice(0, 2).toUpperCase() }
}

function filaCruda(extra: Record<string, unknown> = {}) {
  return {
    id: 'id-1',
    event_id: 'evento-1',
    run_id: 'run-1',
    usuario_id: 'u-1',
    semana_inicio: '2026-09-28',
    paso: 1,
    intento: 1,
    estado: 'completado',
    secuencia: 1,
    hash_artefacto: 'hash-1',
    version_reglas: 'reglas-v1',
    fecha_dato: '2026-09-28T12:00:00Z',
    fecha_recepcion: '2026-09-25T12:00:00Z',
    resumen: 'Resumen del paso',
    avisos: [],
    preguntas_pendientes: [],
    creado_en: '2026-09-28T12:00:00Z',
    ...extra,
  }
}

describe('AgentesTab', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    nube.activo = true
    nube.filas = []
  })

  it('sin ninguna fila en cadena_corridas, muestra el estado vacío honesto', async () => {
    vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([usuario('u-1', 'Persona Uno')])
    nube.filas = []
    render(<AgentesTab />)
    await waitFor(() => expect(screen.getByText(/todavía no ha sincronizado nada/i)).toBeInTheDocument())
  })

  it('pinta el estado correcto de cada paso, y "Sin dato" cuando el paso no tiene evento', async () => {
    vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([usuario('u-1', 'Persona Uno')])
    nube.filas = [
      filaCruda({ id: 'a', paso: 1, estado: 'completado' }),
      filaCruda({ id: 'b', paso: 2, estado: 'fallido', secuencia: 2 }),
      filaCruda({ id: 'c', paso: 3, estado: 'descartado', secuencia: 3 }),
      // sin paso 4: debe salir "Sin dato"
    ]
    render(<AgentesTab />)
    await waitFor(() => expect(screen.getByText('Persona Uno')).toBeInTheDocument())
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('Fallido')).toBeInTheDocument()
    expect(screen.getByText('Descartado')).toBeInTheDocument()
    expect(screen.getByText('Sin dato')).toBeInTheDocument()
  })

  it('clic en una casilla con evento muestra el resumen del paso', async () => {
    vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([usuario('u-1', 'Persona Uno')])
    nube.filas = [filaCruda({ paso: 1, resumen: 'Valoración: zona verde, sin hallazgos.' })]
    render(<AgentesTab />)
    await waitFor(() => expect(screen.getByText('Persona Uno')).toBeInTheDocument())
    expect(screen.queryByText('Valoración: zona verde, sin hallazgos.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /① Valoración/ }))
    expect(screen.getByText('Valoración: zona verde, sin hallazgos.')).toBeInTheDocument()
  })

  it('con la última recepción a más de 24 h, muestra la etiqueta "Datos atrasados"', async () => {
    vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([usuario('u-1', 'Persona Uno')])
    const hace30h = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
    nube.filas = [filaCruda({ fecha_recepcion: hace30h })]
    render(<AgentesTab />)
    await waitFor(() => expect(screen.getByText('Datos atrasados')).toBeInTheDocument())
  })

  it('con la última recepción reciente, NO muestra la etiqueta de atraso', async () => {
    vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([usuario('u-1', 'Persona Uno')])
    nube.filas = [filaCruda({ fecha_recepcion: new Date().toISOString() })]
    render(<AgentesTab />)
    await waitFor(() => expect(screen.getByText(/Datos de la cadena del/)).toBeInTheDocument())
    expect(screen.queryByText('Datos atrasados')).not.toBeInTheDocument()
  })

  it('sin preguntas pendientes, la bandeja lo dice explícitamente', async () => {
    vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([usuario('u-1', 'Persona Uno')])
    nube.filas = [filaCruda({ preguntas_pendientes: [] })]
    render(<AgentesTab />)
    await waitFor(() => expect(screen.getByText('No hay preguntas pendientes.')).toBeInTheDocument())
  })

  it('con preguntas pendientes, la bandeja las lista', async () => {
    vi.spyOn(db.usuarios, 'entrenan').mockReturnValue([usuario('u-1', 'Persona Uno')])
    nube.filas = [filaCruda({ paso: 1, preguntas_pendientes: ['¿Dolor en reposo o solo al cargar?'] })]
    render(<AgentesTab />)
    await waitFor(() => expect(screen.getByText('¿Dolor en reposo o solo al cargar?')).toBeInTheDocument())
  })
})
